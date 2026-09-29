/**
 * Task definitions for Module 4: Drinking TEA with Others
 *
 * One task per page, mirroring Module 1's shape.
 */

import {
	createTask,
	type TaskDefinition,
	TaskType,
} from "@/components/docs/curriculum/task-registry";

export const drinkingTasks: TaskDefinition[] = [
	// Page 1: Exploration - collaboration controls and the project process
	createTask({
		id: "complete-exploration",
		title: "Map the collaboration controls",
		description:
			"Work through the collaboration controls, then the process they support across a project.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "exploration-content",
		autoTrack: false,
		learningObjective:
			"Explain how sharing a working case differs from publishing to Discover",
		order: 1,
	}),

	// Page 2: Reflection - concept cards + reflection prompts
	createTask({
		id: "review-core-elements",
		title: "Review the core concepts",
		description: "Click through the concept cards to review each term",
		type: TaskType.INTERACT,
		page: "reflection",
		section: "core-elements",
		autoTrack: true,
		required: true,
		learningObjective:
			"Identify the collaboration controls and what each governs",
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
			"Plan who contributes and what is shared at each project phase",
		order: 3,
	}),

	// Page 3: Assessment - auto-tracked when quiz is passed
	createTask({
		id: "knowledge-check",
		title: "Complete knowledge check",
		description:
			"Answer quiz questions about permissions, public snapshots and timing",
		type: TaskType.QUIZ,
		page: "assessment",
		section: "knowledge-check",
		autoTrack: true,
		required: true,
		learningObjective:
			"Demonstrate understanding of collaboration and publishing decisions",
		order: 4,
	}),
];
