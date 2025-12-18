"use client";

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import CaseViewerWrapper from "./case-viewer-wrapper";
import { useModuleProgress } from "./module-progress-context";
import {
	getStageById,
	isLastStage,
	type StageDefinition,
} from "./stage-definitions";
import StageGuidancePanel from "./stage-guidance-panel";
import StageSelector from "./stage-selector";

type ProgressiveCaseViewerProps = {
	/** Stage definitions for this case */
	stages: StageDefinition[];
	/** Initial stage to display (1-indexed, defaults to 1) */
	initialStage?: number;
	/** Whether keyboard navigation is enabled */
	enableKeyboard?: boolean;
};

/**
 * ProgressiveCaseViewer - Orchestrates progressive disclosure of an assurance case
 *
 * Manages stage state and coordinates between:
 * - StageSelector (navigation stepper)
 * - StageGuidancePanel (contextual help)
 * - CaseViewerWrapper (React Flow viewer)
 *
 * Integrates with ModuleProgressContext to track task completion.
 */
const ProgressiveCaseViewer = ({
	stages,
	initialStage = 1,
	enableKeyboard = true,
}: ProgressiveCaseViewerProps): React.ReactNode => {
	const { completeTask, getTask } = useModuleProgress();

	// Track current stage (1-indexed)
	const [currentStage, setCurrentStage] = useState(initialStage);

	// Calculate completed stages from task completion status
	const completedStages = useMemo(() => {
		const completed = new Set<number>();
		for (const stage of stages) {
			const task = getTask(stage.taskId);
			if (task?.completed) {
				completed.add(stage.id);
			}
		}
		return completed;
	}, [stages, getTask]);

	// Get current stage definition
	const currentStageDefinition = useMemo(
		() => getStageById(stages, currentStage),
		[stages, currentStage]
	);

	// Handle stage selection from stepper
	const handleStageSelect = useCallback((stageId: number): void => {
		setCurrentStage(stageId);
	}, []);

	// Handle advancing to next stage
	const handleAdvance = useCallback((): void => {
		if (!currentStageDefinition) {
			return;
		}

		// Mark current stage's task as complete
		completeTask(currentStageDefinition.taskId);

		// Move to next stage if not on last stage
		if (!isLastStage(stages, currentStage)) {
			setCurrentStage((prev) => prev + 1);
		}
	}, [currentStageDefinition, currentStage, stages, completeTask]);

	if (!currentStageDefinition) {
		return (
			<div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
				<p className="text-yellow-700 dark:text-yellow-300">
					Stage {currentStage} not found.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Guidance panel - above viewer to read first */}
			<div className="mt-4">
				<StageGuidancePanel stage={currentStageDefinition} />
			</div>

			{/* Case viewer - the main interactive element */}
			<div className="h-[500px] overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-700">
				<CaseViewerWrapper
					caseFile={currentStageDefinition.caseFile}
					key={currentStageDefinition.caseFile}
				/>
			</div>

			{/* Stage selector (stepper) - below viewer after exploration */}
			<StageSelector
				completedStages={completedStages}
				currentStage={currentStage}
				enableKeyboard={enableKeyboard}
				onAdvance={handleAdvance}
				onStageSelect={handleStageSelect}
				stages={stages}
			/>
		</div>
	);
};

export default ProgressiveCaseViewer;
