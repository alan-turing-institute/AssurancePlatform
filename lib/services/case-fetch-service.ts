import {
	parseContextEntries,
	plainReferenceText,
	type TermSource,
	termsInReach,
} from "@/lib/case/defined-terms";
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

/**
 * A case's live elements grouped by parent, built once per fetch so each
 * builder reads its children from a lookup instead of scanning every element.
 */
interface ElementIndex {
	childrenByParent: Map<string, CaseElement[]>;
	/**
	 * Counter-goals being built on the current path. Evidence reused beneath a
	 * counter-goal can lead back to it; it is not expanded again inside itself.
	 */
	openCounterGoals: Set<string>;
}

function indexElements(elements: CaseElement[]): ElementIndex {
	const childrenByParent = new Map<string, CaseElement[]>();
	for (const element of elements) {
		if (element.parentId === null) {
			continue;
		}
		const siblings = childrenByParent.get(element.parentId);
		if (siblings) {
			siblings.push(element);
		} else {
			childrenByParent.set(element.parentId, [element]);
		}
	}
	return { childrenByParent, openCounterGoals: new Set() };
}

function childrenOf(index: ElementIndex, parentId: string): CaseElement[] {
	return index.childrenByParent.get(parentId) ?? [];
}

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
		moduleReferenceDangling: element.moduleReferenceDangling,
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
		moduleReferenceDangling: element.moduleReferenceDangling,
		moduleCaseName,
		moduleCaseAccessible: element.moduleReferenceId
			? citation.accessibleCaseIds.has(element.moduleReferenceId)
			: false,
		comments: [],
		inSandbox: element.inSandbox,
	};
}

/**
 * Builds the awayGoals and modules arrays for one parent's children (ADR
 * 0005 D3): AWAY_GOAL and MODULE are admitted wherever PROPERTY_CLAIM is.
 * Extracted (review round 1 — fallow duplication finding) from
 * `buildGoalStructure`, `buildStrategyStructure`, and
 * `buildPropertyClaimStructure`, which otherwise repeated this exact
 * filter-sort-map pair, once each, identically but for the goalId/
 * strategyId args each passes through to the two element structures.
 */
function buildCitedChildren(
	children: CaseElement[],
	goalId: string | null,
	strategyId: string | null,
	citation: CitationContext,
	index: ElementIndex
): { awayGoals: AwayGoalResponse[]; modules: ModuleResponse[] } {
	const awayGoals = children
		.filter((el) => el.elementType === "AWAY_GOAL")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => ({
			...buildAwayGoalStructure(el, goalId, strategyId, citation),
			...buildGoalDefeaters(el.id, index, citation),
		}));

	const modules = children
		.filter((el) => el.elementType === "MODULE")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((el) => ({
			...buildModuleStructure(el, goalId, strategyId, citation),
			...buildGoalDefeaters(el.id, index, citation),
		}));

	return { awayGoals, modules };
}

/**
 * Builds a parent's STRATEGY children (sorted, structured). Extracted
 * (review round 1 — fallow duplication finding) from `buildGoalStructure`
 * and `buildPropertyClaimStructure`, which otherwise repeated this exact
 * filter-sort-map pair, differing only in which id (goal's or none, for a
 * nested claim) each passes through as the strategy's `goalId`.
 */
