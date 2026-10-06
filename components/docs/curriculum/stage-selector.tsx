"use client";

import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type React from "react";
import { useCallback, useEffect } from "react";
import type { StageDefinition } from "./stage-definitions";

interface StageSelectorProps {
	/** Set of completed stage IDs */
	completedStages: Set<number>;
	/** Current active stage (1-indexed) */
	currentStage: number;
	/** Whether keyboard navigation is enabled */
	enableKeyboard?: boolean;
	/** Callback to advance to next stage (marks current complete) */
	onAdvance: () => void;
	/** Callback when stage is selected */
	onStageSelect: (stageId: number) => void;
	/** All stage definitions */
	stages: StageDefinition[];
}

/**
 * Get progress dot styling based on state
 */
const getProgressDotClass = (
	stageId: number,
	currentStage: number,
	isCompleted: boolean,
	isAccessible: boolean
): string => {
	const baseClasses =
		"relative flex items-center justify-center transition-all";

	if (stageId === currentStage) {
		// Current stage - highlighted
		return `${baseClasses} ring-2 ring-primary/40 ring-offset-2 ring-offset-background`;
	}
	if (isCompleted) {
		// Completed stage - filled
		return `${baseClasses} cursor-pointer hover:scale-110`;
	}
	if (isAccessible) {
		// Accessible but not completed
		return `${baseClasses} cursor-pointer hover:scale-110`;
	}
	// Locked stage
	return `${baseClasses} cursor-not-allowed opacity-50`;
};

/**
 * Get dot background color
 */
const getDotBgClass = (
	stageId: number,
	currentStage: number,
	isCompleted: boolean
): string => {
	if (stageId === currentStage) {
		return "bg-primary text-primary-foreground";
	}
	if (isCompleted) {
		return "bg-success text-success-foreground";
	}
	return "bg-muted text-muted-foreground";
};

/**
 * Render content inside the stage dot
 */
const renderDotContent = (
	stageId: number,
	isCompleted: boolean,
	isCurrent: boolean,
	isAccessible: boolean
): React.ReactNode => {
	if (isCompleted && !isCurrent) {
		return <Check className="h-4 w-4" />;
	}
	if (isAccessible) {
		return stageId;
	}
	return <Lock className="h-3 w-3" />;
};

/**
 * Get connector line styling
 */
const getConnectorClass = (
	isCompleted: boolean,
	isNextAccessible: boolean
): string => {
	if (isCompleted) {
		return "bg-success";
	}
	if (isNextAccessible) {
		return "bg-primary/40";
	}
	return "bg-border";
};

/**
 * True when the key press belongs to something else on the page: a text
 * field or select (the arrow keys change their value), the canvas (arrow keys
 * pan and move focus between nodes), a dialog (portalled outside the canvas), or
 * any region marked `.nokey`.
 */
const isKeyboardCaptured = (target: EventTarget | null): boolean => {
	if (!(target instanceof Element)) {
		return false;
	}
	return (
		target.matches("input, textarea, select, [contenteditable]") ||
		target.closest(
			'.react-flow, .nokey, [role="dialog"], [role="alertdialog"]'
		) !== null
	);
};

/**
 * StageSelector - Horizontal stepper for progressive stage navigation
 *
 * Displays all stages as connected dots with labels.
 * Users can navigate back to completed stages but cannot skip ahead.
 * The right arrow advances to the next stage and marks the current as complete.
 */
