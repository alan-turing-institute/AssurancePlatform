import type { Tour } from "nextstepjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTour } from "../resolve-tour";

function addTarget(id: string): void {
	const el = document.createElement("div");
	el.setAttribute("data-tour", id);
	el.getBoundingClientRect = () =>
		({ width: 10, height: 10, top: 0, left: 0 }) as DOMRect;
	document.body.append(el);
}

function step(target?: string) {
	return {
		title: target ?? "centred",
		content: "x",
		...(target ? { selector: `[data-tour='${target}']` } : {}),
	};
}

describe("resolveTour", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = "";
	});

	it("drops a step whose target never appears", async () => {
		addTarget("a");
		addTarget("b");
		addTarget("c");
		const tour: Tour = {
			tour: "t",
			steps: [step("a"), step("b"), step("missing"), step("c")],
		};

		const promise = resolveTour(tour);
		await vi.advanceTimersByTimeAsync(2000);

		expect((await promise).steps.map((s) => s.title)).toEqual(["a", "b", "c"]);
	});

	it("keeps a target that appears within the timeout", async () => {
		addTarget("a");
		const tour: Tour = { tour: "t", steps: [step("a"), step("late")] };

		const promise = resolveTour(tour);
		await vi.advanceTimersByTimeAsync(300);
		addTarget("late");
		await vi.advanceTimersByTimeAsync(200);

		expect((await promise).steps).toHaveLength(2);
	});

	it("keeps steps with no target", async () => {
		addTarget("a");
		const tour: Tour = {
			tour: "t",
			steps: [step(), step("a"), step("missing"), step()],
		};

		const promise = resolveTour(tour);
		await vi.advanceTimersByTimeAsync(2000);

		expect((await promise).steps.map((s) => s.title)).toEqual([
			"centred",
			"a",
			"centred",
		]);
	});
});
