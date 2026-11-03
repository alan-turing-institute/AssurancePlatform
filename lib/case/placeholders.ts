/**
 * Placeholders and pattern markers: the rules that decide when an element is
 * still "to fill in", and what an edit does to the markers an element carries.
 * Pure, so the services that write elements and the screens that record
 * history apply the same rules.
 */

import { parseContextEntries } from "@/lib/case/defined-terms";
import { contextEqual } from "@/lib/case/tree-diff";
import type { CaseKind, TreeNode } from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";

/** The words for the number of elements a case still has to fill in. */
export function placeholderCountMessage(count: number): string {
	return `${count} ${count === 1 ? "element" : "elements"} still to fill in`;
}

/**
 * How many elements are placeholders. An element listed more than once (a
 * piece of evidence shown under each claim that links it) counts once.
 */
export function countPlaceholders(
	items: Iterable<{ id: string; isPlaceholder?: boolean | null }>
): number {
	const placeholderIds = new Set<string>();
	for (const item of items) {
		if (item.isPlaceholder) {
			placeholderIds.add(item.id);
		}
	}
	return placeholderIds.size;
}

/** Every node of an exported tree. */
export function treeNodes(root: TreeNode): TreeNode[] {
	const nodes: TreeNode[] = [];
	const pending = [root];
	for (let node = pending.pop(); node; node = pending.pop()) {
		nodes.push(node);
		pending.push(...node.children);
	}
	return nodes;
}

/**
 * Whether writing `written` as an element's description takes the
 * "to fill in" marker off it. It does in a case, for text that is not empty
 * and differs from what is stored; in a pattern, nothing clears: the author
 * decides whether the person using the pattern writes the element.
 */
export function writingClearsPlaceholder(
	kind: CaseKind | undefined,
	stored: string,
	written: string | undefined
): boolean {
	return (
		kind === "CASE" &&
		written !== undefined &&
		written.trim() !== "" &&
		written !== stored
	);
}

/**
 * The element data a history entry records for an edit made from the
 * browser, before and after. The server takes the marker off a placeholder
 * when its description is written in a case, so the after state says so:
 * redoing the edit then sends the marker off, not the one it started with.
 * An edit that sets the marker itself (in a pattern) records the state before
 * with the marker spelled out, so undoing it can switch the marker back off.
 */
export function recordedStates(
	kind: CaseKind | undefined,
	before: Record<string, unknown>,
	fields: Record<string, unknown>
): { after: Record<string, unknown>; before: Record<string, unknown> } {
	const after = { ...before, ...fields };
	const written =
		typeof fields.description === "string" ? fields.description : undefined;
	if (
		writingClearsPlaceholder(kind, String(before.description ?? ""), written)
	) {
		after.isPlaceholder = false;
	}
	if (fields.isPlaceholder === undefined) {
		return { before, after };
	}
	return {
		before: {
			...before,
			isPlaceholder: before.isPlaceholder === true,
			placeholderHint: before.placeholderHint ?? null,
		},
		after,
	};
}

/** The text of an element, as it is stored or as an edit writes it. */
export interface ElementText {
	assumption?: string | null;
	context?: ContextEntry[];
	description?: string;
	justification?: string | null;
}

/** What an element already holds, with whether it came from a pattern. */
export interface StoredElementText extends ElementText {
	description: string;
	fromPattern: boolean;
}

/** An element row as stored, read as the text the pattern-marker rules compare with. */
export function storedElementText(row: {
	assumption: string | null;
	context: unknown;
	description: string;
	fromPattern: boolean;
	justification: string | null;
}): StoredElementText {
	return {
		description: row.description,
		assumption: row.assumption,
		justification: row.justification,
		context: parseContextEntries(row.context),
		fromPattern: row.fromPattern,
	};
}

function differs(
	written: string | null | undefined,
	stored: string | null | undefined
): boolean {
	return written !== undefined && (written ?? "") !== (stored ?? "");
}

/**
 * Whether an edit writes text that differs from the stored text. Only the
 * fields the edit carries are compared: the edit dialog sends the assumption,
 * justification and context every time, so what counts is a difference from
 * the stored value, not the presence of the field.
 */
function changesText(stored: ElementText, edit: ElementText): boolean {
	return (
		differs(edit.description, stored.description) ||
		differs(edit.assumption, stored.assumption) ||
		differs(edit.justification, stored.justification) ||
		(edit.context !== undefined && !contextEqual(edit.context, stored.context))
	);
}

/** The pattern markers an edit changes by itself. */
export interface PatternMarkerChanges {
	isPlaceholder?: false;
	modifiedFromPattern?: true;
}

/**
 * The markers a text edit changes on an element of a case of this kind:
 * writing the description takes the placeholder marker off (unless the edit
 * sets the marker itself), and changing text on an element that came from a
 * pattern marks it as modified.
 */
export function patternMarkersForEdit(input: {
	edit: ElementText;
	kind: CaseKind;
	placeholderSetByEdit: boolean;
	stored: StoredElementText;
}): PatternMarkerChanges {
	const { edit, kind, placeholderSetByEdit, stored } = input;
	const changes: PatternMarkerChanges = {};
	if (
		!placeholderSetByEdit &&
		writingClearsPlaceholder(kind, stored.description, edit.description)
	) {
		changes.isPlaceholder = false;
	}
	if (stored.fromPattern && changesText(stored, edit)) {
		changes.modifiedFromPattern = true;
	}
	return changes;
}
