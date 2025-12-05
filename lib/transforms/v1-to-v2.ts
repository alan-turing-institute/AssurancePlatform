/**
 * Transforms v1 (Django nested) format to v2 (Prisma flat) format.
 *
 * Key transformations:
 * 1. Flattens nested goal/strategy/claim structure into flat elements array
 * 2. Merges short_description and long_description into single description
 * 3. Extracts evidence links to separate array (many-to-many)
 * 4. Ignores owner, permissions, groups fields
 * 5. Generates temporary UUIDs for import mapping
 */

import type {
	CaseExportV1,
	CaseExportV2,
	ContextV1,
	ElementV2,
	EvidenceLinkV2,
	EvidenceV1,
	GoalV1,
	PropertyClaimV1,
	StrategyV1,
} from "../schemas/case-export";

export type TransformResult = {
	case: CaseExportV2;
	warnings: string[];
};

/**
 * Smart description merge:
 * - If short === long: use short only
 * - If either is "N/A" or empty: use the other
 * - Otherwise: concatenate with newline separator
 */
export function mergeDescriptions(short: string, long: string): string {
	const shortTrimmed = short?.trim() ?? "";
	const longTrimmed = long?.trim() ?? "";

	// Handle empty/placeholder values
	const isShortEmpty =
		!shortTrimmed || shortTrimmed === "N/A" || shortTrimmed === "N/A.";
	const isLongEmpty =
		!longTrimmed || longTrimmed === "N/A" || longTrimmed === "N/A.";

	if (isShortEmpty && isLongEmpty) {
		return "";
	}

	if (isShortEmpty) {
		return longTrimmed;
	}

	if (isLongEmpty) {
		return shortTrimmed;
	}

	// If identical, use one
	if (shortTrimmed === longTrimmed) {
		return shortTrimmed;
	}

	// Concatenate with newline separator
	return `${shortTrimmed}\n\n${longTrimmed}`;
}

/**
 * Generates a temporary UUID for import mapping.
 * These will be replaced with actual UUIDs on database insert.
 */
let tempIdCounter = 0;
export function generateTempId(): string {
	tempIdCounter += 1;
	return `temp-${Date.now()}-${tempIdCounter}`;
}

/**
 * Resets the temp ID counter (useful for testing).
 */
export function resetTempIdCounter(): void {
	tempIdCounter = 0;
}

/**
 * Checks if a value is a valid UUID format.
 */
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
	return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Gets or creates a UUID for an element.
 * Preserves valid UUIDs, generates temp IDs for integers/invalid.
 */
export function getOrCreateUuid(
	originalId: unknown,
	idMap: Map<string, string>
): string {
	const originalKey = String(originalId);

	// Check if already mapped
	if (idMap.has(originalKey)) {
		return idMap.get(originalKey) as string;
	}

	// Use original if valid UUID, otherwise generate temp
	const newId = isValidUuid(originalId) ? originalId : generateTempId();

	idMap.set(originalKey, newId);
	return newId;
}

type TransformContext = {
	elements: ElementV2[];
	evidenceLinks: EvidenceLinkV2[];
	idMap: Map<string, string>;
	evidenceMap: Map<string, string>; // For deduplication
	warnings: string[];
};

/**
 * V1 comment structure as used in legacy format.
 */
type CommentV1 = {
	id?: number;
	author?: string;
	content: string;
	created_at?: string;
};

/**
 * Transforms V1 comments to V2 format.
 */
function transformComments(
	comments: CommentV1[] | undefined
): ElementV2["comments"] {
	if (!comments || comments.length === 0) {
		return;
	}

	return comments.map((c) => ({
		author: c.author ?? "Unknown",
		content: c.content,
		createdAt: c.created_at ?? new Date().toISOString(),
	}));
}

/**
 * Processes a context element from v1 format.
 */
function processContext(
	context: ContextV1,
	parentId: string,
	ctx: TransformContext
): void {
	const contextId = getOrCreateUuid(
		context.id ?? `ctx-${context.name}`,
		ctx.idMap
	);

	const element: ElementV2 = {
		id: contextId,
		elementType: "CONTEXT",
		role: null,
		parentId,
		name: context.name,
		description: mergeDescriptions(
			context.short_description,
			context.long_description
		),
		assumption: context.assumption ?? null,
		justification: null,
		url: null,
		level: null,
		inSandbox: context.in_sandbox ?? false,
	};

	const comments = transformComments(context.comments);
	if (comments) {
		element.comments = comments;
	}

	ctx.elements.push(element);
}

