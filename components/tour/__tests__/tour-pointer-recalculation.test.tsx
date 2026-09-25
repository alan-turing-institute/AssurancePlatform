import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Tour } from "nextstepjs";
import { NextStep, NextStepProvider, useNextStep } from "nextstepjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TourCard from "@/components/tour/tour-card";

// Regression coverage for AP-QA-009: `patches/nextstepjs@2.3.0.patch` adds a
// pointer-position recalculation to nextstepjs's internal `nextStep`/
// `prevStep`. A patch that fails to apply is not fatal to `pnpm install`
// (it warns and exits 0), so the only thing that reliably catches a silently
// unapplied patch is checking the installed dist directly — the same check
// the finding's own reproduction command uses.
//
// The click-driven assertion below documents the user-observable behaviour
// the patch targets (the pointer follows the tour to its next target); it
// unmocks the real nextstepjs library, the same way
// components/modals/__tests__/help-modal.tour-provider.test.tsx does.

const testTour: Tour = {
	tour: "test-tour",
	steps: [
		{ content: "a", selector: "#step-a", title: "Step A" },
		{ content: "b", selector: "#step-b", title: "Step B" },
	],
};

const rectsById: Record<string, DOMRect> = {
	"step-a": {
		x: 10,
		y: 20,
		width: 100,
		height: 40,
		top: 20,
		left: 10,
		right: 110,
		bottom: 60,
		toJSON() {
			return this;
		},
	} as DOMRect,
	"step-b": {
		x: 300,
		y: 400,
		width: 50,
		height: 30,
		top: 400,
		left: 300,
		right: 350,
		bottom: 430,
		toJSON() {
			return this;
		},
	} as DOMRect,
};

function Harness() {
	const { startNextStep } = useNextStep();
	return (
		<>
			<button onClick={() => startNextStep("test-tour")} type="button">
				start
			</button>
			<div id="step-a">target a</div>
			<div id="step-b">target b</div>
		</>
	);
}

describe("nextstepjs pointer recalculation (AP-QA-009)", () => {
	beforeEach(() => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
			function mockRect(this: Element) {
				return (
					rectsById[this.id] ??
					({
						x: 0,
						y: 0,
						width: 0,
						height: 0,
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						toJSON() {
							return this;
						},
					} as DOMRect)
				);
			}
		);
	});

	it("installs the pointer-recalculation patch, and moves the pointer to the next step's target", async () => {
		// The deterministic half: fails immediately if
		// patches/nextstepjs@2.3.0.patch silently failed to apply (pnpm warns
		// but exits 0 in that case — this is the gap AP-QA-009 closes).
		const packageEntry = fileURLToPath(await import.meta.resolve("nextstepjs"));
		const nextStepReactPath = join(dirname(packageEntry), "NextStepReact.js");
		const dist = readFileSync(nextStepReactPath, "utf8");
		expect(dist).toContain(
			"Fix: recalculate pointer position after React commits the new step"
		);

		// The behavioural half: driving the real, unmocked library through a
		// step change and checking the pointer follows it.
		const user = userEvent.setup();
		render(
			<NextStepProvider>
				<NextStep
					cardComponent={TourCard}
					cardTransition={{ duration: 0 }}
					steps={[testTour]}
				>
					<Harness />
				</NextStep>
			</NextStepProvider>
		);

		await user.click(screen.getByText("start"));
		await screen.findByText("Step A");

		await user.click(screen.getByRole("button", { name: "Next" }));
		await screen.findByText("Step B");

		await waitFor(() => {
			const pointer = document.querySelector(
				'[data-name="nextstep-pointer"]'
			) as HTMLElement | null;
			// step-b's x (300) minus the default pointerPadding/2 offset (15).
			expect(pointer?.style.transform).toContain("285");
		});
	});
});
