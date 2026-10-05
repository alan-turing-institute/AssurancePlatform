"use client";

import { X } from "lucide-react";
import type { CardComponentProps } from "nextstepjs";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Gap kept between the card and every edge of the window, in pixels. */
const VIEWPORT_MARGIN = 16;

/**
 * Keeps the card inside the window. The tour library places a card beside its
 * target and does not clamp it, so near an edge the card can run off screen.
 * While mounted this shifts the card back by the amount it overhangs, using
 * the CSS `translate` property so the library's own positioning is left
 * alone. The card is measured on every frame because the library animates it
 * into place. The arrow may end up away from the card as a result.
 */
function useKeepInViewport(ref: React.RefObject<HTMLElement | null>) {
	useEffect(() => {
		let frame = 0;
		let shiftX = 0;
		let shiftY = 0;
		const clamp = () => {
			const element = ref.current;
			if (element) {
				const rect = element.getBoundingClientRect();
				// Position the card would have with no shift applied.
				const left = rect.left - shiftX;
				const top = rect.top - shiftY;
				const width = rect.width;
				const height = rect.height;
				const maxX = window.innerWidth - VIEWPORT_MARGIN - width;
				const maxY = window.innerHeight - VIEWPORT_MARGIN - height;
				// The top and left edges win when the card is larger than the window.
				const nextX = Math.max(VIEWPORT_MARGIN, Math.min(left, maxX)) - left;
				const nextY = Math.max(VIEWPORT_MARGIN, Math.min(top, maxY)) - top;
				if (Math.abs(nextX - shiftX) > 0.5 || Math.abs(nextY - shiftY) > 0.5) {
					shiftX = nextX;
					shiftY = nextY;
					element.style.translate =
						shiftX === 0 && shiftY === 0 ? "" : `${shiftX}px ${shiftY}px`;
				}
			}
			frame = requestAnimationFrame(clamp);
		};
		frame = requestAnimationFrame(clamp);
		return () => cancelAnimationFrame(frame);
	}, [ref]);
}

const TourCard = ({
	step,
	currentStep,
	totalSteps,
	nextStep,
	prevStep,
	skipTour,
	arrow,
}: CardComponentProps) => {
	const cardRef = useRef<HTMLDivElement>(null);
	useKeepInViewport(cardRef);
	const isFirstStep = currentStep === 0;
	const isLastStep = currentStep === totalSteps - 1;

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				skipTour?.();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				nextStep();
			} else if (e.key === "ArrowLeft" && !isFirstStep) {
				e.preventDefault();
				prevStep();
			}
		},
		[skipTour, nextStep, prevStep, isFirstStep]
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	return (
		<div
			aria-labelledby="tour-step-title"
			aria-modal="true"
			className="w-[320px] rounded-lg border border-border bg-card p-4 shadow-lg sm:w-[380px]"
			ref={cardRef}
			role="dialog"
		>
			{arrow}

			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2">
					{step.icon && (
						<span aria-hidden="true" className="text-lg">
							{step.icon}
						</span>
					)}
					<h3
						className="font-semibold text-card-foreground text-sm"
						id="tour-step-title"
					>
						{step.title}
					</h3>
				</div>
				{step.showSkip !== false && (
					<Button
						aria-label="Close tour"
						className="h-6 w-6 shrink-0"
						onClick={() => skipTour?.()}
						size="icon"
						variant="ghost"
					>
						<X className="h-3.5 w-3.5" />
					</Button>
				)}
			</div>

			<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
				{step.content}
			</p>

			<div
				className={cn(
					"mt-4 flex items-center",
					isFirstStep ? "justify-end" : "justify-between"
				)}
			>
				{!isFirstStep && (
					<Button onClick={prevStep} size="sm" variant="ghost">
						Previous
					</Button>
				)}

				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-xs">
						{currentStep + 1} of {totalSteps}
					</span>
					<Button onClick={nextStep} size="sm">
						{isLastStep ? "Finish" : "Next"}
					</Button>
				</div>
			</div>
		</div>
	);
};

export default TourCard;
