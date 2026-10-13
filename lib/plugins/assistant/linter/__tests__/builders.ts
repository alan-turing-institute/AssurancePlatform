/**
 * Small factories for constructing case-tree fixtures in the linter tests without
 * hand-writing JSON for every case. Each function sets only the fields that matter for its
 * element type, plus whatever the test overrides via `opts`.
 */

import type { AssertionStatus, ElementRole } from "@/lib/schemas/case-export";
import type { LintCase, LintNode } from "../types";

type TreeNode = LintNode;
type CaseExportNested = LintCase;

let counter = 0;
/** Deterministic, readable ids — stable within a single test file run, unique per call. */
function nextId(prefix: string): string {
	counter++;
	return `${prefix}-${counter}`;
}

interface NodeOpts {
	assertionStatus?: AssertionStatus | null;
	assumption?: string | null;
	children?: TreeNode[];
	citedElementId?: string | null;
	context?: string[];
	defeatsElementId?: string;
	id?: string;
	inSandbox?: boolean;
	isDefeater?: boolean;
	justification?: string | null;
	role?: ElementRole | null;
	url?: string | null;
}

function base(
	idPrefix: string,
	name: string | null,
	description: string,
	opts: NodeOpts
): TreeNode {
	const node: TreeNode = {
		id: opts.id ?? nextId(idPrefix),
		type: "GOAL", // overwritten by each factory below
		name,
		description,
		inSandbox: opts.inSandbox ?? false,
		children: opts.children ?? [],
	};
	if (opts.context !== undefined) {
		node.context = opts.context;
	}
	if (opts.assumption !== undefined) {
		node.assumption = opts.assumption;
	}
	if (opts.justification !== undefined) {
		node.justification = opts.justification;
	}
	if (opts.assertionStatus !== undefined) {
		node.assertionStatus = opts.assertionStatus;
	}
	if (opts.url !== undefined) {
		node.url = opts.url;
	}
	if (opts.isDefeater !== undefined) {
		node.isDefeater = opts.isDefeater;
	}
	if (opts.defeatsElementId !== undefined) {
		node.defeatsElementId = opts.defeatsElementId;
	}
	if (opts.citedElementId !== undefined) {
		node.citedElementId = opts.citedElementId;
	}
	if (opts.role !== undefined) {
		node.role = opts.role;
	}
	return node;
}

export function goal(
	name: string | null,
	description: string,
	opts: NodeOpts = {}
): TreeNode {
	const node = base("goal", name, description, opts);
	node.type = "GOAL";
	node.role = opts.role ?? "TOP_LEVEL";
	return node;
}

export function strategy(
	name: string | null,
	description: string,
	opts: NodeOpts = {}
): TreeNode {
	const node = base("strategy", name, description, opts);
	node.type = "STRATEGY";
	return node;
}

export function claim(
	name: string | null,
	description: string,
	opts: NodeOpts = {}
): TreeNode {
	const node = base("claim", name, description, opts);
	node.type = "PROPERTY_CLAIM";
	return node;
}

export function evidence(
	name: string | null,
	description: string,
	opts: NodeOpts = {}
): TreeNode {
	const node = base("evidence", name, description, opts);
	node.type = "EVIDENCE";
	return node;
}

export function awayGoal(
	name: string | null,
	description: string,
	opts: NodeOpts = {}
): TreeNode {
	const node = base("away", name, description, opts);
	node.type = "AWAY_GOAL";
	return node;
}

export function caseDoc(
	name: string,
	tree: TreeNode,
	description = ""
): CaseExportNested {
	return {
		version: "1.0",
		exportedAt: "2025-01-01T00:00:00.000Z",
		case: { name, description },
		tree,
	};
}
