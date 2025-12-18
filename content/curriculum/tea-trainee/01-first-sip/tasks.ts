/**
 * Task definitions for Module 1: First Sip
 *
 * Tasks are displayed in the progress tracker and can be:
 * - Manual checkpoints (autoTrack: false) - user clicks "Mark as Complete"
 * - Auto-tracked (autoTrack: true) - completed programmatically (e.g., quiz pass)
 *
 * The `section` field is used for scroll navigation - it should match the
 * id attribute of the HTML element to scroll to.
 */

import {
	createTask,
	type TaskDefinition,
	TaskType,
} from "@/components/docs/curriculum/task-registry";

export const firstSipTasks: TaskDefinition[] = [
	// Page 1: Exploration - Progressive stages through the assurance case
	createTask({
		id: "stage-1-goal",
		title: "Understand the main goal",
		description: "Identify the central claim the case is trying to establish.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective: "Identify the top-level goal in an assurance case",
		order: 1,
	}),
	createTask({
		id: "stage-2-context",
		title: "Discover the context",
		description:
			"Understand the assumptions and boundaries that scope the argument.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective:
			"Recognize the role of context in scoping assurance cases",
		order: 2,
	}),
	createTask({
		id: "stage-3-strategies",
		title: "Identify the strategies",
		description:
			"See how the high-level goal is broken down into three approaches.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective: "Understand how strategies decompose high-level goals",
		order: 3,
	}),
	createTask({
		id: "stage-4-claims",
		title: "Follow the discrimination prevention branch",
		description:
			"Explore specific property claims under the first strategy (S1).",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective: "Understand how strategies lead to property claims",
		order: 4,
	}),
	createTask({
		id: "stage-5-evidence",
		title: "Ground claims in evidence",
		description: "See how evidence supports the property claims.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective: "Trace the argument chain from claims to evidence",
		order: 5,
	}),
	createTask({
		id: "stage-6-transparency",
		title: "Explore transparency branch",
		description:
			"Compare the transparency strategy (S2) with discrimination prevention.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective: "Compare different argument branches",
		order: 6,
	}),
	createTask({
		id: "stage-7-complete",
		title: "Analyse the complete case",
		description:
			"Explore the full case freely and identify any gaps in the argument.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "progressive-viewer",
		autoTrack: false,
		learningObjective:
			"Critically evaluate the completeness of an assurance case",
		order: 7,
	}),

	// Page 2: Reflection - Core elements carousel + reflection prompts
	createTask({
		id: "review-core-elements",
		title: "Review the core elements",
		description: "Click through the concept cards to review each element type",
		type: TaskType.INTERACT,
		page: "reflection",
		section: "core-elements",
		autoTrack: true,
		required: true,
		learningObjective: "Identify the core element types in an assurance case",
		order: 8,
	}),
	createTask({
		id: "complete-reflection",
		title: "Complete reflection prompts",
		description: "Answer the reflection questions to synthesise your learning",
		type: TaskType.REFLECTION,
		page: "reflection",
		section: "first-sip-reflection",
		autoTrack: true,
		required: true,
		learningObjective:
			"Articulate understanding and critically evaluate the case",
		order: 9,
	}),

	// Page 3: Assessment - Auto-tracked when quiz is passed
	createTask({
		id: "knowledge-check",
		title: "Complete knowledge check",
		description:
			"Answer quiz questions about the Fair Recruitment AI case to demonstrate understanding",
		type: TaskType.QUIZ,
		page: "assessment",
		section: "knowledge-check",
		autoTrack: true,
		required: true,
		learningObjective:
			"Demonstrate understanding of assurance case structure and principles",
		order: 10,
	}),
];
