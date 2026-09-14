import { compareIdentifiers } from "@/lib/case/identifier-utils";
import { logger } from "@/lib/logger";
import { canAccessCase, getCasePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { UpdateAssuranceCaseInput } from "@/lib/schemas/assurance-case";
import type {
	AssuranceCaseResponse,
	AwayGoalResponse,
	GoalResponse,
	ModuleResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";
import type { Prisma } from "@/src/generated/prisma";
import type { ServiceResult } from "@/types/service";

const log = logger.child({ component: "case-fetch-service" });

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
// Away goal / module citation resolution (ADR 0005 D3)
// ---------------------------------------------------------------------------

/**
 * Names and accessibility, resolved once per fetch, for every AWAY_GOAL/
 * MODULE element in the case — so the canvas card can show a cited case's
 * (and, for away goals, cited element's) name without a follow-up fetch.
 */
interface CitationContext {
	accessibleCaseIds: Set<string>;
	caseNameById: Map<string, string>;
	elementNameById: Map<string, string>;
}

const EMPTY_CITATION_CONTEXT: CitationContext = {
	accessibleCaseIds: new Set(),
	caseNameById: new Map(),
	elementNameById: new Map(),
};

/**
 * Resolves the case names, cited-element names, and viewer accessibility
 * needed by every AWAY_GOAL/MODULE element's card. Skips all three extra
 * queries when the case has none (the common case).
 */
async function buildCitationContext(
	userId: string,
	elements: CaseElement[]
): Promise<CitationContext> {
	const citing = elements.filter(
		(el) => el.elementType === "AWAY_GOAL" || el.elementType === "MODULE"
	);
	if (citing.length === 0) {
		return EMPTY_CITATION_CONTEXT;
	}

	const caseIds = [
		...new Set(
			citing
				.map((el) => el.moduleReferenceId)
				.filter((id): id is string => !!id)
		),
	];
	const elementIds = [
		...new Set(
			citing.map((el) => el.citedElementId).filter((id): id is string => !!id)
		),
	];

	const [cases, citedElements, accessFlags] = await Promise.all([
		caseIds.length
			? prisma.assuranceCase.findMany({
					where: { id: { in: caseIds }, deletedAt: null },
					select: { id: true, name: true },
				})
			: Promise.resolve([]),
		elementIds.length
			? prisma.assuranceElement.findMany({
					where: { id: { in: elementIds }, deletedAt: null },
					select: { id: true, name: true },
				})
			: Promise.resolve([]),
		Promise.all(
			caseIds.map(async (caseId) => ({
				caseId,
				accessible: await canAccessCase({ userId, caseId }, "VIEW"),
			}))
		),
	]);

	return {
		caseNameById: new Map(cases.map((c) => [c.id, c.name])),
		elementNameById: new Map(citedElements.map((el) => [el.id, el.name ?? ""])),
		accessibleCaseIds: new Set(
			accessFlags.filter((f) => f.accessible).map((f) => f.caseId)
		),
	};
}

function buildAwayGoalStructure(
	element: CaseElement,
	goalId: string | null,
	strategyId: string | null,
	citation: CitationContext
): AwayGoalResponse {
	const citedCaseName = element.moduleReferenceId
		? (citation.caseNameById.get(element.moduleReferenceId) ?? null)
		: null;
	const citedElementName = element.citedElementId
		? (citation.elementNameById.get(element.citedElementId) ?? null)
		: null;

	return {
		id: element.id,
		type: "away_goal",
		name: element.name ?? "",
		description: element.description ?? "",
		createdDate: element.createdAt.toISOString(),
		goalId,
		strategyId,
		moduleReferenceId: element.moduleReferenceId,
		citedElementId: element.citedElementId,
		citationDangling: element.citationDangling,
		citedCaseName,
		citedElementName,
		citedCaseAccessible: element.moduleReferenceId
			? citation.accessibleCaseIds.has(element.moduleReferenceId)
			: false,
		comments: [],
		inSandbox: element.inSandbox,
	};
}

function buildModuleStructure(
	element: CaseElement,
	goalId: string | null,
	strategyId: string | null,
	citation: CitationContext
): ModuleResponse {
	const moduleCaseName = element.moduleReferenceId
		? (citation.caseNameById.get(element.moduleReferenceId) ?? null)
		: null;

	return {
		id: element.id,
		type: "module",
		name: element.name ?? "",
		description: element.description ?? "",
		createdDate: element.createdAt.toISOString(),
		goalId,
		strategyId,
		moduleReferenceId: element.moduleReferenceId,
		moduleCaseName,
		moduleCaseAccessible: element.moduleReferenceId
			? citation.accessibleCaseIds.has(element.moduleReferenceId)
			: false,
		comments: [],
		inSandbox: element.inSandbox,
	};
}

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
	allElements: CaseElement[],
	citation: CitationContext
): GoalResponse {
	const children = allElements.filter((el) => el.parentId === goal.id);

	const strategies = children
		.filter((el) => el.elementType === "STRATEGY")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((strategy) =>
			buildStrategyStructure(strategy, allElements, goal.id, citation)
		);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(claim, allElements, goal.id, null, citation)
		);

	// ADR 0005 D3: AWAY_GOAL and MODULE are admitted wherever PROPERTY_CLAIM
	// is admitted — a goal's direct children, alongside strategies/claims.
	const awayGoals = children
		.filter((el) => el.elementType === "AWAY_GOAL")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildAwayGoalStructure(el, goal.id, null, citation));

	const modules = children
		.filter((el) => el.elementType === "MODULE")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildModuleStructure(el, goal.id, null, citation));

	return {
		id: goal.id,
		type: "goal",
		name: goal.name ?? "",
		description: goal.description ?? "",
		keywords: "",
		createdDate: goal.createdAt.toISOString(),
		assuranceCaseId: goal.caseId ?? "",
		context: goal.context || [],
		strategies,
		propertyClaims,
		awayGoals,
		modules,
		comments: [],
		assumption: goal.assumption ?? "",
		justification: goal.justification ?? "",
		inSandbox: goal.inSandbox,
		// Dialogical reasoning (defeaters, ADR 0005 D2) — decoration on the
		// existing card, not a new node kind.
		isDefeater: goal.isDefeater,
		defeatsElementId: goal.defeatsElementId,
		// Per-assertion status (ADR 0004 D3); omitted (not forced to
		// "ASSERTED") when unset, matching element-response.ts's convention —
		// the badge/setter treat undefined the same as the default.
		assertionStatus: goal.assertionStatus ?? undefined,
	};
}

