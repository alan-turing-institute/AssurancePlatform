/**
 * The shape of one entry in an element's `context` list.
 *
 * An entry is either plain text (stored exactly as it always was) or a named
 * entry: a small record that gives the text a name so other elements can refer
 * to it, with an optional value. The same schema backs every write path (the
 * element routes, the JSON editor's batch, case import) and the export file,
 * so a rule cannot differ between them.
 */

import { z } from "zod";

const CONTEXT_ENTRY_NAME_MAX_LENGTH = 40;
const CONTEXT_ENTRY_VALUE_MAX_LENGTH = 500;

/** Ten lowercase letters or digits. */
const CONTEXT_ENTRY_ID_PATTERN = /^[a-z0-9]{10}$/;

/** A letter first, then letters, digits, spaces, hyphens and underscores. */
const CONTEXT_ENTRY_NAME_PATTERN = /^\p{L}[\p{L}\p{Nd} _-]*$/u;

const NAMED_ENTRY_REQUIRED_KEYS = ["id", "name", "text"] as const;

/**
 * A context entry that carries a name (and optionally a value) so that text
 * elsewhere in the case can refer to it by id.
 */
export const NamedContextEntrySchema = z
	.strictObject({
		id: z
			.string()
			.regex(
				CONTEXT_ENTRY_ID_PATTERN,
				"Context entry ids must be 10 lowercase letters or digits"
			)
			.describe("Identifier of the entry, unique within the case"),
		name: z
			.string()
			.trim()
			.min(1, "Context entry names must not be empty")
			.max(
				CONTEXT_ENTRY_NAME_MAX_LENGTH,
				`Context entry names must be at most ${CONTEXT_ENTRY_NAME_MAX_LENGTH} characters`
			)
			.regex(
				CONTEXT_ENTRY_NAME_PATTERN,
				"Context entry names must start with a letter and use only letters, digits, spaces, hyphens and underscores"
			)
			.describe("Name other text can refer to"),
		text: z.string().describe("What the name means"),
		value: z
			.string()
			.max(
				CONTEXT_ENTRY_VALUE_MAX_LENGTH,
				`Context entry values must be at most ${CONTEXT_ENTRY_VALUE_MAX_LENGTH} characters`
			)
			.optional()
			.describe("Optional value for the name, such as a threshold"),
	})
	.describe("A context entry with a name, a meaning and an optional value");

export type NamedContextEntry = z.infer<typeof NamedContextEntrySchema>;

/**
 * The schema library reports a failed choice between a string and a record as
 * a bare "Invalid input". This says what was wrong with the entry instead.
 */
function describeInvalidContextEntry(input: unknown): string {
	if (typeof input === "object" && input !== null && !Array.isArray(input)) {
		const missing = NAMED_ENTRY_REQUIRED_KEYS.filter((key) => !(key in input));
		if (missing.length > 0) {
			return `A named context entry needs an id, a name and a text; missing ${missing.map((key) => `"${key}"`).join(", ")}`;
		}
	}
	return "A context entry must be a piece of text or a named entry with an id, a name, a text and an optional value";
}

/** One entry of a `context` list: a string, or a named entry. */
export const ContextEntrySchema = z
	.union([z.string(), NamedContextEntrySchema], {
		error: (issue) => describeInvalidContextEntry(issue.input),
	})
	.describe("A piece of context: plain text, or a named entry");

export type ContextEntry = z.infer<typeof ContextEntrySchema>;

/** A whole `context` list. */
export const ContextEntriesSchema = z.array(ContextEntrySchema);

export function isNamedContextEntry(
	entry: ContextEntry
): entry is NamedContextEntry {
	return typeof entry !== "string";
}

/** The form in which two names are compared: trimmed, without regard to case. */
function comparableContextEntryName(name: string): string {
	return name.trim().toLowerCase();
}

/**
 * Rules that look across the entries of one element's list: no two named
 * entries share a name, ignoring case, and no two share an id. Returns a
 * message for the first problem, or undefined when the list is fine.
 */
export function findContextListProblem(
	entries: readonly ContextEntry[]
): string | undefined {
	const names = new Map<string, string>();
	const ids = new Set<string>();
	for (const entry of entries) {
		if (!isNamedContextEntry(entry)) {
			continue;
		}
		const key = comparableContextEntryName(entry.name);
		const earlier = names.get(key);
		if (earlier !== undefined) {
			return `Context entry names must be unique within an element, ignoring case: "${earlier}" and "${entry.name.trim()}" both appear`;
		}
		names.set(key, entry.name.trim());
		if (ids.has(entry.id)) {
			return `Context entry id "${entry.id}" is used by more than one entry on the same element`;
		}
		ids.add(entry.id);
	}
	return;
}

/**
 * The case-wide id rule: no id appears on more than one named entry across
 * the given lists (one list per element, counting elements in the bin).
 */
export function findContextIdProblem(
	lists: Iterable<readonly ContextEntry[]>
): string | undefined {
	const seen = new Set<string>();
	for (const list of lists) {
		for (const entry of list) {
			if (!isNamedContextEntry(entry)) {
				continue;
			}
			if (seen.has(entry.id)) {
				return `Context entry id "${entry.id}" is used by more than one entry in this case`;
			}
			seen.add(entry.id);
		}
	}
	return;
}
