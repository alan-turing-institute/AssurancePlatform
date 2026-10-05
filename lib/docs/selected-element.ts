/**
 * Pure helpers that describe one selected canvas element for the docs
 * inspector: what kind of element it is, what it hangs from, and which
 * optional attributes (context, assumption, justification) its card carries.
 *
 * Works on React Flow nodes and edges as plain data, so it needs no store.
 */

import type { Edge, Node } from "reactflow";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import { ELEMENT_GUIDE, type HelpGuideEntry } from "@/lib/help/help-guide";

export interface ElementRef {
	name: string;
	type: DiagramNodeType;
}

export interface SelectedElementSummary {
	attributes: {
		assumption: boolean;
		context: number;
		justification: boolean;
	};
	children: ElementRef[];
	id: string;
	isDefeater: boolean;
	name: string;
	parent: ElementRef | null;
	type: DiagramNodeType;
}

export type AttributeKind = "context" | "assumption" | "justification";

const GUIDE_ID_BY_NODE_TYPE: Record<DiagramNodeType, string> = {
	goal: "GOAL",
	strategy: "STRATEGY",
	property: "PROPERTY_CLAIM",
	evidence: "EVIDENCE",
	awayGoal: "AWAY_GOAL",
	module: "MODULE",
};

const CHALLENGES_EDGE_TYPE = "challenges";

const hasText = (value: unknown): boolean =>
	typeof value === "string" && value.trim().length > 0;

const toRef = (node: Node): ElementRef => ({
	name: String(node.data?.name ?? ""),
	type: node.type as DiagramNodeType,
});

export function summariseSelectedNode(
	node: Node,
	nodes: Node[],
	edges: Edge[]
): SelectedElementSummary {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const support = edges.filter((e) => e.type !== CHALLENGES_EDGE_TYPE);

	const parentEdge = support.find((e) => e.target === node.id);
	const parentNode = parentEdge ? byId.get(parentEdge.source) : undefined;

	const children = support
		.filter((e) => e.source === node.id)
		.map((e) => byId.get(e.target))
		.filter((n): n is Node => n !== undefined)
		.map(toRef)
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

	const context = node.data?.context;

	return {
		id: node.id,
		name: String(node.data?.name ?? ""),
		type: node.type as DiagramNodeType,
		isDefeater: Boolean(node.data?.isDefeater),
		attributes: {
			context: Array.isArray(context) ? context.length : 0,
			assumption: hasText(node.data?.assumption),
			justification: hasText(node.data?.justification),
		},
		parent: parentNode ? toRef(parentNode) : null,
		children,
	};
}

export function getElementGuide(type: DiagramNodeType): HelpGuideEntry {
	const guide = ELEMENT_GUIDE.find((g) => g.id === GUIDE_ID_BY_NODE_TYPE[type]);
	if (!guide) {
		throw new Error(`No element guide entry for node type "${type}"`);
	}
	return guide;
}

const ATTRIBUTE_GUIDE_ID: Record<AttributeKind, string> = {
	context: "CONTEXT",
	assumption: "ASSUMPTION",
	justification: "JUSTIFICATION",
};

export function getAttributeGuide(kind: AttributeKind): HelpGuideEntry {
	const guide = ELEMENT_GUIDE.find((g) => g.id === ATTRIBUTE_GUIDE_ID[kind]);
	if (!guide) {
		throw new Error(`No guide entry for attribute "${kind}"`);
	}
	return guide;
}
