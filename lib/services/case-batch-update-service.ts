/**
 * Case Batch Update Service
 *
 * Handles atomic batch updates for assurance case elements.
 * Used by the JSON editor to apply multiple changes in a single transaction.
 */

import type {
	CreateElementData,
	ElementChange,
	UpdateElementData,
} from "@/lib/case/tree-diff";
import { prisma } from "@/lib/prisma";
import {
	calculateLevelFromParentChain,
	enforceAssertionStatusRules,
	isSystemUserPrincipal,
} from "@/lib/services/element-service";
import { getDescendantIdsForRoots } from "@/lib/utils/tree-traversal";
import type {
	ElementRole,
	Prisma,
	ElementType as PrismaElementType,
} from "@/src/generated/prisma";

/**
 * ADR 0004 D3 write rule (author-declared, machine-proposable, never
 * machine-overwritten; AS_CITED is derived-only): validates every create
 * and update change that carries an assertionStatus value, reusing
 * element-service.ts's enforceAssertionStatusRules rather than
 * re-implementing the principal (guardAssertionStatusWrite) and value
 * (rejectDeclaredAsCited) checks — keeps the rule single-sourced across the
 * single-element route and this batch/JSON-editor path.
 */
async function validateAssertionStatusChanges(
	userId: string,
	creates: CreateChange[],
	updates: UpdateChange[]
): Promise<string | null> {
	const touchesAssertionStatus =
		creates.some((c) => c.data.assertionStatus !== undefined) ||
		updates.some((c) => c.data.assertionStatus !== undefined);

	// enforceAssertionStatusRules's principal check (guardAssertionStatusWrite)
	// depends only on the acting user, which is constant across the whole
	// batch — resolve it once instead of once per create/update that sets
	// assertionStatus.
	const isSystemUser = touchesAssertionStatus
		? await isSystemUserPrincipal(userId)
		: false;

	for (const change of creates) {
		const error = await enforceAssertionStatusRules(
			change.data.assertionStatus,
			userId,
			isSystemUser
		);
		if (error) {
			return error;
		}
	}
	for (const change of updates) {
		const error = await enforceAssertionStatusRules(
			change.data.assertionStatus,
			userId,
			isSystemUser
		);
		if (error) {
			return error;
		}
	}
	return null;
}

/**
 * Result of a batch update operation
 */
export type BatchUpdateResult =
	| {
			data: {
				summary: {
					created: number;
					updated: number;
					deleted: number;
				};
			};
	  }
	| {
			error: string;
			conflictDetected?: boolean;
	  };

/**
 * Options for batch update
 */
export interface BatchUpdateOptions {
	/** Expected version (updatedAt timestamp) for conflict detection */
	expectedVersion?: string;
}

type CreateChange = ElementChange & { type: "create" };
type UpdateChange = ElementChange & { type: "update" };
type DeleteChange = ElementChange & { type: "delete" };
type LinkEvidenceChange = ElementChange & { type: "link_evidence" };
type UnlinkEvidenceChange = ElementChange & { type: "unlink_evidence" };

// Using Parameters to extract the transaction callback argument type
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
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
 * Guards against cross-case writes through the batch endpoint (IDOR):
 * `validateEditAccess` only checks the caller has EDIT permission on the
 * target case, it never confirms the element ids in `changes` actually
 * belong to that case. Without this, a user with edit access to case A could
 * update, delete, re-parent, or evidence-link/unlink elements that live in
 * case B.
 *
 * Collects every id this batch references that is expected to ALREADY
 * exist — update/delete targets, parentIds set on updates or creates, and
 * both sides of a link/unlink evidence change — excluding ids this same
 * batch is about to create (those don't exist yet, so they can't be
 * cross-case). One batched `findMany` then rejects the WHOLE batch if any
 * referenced id is missing or belongs to a different case, so a batch is
 * atomic in its acceptance as well as its application.
 *
 * Soft-deleted elements (`deletedAt` set) are NOT excluded from the lookup:
 * every other query in this file (`fetchLevelInfo`, `validateCreateParents`)
 * already ignores `deletedAt`, and `applyDeletes` hard-deletes rows, so
 * treating a soft-deleted row as still "belonging to its case" here matches
 * how the rest of this file already behaves — it does not open a new hole,
 * and excluding them would just add an inconsistent extra rule for this one
 * validator.
 *
 * The error message names the offending id(s) but never the case they
 * actually belong to, so a caller probing for other cases' element ids
 * learns only "not in this case", not which case it's really in.
 */
