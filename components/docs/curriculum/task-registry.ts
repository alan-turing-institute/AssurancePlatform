/**
 * TaskRegistry - System for registering and managing module tasks
 *
 * Allows modules to define tasks that integrate with the progress tracker
 */

import type { TaskStatus as TaskStatusType } from "@/types/curriculum";

/**
 * Task types supported by the system
 */
export const TaskType = {
	CHECKPOINT: "checkpoint",
	EXPLORATION: "exploration",
	QUIZ: "quiz",
	REFLECTION: "reflection",
	CONFIDENCE: "confidence",
	READ: "read",
	INTERACT: "interact",
	CUSTOM: "custom",
} as const;

export type TaskTypeValue = (typeof TaskType)[keyof typeof TaskType];

/**
 * Task status values
 */
export const TaskStatus = {
	PENDING: "pending",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
	SKIPPED: "skipped",
} as const;

export type TaskStatusValue = (typeof TaskStatus)[keyof typeof TaskStatus];

/**
 * Task definition created by createTask
 */
export type TaskDefinition = {
	id: string;
	title: string;
	description: string;
	type: TaskTypeValue;
	page: string | null;
	section: string | null;
	autoTrack: boolean;
	required: boolean;
	learningObjective: string | null;
	order: number;
	status: TaskStatusType;
	completed: boolean;
	completedAt: string | null;
	hint?: string;
};

/**
 * Configuration for creating a task
 */
type CreateTaskConfig = {
	id: string;
	title: string;
	description?: string;
	type?: TaskTypeValue;
	page?: string | null;
	section?: string | null;
	autoTrack?: boolean;
	required?: boolean;
	learningObjective?: string | null;
	order?: number;
};

/**
 * Create a task definition
 */
export const createTask = ({
	id,
	title,
	description = "",
	type = TaskType.CHECKPOINT,
	page = null,
	section = null,
	autoTrack = false,
	required = true,
	learningObjective = null,
	order = 0,
}: CreateTaskConfig): TaskDefinition => ({
	id,
	title,
	description,
	type,
	page,
	section,
	autoTrack,
	required,
	learningObjective,
	order,
	status: TaskStatus.PENDING,
	completed: false,
	completedAt: null,
});

/**
 * Example task definitions for first-sip module
 */
export const firstSipTasks: TaskDefinition[] = [
	// Page 1: Exploration
	createTask({
		id: "find-main-goal",
		title: "Find the main goal",
		description:
			"Click on the green node at the top. What is the system claiming?",
		type: TaskType.EXPLORATION,
		page: "exploration",
		autoTrack: true,
		learningObjective: "Identify the top-level goal in an assurance case",
		order: 1,
	}),
	createTask({
		id: "discover-strategies",
		title: "Discover the three strategies",
		description:
			'Find the purple nodes. How does the case break down "fairness"?',
		type: TaskType.EXPLORATION,
		page: "exploration",
		autoTrack: true,
		learningObjective: "Understand how strategies decompose high-level goals",
		order: 2,
	}),
	createTask({
		id: "follow-evidence",
		title: "Follow claims to evidence",
		description: "Pick one strategy and trace its argument to the evidence.",
		type: TaskType.EXPLORATION,
		page: "exploration",
		autoTrack: true,
		learningObjective: "Trace the argument chain from goals to evidence",
		order: 3,
	}),
	createTask({
		id: "identify-context",
		title: "Identify the context",
		description:
			"Find the grey nodes. What assumptions and boundaries are being made explicit?",
		type: TaskType.EXPLORATION,
		page: "exploration",
		autoTrack: true,
		learningObjective:
			"Recognize the role of context in scoping assurance cases",
		order: 4,
	}),
	createTask({
		id: "explore-connections",
		title: "Explore the connections",
		description:
			"How do different parts relate to each other? Can you see the logical flow?",
		type: TaskType.EXPLORATION,
		page: "exploration",
		autoTrack: true,
		learningObjective:
			"Understand the logical relationships between case elements",
		order: 5,
	}),

	// Page 2: Reflection
	createTask({
		id: "first-impressions",
		title: "Share first impressions",
		description:
			"Reflect on your initial reaction to the Fair Recruitment AI case",
		type: TaskType.REFLECTION,
		page: "reflection",
		autoTrack: true,
		required: true,
		learningObjective: "Articulate initial understanding and observations",
		order: 6,
	}),
	createTask({
		id: "argument-flow",
		title: "Analyze argument flow",
		description:
			"Describe how the case builds its argument from goals to evidence",
		type: TaskType.REFLECTION,
		page: "reflection",
		autoTrack: true,
		required: true,
		learningObjective: "Explain the logical structure of an assurance argument",
		order: 7,
	}),
	createTask({
		id: "strengths-weaknesses",
		title: "Identify strengths and weaknesses",
		description: "Evaluate what aspects were convincing or incomplete",
		type: TaskType.REFLECTION,
		page: "reflection",
		autoTrack: true,
		required: false,
		learningObjective: "Critically evaluate assurance arguments",
		order: 8,
	}),

	// Page 3: Assessment
	createTask({
		id: "multiple-choice-quiz",
		title: "Complete knowledge check",
		description: "Answer questions about the Fair Recruitment AI case",
		type: TaskType.QUIZ,
		page: "assessment",
		autoTrack: true,
		required: true,
		learningObjective: "Demonstrate understanding of case structure",
		order: 9,
	}),
	createTask({
		id: "true-false-quiz",
		title: "True or False questions",
		description: "Verify understanding of key concepts",
		type: TaskType.QUIZ,
		page: "assessment",
		autoTrack: true,
		required: true,
		learningObjective: "Confirm grasp of assurance case principles",
		order: 10,
	}),
	createTask({
		id: "confidence-rating",
		title: "Rate your confidence",
		description: "Assess your confidence in understanding assurance cases",
		type: TaskType.CONFIDENCE,
		page: "assessment",
		autoTrack: true,
		required: false,
		learningObjective: "Self-assess comprehension level",
		order: 11,
	}),
];

/**
 * Get tasks for a specific page
 */
export const getTasksForPage = (
	tasks: TaskDefinition[],
	page: string
): TaskDefinition[] =>
	tasks.filter((task) => task.page === page).sort((a, b) => a.order - b.order);

/**
 * Get the next incomplete task
 */
export const getNextTask = (tasks: TaskDefinition[]): TaskDefinition | null =>
	tasks.find((task) => task.status !== TaskStatus.COMPLETED) || null;

/**
 * Get required tasks
 */
export const getRequiredTasks = (tasks: TaskDefinition[]): TaskDefinition[] =>
	tasks.filter((task) => task.required);

/**
 * Check if module is complete
 */
export const isModuleComplete = (tasks: TaskDefinition[]): boolean => {
	const requiredTasks = getRequiredTasks(tasks);
	return requiredTasks.every((task) => task.status === TaskStatus.COMPLETED);
};

export default {
	TaskType,
	TaskStatus,
	createTask,
	firstSipTasks,
	getTasksForPage,
	getNextTask,
	getRequiredTasks,
	isModuleComplete,
};
