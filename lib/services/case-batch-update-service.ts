"use server";

/**
 * Case Batch Update Service
 *
 * Handles atomic batch updates for assurance case elements.
 * Used by the JSON editor to apply multiple changes in a single transaction.
 */

import { prismaNew } from "@/lib/prisma";
import type {
	ElementRole,
	Prisma,
	ElementType as PrismaElementType,
} from "@/src/generated/prisma";
import type {
	CreateElementData,
	ElementChange,
	UpdateElementData,
} from "./json-diff-service";

/**
 * Result of a batch update operation
 */
export type BatchUpdateResult =
	| {
			success: true;
			summary: {
				created: number;
				updated: number;
				deleted: number;
			};
	  }
	| {
			success: false;
			error: string;
			conflictDetected?: boolean;
	  };

/**
 * Options for batch update
 */
export type BatchUpdateOptions = {
	/** Expected version (updatedAt timestamp) for conflict detection */
	expectedVersion?: string;
};

type CreateChange = ElementChange & { type: "create" };
type UpdateChange = ElementChange & { type: "update" };
type DeleteChange = ElementChange & { type: "delete" };
type LinkEvidenceChange = ElementChange & { type: "link_evidence" };
type UnlinkEvidenceChange = ElementChange & { type: "unlink_evidence" };

// Using Parameters to extract the transaction callback argument type
type TransactionCallback = Parameters<typeof prismaNew.$transaction>[0];
type TransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

/**
 * Validates user has EDIT permission on the case
 */
async function validateEditAccess(
	userId: string,
	caseId: string
): Promise<boolean> {
	const { canAccessCase } = await import("@/lib/permissions");
	return canAccessCase({ userId, caseId }, "EDIT");
}

/**
 * Checks if the case has been modified since expectedVersion
 */
async function checkForConflict(
	caseId: string,
	expectedVersion: string
): Promise<boolean> {
	const caseData = await prismaNew.assuranceCase.findUnique({
		where: { id: caseId },
		select: { updatedAt: true },
	});

	if (!caseData) {
		return false;
	}

	const currentVersion = caseData.updatedAt.toISOString();
	return currentVersion !== expectedVersion;
}

/**
 * Validates parent change doesn't create a circular reference
 */
async function validateNoCircularReference(
	elementId: string,
	newParentId: string
): Promise<boolean> {
	if (elementId === newParentId) {
		return false;
	}

	const descendants = await getDescendantIds(elementId);
	return !descendants.includes(newParentId);
}

/**
 * Gets all descendant IDs for an element
 */
async function getDescendantIds(elementId: string): Promise<string[]> {
	const children = await prismaNew.assuranceElement.findMany({
		where: { parentId: elementId },
		select: { id: true },
	});

	const descendantIds: string[] = [];
	for (const child of children) {
		descendantIds.push(child.id);
		const grandchildren = await getDescendantIds(child.id);
		descendantIds.push(...grandchildren);
	}

	return descendantIds;
}

/**
 * Maps element type string to Prisma enum
 */
function mapElementType(type: string): PrismaElementType {
	const normalised = type.toUpperCase().replace(/\s+/g, "_");
	const typeMap: Record<string, PrismaElementType> = {
		PROPERTY: "PROPERTY_CLAIM",
		PROPERTYCLAIM: "PROPERTY_CLAIM",
	};

	return (typeMap[normalised] ?? normalised) as PrismaElementType;
}

/**
 * Validates that all parent references in creates are valid
 */
async function validateCreateParents(
	creates: CreateChange[],
	deletes: DeleteChange[]
): Promise<string | null> {
	for (const change of creates) {
		if (!change.parentId) {
			continue;
		}

		const parentExists = await prismaNew.assuranceElement.findUnique({
			where: { id: change.parentId },
			select: { id: true },
		});
		const parentBeingCreated = creates.some(
			(c) => c.elementId === change.parentId
		);
		const parentBeingDeleted = deletes.some(
			(c) => c.elementId === change.parentId
		);

		if (!(parentExists || parentBeingCreated)) {
			return `Cannot create element with non-existent parent: ${change.parentId}`;
		}
		if (parentBeingDeleted) {
			return `Cannot create element with parent that is being deleted: ${change.parentId}`;
		}
	}

	return null;
}