function buildStrategyStructure(
	strategy: CaseElement,
	allElements: CaseElement[],
	goalId: string | null,
	citation: CitationContext
): StrategyResponse {
	const children = allElements.filter((el) => el.parentId === strategy.id);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(
				claim,
				allElements,
				null,
				strategy.id,
				citation
			)
		);

	// ADR 0005 D3: AWAY_GOAL and MODULE admitted wherever PROPERTY_CLAIM is.
	const awayGoals = children
		.filter((el) => el.elementType === "AWAY_GOAL")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildAwayGoalStructure(el, null, strategy.id, citation));

	const modules = children
		.filter((el) => el.elementType === "MODULE")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildModuleStructure(el, null, strategy.id, citation));

	return {
		id: strategy.id,
		type: "strategy",
		name: strategy.name ?? "",
		description: strategy.description ?? "",
		createdDate: strategy.createdAt.toISOString(),
		goalId,
		propertyClaims,
		awayGoals,
		modules,
		comments: [],
		assumption: strategy.assumption ?? "",
		justification: strategy.justification ?? "",
		context: strategy.context || [],
		inSandbox: strategy.inSandbox,
		// Per-assertion status (ADR 0004 D3) — see buildGoalStructure comment.
		assertionStatus: strategy.assertionStatus ?? undefined,
	};
}

