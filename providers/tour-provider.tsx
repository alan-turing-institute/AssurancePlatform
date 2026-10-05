"use client";

import { NextStep, NextStepProvider, type Tour, useNextStep } from "nextstepjs";
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useEffect,
	useRef,
	useState,
} from "react";
import TourCard from "@/components/tour/tour-card";
import { allTours, getTour } from "@/lib/tours";
import { resolveTour } from "@/lib/tours/resolve-tour";
import { resetTourControls, useTourControls } from "@/lib/tours/tour-controls";

interface TourProviderProps {
	children: ReactNode;
}

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
function TourPointerFix({ steps }: { steps: Tour[] }) {
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
		const tour = steps.find((t) => t.tour === currentTour);
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
	}, [currentStep, currentTour, isNextStepVisible, steps]);

	return null;
}

/**
 * Connects `useTourControls` to the tour library while mounted. Starting a
 * tour first waits for its targets and drops the steps whose target is
 * absent, then hands the trimmed tour to the library, so the spotlight never
 * stays on the previous element for a step that has nothing to point at.
 */
function TourControlsBridge({
	setSteps,
}: {
	setSteps: Dispatch<SetStateAction<Tour[]>>;
}) {
	const { startNextStep, currentTour, isNextStepVisible } = useNextStep();
	const startNextStepRef = useRef(startNextStep);
	startNextStepRef.current = startNextStep;

	useEffect(() => {
		let mounted = true;
		useTourControls.setState({
			startTour: (id) => {
				const tour = getTour(id);
				if (!tour) {
					return;
				}
				resolveTour(tour).then((resolved) => {
					if (!mounted || resolved.steps.length === 0) {
						return;
					}
					setSteps((previous) =>
						previous.map((t) => (t.tour === id ? resolved : t))
					);
					startNextStepRef.current(id);
				});
			},
		});
		return () => {
			mounted = false;
			resetTourControls();
		};
	}, [setSteps]);

	useEffect(() => {
		useTourControls.setState({
			activeTour: currentTour,
			isTourVisible: isNextStepVisible,
		});
	}, [currentTour, isNextStepVisible]);

	return null;
}

export function TourProvider({ children }: TourProviderProps) {
	const [steps, setSteps] = useState<Tour[]>(allTours);

	return (
		<NextStepProvider>
			<TourControlsBridge setSteps={setSteps} />
			<TourPointerFix steps={steps} />
			<NextStep
				cardComponent={TourCard}
				clickThroughOverlay={false}
				displayArrow={true}
				noInViewScroll={true}
				scrollToTop={false}
				shadowOpacity="0.6"
				steps={steps}
			>
				{children}
			</NextStep>
		</NextStepProvider>
	);
}
