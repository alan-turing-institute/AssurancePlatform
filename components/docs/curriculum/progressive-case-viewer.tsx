"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SelectedElementSummary } from "@/lib/docs/selected-element";
import CaseViewerWrapper from "./case-viewer-wrapper";
import ElementInspector from "./element-inspector";
import { useModuleProgress } from "./module-progress-context";
import {
	getStageById,
	isLastStage,
	isPromptDone,
	type StageDefinition,
} from "./stage-definitions";
import StageGuidancePanel from "./stage-guidance-panel";
import StageSelector from "./stage-selector";

interface ProgressiveCaseViewerProps {
	/** Whether keyboard navigation is enabled */
	enableKeyboard?: boolean;
	/** Initial stage to display (1-indexed, defaults to 1) */
	initialStage?: number;
	/** Stage definitions for this case */
	stages: StageDefinition[];
}

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

	// Names of the elements the learner has selected, per stage
	const [selectedByStage, setSelectedByStage] = useState<
		Record<number, Set<string>>
	>({});
	const [selectedElement, setSelectedElement] =
		useState<SelectedElementSummary | null>(null);

	// Mirrors `selectedByStage` so two selection events in one tick both count
	const selectedRef = useRef(selectedByStage);
	selectedRef.current = selectedByStage;

	// Record every selected node against the current stage, and complete the
	// stage's task once the updated set satisfies all of its prompts. The
	// inspector shows one element; prompts count all of them.
	const handleSelectedElementChange = useCallback(
		(element: SelectedElementSummary | null): void => {
			setSelectedElement(element);
			if (!element) {
				return;
			}
			const names = element.selectedNames ?? [element.name];
			const stage = getStageById(stages, currentStage);
			const merged = new Set(selectedRef.current[currentStage]);
			for (const name of names) {
				merged.add(name);
			}
			const next = { ...selectedRef.current, [currentStage]: merged };
			selectedRef.current = next;
			setSelectedByStage(next);

			const prompts = stage?.prompts;
			if (
				stage &&
				prompts?.length &&
				!getTask(stage.taskId)?.completed &&
				prompts.every((p) => isPromptDone(p, merged))
			) {
				completeTask(stage.taskId);
			}
		},
		[currentStage, stages, getTask, completeTask]
	);

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

	// Forget the selections when a stage's task is reset, so the prompts start
	// again and the stage cannot re-complete from stale selections
	const previousCompleted = useRef(completedStages);
	useEffect(() => {
		const wasReset = [...previousCompleted.current].some(
			(id) => !completedStages.has(id)
		);
		previousCompleted.current = completedStages;
		if (wasReset) {
			selectedRef.current = {};
			setSelectedByStage({});
		}
	}, [completedStages]);

	// Prompts done on the current stage; a completed stage shows all done
	const donePromptIds = useMemo(() => {
		const done = new Set<string>();
		const prompts = currentStageDefinition?.prompts ?? [];
		const stageComplete = currentStageDefinition
			? completedStages.has(currentStageDefinition.id)
			: false;
		const selected = selectedByStage[currentStage] ?? new Set<string>();
		for (const prompt of prompts) {
			if (stageComplete || isPromptDone(prompt, selected)) {
				done.add(prompt.id);
			}
		}
		return done;
	}, [currentStageDefinition, completedStages, selectedByStage, currentStage]);

	// Handle stage selection from stepper
	const handleStageSelect = useCallback((stageId: number): void => {
		setSelectedElement(null);
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
			setSelectedElement(null);
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
				<StageGuidancePanel
					donePromptIds={donePromptIds}
					prompts={currentStageDefinition.prompts}
					stage={currentStageDefinition}
				/>
			</div>

			{/* Case viewer - the main interactive element */}
			<div className="overflow-hidden rounded-xl border shadow-sm">
				<div className="h-125">
					<CaseViewerWrapper
						caseFile={currentStageDefinition.caseFile}
						key={currentStageDefinition.caseFile}
						onSelectedElementChange={handleSelectedElementChange}
					/>
				</div>
				<ElementInspector element={selectedElement} />
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
