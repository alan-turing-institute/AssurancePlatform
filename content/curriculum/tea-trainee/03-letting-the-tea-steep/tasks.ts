/**
 * Task definitions for Module 3: Letting the TEA Steep
 *
 * One task per page, mirroring Module 1's shape.
 */

import {
	createTask,
	type TaskDefinition,
	TaskType,
} from "@/components/docs/curriculum/task-registry";

export const steepingTasks: TaskDefinition[] = [
	// Page 1: Exploration - the operationalisation sequence and activity
	createTask({
		id: "complete-exploration",
		title: "Work through the operationalisation sequence",
		description:
			"Read how a principle becomes a specified, actionable claim, then complete the activity.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		section: "exploration-content",
		autoTrack: false,
		learningObjective:
			"Turn a specified concern into a claim, an action and evidence that can be reviewed",
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
		learningObjective: "Distinguish a principle from a specified action",
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
			"Identify, weigh and specify principles with stakeholder input",
		order: 3,
	}),

	// Page 3: Assessment - auto-tracked when quiz is passed
	createTask({
		id: "knowledge-check",
		title: "Complete knowledge check",
		description:
			"Answer quiz questions about turning principles into project actions",
		type: TaskType.QUIZ,
		page: "assessment",
		section: "knowledge-check",
		autoTrack: true,
		required: true,
		learningObjective:
			"Demonstrate understanding of the operationalisation sequence",
		order: 4,
	}),
];
