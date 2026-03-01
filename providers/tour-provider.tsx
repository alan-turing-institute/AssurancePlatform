"use client";

import { NextStep, NextStepProvider, useNextStep } from "nextstepjs";
import { type ReactNode, useEffect, useRef } from "react";
import TourCard from "@/components/tour/tour-card";
import { caseCanvasTour } from "@/lib/tours/case-canvas-tour";
import { dashboardTour } from "@/lib/tours/dashboard-tour";
import { demoCaseTour } from "@/lib/tours/demo-case-tour";

const allTours = [dashboardTour, caseCanvasTour, demoCaseTour];

type TourProviderProps = {
	children: ReactNode;
};

/**
 * Workaround for a NextStepjs bug where the Framer Motion pointer
 * doesn't animate to the correct position on step transitions.
 *
 * Root cause: NextStepjs's internal `updatePointerPosition` and its
 * resize handler capture `currentStep` via closure. On step change,
 * `onStepChange` fires BEFORE `setCurrentStep`, and the resize
 * listener re-registration races with our fix attempts.
 *
 * Fix: We know the current tour and step index from useNextStep.
 * We look up the step config from our tours array, find the target
 * element, and directly set the pointer DOM element's inline style.
 * This bypasses Framer Motion entirely for the initial positioning.
 *
 * A pnpm patch (patches/nextstepjs.patch) also fixes this at the
 * library level for when the dev server picks up the patched bundle.
 */
function TourPointerFix() {
	const { currentStep, currentTour, isNextStepVisible } = useNextStep();
	const prevStep = useRef(currentStep);

	useEffect(() => {
		if (!(isNextStepVisible && currentTour)) {
			return;
		}
		if (prevStep.current === currentStep) {
			return;
		}
		prevStep.current = currentStep;

		// Find the tour config
		const tour = allTours.find((t) => t.tour === currentTour);
		if (!tour) {
			return;
		}

		const stepConfig = tour.steps[currentStep];
		if (!stepConfig?.selector) {
			return;
		}

		const targetEl = document.querySelector(stepConfig.selector);
		if (!targetEl) {
			return;
		}

		const rect = targetEl.getBoundingClientRect();
		const body = document.body;
		const bodyRect = body.getBoundingClientRect();
		const padding = stepConfig.pointerPadding ?? 10;
		const padOffset = padding / 2;

		const x = rect.left - bodyRect.left + body.scrollLeft - padOffset;
		const y = rect.top - bodyRect.top + body.scrollTop - padOffset;
		const width = rect.width + padding;
		const height = rect.height + padding;

		// Directly update the pointer DOM element's style
		requestAnimationFrame(() => {
			const pointer = document.querySelector(
				'[data-name="nextstep-pointer"]'
			) as HTMLElement | null;
			if (pointer) {
				pointer.style.transform = `translateX(${x}px) translateY(${y}px)`;
				pointer.style.width = `${width}px`;
				pointer.style.height = `${height}px`;
			}
		});
	}, [currentStep, currentTour, isNextStepVisible]);

	return null;
}

export function TourProvider({ children }: TourProviderProps) {
	return (
		<NextStepProvider>
			<TourPointerFix />
			<NextStep
				cardComponent={TourCard}
				clickThroughOverlay={false}
				displayArrow={true}
				noInViewScroll={true}
				scrollToTop={false}
				shadowOpacity="0.6"
				steps={allTours}
			>
				{children}
			</NextStep>
		</NextStepProvider>
	);
}