async function validateElementOwnership(
	caseId: string,
	creates: CreateChange[],
	updates: UpdateChange[],
	deletes: DeleteChange[],
	links: LinkEvidenceChange[],
	unlinks: UnlinkEvidenceChange[]
): Promise<string | null> {
	const createdIds = new Set(creates.map((c) => c.elementId));

	const referencedIds = new Set<string>();
	const addIfExisting = (id: string | null | undefined) => {
		if (id && !createdIds.has(id)) {
			referencedIds.add(id);
		}
	};

	for (const change of updates) {
		addIfExisting(change.elementId);
		addIfExisting(change.data.parentId);
	}
	for (const change of deletes) {
		addIfExisting(change.elementId);
	}
	for (const change of creates) {
		addIfExisting(change.parentId);
	}
	for (const change of links) {
		addIfExisting(change.evidenceId);
		addIfExisting(change.claimId);
	}
	for (const change of unlinks) {
		addIfExisting(change.evidenceId);
		addIfExisting(change.claimId);
	}

	if (referencedIds.size === 0) {
		return null;
	}

	const ids = Array.from(referencedIds);
	const rows = await prisma.assuranceElement.findMany({
		where: { id: { in: ids } },
		select: { id: true, caseId: true },
	});
	const rowById = new Map(rows.map((r) => [r.id, r]));

	const offendingIds = ids.filter((id) => rowById.get(id)?.caseId !== caseId);
	if (offendingIds.length > 0) {
		return `Element${offendingIds.length > 1 ? "s" : ""} ${offendingIds.join(", ")} not found in this case`;
	}

	return null;
}

/**
 * Checks if the case has been modified since expectedVersion
 */
