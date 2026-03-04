import { compareIdentifiers } from "@/lib/case/identifier-utils";
import { canAccessCase, getCasePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { UpdateAssuranceCaseInput } from "@/lib/schemas/assurance-case";
import type { Prisma } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

// ---------------------------------------------------------------------------
// Types (derived from Prisma query shape)
// ---------------------------------------------------------------------------

const CASE_INCLUDE = {
	elements: {
		where: { deletedAt: null },
		include: {
			children: { where: { deletedAt: null } },
			comments: true,
			evidenceLinksTo: {
				where: { evidence: { deletedAt: null } },
				include: { evidence: { include: { comments: true } } },
			},
		},
	},
	createdBy: { select: { id: true, username: true } },
} satisfies Prisma.AssuranceCaseInclude;

type CaseWithIncludes = Prisma.AssuranceCaseGetPayload<{
	include: typeof CASE_INCLUDE;
}>;
type CaseElement = CaseWithIncludes["elements"][number];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps Prisma permission levels to frontend format.
 */
function mapPermissionToFrontend(
	permission: string | null,
	isOwner: boolean
): string {
	if (isOwner) {
		return "manage";
	}
	switch (permission) {
		case "ADMIN":
			return "manage";
		case "EDIT":
			return "edit";
		case "COMMENT":
			return "comment";
		default:
			return "view";
	}
}

function buildGoalStructure(
	goal: CaseElement,
	allElements: CaseElement[]
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === goal.id);

	const strategies = children
		.filter((el) => el.elementType === "STRATEGY")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((strategy) => buildStrategyStructure(strategy, allElements, goal.id));

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(claim, allElements, goal.id, null)
		);

	return {
		id: goal.id,
		type: "goal",
		name: goal.name,
		description: goal.description || "",
		keywords: "",
		createdDate: goal.createdAt.toISOString(),
		assuranceCaseId: goal.caseId,
		context: goal.context || [],
		strategies,
		propertyClaims,
		comments: goal.comments || [],
		assumption: goal.assumption || "",
		justification: goal.justification || "",
		inSandbox: goal.inSandbox,
	};
}

function buildStrategyStructure(
	strategy: CaseElement,
	allElements: CaseElement[],
	goalId: string
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === strategy.id);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(claim, allElements, null, strategy.id)
		);

	return {
		id: strategy.id,
		type: "strategy",
		name: strategy.name,
		description: strategy.description || "",
		createdDate: strategy.createdAt.toISOString(),
		goalId,
		propertyClaims,
		comments: strategy.comments || [],
		assumption: strategy.assumption || "",
		justification: strategy.justification || "",
		context: strategy.context || [],
		inSandbox: strategy.inSandbox,
	};
}

function buildPropertyClaimStructure(
	claim: CaseElement,
	allElements: CaseElement[],
	goalId: string | null,
	strategyId: string | null
): Record<string, unknown> {
	const children = allElements.filter((el) => el.parentId === claim.id);

	// Get evidence from EvidenceLink table (evidence uses many-to-many links, not parentId)
	const linkedEvidence =
		claim.evidenceLinksTo?.map((link) => link.evidence) ?? [];

	const evidence = linkedEvidence
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((ev) => ({
			id: ev.id,
			type: "evidence",
			name: ev.name,
			description: ev.description || "",
			createdDate: ev.createdAt.toISOString(),
			URL: ev.url || "",
			urls: ev.urls || [],
			propertyClaimId: [claim.id],
			comments: ev.comments || [],
			inSandbox: ev.inSandbox,
		}));

	const nestedClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((nested) =>
			buildPropertyClaimStructure(nested, allElements, null, null)
		);

	return {
		id: claim.id,
		type: "property_claim",
		name: claim.name,
		description: claim.description || "",
		createdDate: claim.createdAt.toISOString(),
		goalId,
		strategyId,
		propertyClaimId: claim.parentId,
		level: claim.level || 1,
		claimType: "Project claim",
		propertyClaims: nestedClaims,
		evidence,
		comments: claim.comments || [],
		assumption: claim.assumption || "",
		justification: claim.justification || "",
		context: claim.context || [],
		inSandbox: claim.inSandbox,
	};
}

