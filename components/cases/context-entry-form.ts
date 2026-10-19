/**
 * Helpers for the edit dialog's context entries: naming and un-naming an
 * entry, what the dialog sends back for the list, and the terms the
 * description editor can offer while the entries are still being edited.
 */

import {
	type DefinedTerm,
	parseContextEntries,
	termsInReach,
} from "@/lib/case/defined-terms";
import type {
	ContextEntry,
	NamedContextEntry,
} from "@/lib/schemas/context-entry";

/**
 * Whether a value in the form's `context` list is a named entry. The form can
 * briefly hold an empty slot while the list changes, so anything that is not
 * a record is treated as plain text.
 */
export function isNamedEntryValue(entry: unknown): entry is NamedContextEntry {
	return typeof entry === "object" && entry !== null;
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 10;
/** The largest multiple of the alphabet size that fits in a byte; bytes at or above it are redrawn so every character is equally likely. */
const UNBIASED_LIMIT = 252;

function randomId(): string {
	let id = "";
	while (id.length < ID_LENGTH) {
		const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
		for (const byte of bytes) {
			if (byte < UNBIASED_LIMIT && id.length < ID_LENGTH) {
				id += ID_ALPHABET.charAt(byte % ID_ALPHABET.length);
			}
		}
	}
	return id;
}

/**
 * A new id for a named entry: ten lowercase letters or digits, different from
 * every id in `taken`. It uses `crypto.getRandomValues` because that, unlike
 * `crypto.randomUUID`, is also available over plain http.
 */
export function createContextEntryId(taken: ReadonlySet<string>): string {
	let id = randomId();
	while (taken.has(id)) {
		id = randomId();
	}
	return id;
}

/** The ids of the named entries in a list. */
export function namedEntryIds(entries: readonly ContextEntry[]): Set<string> {
	const ids = new Set<string>();
	for (const entry of entries) {
		if (isNamedEntryValue(entry)) {
			ids.add(entry.id);
		}
	}
	return ids;
}

/** Turns the entry at `index` into a named entry with no name yet. */
export function nameEntryAt(
	entries: readonly ContextEntry[],
	index: number,
	taken: ReadonlySet<string>
): ContextEntry[] {
	return entries.map((entry, position) =>
		position === index && !isNamedEntryValue(entry)
			? { id: createContextEntryId(taken), name: "", text: entry }
			: entry
	);
}

/** Turns the named entry at `index` back into plain text; its name and value are dropped. */
export function unnameEntryAt(
	entries: readonly ContextEntry[],
	index: number
): ContextEntry[] {
	return entries.map((entry, position) =>
		position === index && isNamedEntryValue(entry) ? entry.text : entry
	);
}

function finaliseNamedEntry(entry: NamedContextEntry): NamedContextEntry {
	const value = entry.value?.trim();
	const finished: NamedContextEntry = {
		id: entry.id,
		name: entry.name.trim(),
		text: entry.text.trim(),
	};
	if (value) {
		finished.value = value;
	}
	return finished;
}

/**
 * The list the dialog sends back: text trimmed, blank text entries left out,
 * and each named entry rebuilt from its four fields so nothing else travels
 * with it.
 */
export function finaliseContextEntries(
	entries: readonly ContextEntry[]
): ContextEntry[] {
	const finished: ContextEntry[] = [];
	for (const entry of entries) {
		if (isNamedEntryValue(entry)) {
			finished.push(finaliseNamedEntry(entry));
			continue;
		}
		const text = typeof entry === "string" ? entry.trim() : "";
		if (text.length > 0) {
			finished.push(text);
		}
	}
	return finished;
}

/** The element a dialog is editing, as far as its terms are concerned. */
interface EditedElement {
	id?: unknown;
	name?: unknown;
	termsInReach?: unknown;
}

/**
 * The terms the description editor and the "Terms you can use here" list
 * offer. The entries on the element come from the form, so a name given in
 * the dialog can be used before it is saved; the terms above come from the
 * card's data. A name still being typed (empty) is left out.
 */
export function termsForEditedElement(
	element: EditedElement,
	contextEntries: readonly ContextEntry[]
): DefinedTerm[] {
	const elementId = String(element.id ?? "");
	const own = termsInReach([
		{
			id: elementId,
			name: typeof element.name === "string" ? element.name : null,
			context: parseContextEntries(contextEntries),
		},
	]);
	const inherited = Array.isArray(element.termsInReach)
		? (element.termsInReach as DefinedTerm[]).filter(
				(term) => term.definedOn.elementId !== elementId
			)
		: [];
	return [...own, ...inherited].filter((term) => term.name.trim().length > 0);
}