/**
 * Validates that all parent moves don't create circular references
 */
async function validateUpdateParents(
	updates: UpdateChange[]
): Promise<string | null> {
	for (const change of updates) {
		const newParentId = change.data.parentId;
		if (newParentId === undefined || newParentId === null) {
			continue;
		}

		const isValid = await validateNoCircularReference(
			change.elementId,
			newParentId
		);
		if (!isValid) {
			return `Circular reference detected when moving element ${change.elementId}`;
		}
	}

	return null;
}

/**
 * Calculates the level for a property claim based on its parent
 */
async function calculateLevel(
	tx: TransactionClient,
	parentId: string | null
): Promise<number | null> {
	if (!parentId) {
		return null;
	}

	const parent = await tx.assuranceElement.findUnique({
		where: { id: parentId },
		select: { level: true, elementType: true },
	});

	if (parent?.elementType === "PROPERTY_CLAIM") {
		return (parent.level ?? 1) + 1;
	}
	return 1;
}

/**
 * Builds the data object for creating an element.
 * Evidence elements always have parentId=null (they use evidence_links instead).
 */
function buildCreateData(
	data: CreateElementData,
	caseId: string,
	parentId: string | null,
	level: number | null,
	userId: string
): Prisma.AssuranceElementUncheckedCreateInput {
	const elementType = mapElementType(data.type);
	// Evidence uses evidence_links table, not parentId
	const effectiveParentId = elementType === "EVIDENCE" ? null : parentId;

	return {
		id: data.id,
		caseId,
		elementType,
		name: data.name,
		description: data.description,
		inSandbox: data.inSandbox,
		parentId: effectiveParentId,
		role: data.role as ElementRole | null | undefined,
		assumption: data.assumption,
		justification: data.justification,
		context: data.context ?? [],
		url: data.url,
		level,
		moduleReferenceId: data.moduleReferenceId,
		moduleEmbedType: data.moduleEmbedType as "COPY" | "REFERENCE" | null,
		modulePublicSummary: data.modulePublicSummary,
		fromPattern: data.fromPattern ?? false,
		modifiedFromPattern: data.modifiedFromPattern ?? false,
		isDefeater: data.isDefeater ?? false,
		defeatsElementId: data.defeatsElementId,
		createdById: userId,
	};
}

/**
 * Applies delete operations
 */
async function applyDeletes(
	tx: TransactionClient,
	deletes: DeleteChange[]
): Promise<void> {
	for (const change of deletes) {
		await tx.assuranceElement.delete({
			where: { id: change.elementId },
		});
	}
}

/**
 * Applies create operations in dependency order
 */
async function applyCreates(
	tx: TransactionClient,
	creates: CreateChange[],
	caseId: string,
	userId: string
): Promise<void> {
	const createMap = new Map(creates.map((c) => [c.elementId, c]));
	const created = new Set<string>();

	const createOne = async (change: CreateChange): Promise<void> => {
		if (created.has(change.elementId)) {
			return;
		}

		// Create parent first if it's also being created
		if (change.parentId && createMap.has(change.parentId)) {
			const parentChange = createMap.get(change.parentId);
			if (parentChange) {
				await createOne(parentChange);
			}
		}

		// Calculate level for property claims
		let level: number | null = null;
		if (change.data.type === "PROPERTY_CLAIM" && change.parentId) {
			level = await calculateLevel(tx, change.parentId);
		}

		const createData = buildCreateData(
			change.data,
			caseId,
			change.parentId,
			level,
			userId
		);
		await tx.assuranceElement.create({ data: createData });
		created.add(change.elementId);
	};

	for (const change of creates) {
		await createOne(change);
	}
}

/**
 * Builds the data object for updating an element
 */
function buildUpdateData(data: UpdateElementData): Record<string, unknown> {
	const updateData: Record<string, unknown> = {};

	const fields: (keyof UpdateElementData)[] = [
		"name",
		"description",
		"inSandbox",
		"parentId",
		"role",
		"assumption",
		"justification",
		"context",
		"url",
		"level",
		"moduleReferenceId",
		"moduleEmbedType",
		"modulePublicSummary",
		"fromPattern",
		"modifiedFromPattern",
		"isDefeater",
		"defeatsElementId",
	];

	for (const field of fields) {
		if (data[field] !== undefined) {
			updateData[field] = data[field];
		}
	}

	return updateData;
}

