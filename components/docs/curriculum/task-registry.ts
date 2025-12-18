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
	getTasksForPage,
	getNextTask,
	getRequiredTasks,
	isModuleComplete,
};