/**
 * Processes an evidence element from v1 format.
 * Returns the evidence element ID for linking.
 */
function processEvidence(
	evidence: EvidenceV1,
	claimId: string,
	ctx: TransformContext
): void {
	// Check if this evidence already exists (deduplication)
	const evKey = String(evidence.id ?? `ev-${evidence.name}`);

	let evidenceId: string;
	if (ctx.evidenceMap.has(evKey)) {
		// Evidence already created, just add link
		evidenceId = ctx.evidenceMap.get(evKey) as string;
	} else {
		// Create new evidence element
		evidenceId = getOrCreateUuid(
			evidence.id ?? `ev-${evidence.name}`,
			ctx.idMap
		);
		ctx.evidenceMap.set(evKey, evidenceId);

		const element: ElementV2 = {
			id: evidenceId,
			elementType: "EVIDENCE",
			role: null,
			parentId: null, // Evidence has no parent in v2 flat structure
			name: evidence.name,
			description: mergeDescriptions(
				evidence.short_description,
				evidence.long_description
			),
			assumption: null,
			justification: null,
			url: evidence.URL ?? null,
			level: null,
			inSandbox: evidence.in_sandbox ?? false,
		};

		const comments = transformComments(evidence.comments);
		if (comments) {
			element.comments = comments;
		}

		ctx.elements.push(element);
	}

	// Create evidence link
	ctx.evidenceLinks.push({
		evidenceId,
		claimId,
	});
}

/**
 * Processes a single property claim element.
 */
function processSingleClaim(
	claim: PropertyClaimV1,
	parentId: string,
	ctx: TransformContext,
	parentLevel: number
): string {
	const claimId = getOrCreateUuid(
		claim.id ?? `claim-${claim.name}-${parentId}`,
		ctx.idMap
	);

	// Calculate level: use v1 level if present, otherwise derive from parent
	const level = claim.level ?? parentLevel + 1;

	const element: ElementV2 = {
		id: claimId,
		elementType: "PROPERTY_CLAIM",
		role: null,
		parentId,
		name: claim.name,
		description: mergeDescriptions(
			claim.short_description,
			claim.long_description
		),
		assumption: claim.assumption ?? null,
		justification: null,
		url: null,
		level,
		inSandbox: claim.in_sandbox ?? false,
	};

	const comments = transformComments(claim.comments);
	if (comments) {
		element.comments = comments;
	}

	ctx.elements.push(element);

	return claimId;
}

/**
 * Processes claim children (evidence, nested claims, strategies).
 */
function processClaimChildren(
	claim: PropertyClaimV1,
	claimId: string,
	ctx: TransformContext,
	level: number
): void {
	// Process evidence attached to this claim
	for (const evidence of claim.evidence ?? []) {
		processEvidence(evidence, claimId, ctx);
	}

	// Process nested property claims
	processPropertyClaims(claim.property_claims, claimId, ctx, level);

	// Process strategies under property claims (advanced mode)
	for (const strategy of claim.strategies ?? []) {
		processStrategy(strategy, claimId, ctx);
	}
}

/**
 * Recursively processes property claims and their nested children.
 */
function processPropertyClaims(
	claims: PropertyClaimV1[] | undefined,
	parentId: string,
	ctx: TransformContext,
	parentLevel = 0
): void {
	if (!claims) {
		return;
	}

	for (const claim of claims) {
		const level = claim.level ?? parentLevel + 1;
		const claimId = processSingleClaim(claim, parentId, ctx, parentLevel);
		processClaimChildren(claim, claimId, ctx, level);
	}
}

/**
 * Processes a strategy element from v1 format.
 */
function processStrategy(
	strategy: StrategyV1,
	parentId: string,
	ctx: TransformContext
): void {
	const strategyId = getOrCreateUuid(
		strategy.id ?? `strat-${strategy.name}`,
		ctx.idMap
	);

	const element: ElementV2 = {
		id: strategyId,
		elementType: "STRATEGY",
		role: null,
		parentId,
		name: strategy.name,
		description: mergeDescriptions(
			strategy.short_description,
			strategy.long_description
		),
		assumption: strategy.assumption ?? null,
		justification: strategy.justification ?? null,
		url: null,
		level: null,
		inSandbox: strategy.in_sandbox ?? false,
	};

	const comments = transformComments(strategy.comments);
	if (comments) {
		element.comments = comments;
	}

	ctx.elements.push(element);

	// Process property claims under strategy
	processPropertyClaims(strategy.property_claims, strategyId, ctx, 0);
}

