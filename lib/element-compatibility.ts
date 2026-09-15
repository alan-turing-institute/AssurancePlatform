/**
 * Element parent-child compatibility rules.
 *
 * Pure function module — no Prisma dependency, importable by both client and server.
 *
 * Hierarchy:
 *   goal          → strategy, property_claim, away_goal, module
 *   strategy      → property_claim, away_goal, module
 *   property_claim → property_claim, evidence, strategy, away_goal, module
 *   evidence      → (terminal — no valid children)
 *   away_goal     → (terminal — leaf in 1.0 core, ADR 0005 D3)
 *   module        → (terminal — leaf in 1.0 core, ADR 0005 D3)
 */

/**
 * Canonical lowercase type representation used internally.
 * All public functions normalise input before lookup.
 */
type CanonicalType =
	| "goal"
	| "strategy"
	| "property_claim"
	| "evidence"
	| "away_goal"
	| "module";

/**
 * Normalises any element type string to the canonical lowercase form.
 *
 * Handles:
 *   - Prisma UPPERCASE:  "GOAL", "PROPERTY_CLAIM"
 *   - Display lowercase: "goal", "property_claim"
 *   - React Flow:        "propertyClaim", "awayGoal"
 *   - Legacy alias:      "property"
 */
function normalise(type: string): string {
	const trimmed = type.trim().toLowerCase();

	// Map known variants to canonical form
	if (
		trimmed === "property" ||
		trimmed === "propertyclaim" ||
		trimmed === "property_claim"
	) {
		return "property_claim";
	}
	if (trimmed === "awaygoal" || trimmed === "away_goal") {
		return "away_goal";
	}

	// Strip underscores for comparison (e.g. "property_claim" → already handled above)
	return trimmed.replace(/_/g, "_"); // keep underscores as-is after normalisation above
}

/**
 * Parent → valid child types mapping. Away goals and modules (ADR 0005 D3)
 * are admitted wherever a property claim is — the same three parents — and
 * are themselves terminal (no create path for their children in 1.0 core).
 */
const VALID_CHILDREN: Record<CanonicalType, CanonicalType[]> = {
	goal: ["strategy", "property_claim", "away_goal", "module"],
	strategy: ["property_claim", "away_goal", "module"],
	property_claim: [
		"property_claim",
		"evidence",
		"strategy",
		"away_goal",
		"module",
	],
	evidence: [],
	away_goal: [],
	module: [],
};

/**
 * Returns the list of valid child types for a given parent type.
 * Returns an empty array for terminal types (evidence) or unknown types.
 *
 * @param parentType - Any string representation of the parent element type
 * @returns Array of canonical child type strings
 */
export function getCompatibleChildTypes(parentType: string): string[] {
	const canonical = normalise(parentType) as CanonicalType;
	return VALID_CHILDREN[canonical] ?? [];
}

/**
 * Returns the list of valid parent types for a given child type.
 * Inverse lookup of getCompatibleChildTypes.
 *
 * @param childType - Any string representation of the child element type
 * @returns Array of canonical parent type strings
 */
export function getCompatibleParentTypes(childType: string): string[] {
	const canonical = normalise(childType) as CanonicalType;
	const parents: CanonicalType[] = [];

	for (const [parent, children] of Object.entries(VALID_CHILDREN) as [
		CanonicalType,
		CanonicalType[],
	][]) {
		if (children.includes(canonical)) {
			parents.push(parent);
		}
	}

	return parents;
}

/**
 * Returns true if the child type can be placed under the parent type.
 *
 * @param childType  - Any string representation of the child element type
 * @param parentType - Any string representation of the parent element type
 * @returns Boolean indicating compatibility
 */
/**
 * Normalises an orphan element type string to canonical underscore form.
 * Handles undefined input and whitespace-separated type names.
 *
 * Useful for matching orphan elements (whose `type` field may use various formats)
 * against canonical types like "property_claim", "strategy", "evidence".
 */
export function normaliseOrphanType(type: string | undefined): string {
	const lower = type?.toLowerCase().replace(/\s+/g, "_") ?? "";
	return lower === "propertyclaim" ? "property_claim" : lower;
}

/**
 * Maps React Flow node types to canonical element types.
 * React Flow uses short names like "property" while canonical types use "property_claim".
 */
export const REACTFLOW_TO_CANONICAL: Record<string, string> = {
	property: "property_claim",
	strategy: "strategy",
	evidence: "evidence",
	context: "context",
	goal: "goal",
	awayGoal: "away_goal",
	module: "module",
};

export function canBeChildOf(childType: string, parentType: string): boolean {
	const canonicalChild = normalise(childType) as CanonicalType;
	const canonicalParent = normalise(parentType) as CanonicalType;

	const validChildren = VALID_CHILDREN[canonicalParent];
	if (!validChildren) {
		return false;
	}

	return validChildren.includes(canonicalChild);
}
