import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useReturnFocus } from "../use-return-focus";

function addButton(label: string) {
	const button = document.createElement("button");
	button.textContent = label;
	document.body.appendChild(button);
	return button;
}

function cancelable() {
	return new Event("focus", { cancelable: true });
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("useReturnFocus edge cases", () => {
	it("forgets the opener once the dialog has closed", () => {
		const opener = addButton("Delete");
		const other = addButton("Other");
		const { result } = renderHook(() => useReturnFocus());

		opener.focus();
		result.current.onOpenAutoFocus(cancelable());
		result.current.onCloseAutoFocus(cancelable());

		other.focus();
		const secondClose = cancelable();
		result.current.onCloseAutoFocus(secondClose);

		expect(document.activeElement).toBe(other);
		expect(secondClose.defaultPrevented).toBe(false);
	});

	it("returns to the most recent opener when opened twice", () => {
		const first = addButton("First");
		const second = addButton("Second");
		const { result } = renderHook(() => useReturnFocus());

		first.focus();
		result.current.onOpenAutoFocus(cancelable());
		second.focus();
		result.current.onOpenAutoFocus(cancelable());
		result.current.onCloseAutoFocus(cancelable());

		expect(document.activeElement).toBe(second);
	});

	it("reads the fallback when the dialog closes, not when it renders", () => {
		const opener = addButton("Delete");
		const late = addButton("Late");
		const fallback: { current: HTMLElement | null } = { current: null };
		const { result } = renderHook(() => useReturnFocus(fallback));

		opener.focus();
		result.current.onOpenAutoFocus(cancelable());
		opener.remove();
		fallback.current = late;
		result.current.onCloseAutoFocus(cancelable());

		expect(document.activeElement).toBe(late);
	});

	it("leaves the default alone when the fallback has also left the document", () => {
		const opener = addButton("Delete");
		const gone = addButton("Gone");
		const { result } = renderHook(() => useReturnFocus({ current: gone }));

		opener.focus();
		result.current.onOpenAutoFocus(cancelable());
		opener.remove();
		gone.remove();
		const close = cancelable();
		result.current.onCloseAutoFocus(close);

		expect(close.defaultPrevented).toBe(false);
	});

	it("does not treat a non-HTML element as an opener", () => {
		const fallback = addButton("List");
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("tabindex", "0");
		document.body.appendChild(svg);
		const { result } = renderHook(() => useReturnFocus({ current: fallback }));

		svg.focus();
		result.current.onOpenAutoFocus(cancelable());
		svg.remove();
		result.current.onCloseAutoFocus(cancelable());

		expect(document.activeElement).toBe(fallback);
	});

	it("uses the fallback supplied on the latest render", () => {
		const opener = addButton("Delete");
		const older = addButton("Older");
		const newer = addButton("Newer");
		const { result, rerender } = renderHook(
			({ target }) => useReturnFocus({ current: target }),
			{ initialProps: { target: older } }
		);

		rerender({ target: newer });
		opener.focus();
		result.current.onOpenAutoFocus(cancelable());
		opener.remove();
		result.current.onCloseAutoFocus(cancelable());

		expect(document.activeElement).toBe(newer);
	});

	it("keeps the same handlers across renders", () => {
		const { result, rerender } = renderHook(() => useReturnFocus());
		const before = result.current;
		rerender();
		expect(result.current).toBe(before);
	});
});
