"use client";

import { X } from "lucide-react";
import type { CardComponentProps } from "nextstepjs";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TourCard = ({
	step,
	currentStep,
	totalSteps,
	nextStep,
	prevStep,
	skipTour,
	arrow,
}: CardComponentProps) => {
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
