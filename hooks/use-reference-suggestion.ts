"use client";

import { SuggestionPluginKey, type SuggestionProps } from "@tiptap/suggestion";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DefinedTerm } from "@/lib/case/defined-terms";

/** What the pick-list needs to draw itself and to insert the chosen term. */
export interface ReferenceListState {
	items: DefinedTerm[];
	/** Where the caret is, for the list to sit under. */
	position: (() => DOMRect | null) | null;
	query: string;
	/** Inserts the term in place of what has been typed since the `{`. */
	select: (term: DefinedTerm) => void;
}

/** The terms whose name contains what was typed, nearest definition first. */
export function filterTerms(
	terms: readonly DefinedTerm[],
	query: string
): DefinedTerm[] {
	const wanted = query.trim().toLowerCase();
	if (!wanted) {
		return [...terms];
	}
	return terms.filter((term) => term.name.toLowerCase().includes(wanted));
}

/** Whether the list has something to say: choices, or a hint that there are none. */
export function isListVisible(
	list: ReferenceListState | null,
	termCount: number
): boolean {
	if (!list) {
		return false;
	}
	return list.items.length > 0 || (list.query === "" && termCount === 0);
}

/**
 * The pick-list behind typing `{` in an element's text. It supplies the
 * options for the mention add-on and the state the list is drawn from, so the
 * list can be drawn by the page's own popover rather than by the add-on.
 *
 * `terms` is read when a query changes, so the list always reflects the
 * entries as they stand in the form.
 */
export function useReferenceSuggestion(terms: readonly DefinedTerm[]) {
	const termsRef = useRef(terms);
	termsRef.current = terms;

	const [list, setList] = useState<ReferenceListState | null>(null);
	const [activeIndex, setActiveIndexState] = useState(0);
	const listRef = useRef<ReferenceListState | null>(null);
	const activeIndexRef = useRef(0);

	const setActiveIndex = useCallback((index: number) => {
		activeIndexRef.current = index;
		setActiveIndexState(index);
	}, []);

	const suggestion = useMemo(() => {
		const show = (props: SuggestionProps<DefinedTerm>) => {
			const previous = listRef.current;
			const next: ReferenceListState = {
				items: props.items,
				position: props.clientRect ?? null,
				query: props.query,
				select: (term) => props.command({ id: term.id, label: term.name }),
			};
			listRef.current = next;
			if (!previous || previous.query !== next.query) {
				setActiveIndex(0);
			}
			setList(next);
		};

		const move = (step: number) => {
			const count = listRef.current?.items.length ?? 0;
			if (count > 0) {
				setActiveIndex((activeIndexRef.current + step + count) % count);
			}
		};

		const choose = () => {
			const current = listRef.current;
			const term = current?.items[activeIndexRef.current];
			if (!(current && term)) {
				return false;
			}
			current.select(term);
			return true;
		};

		return {
			char: "{",
			pluginKey: SuggestionPluginKey,
			// Names may contain spaces, and a `{` can follow any character.
			allowSpaces: true,
			allowedPrefixes: null,
			decorationClass: "rounded-sm bg-primary/10",
			items: ({ query }: { query: string }) =>
				filterTerms(termsRef.current, query),
			render: () => ({
				onStart: show,
				onUpdate: show,
				onExit: () => {
					listRef.current = null;
					setActiveIndex(0);
					setList(null);
				},
				onKeyDown: ({ event }: { event: KeyboardEvent }) => {
					if (event.isComposing || !listRef.current?.items.length) {
						return false;
					}
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						move(event.key === "ArrowDown" ? 1 : -1);
						return true;
					}
					return event.key === "Enter" && !event.shiftKey && choose();
				},
			}),
		};
	}, [setActiveIndex]);

	return {
		activeIndex,
		list,
		setActiveIndex,
		suggestion,
		visible: isListVisible(list, terms.length),
	};
}
