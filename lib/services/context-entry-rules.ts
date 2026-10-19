/**
 * The rules for named context entries that need the database: an entry's id
 * is unique within its case, counting elements in the bin so that restoring
 * one cannot bring back a duplicate. The rules that need only the entries
 * themselves (names unique per element, ids unique per element) are in
 * lib/schemas/context-entry.ts.
 *
 * Every write path calls these before it writes: the single-element routes,
 * the JSON editor's batch and case import. Each returns a message for the
 * first problem, or undefined when the entries are fine.
 */

import { parseContextEntries } from "@/lib/case/defined-terms";
import {
	type ContextEntry,
	findContextIdProblem,
	findContextListProblem,
	isNamedContextEntry,
} from "@/lib/schemas/context-entry";
import type { TxClient } from "@/lib/utils/tree-traversal";

/** The ids of the named entries in a list. */
function namedEntryIds(context: readonly ContextEntry[]): string[] {
	return context.filter(isNamedContextEntry).map((entry) => entry.id);
}

/**
 * Checks the context list an element is about to be written with: no two
 * names equal ignoring case, no id repeated, and no id already used by another
 * element of the case (live or in the bin). `ownElementId` is the element being
 * updated, whose own entries do not count as clashes; it is undefined on
 * create.
 */
export async function checkContextEntriesForElement(
	db: TxClient,
	caseId: string,
	ownElementId: string | undefined,
	context: readonly ContextEntry[] | undefined
): Promise<string | undefined> {
	if (!context) {
		return;
	}
	const listProblem = findContextListProblem(context);
	if (listProblem) {
		return listProblem;
	}
	const ids = namedEntryIds(context);
	if (ids.length === 0) {
		return;
	}
	const clash = await db.assuranceElement.findFirst({
		where: {
			caseId,
			...(ownElementId ? { id: { not: ownElementId } } : {}),
			OR: ids.map((id) => ({ context: { array_contains: [{ id }] } })),
		},
		select: { context: true },
	});
	if (!clash) {
		return;
	}
	const taken = new Set(namedEntryIds(parseContextEntries(clash.context)));
	const id = ids.find((candidate) => taken.has(candidate)) ?? ids[0];
	return `Context entry id "${id}" is used by more than one entry in this case`;
}

/**
 * Checks the context lists of a whole case as they will stand after a write:
 * every element's names unique, and every id used once across the case. A
 * batch that deletes an entry and creates it again passes, because the check
 * sees only the final state.
 */
export function checkContextEntriesForCase(
	lists: Iterable<readonly ContextEntry[]>
): string | undefined {
	const all = [...lists];
	for (const list of all) {
		const problem = findContextListProblem(list);
		if (problem) {
			return problem;
		}
	}
	return findContextIdProblem(all);
}
