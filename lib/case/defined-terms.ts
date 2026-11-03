/**
 * Defined terms: named context entries and the references to them that sit
 * inside element text.
 *
 * A named entry on an element gives a piece of context a name, such as
 * `window`. Text on that element, or on any element below it, can refer to the
 * name with a token of the form `{window#k3f9x2m7qa}`: the name, a `#`, then
 * the entry's id. The id decides what the token points at; the name inside it
 * is only the fallback shown when the entry cannot be found.
 *
 * Which entries a token can reach is worked out here from the parent chain
 * whenever it is needed and never stored, so moving an element or deleting an
 * entry cannot leave a stale flag behind. Nothing in this file touches the
 * store or the database, so it runs in the browser and on the server alike.
 */

import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import {
	type ContextEntry,
	isNamedContextEntry,
	type NamedContextEntry,
} from "@/lib/schemas/context-entry";

// ---------------------------------------------------------------------------
// References inside text
// ---------------------------------------------------------------------------

/** `{name#id}`: no braces or `#` in the name, a ten-character id. */
const REFERENCE_PATTERN = /\{([^{}#\n]+)#([a-z0-9]{10})\}/g;

export type TextSegment =
	| { type: "text"; text: string }
	| { type: "reference"; name: string; id: string; raw: string };

/** Writes a reference token. */
export function formatReference(name: string, id: string): string {
	return `{${name}#${id}}`;
}

/**
 * Splits text into plain runs and references. Braces that do not form a
 * reference, such as `{like this}`, stay in the plain runs.
 */
export function parseReferences(text: string): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;
	for (const match of text.matchAll(REFERENCE_PATTERN)) {
		const [raw, name, id] = match;
		if (name === undefined || id === undefined) {
			continue;
		}
		if (match.index > cursor) {
			segments.push({ type: "text", text: text.slice(cursor, match.index) });
		}
		segments.push({ type: "reference", name, id, raw });
		cursor = match.index + raw.length;
	}
	if (cursor < text.length) {
		segments.push({ type: "text", text: text.slice(cursor) });
	}
	return segments;
}

/** Whether the text holds at least one reference. */
export function hasReference(text: string | null | undefined): boolean {
	if (!text?.includes("{")) {
		return false;
	}
	return parseReferences(text).some((segment) => segment.type === "reference");
}

// ---------------------------------------------------------------------------
// Reading a stored context list
// ---------------------------------------------------------------------------

function pickNamedEntry(raw: unknown): NamedContextEntry | null {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		return null;
	}
	const { id, name, text, value, variable } = raw as Record<string, unknown>;
	if (
		typeof id !== "string" ||
		typeof name !== "string" ||
		typeof text !== "string"
	) {
		return null;
	}
	const entry: NamedContextEntry = { id, name, text };
	if (typeof value === "string") {
		entry.value = value;
	}
	if (variable === true) {
		entry.variable = true;
	}
	return entry;
}

/**
 * Turns whatever the database holds in an element's `context` column into a
 * list of entries. Strings pass through; a record is rebuilt from its `id`,
 * `name`, `text`, `value` and `variable` alone, so no stray key can travel
 * into an export, a snapshot or an API response; anything else is dropped. It never
 * throws, because a read must not fail on an odd stored value.
 */
export function parseContextEntries(raw: unknown): ContextEntry[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const entries: ContextEntry[] = [];
	for (const item of raw) {
		if (typeof item === "string") {
			entries.push(item);
			continue;
		}
		const named = pickNamedEntry(item);
		if (named) {
			entries.push(named);
		}
	}
	return entries;
}

// ---------------------------------------------------------------------------
// Which terms an element can reach
// ---------------------------------------------------------------------------

/** One element on the way from a card up to the top goal. */
export interface TermSource {
	context?: readonly ContextEntry[] | null;
	id: string;
	name?: string | null;
}

/** A named entry, with the element it is defined on. */
export interface DefinedTerm {
	definedOn: { elementId: string; elementName: string | null };
	id: string;
	name: string;
	/** What the name means: the entry's text. */
	text: string;
	value?: string;
	/** Set when the entry is a variable: a reference shows its value in place of its name. */
	variable?: true;
}

/**
 * The named entries an element can reach: its own, then those of each element
 * above it. `chain` runs from the element itself up to the top goal, so the
 * result lists the nearest definition first; a sibling branch is never in it.
 * When two entries share a name both are listed, nearer first.
 */
export function termsInReach(chain: readonly TermSource[]): DefinedTerm[] {
	const terms: DefinedTerm[] = [];
	for (const source of chain) {
		for (const entry of source.context ?? []) {
			if (!isNamedContextEntry(entry)) {
				continue;
			}
			const term: DefinedTerm = {
				id: entry.id,
				name: entry.name,
				text: entry.text,
				definedOn: { elementId: source.id, elementName: source.name ?? null },
			};
			if (entry.value !== undefined) {
				term.value = entry.value;
			}
			if (entry.variable) {
				term.variable = true;
			}
			terms.push(term);
		}
	}
	return terms;
}

/** The nearest term with the given id, or undefined when it is out of reach. */
export function findTermById(
	terms: readonly DefinedTerm[],
	id: string
): DefinedTerm | undefined {
	return terms.find((term) => term.id === id);
}

// ---------------------------------------------------------------------------
// The plain-text copy
// ---------------------------------------------------------------------------

/** What a reference to a term is read as. */
interface ReferenceDisplay {
	/** The term's current name, or the name stored in the reference when the term is out of reach. */
	name: string;
	/** The words to read: the name; for a variable, its value, or `[name]` while it has none. */
	text: string;
	/** Whether the variable has no value yet. */
	unfilled: boolean;
	/** Whether the term is a variable, so `text` is its value or `[name]` and not a name. */
	variable: boolean;
}

/**
 * How a reference shows: the one rule behind every card, list and plain-text
 * copy. An ordinary term, or one out of reach, shows its name. A variable
 * shows its value, taken as it is and never read for references of its own;
 * one without a value (blank counts as none) shows `[name]` and is unfilled.
 */
export function referenceDisplay(
	term: DefinedTerm | undefined,
	storedName: string
): ReferenceDisplay {
	const name = term?.name ?? storedName;
	if (!term?.variable) {
		return { name, text: name, variable: false, unfilled: false };
	}
	const value = term.value?.trim();
	return {
		name,
		text: value || `[${name}]`,
		variable: true,
		unfilled: !value,
	};
}

/** How a definition line says a name is a variable: `variable: AcmeBot`, or `variable, not set`. */
export function variableNote(value: string | undefined): string {
	const shown = value?.trim();
	return shown ? `variable: ${shown}` : "variable, not set";
}

/** How plain text is written. */
interface PlainTextOptions {
	/**
	 * Write each variable as `{name = "value"}` (`{name = (not set)}` while it
	 * has none) instead of its value, the value as a JSON string so that
	 * nothing in it can be taken for the end of the marker, for a reader that
	 * must tell a variable from fixed wording, such as a model.
	 */
	marked?: boolean;
}

/**
 * Text with every reference written as `{name}`, except a variable, which is
 * written as its value (or `[name]` while it has none). The name is the
 * entry's current name when the entry is in `terms`, otherwise the name stored
 * in the token.
 */
export function plainReferenceText(
	text: string,
	terms: readonly DefinedTerm[] = [],
	options: PlainTextOptions = {}
): string {
	if (!text.includes("{")) {
		return text;
	}
	return parseReferences(text)
		.map((segment) => {
			if (segment.type === "text") {
				return segment.text;
			}
			const shown = referenceDisplay(
				findTermById(terms, segment.id),
				segment.name
			);
			if (!shown.variable) {
				return `{${shown.text}}`;
			}
			if (options.marked) {
				return `{${shown.name} = ${shown.unfilled ? "(not set)" : JSON.stringify(shown.text)}}`;
			}
			return shown.text;
		})
		.join("");
}

/**
 * The name an activity notice shows for one element: its label, or, when it
 * has none, its description with references written as `{name}`. A notice is
 * made from a single element read on its own, so a reference shows the name
 * stored in its token, which is out of date if the entry was renamed since.
 */
export function noticeElementName(element: {
	description: string;
	name: string | null;
}): string {
	return element.name || plainReferenceText(element.description);
}

/**
 * A context entry as one string: `window: meaning (value: 5 minutes)`, or for a
 * variable `system: meaning (variable: AcmeBot)` and `(variable, not set)`.
 */
export function plainContextEntry(
	entry: ContextEntry,
	terms: readonly DefinedTerm[] = [],
	options: PlainTextOptions = {}
): string {
	if (!isNamedContextEntry(entry)) {
		return plainReferenceText(entry, terms, options);
	}
	const meaning = plainReferenceText(entry.text, terms, options);
	const head = meaning.trim() ? `${entry.name}: ${meaning}` : entry.name;
	if (entry.variable) {
		return `${head} (${variableNote(entry.value)})`;
	}
	return entry.value?.trim() ? `${head} (value: ${entry.value})` : head;
}

/** A case tree node in the shape the case had before named entries existed. */
export type PlainTreeNode = Omit<TreeNode, "children" | "context"> & {
	children: PlainTreeNode[];
	context?: string[];
};

/**
 * The whole case in today's shape: every context entry a string and every
 * reference written as `{name}`. Everything that hands case text to something
 * else (document exports, the Case Assistant, the rules check) is written
 * against this type, so the compiler flags a reader that is given the stored
 * shape by mistake.
 */
export type PlainCase = Omit<CaseExportNested, "tree"> & {
	tree: PlainTreeNode;
};

/** How an element still to fill in is marked in the text a model reads: `{to fill in: "hint"}`, the hint as a JSON string. */
function placeholderMarker(hint: string | null | undefined): string {
	const guidance = hint?.trim();
	return guidance
		? `{to fill in: ${JSON.stringify(guidance)}}`
		: "{to fill in}";
}

function plainNode(
	node: TreeNode,
	ancestors: readonly TermSource[],
	options: PlainTextOptions
): PlainTreeNode {
	const chain: TermSource[] = [
		{ id: node.id, name: node.name, context: node.context },
		...ancestors,
	];
	const terms = termsInReach(chain);
	const { context, children, ...rest } = node;
	const plain: PlainTreeNode = {
		...rest,
		children: children?.map((child) => plainNode(child, chain, options)),
	};
	// A field is only converted when the node has it as text, so a node keeps
	// exactly the fields it came with.
	if (typeof node.description === "string") {
		const description = plainReferenceText(node.description, terms, options);
		plain.description =
			options.marked && node.isPlaceholder
				? [description, placeholderMarker(node.placeholderHint)]
						.filter(Boolean)
						.join(" ")
				: description;
	}
	if (typeof node.assumption === "string") {
		plain.assumption = plainReferenceText(node.assumption, terms, options);
	}
	if (typeof node.justification === "string") {
		plain.justification = plainReferenceText(
			node.justification,
			terms,
			options
		);
	}
	if (context !== undefined) {
		plain.context = context.map((entry) =>
			plainContextEntry(entry, terms, options)
		);
	}
	return plain;
}

/**
 * Converts an exported case to its plain-text copy; the input is untouched.
 * The `marked` form is for a model: it writes each variable as
 * `{name = "value"}` and adds `{to fill in: "hint"}` to the description of an
 * element still to fill in, so the model can tell both from fixed wording.
 */
export function toPlainCase(
	caseExport: CaseExportNested,
	options: PlainTextOptions = {}
): PlainCase {
	return {
		...caseExport,
		tree: plainNode(caseExport.tree as TreeNode, [], options),
	};
}

// ---------------------------------------------------------------------------
// Variables that still have no value
// ---------------------------------------------------------------------------

/** The text of an element in which a reference can appear. */
interface ElementTexts {
	assumption?: string | null;
	context?: readonly ContextEntry[] | null;
	description?: string | null;
	justification?: string | null;
}

/**
 * The ids of the variables with no value that an element's text refers to,
 * resolved with the terms in its reach. A reference whose term is out of reach
 * is not a variable and does not count.
 */
export function unsetVariablesMentioned(
	element: ElementTexts,
	terms: readonly DefinedTerm[]
): string[] {
	const unset = new Set<string>();
	const scan = (text: string | null | undefined) => {
		if (!text?.includes("{")) {
			return;
		}
		for (const segment of parseReferences(text)) {
			if (segment.type !== "reference") {
				continue;
			}
			const term = findTermById(terms, segment.id);
			if (referenceDisplay(term, segment.name).unfilled) {
				unset.add(segment.id);
			}
		}
	};
	scan(element.description);
	scan(element.assumption);
	scan(element.justification);
	for (const entry of element.context ?? []) {
		scan(isNamedContextEntry(entry) ? entry.text : entry);
	}
	return [...unset];
}

// ---------------------------------------------------------------------------
// Whether a case uses the feature
// ---------------------------------------------------------------------------

function nodeUsesDefinedTerms(node: TreeNode): boolean {
	if (
		hasReference(node.description) ||
		hasReference(node.assumption) ||
		hasReference(node.justification)
	) {
		return true;
	}
	return (node.context ?? []).some(
		(entry) => isNamedContextEntry(entry) || hasReference(entry)
	);
}

/** Whether any element holds a named entry or a reference. */
export function caseUsesDefinedTerms(root: TreeNode): boolean {
	const pending: TreeNode[] = [root];
	for (let node = pending.pop(); node; node = pending.pop()) {
		if (nodeUsesDefinedTerms(node)) {
			return true;
		}
		pending.push(...node.children);
	}
	return false;
}