/**
 * Builds Prisma update data from validated input.
 */
function buildCaseUpdateData(
	body: UpdateAssuranceCaseInput
): Record<string, unknown> {
	const updateData: Record<string, unknown> = {};
	if (body.name !== undefined) {
		updateData.name = body.name;
	}
	if (body.description !== undefined) {
		updateData.description = body.description;
	}
	if (body.colourProfile !== undefined) {
		updateData.colourProfile = body.colourProfile;
	}
	if (body.layoutDirection !== undefined) {
		updateData.layoutDirection = body.layoutDirection;
	}
	return updateData;
}

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

/**
 * Fetches case data for the given user.
 * Returns the same "Permission denied" error for not-found and forbidden
 * to prevent case existence enumeration.
 */
export async function fetchCaseFromPrisma(
	caseId: string,
	userId: string
): ServiceResult<Record<string, unknown>> {
	// Check if user has access to this case (handles owner, direct, and team permissions)
	const permissionResult = await getCasePermission({
		userId,
		caseId,
	});

	if (!permissionResult.hasAccess) {
		return { error: "Permission denied" };
	}

	// Fetch the case data (exclude soft-deleted cases)
	// Note: We exclude publishedVersions query because it uses the legacy Django
	// table with bigint foreign keys that don't match new UUID case IDs.
	// For case study integration, use the Release model instead.
	const caseData = await prisma.assuranceCase.findUnique({
		where: { id: caseId, deletedAt: null },
		include: CASE_INCLUDE,
	});

	if (!caseData) {
		return { error: "Permission denied" };
	}

	// Transform Prisma data to the expected format
	// Build the nested structure from flat elements
	const goals = caseData.elements
		.filter((el) => el.elementType === "GOAL" && el.parentId === null)
		.map((goal) => buildGoalStructure(goal, caseData.elements));

	const permissions = mapPermissionToFrontend(
		permissionResult.permission,
		permissionResult.isOwner
	);

	// Case study integration - disabled for now as publishedVersions uses legacy
	// bigint foreign keys. TODO: Implement using Release model.
	const hasPublicCaseStudy = false;
	const linkedCaseStudyCount = 0;

	return {
		data: {
			id: caseData.id,
			name: caseData.name,
			description: caseData.description,
			createdDate: caseData.createdAt.toISOString(),
			colourProfile: caseData.colourProfile,
			owner: caseData.createdById,
			goals,
			permissions,
			// Publish status fields
			published: caseData.publishStatus === "PUBLISHED",
			publishStatus: caseData.publishStatus,
			publishedAt: caseData.publishedAt?.toISOString() ?? null,
			markedReadyAt: caseData.markedReadyAt?.toISOString() ?? null,
			// Case study integration
			hasPublicCaseStudy,
			linkedCaseStudyCount,
			// Demo/tutorial flag
			isDemo: caseData.isDemo,
			// Layout preference
			layoutDirection: caseData.layoutDirection,
		},
	};
}

// ---------------------------------------------------------------------------
// Case list types
// ---------------------------------------------------------------------------

export type AssuranceCaseSummary = {
	id: string;
	name: string;
	description?: string;
	createdDate: string;
	updatedDate: string;
	owner?: string;
	isDemo?: boolean;
	permissions?: string;
};

// ---------------------------------------------------------------------------
// Case list and create service functions
// ---------------------------------------------------------------------------

/**
 * Fetches all assurance cases the user owns or has explicit permission on.
 * Excludes soft-deleted cases.
 */
