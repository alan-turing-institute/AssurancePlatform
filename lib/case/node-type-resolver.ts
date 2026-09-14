/**
 * Node-kind resolution (ADR 0005 D5): the single lookup from an element
 * type (plus flags, for the seam D6's GSN plugin needs) to the React Flow
 * `node.type` string. Framework/UI-agnostic — no React or component
 * imports — so both `convert-case.ts` (server-shaped data in, node list
 * out) and `components/cases/node-type-resolver.ts` (the same keys mapped
 * to renderer components, for `flow.tsx`'s `nodeTypes`) read from one
 * source instead of each keeping its own copy.
 */

/** Flags a resolution decision may depend on, beyond the element type itself. */
export interface NodeResolutionFlags {
	isDefeater?: boolean;
}

/** The React Flow node types this module knows how to resolve to. */
const REACT_FLOW_NODE_KINDS = [
	"goal",
	"strategy",
	"property",
	"evidence",
	"awayGoal",
	"module",
] as const;

export type ReactFlowNodeKind = (typeof REACT_FLOW_NODE_KINDS)[number];

/**
 * Normalises any of this codebase's element-type spellings ("GOAL",
 * "property_claim", "propertyClaim", "away_goal", …) to a React Flow node
 * type key.
 */
function toReactFlowKey(elementType: string): string {
	const lower = elementType.toLowerCase().replace(/[\s-]+/g, "_");
	const map: Record<string, ReactFlowNodeKind> = {
		goal: "goal",
		strategy: "strategy",
		property: "property",
		property_claim: "property",
		propertyclaim: "property",
		evidence: "evidence",
		away_goal: "awayGoal",
		awaygoal: "awayGoal",
		module: "module",
	};
	return map[lower] ?? lower;
}

/**
 * Resolves the React Flow `node.type` string for an element type. `flags`
 * is unused for every 1.0 core kind — the seam D6's canvas-decorator slot
 * needs, so an enabled GSN-plugin override can key on `isDefeater` (or any
 * future flag) without reshaping this function's signature. Falls back to
 * "property" for an unrecognised type, matching the default renderer.
 */
export function resolveReactFlowNodeType(
	elementType: string,
	_flags: NodeResolutionFlags = {}
): ReactFlowNodeKind {
	const key = toReactFlowKey(elementType);
	return (REACT_FLOW_NODE_KINDS as readonly string[]).includes(key)
		? (key as ReactFlowNodeKind)
		: "property";
}
