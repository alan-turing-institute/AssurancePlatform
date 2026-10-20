"use client";

import type { UseFormReturn } from "react-hook-form";
import {
	isNamedEntryValue,
	namedEntryIds,
	nameEntryAt,
	termsForEditedElement,
	unnameEntryAt,
} from "@/components/cases/context-entry-form";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	type ContextEntry,
	findContextListProblem,
} from "@/lib/schemas/context-entry";
import type { NodeEditFormInput } from "@/lib/schemas/element";

/** The problem with an entry list as a whole, ignoring names still being typed. */
export function findDraftContextProblem(
	entries: readonly ContextEntry[]
): string | undefined {
	return findContextListProblem(
		entries.filter(
			(entry) =>
				typeof entry === "string" ||
				(isNamedEntryValue(entry) && !!entry.name?.trim())
		)
	);
}

/**
 * Naming and un-naming the context entries in the edit dialog's form, and the
 * terms the element's text can refer to as the entries now stand.
 */
export function useContextNaming(
	form: UseFormReturn<NodeEditFormInput>,
	element: Record<string, unknown> | undefined,
	entries: readonly ContextEntry[]
): {
	contextProblem: string | undefined;
	nameContext: (index: number) => void;
	terms: DefinedTerm[];
	unnameContext: (index: number) => void;
} {
	const terms = termsForEditedElement(element ?? {}, entries);

	const nameContext = (index: number) => {
		const current = form.getValues("context") ?? [];
		const taken = new Set([
			...namedEntryIds(current),
			...terms.map((term) => term.id),
		]);
		form.setValue("context", nameEntryAt(current, index, taken), {
			shouldDirty: true,
		});
	};

	const unnameContext = (index: number) => {
		form.setValue(
			"context",
			unnameEntryAt(form.getValues("context") ?? [], index),
			{ shouldDirty: true }
		);
	};

	return {
		contextProblem: findDraftContextProblem(entries),
		nameContext,
		terms,
		unnameContext,
	};
}