function buildNestedStrategies(
	children: CaseElement[],
	goalId: string | null,
	index: ElementIndex,
	citation: CitationContext
): StrategyResponse[] {
	return children
		.filter((el) => el.elementType === "STRATEGY")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((strategy) =>
			buildStrategyStructure(strategy, index, goalId, citation)
		);
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

/** Preserve nested counter-goals for the canvas's existing defeater attachments. */
function buildGoalDefeaters(
	parentId: string,
	index: ElementIndex,
	citation: CitationContext
): { goals?: GoalResponse[] } {
	const goals = childrenOf(index, parentId)
		.filter(
			(el) =>
				el.elementType === "GOAL" &&
				el.isDefeater &&
				!index.openCounterGoals.has(el.id)
		)
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((goal) => {
			index.openCounterGoals.add(goal.id);
			const structure = buildGoalStructure(goal, index, citation);
			index.openCounterGoals.delete(goal.id);
			return structure;
		});
	return goals.length > 0 ? { goals } : {};
}

function buildGoalStructure(
	goal: CaseElement,
	index: ElementIndex,
	citation: CitationContext
): GoalResponse {
	const children = childrenOf(index, goal.id);

	const strategies = buildNestedStrategies(children, goal.id, index, citation);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(claim, index, goal.id, null, citation)
		);

	// ADR 0005 D3: AWAY_GOAL and MODULE are admitted wherever PROPERTY_CLAIM
	// is admitted — a goal's direct children, alongside strategies/claims.
	const { awayGoals, modules } = buildCitedChildren(
		children,
		goal.id,
		null,
		citation,
		index
	);

	return {
		...buildGoalDefeaters(goal.id, index, citation),
		id: goal.id,
		type: "goal",
		name: goal.name ?? "",
		description: goal.description ?? "",
		keywords: "",
		createdDate: goal.createdAt.toISOString(),
		assuranceCaseId: goal.caseId ?? "",
		context: parseContextEntries(goal.context),
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
	index: ElementIndex,
	goalId: string | null,
	citation: CitationContext
): StrategyResponse {
	const children = childrenOf(index, strategy.id);

	const propertyClaims = children
		.filter((el) => el.elementType === "PROPERTY_CLAIM")
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((claim) =>
			buildPropertyClaimStructure(claim, index, null, strategy.id, citation)
		);

	// ADR 0005 D3: AWAY_GOAL and MODULE admitted wherever PROPERTY_CLAIM is.
	const { awayGoals, modules } = buildCitedChildren(
		children,
		null,
		strategy.id,
		citation,
		index
	);

	return {
		...buildGoalDefeaters(strategy.id, index, citation),
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
		context: parseContextEntries(strategy.context),
		inSandbox: strategy.inSandbox,
		// Per-assertion status (ADR 0004 D3) — see buildGoalStructure comment.
		assertionStatus: strategy.assertionStatus ?? undefined,
	};
}

function buildPropertyClaimStructure(
	claim: CaseElement,
	index: ElementIndex,
	goalId: string | null,
	strategyId: string | null,
	citation: CitationContext
): PropertyClaimResponse {
	const children = childrenOf(index, claim.id);

	// Get evidence from EvidenceLink table (evidence uses many-to-many links, not parentId)
	const linkedEvidence =
		claim.evidenceLinksTo?.map((link) => link.evidence) ?? [];

	const evidence = linkedEvidence
		.sort((a, b) => compareIdentifiers(a.name, b.name))
		.map((ev) => ({
			...buildGoalDefeaters(ev.id, index, citation),
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
			buildPropertyClaimStructure(nested, index, null, null, citation)
		);

	const nestedStrategies = buildNestedStrategies(
		children,
		null,
		index,
		citation
	);

	// ADR 0005 D3: AWAY_GOAL and MODULE admitted wherever PROPERTY_CLAIM is.
	const { awayGoals, modules } = buildCitedChildren(
		children,
		null,
		null,
		citation,
		index
	);

	return {
		...buildGoalDefeaters(claim.id, index, citation),
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
		context: parseContextEntries(claim.context),
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
	const index = indexElements(caseData.elements);
	const roots = caseData.elements.filter(
		(el) => el.elementType === "GOAL" && el.parentId === null
	);
	// A goal defeater without a parent (stored before such goals were refused)
	// never stands in for the case's goal, whatever order the rows come back in.
	const ordinaryRoots = roots.filter((el) => !el.isDefeater);
	const goals = (
		ordinaryRoots.length > 0 ? ordinaryRoots : roots.slice(0, 1)
	).map((goal) => buildGoalStructure(goal, index, citation));

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
			isOwner: permissionResult.isOwner,
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

/**
 * Resolves a case's name for viewer-facing surfaces that must not disclose
 * it to someone without VIEW access — currently the case page's server-
 * rendered `<title>` (AP-QA-012). Checks `canAccessCase` first (owner,
 * direct and team grants; trashed cases excluded by default) and only then
 * looks the name up directly, rather than reusing `fetchCaseFromPrisma`,
 * which does far more work than a page title needs.
 *
 * Returns `null` for no access, a missing case and a trashed case alike —
 * one return value, so the caller cannot distinguish "you can't see this"
 * from "this doesn't exist", the same anti-enumeration discipline as
 * `fetchCaseFromPrisma`. `deletedAt: null` on the lookup is defence in
 * depth alongside `canAccessCase`'s own trash exclusion, not a substitute
 * for it.
 */
export async function getCaseNameForViewer(
	userId: string,
	caseId: string
): Promise<string | null> {
	const hasAccess = await canAccessCase({ userId, caseId }, "VIEW");
	if (!hasAccess) {
		return null;
	}

	try {
		const record = await prisma.assuranceCase.findUnique({
			where: { id: caseId, deletedAt: null },
			select: { name: true },
		});
		return record?.name ?? null;
	} catch (error) {
		log.error("getCaseNameForViewer", { userId, caseId, error });
		return null;
	}
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
	/** Whether the case has a current published copy on Discover. */
	published?: boolean;
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
				published: true,
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
				published: c.published,
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
				published: true,
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
				published: c.published,
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

interface TermElementRow {
	context: unknown;
	id: string;
	name: string | null;
	parentId: string | null;
}

/** The element and the elements above it, as sources of defined terms. */
function termSourceChain(
	element: TermElementRow,
	byId: ReadonlyMap<string, TermElementRow>
): TermSource[] {
	const chain: TermSource[] = [];
	const seen = new Set<string>();
	for (
		let current: TermElementRow | undefined = element;
		current && !seen.has(current.id);
		current = current.parentId ? byId.get(current.parentId) : undefined
	) {
		seen.add(current.id);
		chain.push({
			id: current.id,
			name: current.name,
			context: parseContextEntries(current.context),
		});
	}
	return chain;
}

/**
 * Lists the GOAL elements of a case, for the "Add away goal" picker's
 * second step (ADR 0005 D7). Requires at least VIEW access on the cited
 * case — citing a goal is a read, so the same bar as opening the case.
 * Same not-found-vs-forbidden error as `fetchCaseFromPrisma` to avoid case
 * enumeration.
 *
 * The picker copies a goal's description into an element of another case,
 * where a reference to a name defined here could not be resolved, so the
 * description is returned in plain form: each reference written as `{name}`,
 * with the name the entry has now.
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
		const elements = await prisma.assuranceElement.findMany({
			where: { caseId, deletedAt: null },
			select: {
				id: true,
				name: true,
				description: true,
				elementType: true,
				parentId: true,
				context: true,
			},
		});
		const byId = new Map(elements.map((element) => [element.id, element]));

		return {
			data: elements
				.filter((element) => element.elementType === "GOAL")
				.map((goal) => ({
					id: goal.id,
					name: goal.name ?? "",
					description: plainReferenceText(
						goal.description ?? "",
						termsInReach(termSourceChain(goal, byId))
					),
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