/**
 * Processes a goal element from v1 format.
 */
function processGoal(goal: GoalV1, ctx: TransformContext): void {
	const goalId = getOrCreateUuid(goal.id ?? `goal-${goal.name}`, ctx.idMap);

	const element: ElementV2 = {
		id: goalId,
		elementType: "GOAL",
		role: "TOP_LEVEL",
		parentId: null,
		name: goal.name,
		description: mergeDescriptions(
			goal.short_description,
			goal.long_description
		),
		assumption: goal.assumption ?? null,
		justification: null,
		url: null,
		level: null,
		inSandbox: goal.in_sandbox ?? false,
	};

	const comments = transformComments(goal.comments);
	if (comments) {
		element.comments = comments;
	}

	ctx.elements.push(element);

	// Process contexts under goal
	if (goal.context) {
		for (const context of goal.context) {
			processContext(context, goalId, ctx);
		}
	}

	// Process strategies under goal
	if (goal.strategies) {
		for (const strategy of goal.strategies) {
			processStrategy(strategy, goalId, ctx);
		}
	}

	// Process direct property claims under goal
	processPropertyClaims(goal.property_claims, goalId, ctx, 0);
}

/**
 * Transforms a v1 case export to v2 format.
 */
export function transformV1ToV2(v1Case: CaseExportV1): TransformResult {
	const ctx: TransformContext = {
		elements: [],
		evidenceLinks: [],
		idMap: new Map(),
		evidenceMap: new Map(),
		warnings: [],
	};

	// Process each goal
	if (v1Case.goals) {
		for (const goal of v1Case.goals) {
			processGoal(goal, ctx);
		}
	}

	// Generate warnings for ignored fields
	if (v1Case.owner !== undefined) {
		ctx.warnings.push("The 'owner' field was ignored.");
	}

	if (
		v1Case.edit_groups?.length ||
		v1Case.view_groups?.length ||
		v1Case.review_groups?.length
	) {
		ctx.warnings.push("Permission groups were ignored.");
	}

	// Build the v2 case export
	const v2Case: CaseExportV2 = {
		version: "2.0",
		exportedAt: new Date().toISOString(),
		case: {
			name: v1Case.name,
			description: v1Case.description ?? "",
			colorProfile: v1Case.color_profile ?? "default",
		},
		elements: ctx.elements,
		evidenceLinks: ctx.evidenceLinks,
	};

	return {
		case: v2Case,
		warnings: ctx.warnings,
	};
}

type SortContext = {
	inDegree: Map<string, number>;
	children: Map<string, ElementV2[]>;
};

/**
 * Initialises the dependency graph for topological sort.
 */
function initSortGraph(elements: ElementV2[]): SortContext {
	const inDegree = new Map<string, number>();
	const children = new Map<string, ElementV2[]>();

	for (const el of elements) {
		inDegree.set(el.id, 0);
		children.set(el.id, []);
	}

	for (const el of elements) {
		if (el.parentId && inDegree.has(el.parentId)) {
			inDegree.set(el.id, (inDegree.get(el.id) ?? 0) + 1);
			children.get(el.parentId)?.push(el);
		}
	}

	return { inDegree, children };
}

/**
 * Processes the sort queue using Kahn's algorithm.
 */
function processSortQueue(queue: ElementV2[], ctx: SortContext): ElementV2[] {
	const result: ElementV2[] = [];

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) {
			break;
		}

		result.push(current);

		for (const child of ctx.children.get(current.id) ?? []) {
			const newDegree = (ctx.inDegree.get(child.id) ?? 1) - 1;
			ctx.inDegree.set(child.id, newDegree);
			if (newDegree === 0) {
				queue.push(child);
			}
		}
	}

	return result;
}

/**
 * Topologically sorts elements so parents come before children.
 * Uses Kahn's algorithm.
 */
export function topologicalSort(elements: ElementV2[]): ElementV2[] {
	const ctx = initSortGraph(elements);

	// Queue elements with no dependencies (roots)
	const queue = elements.filter((el) => ctx.inDegree.get(el.id) === 0);
	const result = processSortQueue(queue, ctx);

	// Handle orphaned elements (parent not in import)
	const resultIds = new Set(result.map((el) => el.id));
	const orphans = elements.filter((el) => !resultIds.has(el.id));

	return [...result, ...orphans];
}