const StageSelector = ({
	stages,
	currentStage,
	completedStages,
	onStageSelect,
	onAdvance,
	enableKeyboard = true,
}: StageSelectorProps): React.ReactNode => {
	// Determine which stages are accessible (completed + current + next unlocked)
	const maxAccessibleStage = Math.max(currentStage, ...[...completedStages], 1);

	const isStageAccessible = useCallback(
		(stageId: number): boolean => stageId <= maxAccessibleStage + 1,
		[maxAccessibleStage]
	);

	const handleStageClick = useCallback(
		(stageId: number): void => {
			// Can go back to any completed stage or current stage
			// Can go forward only to the next uncompleted stage
			if (stageId <= maxAccessibleStage + 1) {
				onStageSelect(stageId);
			}
		},
		[maxAccessibleStage, onStageSelect]
	);

	const goToPrevious = useCallback((): void => {
		const prevStage = currentStage - 1;
		if (prevStage >= 1) {
			onStageSelect(prevStage);
		}
	}, [currentStage, onStageSelect]);

	// Keyboard navigation
	useEffect(() => {
		if (!enableKeyboard) {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent): void => {
			if (isKeyboardCaptured(e.target)) {
				return;
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				onAdvance();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				goToPrevious();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enableKeyboard, onAdvance, goToPrevious]);

	const canGoBack = currentStage > 1;
	const isLastStage = currentStage === stages.length;
	const isCurrentStageCompleted = completedStages.has(currentStage);

	return (
		<div className="w-full">
			{/* Compact horizontal stepper */}
			<div className="flex items-center justify-between gap-1 rounded-lg bg-muted/40 p-2 sm:gap-2 sm:p-3">
				{/* Previous button */}
				<button
					aria-label="Previous stage"
					className={`flex-shrink-0 rounded-full p-1.5 transition-colors sm:p-2 ${
						canGoBack
							? "bg-background text-foreground shadow-sm hover:bg-accent"
							: "cursor-not-allowed text-muted-foreground/50"
					}`}
					disabled={!canGoBack}
					onClick={goToPrevious}
					type="button"
				>
					<ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
				</button>

				{/* Stage dots — its own horizontal scroll region on narrow
				    viewports, so the prev/next buttons stay outside it and
				    always reachable even if a viewport is narrower than the
				    shrunk dots still need. */}
				<div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto">
					{stages.map((stage, index) => {
						const isCompleted = completedStages.has(stage.id);
						const isCurrent = stage.id === currentStage;
						const isAccessible = isStageAccessible(stage.id);
						const isLast = index === stages.length - 1;

						return (
							<div className="flex items-center" key={stage.id}>
								{/* Stage dot */}
								<button
									aria-current={isCurrent ? "step" : undefined}
									aria-label={`Stage ${stage.id}: ${stage.title}${isCompleted ? " (completed)" : ""}${isAccessible ? "" : " (locked)"}`}
									className={`relative z-10 ${getProgressDotClass(
										stage.id,
										currentStage,
										isCompleted,
										isAccessible
									)}`}
									disabled={!isAccessible}
									onClick={() => handleStageClick(stage.id)}
									type="button"
								>
									<div
										className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold text-xs transition-transform sm:h-9 sm:w-9 sm:text-sm ${isCurrent ? "scale-110" : ""} ${getDotBgClass(stage.id, currentStage, isCompleted)}`}
									>
										{renderDotContent(
											stage.id,
											isCompleted,
											isCurrent,
											isAccessible
										)}
									</div>
								</button>

								{/* Connector line (not after last dot) */}
								{!isLast && (
									<div
										className={`-mx-0.5 h-0.5 w-3 sm:-mx-1 sm:w-8 ${getConnectorClass(isCompleted, isStageAccessible(stage.id + 1))}`}
									/>
								)}
							</div>
						);
					})}
				</div>

				{/* Next/Advance button - shows "Mark Complete" on last stage */}
				{isLastStage && !isCurrentStageCompleted ? (
					<button
						aria-label="Mark exploration complete"
						className="flex flex-shrink-0 items-center gap-1 rounded-full bg-success px-2.5 py-1.5 font-medium text-sm text-success-foreground shadow-sm transition-colors hover:bg-success/90 sm:gap-1.5 sm:px-3 sm:py-2"
						onClick={onAdvance}
						type="button"
					>
						<Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						<span className="hidden sm:inline">Complete</span>
					</button>
				) : (
					<button
						aria-label={
							isLastStage && isCurrentStageCompleted
								? "All stages complete"
								: "Continue to next stage"
						}
						className={`flex-shrink-0 rounded-full p-1.5 transition-colors sm:p-2 ${
							isLastStage && isCurrentStageCompleted
								? "cursor-not-allowed text-muted-foreground/50"
								: "bg-background text-foreground shadow-sm hover:bg-accent"
						}`}
						disabled={isLastStage && isCurrentStageCompleted}
						onClick={onAdvance}
						type="button"
					>
						<ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
					</button>
				)}
			</div>
		</div>
	);
};

export default StageSelector;
