"use client";

import { Check } from "lucide-react";
import type React from "react";
import { useModuleProgress } from "./module-progress-context";
import { TaskStatus } from "./task-registry";

type CheckpointVariant = "minimal" | "inline" | "border";

type TaskCheckpointProps = {
	id: string;
	title?: string | null;
	section?: string | null;
	children: React.ReactNode;
	/** Style variant: "minimal" (default), "inline", or "border" */
	variant?: CheckpointVariant;
	/** Whether to show the completion toggle */
	showToggle?: boolean;
	/** @deprecated Use variant instead */
	showButton?: boolean;
	/** @deprecated Use variant="border" instead */
	showHeader?: boolean;
};

type ToggleButtonProps = {
	isComplete: boolean;
	onClick: () => void;
	size?: "sm" | "md";
	showLabel?: boolean;
};

/**
 * Small toggle button with checkbox indicator
 */
const ToggleButton = ({
	isComplete,
	onClick,
	size = "sm",
	showLabel = true,
}: ToggleButtonProps): React.ReactNode => {
	const sizeClasses = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
	const checkSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

	const baseClasses = isComplete
		? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
		: "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300";

	const circleClasses = isComplete
		? "border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400"
		: "border-gray-300 bg-white group-hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:group-hover:border-gray-500";

	return (
		<button
			className={`group flex items-center gap-1.5 rounded-full px-3 py-1 font-medium text-xs transition-all ${baseClasses}`}
			onClick={onClick}
			type="button"
		>
			<span
				className={`flex items-center justify-center rounded-full border transition-all ${sizeClasses} ${circleClasses}`}
			>
				{isComplete && (
					<Check className={`${checkSize} text-white dark:text-gray-900`} />
				)}
			</span>
			{showLabel && (isComplete ? "Done" : "Mark done")}
		</button>
	);
};

/**
 * Minimal variant - small pill at bottom
 */
const MinimalCheckpoint = ({
	id,
	section,
	children,
	isComplete,
	shouldShowToggle,
	autoTrack,
	onToggle,
}: {
	id: string;
	section: string | null;
	children: React.ReactNode;
	isComplete: boolean;
	shouldShowToggle: boolean;
	autoTrack: boolean;
	onToggle: () => void;
}): React.ReactNode => (
	<div className="task-checkpoint" id={section || id}>
		<div className={isComplete ? "opacity-60" : ""}>{children}</div>
		{shouldShowToggle && !autoTrack && (
			<div className="mt-3 flex items-center">
				<ToggleButton isComplete={isComplete} onClick={onToggle} size="md" />
			</div>
		)}
	</div>
);

/**
 * Inline variant - checkbox at start of content
 */
const InlineCheckpoint = ({
	id,
	section,
	children,
	isComplete,
	shouldShowToggle,
	autoTrack,
	onToggle,
}: {
	id: string;
	section: string | null;
	children: React.ReactNode;
	isComplete: boolean;
	shouldShowToggle: boolean;
	autoTrack: boolean;
	onToggle: () => void;
}): React.ReactNode => {
	const buttonClasses = isComplete
		? "border-emerald-500 bg-emerald-500 dark:border-emerald-400 dark:bg-emerald-400"
		: "border-gray-300 bg-white hover:border-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-gray-500";

	return (
		<div className="task-checkpoint flex items-start gap-3" id={section || id}>
			{shouldShowToggle && !autoTrack && (
				<button
					aria-label={isComplete ? "Mark as incomplete" : "Mark as complete"}
					className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${buttonClasses}`}
					onClick={onToggle}
					type="button"
				>
					{isComplete && (
						<Check className="h-3.5 w-3.5 text-white dark:text-gray-900" />
					)}
				</button>
			)}
			<div className={`flex-1 ${isComplete ? "opacity-60" : ""}`}>
				{children}
			</div>
		</div>
	);
};

/**
 * Border variant - left accent with optional header
 */
const BorderCheckpoint = ({
	id,
	section,
	children,
	isComplete,
	shouldShowToggle,
	autoTrack,
	displayTitle,
	showHeader,
	onToggle,
}: {
	id: string;
	section: string | null;
	children: React.ReactNode;
	isComplete: boolean;
	shouldShowToggle: boolean;
	autoTrack: boolean;
	displayTitle: string | null | undefined;
	showHeader: boolean | undefined;
	onToggle: () => void;
}): React.ReactNode => {
	const containerClasses = isComplete
		? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-900/10"
		: "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30";

	const titleClasses = isComplete
		? "text-emerald-700 dark:text-emerald-400"
		: "text-gray-600 dark:text-gray-400";

	const hasHeader = showHeader || displayTitle;

	return (
		<div
			className={`task-checkpoint relative rounded-r-lg border-l-4 py-2 pl-4 transition-all ${containerClasses}`}
			id={section || id}
		>
			{hasHeader && (
				<div className="mb-2 flex items-center justify-between">
					<span className={`font-medium text-sm ${titleClasses}`}>
						{displayTitle}
					</span>
					{shouldShowToggle && !autoTrack && (
						<ToggleButton isComplete={isComplete} onClick={onToggle} />
					)}
				</div>
			)}

			<div className={isComplete ? "opacity-60" : ""}>{children}</div>

			{!hasHeader && shouldShowToggle && !autoTrack && (
				<div className="mt-2 flex justify-end">
					<ToggleButton isComplete={isComplete} onClick={onToggle} />
				</div>
			)}
		</div>
	);
};

/**
 * TaskCheckpoint - Wrapper for content sections with manual completion
 *
 * Integrates with ModuleProgressContext to track task completion
 * Provides visual feedback and manual completion trigger
 *
 * Variants:
 * - minimal: Small pill toggle at the bottom (default)
 * - inline: Checkbox-style toggle inline with content
 * - border: Left border accent with status indicator
 */
const TaskCheckpoint = ({
	id,
	title = null,
	section = null,
	children,
	variant = "minimal",
	showToggle = true,
	showButton,
	showHeader,
}: TaskCheckpointProps): React.ReactNode => {
	const { getTask, completeTask, resetTask } = useModuleProgress();
	const task = getTask(id);

	if (!task) {
		console.warn(`TaskCheckpoint: Task with id "${id}" not found in registry`);
		return <div>{children}</div>;
	}

	const isComplete = task.status === TaskStatus.COMPLETED;
	const displayTitle = title || (task as { title?: string }).title;
	const autoTrack = (task as { autoTrack?: boolean }).autoTrack ?? false;
	const shouldShowToggle = showButton ?? showToggle;

	const handleToggle = (): void => {
		if (isComplete) {
			resetTask(id);
		} else {
			completeTask(id);
		}
	};

	const commonProps = {
		id,
		section,
		children,
		isComplete,
		shouldShowToggle,
		autoTrack,
		onToggle: handleToggle,
	};

	if (variant === "inline") {
		return <InlineCheckpoint {...commonProps} />;
	}

	if (variant === "border") {
		return (
			<BorderCheckpoint
				{...commonProps}
				displayTitle={displayTitle}
				showHeader={showHeader}
			/>
		);
	}

	return <MinimalCheckpoint {...commonProps} />;
};

export default TaskCheckpoint;
