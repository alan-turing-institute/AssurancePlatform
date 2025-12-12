"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type React from "react";
import { useModuleProgress } from "./module-progress-context";
import { TaskStatus } from "./task-registry";

type ButtonPosition = "top" | "bottom";

type TaskCheckpointProps = {
	id: string;
	title?: string | null;
	section?: string | null;
	children: React.ReactNode;
	showButton?: boolean;
	buttonPosition?: ButtonPosition;
	showHeader?: boolean;
};

/**
 * TaskCheckpoint - Wrapper for content sections with manual completion
 *
 * Integrates with ModuleProgressContext to track task completion
 * Provides visual feedback and manual completion trigger
 */
const TaskCheckpoint = ({
	id,
	title = null,
	section = null,
	children,
	showButton = true,
	buttonPosition = "bottom",
	showHeader = false,
}: TaskCheckpointProps): React.ReactNode => {
	const { getTask, completeTask, resetTask } = useModuleProgress();

	const task = getTask(id);

	if (!task) {
		console.warn(`TaskCheckpoint: Task with id "${id}" not found in registry`);
		return <div>{children}</div>;
	}

	const isComplete = task.status === TaskStatus.COMPLETED;
	const displayTitle = title || (task as { title?: string }).title;

	const handleComplete = (): void => {
		if (isComplete) {
			resetTask(id);
		} else {
			completeTask(id);
		}
	};

	const autoTrack = (task as { autoTrack?: boolean }).autoTrack;
	const description = (task as { description?: string }).description;

	const completionButton = showButton && !autoTrack && (
		<div className="mt-4">
			<button
				className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium transition-all ${
					isComplete
						? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
						: "bg-green-600 text-white shadow-xs hover:bg-green-700"
				}`}
				onClick={handleComplete}
				type="button"
			>
				{isComplete ? (
					<>
						<CheckCircle2 className="h-4 w-4" />
						<span>Completed</span>
					</>
				) : (
					<>
						<Circle className="h-4 w-4" />
						<span>Mark as Complete</span>
					</>
				)}
			</button>
			{description && !isComplete && (
				<p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
					{description}
				</p>
			)}
		</div>
	);

	return (
		<div
			className={`task-checkpoint ${isComplete ? "task-checkpoint--complete" : ""}`}
			id={section || id}
		>
			{/* Optional header with completion status */}
			{showHeader && displayTitle && (
				<div className="mb-4 flex items-center gap-2">
					{isComplete ? (
						<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
					) : (
						<Circle className="h-5 w-5 text-gray-400" />
					)}
					<h3 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
						{displayTitle}
					</h3>
				</div>
			)}

			{/* Button at top if specified */}
			{buttonPosition === "top" && completionButton}

			{/* Content */}
			<div className={isComplete ? "opacity-75" : ""}>{children}</div>

			{/* Button at bottom (default) */}
			{buttonPosition === "bottom" && completionButton}
		</div>
	);
};

export default TaskCheckpoint;