async function checkForConflict(
	caseId: string,
	expectedVersion: string
): Promise<boolean> {
	const caseData = await prisma.assuranceCase.findUnique({
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
	// One batched lookup for every parentId referenced by a create, instead
	// of one findUnique per create.
	const parentIdsToCheck = Array.from(
		new Set(
			creates.map((c) => c.parentId).filter((id): id is string => Boolean(id))
		)
	);
	const existingParents =
		parentIdsToCheck.length > 0
			? await prisma.assuranceElement.findMany({
					where: { id: { in: parentIdsToCheck } },
					select: { id: true },
				})
			: [];
	const existingParentIds = new Set(existingParents.map((p) => p.id));

	for (const change of creates) {
		if (!change.parentId) {
			continue;
		}

		const parentExists = existingParentIds.has(change.parentId);
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
 * Validates that all parent moves don't create circular references.
 *
 * Descendants for every relevant update are fetched with a single shared
 * breadth-first sweep (`getDescendantIdsForRoots`) rather than one
 * `getDescendantIds` walk per update — same self-reference/circular checks,
 * same order, same error text, just one batch of queries instead of N.
 */
async function validateUpdateParents(
	updates: UpdateChange[]
): Promise<string | null> {
	const relevant = updates.filter(
		(c) => c.data.parentId !== undefined && c.data.parentId !== null
	);
	if (relevant.length === 0) {
		return null;
	}

	const descendantsByElement = await getDescendantIdsForRoots(
		relevant.map((c) => c.elementId)
	);

	for (const change of relevant) {
		const newParentId = change.data.parentId as string;
		if (change.elementId === newParentId) {
			return `Circular reference detected when moving element ${change.elementId}`;
		}
		if (descendantsByElement.get(change.elementId)?.has(newParentId)) {
			return `Circular reference detected when moving element ${change.elementId}`;
		}
	}

	return null;
}

/**
 * Minimal shape needed to decide a child's level from its parent row —
 * `parentId` is included so a STRATEGY parent's own parent (the transparent
 * grandparent hop — see `calculateLevelFromParentChain`) can be looked up
 * from the same batched-fetch shape.
 */
interface LevelInfo {
	elementType: PrismaElementType;
	level: number | null;
	parentId: string | null;
}

/**
 * Batched replacement for calling `tx.assuranceElement.findUnique` once per
 * id: fetches {level, elementType, parentId} for every id in one
 * `findMany`. Used by `applyCreates`/`applyUpdates`/the cascade so level
 * lookups for a whole batch cost one query instead of one per element.
 */
async function fetchLevelInfo(
	tx: TransactionClient,
	ids: string[]
): Promise<Map<string, LevelInfo>> {
	if (ids.length === 0) {
		return new Map();
	}
	const rows = await tx.assuranceElement.findMany({
		where: { id: { in: ids } },
		select: { id: true, level: true, elementType: true, parentId: true },
	});
	return new Map(
		rows.map((r) => [
			r.id,
			{ level: r.level, elementType: r.elementType, parentId: r.parentId },
		])
	);
}

/**
 * For every STRATEGY entry in `parentInfoById`, batch-fetches its OWN parent
 * (the grandparent, from the child's point of view) — the extra hop
 * `calculateLevelFromParentChain` needs to apply the transparent-strategy
 * rule. Keyed by grandparent id, same shape as `fetchLevelInfo` so it can be
 * looked up alongside `parentInfoById`/`ownTypeById` interchangeably.
 */
function fetchGrandparentInfoForStrategies(
	tx: TransactionClient,
	parentInfoById: Map<string, LevelInfo>
): Promise<Map<string, LevelInfo>> {
	const grandparentIds = Array.from(
		new Set(
			Array.from(parentInfoById.values())
				.filter(
					(info): info is LevelInfo & { parentId: string } =>
						info.elementType === "STRATEGY" && Boolean(info.parentId)
				)
				.map((info) => info.parentId)
		)
	);
	return fetchLevelInfo(tx, grandparentIds);
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
		assertionStatus: data.assertionStatus,
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
	// Levels of elements created earlier in this same call, keyed by
	// elementId — populated as createOne runs (parent-before-child order is
	// required by the self-referencing FK, so creates stay per-row writes).
	const levelById = new Map<string, number | null>();

	// Parents referenced by property-claim creates that are NOT themselves
	// part of this batch: their level is fixed pre-transaction state, so
	// fetch it once for all of them instead of once per create. A second pass
	// fetches the grandparent of any of those parents that is a STRATEGY —
	// the transparent-strategy hop `calculateLevelFromParentChain` needs.
	const externalParentIds = Array.from(
		new Set(
			creates
				.filter((c) => c.data.type === "PROPERTY_CLAIM" && c.parentId)
				.map((c) => c.parentId as string)
				.filter((id) => !createMap.has(id))
		)
	);
	const externalParentInfo = await fetchLevelInfo(tx, externalParentIds);
	const externalGrandparentInfo = await fetchGrandparentInfoForStrategies(
		tx,
		externalParentInfo
	);
	const externalInfo = new Map([
		...externalParentInfo,
		...externalGrandparentInfo,
	]);

	// Resolves {elementType, level, parentId} for any id referenced by this
	// batch's creates, whether it's being created in this same call (in which
	// case its level was just computed by an earlier, parent-first `createOne`
	// call) or already exists (the pre-transaction snapshot above).
	const resolveInfo = (id: string): LevelInfo | undefined => {
		const withinBatch = createMap.get(id);
		if (withinBatch) {
			return {
				elementType: mapElementType(withinBatch.data.type),
				level: levelById.get(id) ?? null,
				parentId: withinBatch.parentId ?? null,
			};
		}
		return externalInfo.get(id);
	};

	const resolveParentLevel = (parentId: string): number => {
		const parentInfo = resolveInfo(parentId);
		const grandparentInfo =
			parentInfo?.elementType === "STRATEGY" && parentInfo.parentId
				? resolveInfo(parentInfo.parentId)
				: undefined;
		return calculateLevelFromParentChain(parentInfo, grandparentInfo);
	};

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
			level = resolveParentLevel(change.parentId);
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
		levelById.set(change.elementId, level);
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
		"assertionStatus",
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
 * Computes each moved property claim's FINAL level from the post-batch
 * parent arrangement — independent of the order updates appear in the
 * `changes` array. `moveMap` is elementId -> new parentId for every update
 * in this batch that sets a parentId. If a moved element's new parent is
 * ALSO moved within the same batch, that parent's level is resolved first
 * via memoised recursion over `moveMap` itself, so a child-move listed
 * before its parent-move (or the reverse) always lands on the parent's
 * POST-batch level rather than a stale pre-batch snapshot.
 *
 * Cycles created purely by this batch's own moves — e.g. two elements each
 * moved under the other, where neither is currently a descendant of the
 * other in the database, so `validateUpdateParents`'s pre-batch descendant
 * check can't see it — are caught here (via the `visiting` set) and
 * reported with the same "Circular reference detected" message the
 * pre-batch check uses, so callers see one consistent error shape either
 * way.
 */
function resolveFinalLevelsForBatch(
	moveMap: Map<string, string>,
	ownTypeById: Map<string, LevelInfo>,
	externalInfoById: Map<string, LevelInfo>
): Map<string, number> {
	const finalLevels = new Map<string, number>();
	const visiting = new Set<string>();

	// Static (pre-batch) info for any id this batch references, whether it's
	// one of the moved elements themselves or one of their (non-moved) new
	// parents/grandparents.
	const getInfo = (id: string): LevelInfo | undefined =>
		ownTypeById.get(id) ?? externalInfoById.get(id);

	// Resolves {elementType, level, parentId} for `id` as it will stand AFTER
	// this batch: if `id` is itself being moved and is a PROPERTY_CLAIM, its
	// level comes from `resolve` (below); otherwise it's the static snapshot.
	// Only ever recurses into `resolve` for ids already known to be
	// PROPERTY_CLAIM, so `finalLevels` never gets a spurious entry for a
	// STRATEGY (which would wrongly cause its own update to write a level).
	const resolvedInfo = (id: string): LevelInfo | undefined => {
		const info = getInfo(id);
		if (!info) {
			return undefined;
		}
		const isMovedClaim =
			moveMap.has(id) && info.elementType === "PROPERTY_CLAIM";
		return isMovedClaim ? { ...info, level: resolve(id) } : info;
	};

	const resolve = (elementId: string): number => {
		const memoised = finalLevels.get(elementId);
		if (memoised !== undefined) {
			return memoised;
		}
		if (visiting.has(elementId)) {
			throw new Error(
				`Circular reference detected when moving element ${elementId}`
			);
		}
		visiting.add(elementId);

		const newParentId = moveMap.get(elementId);
		let level = 1;
		if (newParentId) {
			const parentInfo = resolvedInfo(newParentId);
			const grandparentInfo =
				parentInfo?.elementType === "STRATEGY" && parentInfo.parentId
					? resolvedInfo(parentInfo.parentId)
					: undefined;
			level = calculateLevelFromParentChain(parentInfo, grandparentInfo);
		}

		visiting.delete(elementId);
		finalLevels.set(elementId, level);
		return level;
	};

	for (const [elementId] of moveMap) {
		if (ownTypeById.get(elementId)?.elementType === "PROPERTY_CLAIM") {
			resolve(elementId);
		}
	}

	return finalLevels;
}

/** Minimal descendant row shape `cascadeFromRoot` needs to walk a subtree. */
interface DescendantRow {
	elementType: PrismaElementType;
	id: string;
	parentId: string | null;
}

/**
 * Walks one moved property claim's PRE-batch subtree (parent-child edges
 * don't change when the claim itself moves — only its own parentId does)
 * and recomputes the level of every descendant that ISN'T itself explicitly
 * moved in this batch, propagating `rootLevel` down layer by layer.
 *
 * Stops descending (and skips writing) at any descendant that IS a
 * `moveMap` key: that element's own level comes from
 * `resolveFinalLevelsForBatch` instead, and — if it's a property claim —
 * it is itself one of the roots this function is called for, so its
 * subtree is recomputed from ITS new position via its own separate call.
 */
/**
 * One pending descendant row in `cascadeFromRoot`'s frontier walk.
 * `parentInfo`/`grandparentInfo` are the {elementType, level} of the row's
 * OWN actual parent and grandparent (not a rolling "nearest property claim"
 * anchor) — same shape `calculateLevelFromParentChain` takes everywhere
 * else, so a STRATEGY row in the middle of a subtree is transparent here
 * too: its level is computed but never used to gate its children (its
 * elementType, not its level, is what the shared rule looks at).
 */
interface CascadeFrontierEntry {
	grandparentInfo: LevelInfo | undefined;
	parentInfo: LevelInfo;
	row: DescendantRow;
}

/**
 * Processes a single descendant row for `cascadeFromRoot`: computes its
 * level via the shared `calculateLevelFromParentChain` rule, records a level
 * update when it's a property claim, and returns the next frontier entries
 * for its children — or an empty array if this row is an explicit mover in
 * `moveMap` (stop descending, per `cascadeFromRoot`'s contract).
 */
function cascadeFrontierStep(
	entry: CascadeFrontierEntry,
	childrenByParent: Map<string, DescendantRow[]>,
	moveMap: Map<string, string>,
	levelUpdates: Map<string, number>
): CascadeFrontierEntry[] {
	const { row, parentInfo, grandparentInfo } = entry;
	const isPropertyClaim = row.elementType === "PROPERTY_CLAIM";
	const level = calculateLevelFromParentChain(parentInfo, grandparentInfo);

	if (moveMap.has(row.id)) {
		return [];
	}
	if (isPropertyClaim) {
		levelUpdates.set(row.id, level);
	}

	const ownInfo: LevelInfo = {
		elementType: row.elementType,
		level,
		parentId: row.parentId,
	};
	return (childrenByParent.get(row.id) ?? []).map((child) => ({
		row: child,
		parentInfo: ownInfo,
		grandparentInfo: parentInfo,
	}));
}

function cascadeFromRoot(
	rootId: string,
	rootLevel: number,
	childrenByParent: Map<string, DescendantRow[]>,
	moveMap: Map<string, string>,
	levelUpdates: Map<string, number>
): void {
	const rootInfo: LevelInfo = {
		elementType: "PROPERTY_CLAIM" as PrismaElementType,
		level: rootLevel,
		parentId: null,
	};
	let frontier: CascadeFrontierEntry[] = (
		childrenByParent.get(rootId) ?? []
	).map((row) => ({
		row,
		parentInfo: rootInfo,
		grandparentInfo: undefined,
	}));

	while (frontier.length > 0) {
		const next: CascadeFrontierEntry[] = [];
		for (const entry of frontier) {
			next.push(
				...cascadeFrontierStep(entry, childrenByParent, moveMap, levelUpdates)
			);
		}
		frontier = next;
	}
}

/**
 * Recomputes levels for descendants of moved property claims that are NOT
 * themselves listed in `changes` — required so a moved claim's existing
 * subtree reflects its new depth regardless of update order, not just the
 * claim that was directly moved. Reuses `getDescendantIdsForRoots`
 * (tree-traversal.ts) for the shared BFS rather than a bespoke walker; runs
 * zero extra queries when no property claim is moved in this batch.
 */
async function resolveDescendantCascadeLevels(
	tx: TransactionClient,
	moveMap: Map<string, string>,
	ownTypeById: Map<string, LevelInfo>,
	finalLevels: Map<string, number>
): Promise<Map<string, number>> {
	const rootIds = Array.from(moveMap.keys()).filter(
		(id) => ownTypeById.get(id)?.elementType === "PROPERTY_CLAIM"
	);
	if (rootIds.length === 0) {
		return new Map();
	}

	const descendantsByRoot = await getDescendantIdsForRoots(rootIds, tx);
	const allDescendantIds = Array.from(
		new Set(Array.from(descendantsByRoot.values()).flatMap((ids) => [...ids]))
	);
	if (allDescendantIds.length === 0) {
		return new Map();
	}

	const rows = await tx.assuranceElement.findMany({
		where: { id: { in: allDescendantIds } },
		select: { id: true, parentId: true, elementType: true },
	});
	const childrenByParent = new Map<string, DescendantRow[]>();
	for (const row of rows) {
		if (!row.parentId) {
			continue;
		}
		const bucket = childrenByParent.get(row.parentId);
		if (bucket) {
			bucket.push(row);
		} else {
			childrenByParent.set(row.parentId, [row]);
		}
	}

	const levelUpdates = new Map<string, number>();
	for (const rootId of rootIds) {
		const rootLevel = finalLevels.get(rootId);
		if (rootLevel !== undefined) {
			cascadeFromRoot(
				rootId,
				rootLevel,
				childrenByParent,
				moveMap,
				levelUpdates
			);
		}
	}
	return levelUpdates;
}

/**
 * Writes recomputed levels for descendants that weren't themselves listed
 * in `changes` (see `resolveDescendantCascadeLevels`) — grouped into one
 * `updateMany` per distinct level value instead of one `update` per
 * descendant.
 */
async function applyCascadeLevelUpdates(
	tx: TransactionClient,
	cascadeLevels: Map<string, number>
): Promise<void> {
	if (cascadeLevels.size === 0) {
		return;
	}
	const idsByLevel = new Map<number, string[]>();
	for (const [id, level] of cascadeLevels) {
		const bucket = idsByLevel.get(level);
		if (bucket) {
			bucket.push(id);
		} else {
			idsByLevel.set(level, [id]);
		}
	}
	for (const [level, ids] of idsByLevel) {
		await tx.assuranceElement.updateMany({
			where: { id: { in: ids } },
			data: { level },
		});
	}
}

/**
 * Applies update operations
 */
async function applyUpdates(
	tx: TransactionClient,
	updates: UpdateChange[]
): Promise<void> {
	const relevantForLevel = updates.filter(
		(c) => c.data.parentId !== undefined && c.data.parentId !== null
	);

	// Each update's own elementType (never touched by buildUpdateData, so
	// it's immutable for the lifetime of this call) — one batched fetch
	// instead of one findUnique per update that moves an element.
	const ownTypeById = await fetchLevelInfo(
		tx,
		relevantForLevel.map((c) => c.elementId)
	);

	// New-parent {elementType, level} as of the start of this call, for
	// parents NOT themselves moved in this batch. Parents that ARE moved in
	// this batch resolve through `resolveFinalLevelsForBatch`'s own
	// recursion instead, so this snapshot never goes stale for them.
	const parentInfoById = await fetchLevelInfo(
		tx,
		Array.from(new Set(relevantForLevel.map((c) => c.data.parentId as string)))
	);
	// Grandparent {elementType, level} for any new parent that is a STRATEGY —
	// the transparent-strategy hop (see calculateLevelFromParentChain).
	const grandparentInfoById = await fetchGrandparentInfoForStrategies(
		tx,
		parentInfoById
	);
	const externalInfoById = new Map([...parentInfoById, ...grandparentInfoById]);
	const moveMap = new Map(
		relevantForLevel.map((c) => [c.elementId, c.data.parentId as string])
	);

	const finalLevels = resolveFinalLevelsForBatch(
		moveMap,
		ownTypeById,
		externalInfoById
	);
	const cascadeLevels = await resolveDescendantCascadeLevels(
		tx,
		moveMap,
		ownTypeById,
		finalLevels
	);

	for (const change of updates) {
		const updateData = buildUpdateData(change.data);

		if (finalLevels.has(change.elementId)) {
			updateData.level = finalLevels.get(change.elementId);
		}

		await tx.assuranceElement.update({
			where: { id: change.elementId },
			data: updateData,
		});
	}

	await applyCascadeLevelUpdates(tx, cascadeLevels);
}

/**
 * Removes evidence links (unlinks evidence from claims). Batched into a
 * single deleteMany with an OR of every (evidenceId, claimId) pair instead
 * of one deleteMany per unlink change.
 */
async function applyUnlinkEvidence(
	tx: TransactionClient,
	unlinks: UnlinkEvidenceChange[]
): Promise<void> {
	if (unlinks.length === 0) {
		return;
	}
	await tx.evidenceLink.deleteMany({
		where: {
			OR: unlinks.map((change) => ({
				evidenceId: change.evidenceId,
				claimId: change.claimId,
			})),
		},
	});
}

/**
 * Creates evidence links (links evidence to claims). `evidenceLink` has a
 * `@@unique([evidenceId, claimId])` constraint, so a single `createMany`
 * with `skipDuplicates` gets the same "create only if not already linked"
 * behaviour as the old per-item findFirst-then-create, in one query instead
 * of up to two per link.
 */
async function applyLinkEvidence(
	tx: TransactionClient,
	links: LinkEvidenceChange[]
): Promise<void> {
	if (links.length === 0) {
		return;
	}
	await tx.evidenceLink.createMany({
		data: links.map((change) => ({
			evidenceId: change.evidenceId,
			claimId: change.claimId,
		})),
		skipDuplicates: true,
	});
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
		return { error: "Permission denied" };
	}

	// Check for conflict if expectedVersion is provided
	if (options.expectedVersion) {
		const hasConflict = await checkForConflict(caseId, options.expectedVersion);
		if (hasConflict) {
			return {
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

	// IDOR guard: confirms every existing element this batch references
	// (update/delete targets, parent references, evidence links) actually
	// belongs to `caseId` — case-level EDIT access alone doesn't prove that.
	const ownershipError = await validateElementOwnership(
		caseId,
		creates,
		updates,
		deletes,
		links,
		unlinks
	);
	if (ownershipError) {
		return { error: ownershipError };
	}

	// ADR 0004 D3 write rule: assertionStatus is author-declared only — see
	// enforceAssertionStatusRules's docstring (element-service.ts) for why
	// case-level EDIT access alone isn't a sufficient gate.
	const assertionStatusError = await validateAssertionStatusChanges(
		userId,
		creates,
		updates
	);
	if (assertionStatusError) {
		return { error: assertionStatusError };
	}

	// Validate parent references
	const createParentError = await validateCreateParents(creates, deletes);
	if (createParentError) {
		return { error: createParentError };
	}

	const updateParentError = await validateUpdateParents(updates);
	if (updateParentError) {
		return { error: updateParentError };
	}

	try {
		await prisma.$transaction(async (tx) => {
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
			data: {
				summary: {
					created: creates.length,
					updated: updates.length,
					deleted: deletes.length,
				},
			},
		};
	} catch (error) {
		console.error("Batch update failed:", error);
		return {
			error:
				error instanceof Error ? error.message : "Failed to apply batch update",
		};
	}
}