export async function listUserCases(
	userId: string
): ServiceResult<AssuranceCaseSummary[]> {
	try {
		const cases = await prisma.assuranceCase.findMany({
			where: {
				deletedAt: null,
				OR: [
					{ createdById: userId },
					{
						userPermissions: {
							some: { userId },
						},
					},
				],
			},
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true,
				updatedAt: true,
				createdById: true,
				isDemo: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return {
			data: cases.map((c) => ({
				id: c.id,
				name: c.name,
				description: c.description ?? undefined,
				createdDate: c.createdAt.toISOString(),
				updatedDate: c.updatedAt.toISOString(),
				owner: c.createdById ?? undefined,
				isDemo: c.isDemo,
				permissions: c.createdById === userId ? "owner" : "view",
			})),
		};
	} catch (error) {
		console.error("[listUserCases]", { userId, error });
		return { error: "Failed to fetch cases" };
	}
}

/**
 * Fetches cases that are shared with the user (via direct permission or team membership)
 * but where the user is NOT the creator.
 * Excludes soft-deleted cases.
 */
export async function listSharedCases(
	userId: string
): ServiceResult<AssuranceCaseSummary[]> {
	try {
		const cases = await prisma.assuranceCase.findMany({
			where: {
				deletedAt: null,
				AND: [
					{
						OR: [
							{
								userPermissions: {
									some: { userId },
								},
							},
							{
								teamPermissions: {
									some: {
										team: {
											members: {
												some: { userId },
											},
										},
									},
								},
							},
						],
					},
					{
						NOT: { createdById: userId },
					},
				],
			},
			select: {
				id: true,
				name: true,
				description: true,
				createdAt: true,
				updatedAt: true,
				createdById: true,
			},
			orderBy: { createdAt: "desc" },
		});

		return {
			data: cases.map((c) => ({
				id: c.id,
				name: c.name,
				description: c.description ?? undefined,
				createdDate: c.createdAt.toISOString(),
				updatedDate: c.updatedAt.toISOString(),
				owner: c.createdById ?? undefined,
			})),
		};
	} catch (error) {
		console.error("[listSharedCases]", { userId, error });
		return { error: "Failed to fetch shared cases" };
	}
}

/**
 * Creates a new assurance case owned by the given user.
 */
export async function createCase(
	userId: string,
	data: { name: string; description?: string; colourProfile?: string }
): ServiceResult<{ id: string }> {
	try {
		const newCase = await prisma.$transaction(async (tx) => {
			const createdCase = await tx.assuranceCase.create({
				data: {
					name: data.name,
					description: data.description ?? "",
					colourProfile: data.colourProfile,
					createdById: userId,
				},
			});

			await tx.assuranceElement.create({
				data: {
					caseId: createdCase.id,
					elementType: "GOAL",
					role: "TOP_LEVEL",
					name: "G1",
					description: "Describe your top-level assurance goal",
					createdById: userId,
				},
			});

			return createdCase;
		});

		return { data: { id: newCase.id } };
	} catch (error) {
		console.error("[createCase]", { userId, error });
		return { error: "Failed to create case" };
	}
}

/**
 * Updates case metadata.
 * Returns "Permission denied" if the user lacks EDIT access.
 */
export async function updateCaseWithPrisma(
	id: string,
	userId: string,
	body: UpdateAssuranceCaseInput
): ServiceResult<Record<string, unknown>> {
	// Check permission
	const hasAccess = await canAccessCase({ userId, caseId: id }, "EDIT");
	if (!hasAccess) {
		return { error: "Permission denied" };
	}

	const updateData = buildCaseUpdateData(body);
	const updated = await prisma.assuranceCase.update({
		where: { id },
		data: updateData,
	});

	return {
		data: {
			id: updated.id,
			name: updated.name,
			description: updated.description,
			createdDate: updated.createdAt.toISOString(),
			colourProfile: updated.colourProfile,
			layoutDirection: updated.layoutDirection,
		},
	};
}
