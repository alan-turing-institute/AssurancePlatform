"use client";

import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type React from "react";
import { useCallback, useEffect } from "react";
import type { StageDefinition } from "./stage-definitions";

type StageSelectorProps = {
	/** All stage definitions */
	stages: StageDefinition[];
	/** Current active stage (1-indexed) */
	currentStage: number;
	/** Set of completed stage IDs */
	completedStages: Set<number>;
	/** Callback when stage is selected */
	onStageSelect: (stageId: number) => void;
	/** Callback to advance to next stage (marks current complete) */
	onAdvance: () => void;
	/** Whether keyboard navigation is enabled */
	enableKeyboard?: boolean;
};

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
		return `${baseClasses} ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900`;
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
		return "bg-blue-600 text-white";
	}
	if (isCompleted) {
		return "bg-emerald-500 text-white";
	}
	return "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
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
		return "bg-emerald-500";
	}
	if (isNextAccessible) {
		return "bg-blue-300 dark:bg-blue-700";
	}
	return "bg-gray-200 dark:bg-gray-700";
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
			<div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
				{/* Previous button */}
				<button
					aria-label="Previous stage"
					className={`flex-shrink-0 rounded-full p-2 transition-colors ${
						canGoBack
							? "bg-white text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							: "cursor-not-allowed text-gray-300 dark:text-gray-600"
					}`}
					disabled={!canGoBack}
					onClick={goToPrevious}
					type="button"
				>
					<ChevronLeft className="h-5 w-5" />
				</button>

				{/* Stage dots */}
				<div className="flex flex-1 items-center justify-center">
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
									<motion.div
										animate={{
											scale: isCurrent ? 1.15 : 1,
										}}
										className={`flex h-9 w-9 items-center justify-center rounded-full font-semibold text-sm ${getDotBgClass(stage.id, currentStage, isCompleted)}`}
										transition={{
											type: "spring",
											stiffness: 300,
											damping: 20,
										}}
									>
										{renderDotContent(
											stage.id,
											isCompleted,
											isCurrent,
											isAccessible
										)}
									</motion.div>
								</button>

								{/* Connector line (not after last dot) */}
								{!isLast && (
									<div
										className={`-mx-1 h-0.5 w-5 sm:w-8 ${getConnectorClass(isCompleted, isStageAccessible(stage.id + 1))}`}
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
						className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 font-medium text-sm text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
						onClick={onAdvance}
						type="button"
					>
						<Check className="h-4 w-4" />
						<span className="hidden sm:inline">Complete</span>
					</button>
				) : (
					<button
						aria-label={
							isLastStage && isCurrentStageCompleted
								? "All stages complete"
								: "Continue to next stage"
						}
						className={`flex-shrink-0 rounded-full p-2 transition-colors ${
							isLastStage && isCurrentStageCompleted
								? "cursor-not-allowed text-gray-300 dark:text-gray-600"
								: "bg-white text-gray-600 shadow-sm hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						}`}
						disabled={isLastStage && isCurrentStageCompleted}
						onClick={onAdvance}
						type="button"
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				)}
			</div>
		</div>
	);
};

export default StageSelector;
