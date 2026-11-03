/**
 * The variables a pattern offers, and setting their values.
 *
 * A pattern's variables are its named context entries marked as variables, on
 * any element of its tree. They are read from an exported case file as it is
 * stored, which may come from the database or a client, so every read here
 * tolerates a shape it does not expect and never throws. Nothing in this file
 * touches the store or the database, so it runs in the browser and on the
 * server alike.
 */

import {
	parseContextEntries,
	plainReferenceText,
	type TermSource,
	termsInReach,
} from "@/lib/case/defined-terms";
import {
	type ContextEntry,
	isNamedContextEntry,
	type NamedContextEntry,
} from "@/lib/schemas/context-entry";

/** One variable of a pattern: what it is called, what it means and any value it already has. */
export interface PatternVariable {
	/** The id of the context entry that defines the variable. */
	id: string;
	/** What the variable means, with references to other names written as they are shown. */
	meaning: string;
	name: string;
	/** The value the pattern gives the variable; absent when it has none. */
	value?: string;
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function childrenOf(node: RecordLike): RecordLike[] {
	return Array.isArray(node.children) ? node.children.filter(isRecord) : [];
}

function termSourceOf(
	node: RecordLike,
	context: readonly ContextEntry[]
): TermSource {
	return {
		id: typeof node.id === "string" ? node.id : "",
		name: typeof node.name === "string" ? node.name : null,
		context,
	};
}

function toVariable(
	entry: NamedContextEntry,
	chain: readonly TermSource[]
): PatternVariable {
	const variable: PatternVariable = {
		id: entry.id,
		name: entry.name,
		meaning: plainReferenceText(entry.text, termsInReach(chain)).trim(),
	};
	const value = entry.value?.trim();
	if (value) {
		variable.value = value;
	}
	return variable;
}

function collectVariables(
	node: RecordLike,
	ancestors: readonly TermSource[],
	found: PatternVariable[]
): void {
	const context = parseContextEntries(node.context);
	const chain = [termSourceOf(node, context), ...ancestors];
	for (const entry of context) {
		if (isNamedContextEntry(entry) && entry.variable) {
			found.push(toVariable(entry, chain));
		}
	}
	for (const child of childrenOf(node)) {
		collectVariables(child, chain, found);
	}
}

/**
 * The variables of an exported case file, in tree order: the top element's
 * first, then each element's own entries before those of the elements beneath
 * it. A file that is not a case file has none.
 */
export function patternVariables(file: unknown): PatternVariable[] {
	if (!(isRecord(file) && isRecord(file.tree))) {
		return [];
	}
	const found: PatternVariable[] = [];
	collectVariables(file.tree, [], found);
	return found;
}

/**
 * The entry with its value replaced by the one given for its id, or left
 * without a value when that is empty. Only a variable is changed, and one that
 * has no entry in `values` keeps the value it has.
 */
function withValue(
	entry: unknown,
	values: ReadonlyMap<string, string>
): unknown {
	if (!isRecord(entry) || entry.variable !== true) {
		return entry;
	}
	const given = typeof entry.id === "string" ? values.get(entry.id) : undefined;
	if (given === undefined) {
		return entry;
	}
	const { value: _replaced, ...rest } = entry;
	const value = given.trim();
	return value ? { ...rest, value } : rest;
}

function withValuesBeneath(
	node: unknown,
	values: ReadonlyMap<string, string>
): unknown {
	if (!isRecord(node)) {
		return node;
	}
	return {
		...node,
		...(Array.isArray(node.context) && {
			context: node.context.map((entry) => withValue(entry, values)),
		}),
		...(Array.isArray(node.children) && {
			children: node.children.map((child) => withValuesBeneath(child, values)),
		}),
	};
}

/**
 * A copy of an exported case file in which the variables named in `values`
 * hold the given values: each value is trimmed and stored as it is, never read
 * for references or markup, and an empty one leaves the variable without a
 * value. No text is rewritten, and the file passed in is not changed.
 */
export function setVariableValues(
	file: unknown,
	values: ReadonlyMap<string, string>
): unknown {
	return isRecord(file)
		? { ...file, tree: withValuesBeneath(file.tree, values) }
		: file;
}
