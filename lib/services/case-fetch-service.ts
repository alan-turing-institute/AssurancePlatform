import { compareIdentifiers } from "@/lib/case/identifier-utils";
import { canAccessCase, getCasePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { UpdateAssuranceCaseInput } from "@/lib/schemas/assurance-case";
import type { Prisma } from "@/src/generated/prisma";

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
		short_description: goal.description || "",
		long_description: goal.description || "",
		keywords: "",
		created_date: goal.createdAt.toISOString(),
		assurance_case_id: goal.caseId,
		context: goal.context || [],
		strategies,
		property_claims: propertyClaims,
		comments: goal.comments || [],
		assumption: goal.assumption || "",
		justification: goal.justification || "",
		in_sandbox: goal.inSandbox,
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
		short_description: strategy.description || "",
		long_description: strategy.description || "",
		created_date: strategy.createdAt.toISOString(),
		goal_id: goalId,
		property_claims: propertyClaims,
		comments: strategy.comments || [],
		assumption: strategy.assumption || "",
		justification: strategy.justification || "",
		context: strategy.context || [],
		in_sandbox: strategy.inSandbox,
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
			short_description: ev.description || "",
			long_description: ev.description || "",
			created_date: ev.createdAt.toISOString(),
			URL: ev.url || "",
			urls: ev.urls || [],
			property_claim_id: [claim.id],
			comments: ev.comments || [],
			in_sandbox: ev.inSandbox,
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
		short_description: claim.description || "",
		long_description: claim.description || "",
		created_date: claim.createdAt.toISOString(),
		goal_id: goalId,
		strategy_id: strategyId,
		property_claim_id: claim.parentId,
		level: claim.level || 1,
		claim_type: "Project claim",
		property_claims: nestedClaims,
		evidence,
		comments: claim.comments || [],
		assumption: claim.assumption || "",
		justification: claim.justification || "",
		context: claim.context || [],
		in_sandbox: claim.inSandbox,
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
	if (body.color_profile !== undefined) {
		updateData.colourProfile = body.color_profile;
	}
	if (body.layout_direction !== undefined) {
		updateData.layoutDirection = body.layout_direction;
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
): Promise<{ data: Record<string, unknown> } | { error: string }> {
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
			created_date: caseData.createdAt.toISOString(),
			color_profile: caseData.colourProfile,
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

/**
 * Updates case metadata.
 * Returns "Permission denied" if the user lacks EDIT access.
 */
export async function updateCaseWithPrisma(
	id: string,
	userId: string,
	body: UpdateAssuranceCaseInput
): Promise<{ data: Record<string, unknown> } | { error: string }> {
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
			created_date: updated.createdAt.toISOString(),
			color_profile: updated.colourProfile,
			layoutDirection: updated.layoutDirection,
		},
	};
}