function buildPropertyClaimStructure(
	claim: CaseElement,
	allElements: CaseElement[],
	goalId: string | null,
	strategyId: string | null,
	citation: CitationContext
): PropertyClaimResponse {
	const children = allElements.filter((el) => el.parentId === claim.id);

	// Get evidence from EvidenceLink table (evidence uses many-to-many links, not parentId)
	const linkedEvidence =
		claim.evidenceLinksTo?.map((link) => link.evidence) ?? [];

	const evidence = linkedEvidence
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((ev) => ({
			id: ev.id,
			type: "evidence",
			name: ev.name ?? "",
			description: ev.description ?? "",
			createdDate: ev.createdAt.toISOString(),
			URL: ev.url ?? "",
			urls: ev.urls || [],
			propertyClaimId: [claim.id],
			comments: [],
			inSandbox: ev.inSandbox,
			// Dialogical reasoning (defeaters, ADR 0005 D2).
			isDefeater: ev.isDefeater,
			defeatsElementId: ev.defeatsElementId,
		}));

	const nestedClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((nested) =>
			buildPropertyClaimStructure(nested, allElements, null, null, citation)
		);

	const nestedStrategies = children
		.filter((el) => el.elementType === "STRATEGY")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((strategy) =>
			buildStrategyStructure(strategy, allElements, null, citation)
		);

	// ADR 0005 D3: AWAY_GOAL and MODULE admitted wherever PROPERTY_CLAIM is.
	const awayGoals = children
		.filter((el) => el.elementType === "AWAY_GOAL")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildAwayGoalStructure(el, null, null, citation));

	const modules = children
		.filter((el) => el.elementType === "MODULE")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => buildModuleStructure(el, null, null, citation));

	return {
		id: claim.id,
		type: "property_claim",
		name: claim.name ?? "",
		description: claim.description ?? "",
		createdDate: claim.createdAt.toISOString(),
		goalId,
		strategyId,
		propertyClaimId: claim.parentId,
		level: claim.level ?? 1,
		claimType: "Project claim",
		propertyClaims: nestedClaims,
		strategies: nestedStrategies,
		awayGoals,
		modules,
		evidence,
		comments: [],
		assumption: claim.assumption ?? "",
		justification: claim.justification ?? "",
		context: claim.context || [],
		inSandbox: claim.inSandbox,
		// Dialogical reasoning (defeaters, ADR 0005 D2) — decoration on the
		// existing card, not a new node kind.
		isDefeater: claim.isDefeater,
		defeatsElementId: claim.defeatsElementId,
		// Per-assertion status (ADR 0004 D3) — see buildGoalStructure comment.
		assertionStatus: claim.assertionStatus ?? undefined,
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
): ServiceResult<AssuranceCaseResponse> {
	// Check if user has access to this case (handles owner, direct, and team permissions)
	const permissionResult = await getCasePermission({
		userId,
		caseId,
	});

	if (!permissionResult.hasAccess) {
		return { error: "Permission denied" };
	}

	// Fetch the case data (exclude soft-deleted cases)
	const caseData = await prisma.assuranceCase.findUnique({
		where: { id: caseId, deletedAt: null },
		include: CASE_INCLUDE,
	});

	if (!caseData) {
		return { error: "Permission denied" };
	}

	// Transform Prisma data to the expected format
	// Build the nested structure from flat elements
	const citation = await buildCitationContext(userId, caseData.elements);
	const goals = caseData.elements
		.filter((el) => el.elementType === "GOAL" && el.parentId === null)
		.map((goal) => buildGoalStructure(goal, caseData.elements, citation));

	const permissions = mapPermissionToFrontend(
		permissionResult.permission,
		permissionResult.isOwner
	);

	return {
		data: {
			id: caseData.id,
			name: caseData.name,
			description: caseData.description ?? undefined,
			createdDate: caseData.createdAt.toISOString(),
			colourProfile: caseData.colourProfile ?? undefined,
			owner: caseData.createdById ?? undefined,
			goals,
			permissions,
			type: "assurance_case",
			comments: [],
			// Publish status fields (DRAFT / PUBLISHED — the "Ready to Publish"
			// intermediate step was retired, ADR 0003 §2)
			published: caseData.publishStatus === "PUBLISHED",
			publishStatus: caseData.publishStatus as "DRAFT" | "PUBLISHED",
			publishedAt: caseData.publishedAt?.toISOString() ?? null,
			markedReadyAt: caseData.markedReadyAt?.toISOString() ?? null,
			// Demo/tutorial flag
			isDemo: caseData.isDemo,
			// Layout preference
			layoutDirection: (caseData.layoutDirection ?? undefined) as
				| "TB"
				| "LR"
				| undefined,
		},
	};
}

// ---------------------------------------------------------------------------
// Case list types
// ---------------------------------------------------------------------------

export interface AssuranceCaseSummary {
	createdDate: string;
	description?: string;
	id: string;
	isDemo?: boolean;
	name: string;
	owner?: string;
	permissions?: string;
	updatedDate: string;
}

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
		log.error("listUserCases", { userId, error });
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
		log.error("listSharedCases", { userId, error });
		return { error: "Failed to fetch shared cases" };
	}
}

// ---------------------------------------------------------------------------
// Away goal / module creation picker (ADR 0005 D7)
// ---------------------------------------------------------------------------

export interface CaseGoalSummary {
	description: string;
	id: string;
	name: string;
}

/**
 * Lists the GOAL elements of a case, for the "Add away goal" picker's
 * second step (ADR 0005 D7). Requires at least VIEW access on the cited
 * case — citing a goal is a read, so the same bar as opening the case.
 * Same not-found-vs-forbidden error as `fetchCaseFromPrisma` to avoid case
 * enumeration.
 */
export async function listCaseGoalElements(
	userId: string,
	caseId: string
): ServiceResult<CaseGoalSummary[]> {
	const permissionResult = await getCasePermission({ userId, caseId });
	if (!permissionResult.hasAccess) {
		return { error: "Permission denied" };
	}

	try {
		const goals = await prisma.assuranceElement.findMany({
			where: { caseId, elementType: "GOAL", deletedAt: null },
			select: { id: true, name: true, description: true },
		});

		return {
			data: goals
				.map((g) => ({
					id: g.id,
					name: g.name ?? "",
					description: g.description ?? "",
				}))
				.sort((a, b) => compareIdentifiers(a.name, b.name)),
		};
	} catch (error) {
		log.error("listCaseGoalElements", { userId, caseId, error });
		return { error: "Failed to fetch goals" };
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
		log.error("createCase", { userId, error });
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
): ServiceResult<AssuranceCaseResponse> {
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
			description: updated.description ?? undefined,
			createdDate: updated.createdAt.toISOString(),
			colourProfile: updated.colourProfile ?? undefined,
			layoutDirection: (updated.layoutDirection ?? undefined) as
				| "TB"
				| "LR"
				| undefined,
			type: "assurance_case",
			comments: [],
			permissions: "edit",
		},
	};
}
