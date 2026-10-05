import { act, render, waitFor } from "@testing-library/react";
import type { Tour } from "nextstepjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTour } from "@/lib/tours/index.ts";
import {
	resetTourControls,
	useTourControls,
} from "@/lib/tours/tour-controls.ts";

const SELECTOR_ID = /'([^']+)'/;

const nextStepState = {
	currentStep: 0,
	currentTour: null as string | null,
	isNextStepVisible: false,
};
const startNextStep = vi.fn();
let lastSteps: Tour[] = [];

vi.mock("nextstepjs", () => ({
	NextStepProvider: ({ children }: { children: React.ReactNode }) => children,
	NextStep: ({
		children,
		steps,
	}: {
		children: React.ReactNode;
		steps: Tour[];
	}) => {
		lastSteps = steps;
		return children;
	},
	useNextStep: () => ({ ...nextStepState, startNextStep }),
}));

vi.mock("@/components/tour/tour-card", () => ({ default: () => null }));

// Adds a tour whose every step is targeted, so it can prune to nothing.
vi.mock("@/lib/tours", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/tours")>("@/lib/tours");
	const onlyTargeted: Tour = {
		tour: "only-targeted",
		steps: [
			{
				title: "x",
				content: "x",
				selector: "[data-tour='absent-one']",
			} as never,
		],
	};
	return {
		...actual,
		getTour: (id: string) =>
			id === "only-targeted" ? onlyTargeted : actual.getTour(id),
	};
});

const { TourProvider } = await import("../tour-provider.tsx");

function addTarget(selector: string) {
	const id = SELECTOR_ID.exec(selector)?.[1] ?? "";
	const element = document.createElement("div");
	element.setAttribute("data-tour", id);
	element.getBoundingClientRect = () =>
		({
			width: 40,
			height: 30,
			top: 5,
			left: 7,
			right: 47,
			bottom: 35,
			x: 7,
			y: 5,
		}) as DOMRect;
	document.body.appendChild(element);
}

describe("TourProvider (adversarial)", () => {
	let noop: ReturnType<typeof useTourControls.getState>["startTour"];

	beforeEach(() => {
		resetTourControls();
		noop = useTourControls.getState().startTour;
		startNextStep.mockClear();
		nextStepState.currentStep = 0;
		nextStepState.currentTour = null;
		nextStepState.isNextStepVisible = false;
		lastSteps = [];
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("registers a real startTour on mount and restores the no-op on unmount", () => {
		const { unmount } = render(
			<TourProvider>
				<div />
			</TourProvider>
		);
		expect(useTourControls.getState().startTour).not.toBe(noop);
		unmount();
		expect(useTourControls.getState().startTour).toBe(noop);
	});

	it("ignores an unknown tour id", async () => {
		render(
			<TourProvider>
				<div />
			</TourProvider>
		);
		act(() => useTourControls.getState().startTour("nonexistent" as never));
		await new Promise((r) => setTimeout(r, 50));
		expect(startNextStep).not.toHaveBeenCalled();
	});

	it("does not start a tour whose targets are all absent", async () => {
		render(
			<TourProvider>
				<div />
			</TourProvider>
		);
		act(() => useTourControls.getState().startTour("only-targeted" as never));
		await new Promise((r) => setTimeout(r, 1800));
		expect(startNextStep).not.toHaveBeenCalled();
	}, 10_000);

	it("does not start after unmounting while targets were still being awaited", async () => {
		const { unmount } = render(
			<TourProvider>
				<div />
			</TourProvider>
		);
		act(() => useTourControls.getState().startTour("dashboard"));
		unmount();
		await new Promise((r) => setTimeout(r, 1800));
		expect(startNextStep).not.toHaveBeenCalled();
	}, 10_000);

	it("hands the library the pruned tour, then starts it", async () => {
		const original = getTour("dashboard") as Tour;
		const targeted = original.steps.filter((s) => s.selector);
		// Leave out the first targeted step; the rest are present.
		for (const s of targeted.slice(1)) {
			addTarget(s.selector as string);
		}
		render(
			<TourProvider>
				<div />
			</TourProvider>
		);
		act(() => useTourControls.getState().startTour("dashboard"));
		await waitFor(
			() => expect(startNextStep).toHaveBeenCalledWith("dashboard"),
			{
				timeout: 4000,
			}
		);
		const given = lastSteps.find((t) => t.tour === "dashboard") as Tour;
		expect(given.steps).toHaveLength(original.steps.length - 1);
		expect(given.steps.map((s) => s.selector)).not.toContain(
			targeted[0].selector
		);
		// Other tours are untouched.
		expect(lastSteps.find((t) => t.tour === "demo-case")).toBe(
			getTour("demo-case")
		);
	}, 10_000);

	it("positions the pointer from the same pruned steps the library was given", async () => {
		const original = getTour("dashboard") as Tour;
		const targeted = original.steps.filter((s) => s.selector);
		for (const s of targeted.slice(1)) {
			addTarget(s.selector as string);
		}
		const pointer = document.createElement("div");
		pointer.setAttribute("data-name", "nextstep-pointer");
		document.body.appendChild(pointer);

		const ui = () => (
			<TourProvider>
				<div />
			</TourProvider>
		);
		const { rerender } = render(ui());
		act(() => useTourControls.getState().startTour("dashboard"));
		await waitFor(() => expect(startNextStep).toHaveBeenCalled(), {
			timeout: 4000,
		});

		// Pruned index 1 is the second targeted step's predecessor-free slot:
		// [intro, <targeted[1]>, ...]. In the static list index 1 is the
		// absent targeted[0], which would leave the pointer untouched.
		nextStepState.currentTour = "dashboard";
		nextStepState.isNextStepVisible = true;
		nextStepState.currentStep = 1;
		rerender(ui());

		await waitFor(() => expect(pointer.style.width).toBe("50px"));
		expect(pointer.style.height).toBe("40px");
	}, 10_000);
});
