import type { Step, Tour } from "nextstepjs";
import { afterEach, describe, expect, it } from "vitest";
import { resolveTour } from "../resolve-tour.ts";

const FAST = { timeoutMs: 150, intervalMs: 10 };

function step(title: string, selector?: string): Step {
	return { title, content: title, ...(selector ? { selector } : {}) } as Step;
}

function addTarget(id: string, size = { width: 20, height: 20 }): HTMLElement {
	const element = document.createElement("div");
	element.setAttribute("data-tour", id);
	element.getBoundingClientRect = () =>
		({ ...size, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 }) as DOMRect;
	document.body.appendChild(element);
	return element;
}

const sel = (id: string) => `[data-tour='${id}']`;

describe("resolveTour (adversarial)", () => {
	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("keeps untargeted steps and drops steps whose target never appears, preserving order", async () => {
		addTarget("a");
		addTarget("c");
		const tour: Tour = {
			tour: "t",
			steps: [
				step("intro"),
				step("A", sel("a")),
				step("B", sel("missing")),
				step("C", sel("c")),
				step("outro"),
			],
		};

		const resolved = await resolveTour(tour, FAST);

		expect(resolved.steps.map((s) => s.title)).toEqual([
			"intro",
			"A",
			"C",
			"outro",
		]);
		expect(resolved.tour).toBe("t");
	});

	it("treats an element with a zero-size bounding rect as absent", async () => {
		addTarget("flat", { width: 0, height: 0 });
		addTarget("thin", { width: 10, height: 0 });
		addTarget("real");
		const tour: Tour = {
			tour: "t",
			steps: [
				step("flat", sel("flat")),
				step("thin", sel("thin")),
				step("real", sel("real")),
			],
		};

		const resolved = await resolveTour(tour, FAST);

		expect(resolved.steps.map((s) => s.title)).toEqual(["real"]);
	});

	it("retains a target that appears before the timeout", async () => {
		const tour: Tour = {
			tour: "t",
			steps: [step("late", sel("late")), step("gone", sel("gone"))],
		};
		setTimeout(() => addTarget("late"), 40);

		const resolved = await resolveTour(tour, {
			timeoutMs: 300,
			intervalMs: 10,
		});

		expect(resolved.steps.map((s) => s.title)).toEqual(["late"]);
	});

	it("drops a target that appears only after the timeout", async () => {
		const tour: Tour = { tour: "t", steps: [step("late", sel("late"))] };
		setTimeout(() => addTarget("late"), 500);

		const resolved = await resolveTour(tour, FAST);

		expect(resolved.steps).toEqual([]);
	});

	it("does not mutate the input tour", async () => {
		const tour: Tour = {
			tour: "t",
			steps: [step("x", sel("nope")), step("y")],
		};

		await resolveTour(tour, FAST);

		expect(tour.steps).toHaveLength(2);
	});

	it("returns promptly when every target is already present", async () => {
		addTarget("a");
		const tour: Tour = { tour: "t", steps: [step("A", sel("a"))] };
		const started = Date.now();

		await resolveTour(tour, { timeoutMs: 2000, intervalMs: 500 });

		expect(Date.now() - started).toBeLessThan(400);
	});
});