/**
 * Applies update operations
 */
async function applyUpdates(
	tx: TransactionClient,
	updates: UpdateChange[]
): Promise<void> {
	for (const change of updates) {
		const updateData = buildUpdateData(change.data);

		// Recalculate level if moving a property claim
		if (change.data.parentId !== undefined && change.data.parentId !== null) {
			const element = await tx.assuranceElement.findUnique({
				where: { id: change.elementId },
				select: { elementType: true },
			});
			if (element?.elementType === "PROPERTY_CLAIM") {
				updateData.level = await calculateLevel(tx, change.data.parentId);
			}
		}

		await tx.assuranceElement.update({
			where: { id: change.elementId },
			data: updateData,
		});
	}
}

/**
 * Removes evidence links (unlinks evidence from claims)
 */
async function applyUnlinkEvidence(
	tx: TransactionClient,
	unlinks: UnlinkEvidenceChange[]
): Promise<void> {
	for (const change of unlinks) {
		await tx.evidenceLink.deleteMany({
			where: {
				evidenceId: change.evidenceId,
				claimId: change.claimId,
			},
		});
	}
}

/**
 * Creates evidence links (links evidence to claims)
 */
async function applyLinkEvidence(
	tx: TransactionClient,
	links: LinkEvidenceChange[]
): Promise<void> {
	for (const change of links) {
		// Check if link already exists to avoid duplicates
		const existing = await tx.evidenceLink.findFirst({
			where: {
				evidenceId: change.evidenceId,
				claimId: change.claimId,
			},
		});

		if (!existing) {
			await tx.evidenceLink.create({
				data: {
					evidenceId: change.evidenceId,
					claimId: change.claimId,
				},
			});
		}
	}
}

/**
 * Applies a batch of element changes atomically.
 *
 * @param userId - User performing the update
 * @param caseId - Case being updated
 * @param changes - Array of changes to apply
 * @param options - Optional settings including conflict detection
 * @returns Result indicating success/failure and summary
 */
export async function applyBatchUpdate(
	userId: string,
	caseId: string,
	changes: ElementChange[],
	options: BatchUpdateOptions = {}
): Promise<BatchUpdateResult> {
	// Validate user has EDIT permission
	const hasAccess = await validateEditAccess(userId, caseId);
	if (!hasAccess) {
		return { success: false, error: "Permission denied" };
	}

	// Check for conflict if expectedVersion is provided
	if (options.expectedVersion) {
		const hasConflict = await checkForConflict(caseId, options.expectedVersion);
		if (hasConflict) {
			return {
				success: false,
				error: "Case has been modified by another user",
				conflictDetected: true,
			};
		}
	}

	// Separate changes by type
	const deletes = changes.filter((c): c is DeleteChange => c.type === "delete");
	const creates = changes.filter((c): c is CreateChange => c.type === "create");
	const updates = changes.filter((c): c is UpdateChange => c.type === "update");
	const unlinks = changes.filter(
		(c): c is UnlinkEvidenceChange => c.type === "unlink_evidence"
	);
	const links = changes.filter(
		(c): c is LinkEvidenceChange => c.type === "link_evidence"
	);

	// Validate parent references
	const createParentError = await validateCreateParents(creates, deletes);
	if (createParentError) {
		return { success: false, error: createParentError };
	}

	const updateParentError = await validateUpdateParents(updates);
	if (updateParentError) {
		return { success: false, error: updateParentError };
	}

	try {
		await prismaNew.$transaction(async (tx) => {
			// Order: unlinks first, then deletes, creates, updates, links last
			await applyUnlinkEvidence(tx, unlinks);
			await applyDeletes(tx, deletes);
			await applyCreates(tx, creates, caseId, userId);
			await applyUpdates(tx, updates);
			await applyLinkEvidence(tx, links);

			// Update the case's updatedAt timestamp
			await tx.assuranceCase.update({
				where: { id: caseId },
				data: { updatedAt: new Date() },
			});
		});

		return {
			success: true,
			summary: {
				created: creates.length,
				updated: updates.length,
				deleted: deletes.length,
			},
		};
	} catch (error) {
		console.error("Batch update failed:", error);
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to apply batch update",
		};
	}
}
