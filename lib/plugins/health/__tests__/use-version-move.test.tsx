import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { draftFromCheck } from "../criteria-draft";
import { useVersionMove } from "../use-version-move";
import { checkLists } from "./criteria-test-data";

const buttons: HTMLButtonElement[] = [];

/** Renders the hook with an opener button already attached, as the form has one before it is rendered. */
function render(attach = true) {
	const button = document.createElement("button");
	document.body.append(button);
	buttons.push(button);
	const hook = renderHook(() => {
		const move = useVersionMove();
		if (attach) {
			move.opener.current = button;
		}
		return move;
	});
	return { ...hook, button };
}

function movedSettings() {
	const check = checkLists()[0]?.checks[0] as HealthCheck;
	return { check, draft: draftFromCheck(check, "integration-1") };
}

afterEach(() => {
	for (const button of buttons.splice(0)) {
		button.remove();
	}
});

describe("moving settings to another check version", () => {
	it("starts with no comparison and nothing moved", () => {
		const { result } = render();

		expect(result.current.comparing).toBe(false);
		expect(result.current.moved).toBeNull();
	});

	it("shows the comparison when it is opened", () => {
		const { result } = render();

		act(() => result.current.open());

		expect(result.current.comparing).toBe(true);
	});

	it("holds the moved settings, and closes the comparison, once the person continues", () => {
		const { result } = render();
		const next = movedSettings();
		act(() => result.current.open());

		act(() => result.current.continueWith(next));

		expect(result.current.comparing).toBe(false);
		expect(result.current.moved).toBe(next);
	});

	it("lets go of the moved settings when they are cleared", () => {
		const { result } = render();
		act(() => result.current.continueWith(movedSettings()));

		act(() => result.current.clear());

		expect(result.current.moved).toBeNull();
	});
});

describe("focus around the comparison", () => {
	it("is not taken by the opener when the form first appears", () => {
		const { button } = render();

		expect(document.activeElement).not.toBe(button);
	});

	it("is not taken by the opener while the comparison is open", () => {
		const { result, button } = render();

		act(() => result.current.open());

		expect(document.activeElement).not.toBe(button);
	});

	it("returns to the opener when the comparison is cancelled", () => {
		const { result, button } = render();
		act(() => result.current.open());

		act(() => result.current.cancel());

		expect(result.current.comparing).toBe(false);
		expect(document.activeElement).toBe(button);
	});

	it("does not return to the opener when the person continues instead", () => {
		const { result, button } = render();
		act(() => result.current.open());
		act(() => result.current.cancel());
		button.blur();
		act(() => result.current.open());

		act(() => result.current.continueWith(movedSettings()));

		expect(document.activeElement).not.toBe(button);
	});

	it("is left alone, without an error, when no opener is attached", () => {
		const { result } = render(false);
		act(() => result.current.open());

		expect(() => act(() => result.current.cancel())).not.toThrow();
		expect(result.current.comparing).toBe(false);
	});
});
