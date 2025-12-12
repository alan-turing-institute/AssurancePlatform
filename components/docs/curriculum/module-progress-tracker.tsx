"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	CheckCircle2,
	ChevronDown,
	Circle,
	HelpCircle,
	Lightbulb,
	Maximize2,
	Minimize2,
	Target,
	X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useModuleProgress } from "./module-progress-context";
import { type TaskDefinition, TaskStatus } from "./task-registry";

type ModuleProgressTrackerProps = {
	show?: boolean;
	showHints?: boolean;
	onNavigate?: ((page: string, section?: string | null) => void) | null;
};

/**
 * Get task card border/background class based on completion state
 */
const getTaskCardClass = (isComplete: boolean, isSkipped: boolean): string => {
	if (isComplete) {
		return "border-green-400 bg-green-50 dark:bg-green-900/20";
	}
	if (isSkipped) {
		return "border-gray-300 bg-gray-50 dark:bg-gray-800/50";
	}
	return "border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800";
};

/**
 * ModuleProgressTracker - Global progress tracker for curriculum modules
 *
 * Displays module progress and tasks in a floating, non-intrusive UI
 * Works across multiple pages with state persistence
 */
const ModuleProgressTracker = ({
	show = true,
	showHints = true,
	onNavigate = null,
}: ModuleProgressTrackerProps): React.ReactNode => {
	const { tasks, progress, completeTask, resetProgress } = useModuleProgress();

	const [isExpanded, setIsExpanded] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [isDismissed, setIsDismissed] = useState(false);
	const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());

	// Cast tasks to TaskDefinition for type safety
	const typedTasks = tasks as TaskDefinition[];

	// Get the current incomplete task
	const currentTask =
		typedTasks.find(
			(t) =>
				t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.SKIPPED
		) || null;
	const currentTaskIndex = currentTask
		? typedTasks.findIndex((t) => t.id === currentTask.id)
		: typedTasks.length;

	const toggleHint = (taskId: string): void => {
		const newExpanded = new Set(expandedHints);
		if (newExpanded.has(taskId)) {
			newExpanded.delete(taskId);
		} else {
			newExpanded.add(taskId);
		}
		setExpandedHints(newExpanded);
	};

	const handleTaskClick = (task: TaskDefinition): void => {
		if (onNavigate && task.page) {
			onNavigate(task.page, task.section);
		}
	};

	// Don't render if explicitly hidden
	if (!show) {
		return null;
	}

	if (isDismissed) {
		return null;
	}

	// Minimized pill
	if (isMinimized) {
		return (
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="fixed right-6 bottom-6 z-50"
				initial={{ opacity: 0, y: 100 }}
			>
				<button
					className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
					onClick={() => setIsMinimized(false)}
					title="Show progress tracker"
					type="button"
				>
					<Target className="h-4 w-4" />
					<span className="font-medium text-sm">
						{progress.completed}/{progress.total} tasks
					</span>
				</button>
			</motion.div>
		);
	}

	// Compact card (default state)
	if (!isExpanded) {
		return (
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="fixed right-6 bottom-6 z-50 w-full max-w-md"
				initial={{ opacity: 0, y: 100 }}
			>
				<div className="rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
					{/* Header Bar */}
					<div className="flex items-center justify-between border-gray-200 border-b p-4 dark:border-gray-700">
						<div className="flex flex-1 items-center gap-3">
							<Target className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 text-gray-600 text-sm dark:text-gray-400">
									<span className="font-medium">
										Task {currentTaskIndex + 1} of {typedTasks.length}
									</span>
									<span>•</span>
									<span>{progress.percentage}% complete</span>
								</div>
								{currentTask && (
									<h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
										{currentTask.title}
									</h3>
								)}
								{!currentTask && progress.completed === typedTasks.length && (
									<h3 className="font-semibold text-green-600 dark:text-green-400">
										All tasks complete! 🎉
									</h3>
								)}
							</div>
						</div>

						<div className="flex items-center gap-1">
							<button
								aria-label="Expand tracker"
								className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
								onClick={() => setIsExpanded(true)}
								title="View all tasks"
								type="button"
							>
								<Maximize2 className="h-4 w-4" />
							</button>
							<button
								aria-label="Minimize tracker"
								className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
								onClick={() => setIsMinimized(true)}
								title="Minimize"
								type="button"
							>
								<Minimize2 className="h-4 w-4" />
							</button>
							<button
								aria-label="Dismiss tracker"
								className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
								onClick={() => setIsDismissed(true)}
								title="Dismiss"
								type="button"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>

					{/* Current Task Details */}
					{currentTask && (
						<div className="p-4">
							{currentTask.description && (
								<p className="mb-3 text-gray-600 text-sm dark:text-gray-400">
									{currentTask.description}
								</p>
							)}

							{showHints && currentTask.hint && (
								<div className="mb-3">
									<button
										className="flex items-center gap-2 text-blue-600 text-sm hover:underline dark:text-blue-400"
										onClick={() => toggleHint(currentTask.id)}
										type="button"
									>
										<HelpCircle className="h-4 w-4" />
										{expandedHints.has(currentTask.id)
											? "Hide hint"
											: "Show hint"}
									</button>

									<AnimatePresence>
										{expandedHints.has(currentTask.id) && (
											<motion.div
												animate={{ height: "auto", opacity: 1 }}
												className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
												exit={{ height: 0, opacity: 0 }}
												initial={{ height: 0, opacity: 0 }}
											>
												<div className="flex gap-2">
													<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
													<p className="text-blue-800 text-sm dark:text-blue-200">
														{currentTask.hint}
													</p>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							)}

							{!currentTask.autoTrack && (
								<button
									className="rounded-md bg-green-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-green-700"
									onClick={() => completeTask(currentTask.id)}
									type="button"
								>
									Mark as Complete
								</button>
							)}
						</div>
					)}

					{/* Progress Bar */}
					<div className="px-4 pb-4">
						<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
							<motion.div
								animate={{ width: `${progress.percentage}%` }}
								className="h-2 rounded-full bg-linear-to-r from-blue-500 to-purple-600"
								initial={{ width: 0 }}
								transition={{ duration: 0.5, ease: "easeOut" }}
							/>
						</div>
					</div>
				</div>
			</motion.div>
		);
	}

	// Expanded full list modal
	return (
		<>
			<motion.div
				animate={{ opacity: 1 }}
				className="fixed inset-0 z-50 bg-black/50"
				initial={{ opacity: 0 }}
				onClick={() => setIsExpanded(false)}
			/>
			<motion.div
				animate={{ opacity: 1, y: 0 }}
				className="fixed right-0 bottom-0 left-0 z-50 max-h-[80vh] overflow-hidden"
				initial={{ opacity: 0, y: 100 }}
			>
				<div className="rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800">
					{/* Header */}
					<div className="flex items-center justify-between border-gray-200 border-b p-6 dark:border-gray-700">
						<div>
							<h2 className="flex items-center gap-2 font-bold text-2xl">
								<Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
								Module Progress
							</h2>
							<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
								{progress.completed} of {progress.total} completed (
								{progress.percentage}%)
							</p>
						</div>
						<button
							aria-label="Collapse tracker"
							className="rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
							onClick={() => setIsExpanded(false)}
							type="button"
						>
							<ChevronDown className="h-6 w-6" />
						</button>
					</div>

					{/* Scrollable Content */}
					<div className="max-h-[60vh] overflow-y-auto p-6">
						{/* Progress Bar */}
						<div className="mb-6">
							<div className="h-3 w-full rounded-full bg-gray-200 dark:bg-gray-700">
								<motion.div
									animate={{ width: `${progress.percentage}%` }}
									className="h-3 rounded-full bg-linear-to-r from-blue-500 to-purple-600"
									initial={{ width: 0 }}
									transition={{ duration: 0.5, ease: "easeOut" }}
								/>
							</div>
						</div>

						{/* All Tasks */}
						<div className="space-y-3">
							{typedTasks.map((task) => {
								const isComplete = task.status === TaskStatus.COMPLETED;
								const isSkipped = task.status === TaskStatus.SKIPPED;
								const isHintExpanded = expandedHints.has(task.id);

								return (
									<div
										className={`rounded-lg border p-4 transition-all ${getTaskCardClass(isComplete, isSkipped)}`}
										key={task.id}
									>
										<div className="flex items-start gap-3">
											<button
												className="mt-0.5 transition-colors"
												disabled={task.autoTrack}
												onClick={() => {
													if (!isComplete) {
														completeTask(task.id);
													}
												}}
												type="button"
											>
												{isComplete ? (
													<CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
												) : (
													<Circle className="h-5 w-5 text-gray-400 hover:text-gray-600" />
												)}
											</button>

											<div className="flex-1">
												<div className="flex items-start justify-between">
													<div>
														<button
															className={`text-left font-medium hover:underline ${
																isComplete || isSkipped
																	? "text-gray-600 line-through dark:text-gray-400"
																	: "text-gray-900 dark:text-gray-100"
															}`}
															onClick={() => handleTaskClick(task)}
															type="button"
														>
															{task.title}
														</button>
														{task.description && (
															<p className="mt-1 text-gray-600 text-sm dark:text-gray-400">
																{task.description}
															</p>
														)}
														{task.page && (
															<p className="mt-1 text-gray-500 text-xs dark:text-gray-500">
																Page: {task.page}
															</p>
														)}
													</div>

													{showHints && task.hint && (
														<button
															className="ml-2 rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
															onClick={() => toggleHint(task.id)}
															type="button"
														>
															<HelpCircle className="h-4 w-4 text-blue-500" />
														</button>
													)}
												</div>

												<AnimatePresence>
													{showHints && task.hint && isHintExpanded && (
														<motion.div
															animate={{ height: "auto", opacity: 1 }}
															className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
															exit={{ height: 0, opacity: 0 }}
															initial={{ height: 0, opacity: 0 }}
														>
															<div className="flex gap-2">
																<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
																<p className="text-blue-800 text-sm dark:text-blue-200">
																	{task.hint}
																</p>
															</div>
														</motion.div>
													)}
												</AnimatePresence>
											</div>
										</div>
									</div>
								);
							})}
						</div>

						<div className="mt-6">
							<button
								className="rounded-md bg-gray-100 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								onClick={resetProgress}
								type="button"
							>
								Reset Progress
							</button>
						</div>
					</div>
				</div>
			</motion.div>
		</>
	);
};

export default ModuleProgressTracker;
