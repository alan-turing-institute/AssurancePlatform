/**
 * Task definitions for Module 2: Brewing Your Own TEA
 *
 * One task per page, mirroring Module 1's shape: a single exploration
 * checkpoint (no multi-stage viewer in this module), then a concept
 * review and reflection task on the reflection page, then the quiz.
 */

import {
	createTask,
	type TaskDefinition,
	TaskType,
} from "@/components/docs/curriculum/task-registry";

export const brewingTasks: TaskDefinition[] = [
	// Page 1: Exploration - the editor walkthrough
	createTask({
		id: "complete-exploration",
		title: "Build the practice case",
		description:
			"Work through the walkthrough to build a goal, strategy, property claim and evidence chain.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "exploration-content",
		autoTrack: false,
		learningObjective:
			"Build a chain from goal and context through a strategy and property claim to evidence",
		order: 1,
	}),

	// Page 2: Reflection - concept cards + reflection prompts
	createTask({
		id: "review-core-elements",
		title: "Review the core elements",
		description: "Click through the concept cards to review each element type",
		type: TaskType.INTERACT,
		page: "reflection",
		section: "core-elements",
		autoTrack: true,
		required: true,
		learningObjective: "Identify the elements used in the practice case",
		order: 2,
	}),
	createTask({
		id: "complete-reflection",
		title: "Complete reflection prompts",
		description: "Answer the reflection questions to synthesise your learning",
		type: TaskType.REFLECTION,
		page: "reflection",
		section: "reflection-prompts",
		autoTrack: true,
		required: true,
		learningObjective:
			"Articulate what the practice case does and does not establish",
		order: 3,
	}),

	// Page 3: Assessment - auto-tracked when quiz is passed
	createTask({
		id: "knowledge-check",
		title: "Complete knowledge check",
		description:
			"Answer quiz questions about building and reviewing a practice case",
		type: TaskType.QUIZ,
		page: "assessment",
		section: "knowledge-check",
		autoTrack: true,
		required: true,
		learningObjective:
			"Demonstrate understanding of the editor actions and distinctions used",
		order: 4,
	}),
];
