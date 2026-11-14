/**
 * Where an argument stops: whether a card on the diagram has nothing beneath
 * it. The answer is worked out from the nodes the canvas holds each time the
 * diagram is drawn. It is never stored, so it cannot change the assertion
 * status an author has set, and exports and imports never carry it.
 *
 * A goal, strategy or property claim is unsupported when no card directly
 * beneath it is a strategy, a property claim, a piece of evidence, an away
 * goal or a module, and the author has not set a status that already says
 * why nothing is beneath it. The marker sits on the element with nothing
 * beneath it, not on the elements above it.
 */

import type { Node } from "reactflow";
import { isAssertionStatusValue } from "@/lib/assertion-status";

/** The kinds of card that can carry the marker; the others end a branch by design. */
const MARKABLE_KINDS: ReadonlySet<string> = new Set([
	"goal",
	"strategy",
	"property",
]);

/**
 * The kinds of card that count as support when they sit directly beneath an
 * element. An away goal or a module counts even when its link to the other
 * case or module is broken: the author has still developed the branch.
 */
const SUPPORTING_KINDS: ReadonlySet<string> = new Set([
	"strategy",
	"property",
	"evidence",
	"awayGoal",
	"module",
]);

/**
 * Whether the author's own status already explains why nothing is beneath the
 * element. Needs support, Assumed, Axiomatic, Defeated and As cited do. A
 * missing status, a null and "ASSERTED" are the same unremarkable default,
 * as on the status badge, and so is a value that is not a status at all.
 */
function hasExplanatoryStatus(assertionStatus: unknown): boolean {
	return (
		isAssertionStatusValue(assertionStatus) && assertionStatus !== "ASSERTED"
	);
}

/** Whether a node, found by its parent link, supports the element it sits beneath. */
function supportsParent(node: Node): boolean {
	return (
		typeof node.type === "string" &&
		SUPPORTING_KINDS.has(node.type) &&
		!node.data?.isDefeater
	);
}

/**
 * Whether the card with this node id carries the unsupported marker.
 *
 * The kind of each card is read from `node.type`. A challenge (a defeater of
 * any kind) is not support, so a claim whose only child is a defeater is
 * unsupported. Children hidden by collapsing a branch still count, so
 * collapsing never puts a marker on the collapsed element. Detached
 * (sandbox) elements are not nodes on the diagram and are never judged.
 */
export function isUnsupported(nodes: readonly Node[], nodeId: string): boolean {
	let found = false;
	for (const node of nodes) {
		if (node.id === nodeId) {
			if (
				typeof node.type !== "string" ||
				!MARKABLE_KINDS.has(node.type) ||
				node.data?.isDefeater ||
				hasExplanatoryStatus(node.data?.assertionStatus)
			) {
				return false;
			}
			found = true;
			continue;
		}
		if (node.data?.parentId === nodeId && supportsParent(node)) {
			return false;
		}
	}
	return found;
}
