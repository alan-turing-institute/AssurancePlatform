import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useReturnFocus } from "../use-return-focus";

function addButton(label: string) {
	const button = document.createElement("button");
	button.textContent = label;
	document.body.appendChild(button);
	return button;
}

function closeEvent() {
	return new Event("focus", { cancelable: true });
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("useReturnFocus", () => {
	it("focuses the element that was active when the dialog opened", () => {
		const opener = addButton("Delete");
		const inside = addButton("Cancel");
		const { result } = renderHook(() => useReturnFocus());

		opener.focus();
		const open = new Event("focus", { cancelable: true });
		result.current.onOpenAutoFocus(open);
		expect(open.defaultPrevented).toBe(false);

		inside.focus();
		const close = closeEvent();
		result.current.onCloseAutoFocus(close);

		expect(document.activeElement).toBe(opener);
		expect(close.defaultPrevented).toBe(true);
	});

	it("uses the fallback when the opener has left the document", () => {
		const opener = addButton("Delete");
		const fallback = addButton("List");
		const { result } = renderHook(() => useReturnFocus({ current: fallback }));

		opener.focus();
		result.current.onOpenAutoFocus(new Event("focus"));
		opener.remove();

		const close = closeEvent();
		result.current.onCloseAutoFocus(close);

		expect(document.activeElement).toBe(fallback);
		expect(close.defaultPrevented).toBe(true);
	});

	it("leaves the default alone when there is nothing to focus", () => {
		const opener = addButton("Delete");
		const { result } = renderHook(() => useReturnFocus());

		opener.focus();
		result.current.onOpenAutoFocus(new Event("focus"));
		opener.remove();

		const close = closeEvent();
		result.current.onCloseAutoFocus(close);

		expect(close.defaultPrevented).toBe(false);
	});

	it("ignores the page body as an opener", () => {
		const fallback = addButton("List");
		const { result } = renderHook(() => useReturnFocus({ current: fallback }));

		result.current.onOpenAutoFocus(new Event("focus"));
		const close = closeEvent();
		result.current.onCloseAutoFocus(close);

		expect(document.activeElement).toBe(fallback);
	});
});
