import { act, renderHook } from "@testing-library/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { describe, expect, it, vi } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	filterTerms,
	isListVisible,
	type ReferenceListState,
	useReferenceSuggestion,
} from "../use-reference-suggestion";

function term(name: string, elementName: string): DefinedTerm {
	return {
		id: `${name}-id`,
		name,
		text: `meaning of ${name}`,
		definedOn: { elementId: elementName, elementName },
	};
}

const WINDOW = term("window", "S2");
const OUTER_WINDOW = term("Window", "G1");
const RATE = term("rate", "G1");

function listOf(items: DefinedTerm[], query: string): ReferenceListState {
	return { items, position: null, query, select: () => undefined };
}

describe("filterTerms", () => {
	it("returns every term, in the order given, when nothing has been typed", () => {
		expect(filterTerms([WINDOW, RATE], "")).toEqual([WINDOW, RATE]);
		expect(filterTerms([WINDOW, RATE], "   ")).toEqual([WINDOW, RATE]);
	});

	it("keeps the terms whose name contains what was typed, ignoring case", () => {
		expect(filterTerms([WINDOW, RATE], "WIN")).toEqual([WINDOW]);
		expect(filterTerms([WINDOW, RATE], "at")).toEqual([RATE]);
	});

	it("lists two terms with the same name, nearer first", () => {
		expect(filterTerms([WINDOW, OUTER_WINDOW, RATE], "window")).toEqual([
			WINDOW,
			OUTER_WINDOW,
		]);
	});

	it("matches a name with a space in it as the space is typed", () => {
		const sized = term("window size", "G1");
		expect(filterTerms([WINDOW, sized], "window s")).toEqual([sized]);
	});

	it("returns nothing when no name matches", () => {
		expect(filterTerms([WINDOW, RATE], "zzz")).toEqual([]);
	});
});

describe("isListVisible", () => {
	it("is hidden when no suggestion is active", () => {
		expect(isListVisible(null, 3)).toBe(false);
	});

	it("is shown when there are terms to pick", () => {
		expect(isListVisible(listOf([WINDOW], "w"), 3)).toBe(true);
	});

	it("is hidden when what was typed matches nothing, so Escape then closes the dialog", () => {
		expect(isListVisible(listOf([], "zzz"), 3)).toBe(false);
	});

	it("is shown with a hint when there are no terms at all", () => {
		expect(isListVisible(listOf([], ""), 0)).toBe(true);
		expect(isListVisible(listOf([], "x"), 0)).toBe(false);
	});
});

describe("useReferenceSuggestion", () => {
	function keydown(key: string, init: KeyboardEventInit = {}) {
		return { event: new KeyboardEvent("keydown", { key, ...init }) };
	}

	function setup(items: DefinedTerm[]) {
		const command = vi.fn();
		const hook = renderHook(() => useReferenceSuggestion(items));
		const handlers = hook.result.current.suggestion.render();
		const show = (query = "", loading = false) =>
			act(() =>
				handlers.onUpdate({
					items,
					command,
					query,
					loading,
					clientRect: null,
				} as unknown as SuggestionProps<DefinedTerm>)
			);
		const press = (key: string, init: KeyboardEventInit = {}) => {
			let handled = false;
			act(() => {
				handled = handlers.onKeyDown(keydown(key, init));
			});
			return handled;
		};
		return { command, handlers, hook, press, show };
	}

	it("draws the list once the add-on has the items, not for its interim update without them", () => {
		const { hook, show } = setup([WINDOW, RATE]);

		show("", true);
		expect(hook.result.current.list).toBeNull();

		show("");
		expect(hook.result.current.list?.items).toEqual([WINDOW, RATE]);
		expect(hook.result.current.visible).toBe(true);
	});

	it("moves the highlight with the arrow keys, wrapping at both ends", () => {
		const { hook, press, show } = setup([WINDOW, RATE]);
		show();

		expect(press("ArrowDown")).toBe(true);
		expect(hook.result.current.activeIndex).toBe(1);
		press("ArrowDown");
		expect(hook.result.current.activeIndex).toBe(0);
		press("ArrowUp");
		expect(hook.result.current.activeIndex).toBe(1);
	});

	it("inserts the highlighted term on Enter", () => {
		const { command, press, show } = setup([WINDOW, RATE]);
		show();
		press("ArrowDown");

		expect(press("Enter")).toBe(true);

		expect(command).toHaveBeenCalledWith({ id: RATE.id, label: RATE.name });
	});

	it("starts the highlight at the top again when what was typed changes", () => {
		const { hook, press, show } = setup([WINDOW, RATE]);
		show("");
		press("ArrowDown");
		expect(hook.result.current.activeIndex).toBe(1);

		show("r");

		expect(hook.result.current.activeIndex).toBe(0);
	});

	it("leaves other keys, Shift+Enter and typing during composition to the editor", () => {
		const { command, handlers, press, show } = setup([WINDOW]);
		show();

		expect(press("a")).toBe(false);
		expect(press("Enter", { shiftKey: true })).toBe(false);
		expect(
			handlers.onKeyDown({
				event: new KeyboardEvent("keydown", {
					key: "Enter",
					isComposing: true,
				}),
			} as never)
		).toBe(false);
		expect(command).not.toHaveBeenCalled();
	});

	it("leaves Enter and the arrows to the editor when there is nothing to pick", () => {
		const { press, show } = setup([]);
		show();

		expect(press("Enter")).toBe(false);
		expect(press("ArrowDown")).toBe(false);
	});

	it("closes the list when the add-on exits", () => {
		const { handlers, hook, show } = setup([WINDOW]);
		show();

		act(() => handlers.onExit());

		expect(hook.result.current.list).toBeNull();
		expect(hook.result.current.visible).toBe(false);
	});
});
