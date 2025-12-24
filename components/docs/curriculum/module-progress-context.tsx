"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type {
	ModuleProgressContextValue,
	ModuleProgressProviderProps,
	ProgressData,
	Task,
} from "@/types/curriculum";
import {
	calculateProgress,
	clearProgress,
	loadProgress,
	saveProgress,
} from "./progress-storage";

/**
 * Module Progress Context
 *
 * Provides global state management for module progress tracking
 */

const ModuleProgressContext = createContext<ModuleProgressContextValue | null>(
	null
);

/**
 * Hook to use module progress context
 * @throws Error if used outside ModuleProgressProvider
 */
export const useModuleProgress = (): ModuleProgressContextValue => {
	const context = useContext(ModuleProgressContext);

	if (!context) {
		throw new Error(
			"useModuleProgress must be used within a ModuleProgressProvider"
		);
	}

	return context;
};

/**
 * Extended context value with additional fields needed by the provider
 */
type ExtendedContextValue = ModuleProgressContextValue & {
	currentPage: string | null;
	courseId: string;
	moduleId: string;
};

/**
 * Module Progress Provider
 * Wraps module pages to provide progress tracking functionality
 */
export const ModuleProgressProvider = ({
	courseId,
	moduleId,
	tasks: initialTasks,
	currentPage = null,
	children,
}: ModuleProgressProviderProps): ReactNode => {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [progress, setProgress] = useState<ProgressData["progress"]>({
		completed: 0,
		total: 0,
		percentage: 0,
	});
	const [isLoaded, setIsLoaded] = useState(false);

	// Load saved progress on mount
	useEffect(() => {
		const savedProgress = loadProgress(courseId, moduleId);

		if (savedProgress?.tasks) {
			// Merge saved progress with task definitions
			const mergedTasks = initialTasks.map((taskDef) => {
				const savedTask = savedProgress.tasks.find((t) => t.id === taskDef.id);

				if (savedTask) {
					return {
						...taskDef,
						status: savedTask.status || "pending",
						completed: savedTask.completed,
						completedAt: savedTask.completedAt || null,
					} as Task;
				}

				return taskDef;
			});

			setTasks(mergedTasks);
		} else {
			// No saved progress, use initial tasks
			setTasks(initialTasks);
		}

		setIsLoaded(true);
	}, [courseId, moduleId, initialTasks]);

	// Calculate and save progress whenever tasks change
	useEffect(() => {
		if (!isLoaded) {
			return;
		}

		const newProgress = calculateProgress(tasks);
		setProgress(newProgress);

		// Save to localStorage
		saveProgress(courseId, moduleId, {
			tasks,
			progress: newProgress,
			currentPage: currentPage ?? undefined,
		});
	}, [tasks, courseId, moduleId, currentPage, isLoaded]);

	/**
	 * Mark a task as complete
	 */
	const completeTask = useCallback((taskId: string): void => {
		setTasks((prevTasks) =>
			prevTasks.map((task) =>
				task.id === taskId
					? {
							...task,
							status: "completed" as const,
							completed: true,
							completedAt: new Date().toISOString(),
						}
					: task
			)
		);
	}, []);

	/**
	 * Mark a task as in progress
	 */
	const startTask = useCallback((taskId: string): void => {
		setTasks((prevTasks) =>
			prevTasks.map((task) =>
				task.id === taskId && task.status === "pending"
					? { ...task, status: "in_progress" as const }
					: task
			)
		);
	}, []);

	/**
	 * Reset a task to pending
	 */
	const resetTask = useCallback((taskId: string): void => {
		setTasks((prevTasks) =>
			prevTasks.map((task) =>
				task.id === taskId
					? {
							...task,
							status: "pending" as const,
							completed: false,
							completedAt: null,
						}
					: task
			)
		);
	}, []);

	/**
	 * Skip a task (for optional tasks)
	 */
	const skipTask = useCallback((taskId: string): void => {
		setTasks((prevTasks) =>
			prevTasks.map((task) =>
				task.id === taskId && !task.required
					? { ...task, status: "skipped" as const }
					: task
			)
		);
	}, []);

	/**
	 * Reset all progress for this module
	 */
	const resetProgress = useCallback((): void => {
		setTasks(initialTasks);
		clearProgress(courseId, moduleId);
	}, [courseId, moduleId, initialTasks]);

	/**
	 * Get task by ID
	 */
	const getTask = useCallback(
		(taskId: string): Task | undefined => tasks.find((t) => t.id === taskId),
		[tasks]
	);

	/**
	 * Get tasks for current page
	 */
	const getCurrentPageTasks = useCallback(
		(): Task[] => tasks.filter((task) => task.page === currentPage),
		[tasks, currentPage]
	);

	const contextValue: ExtendedContextValue = {
		// State
		tasks,
		progress,
		isLoaded,
		currentPage,
		courseId,
		moduleId,

		// Actions
		completeTask,
		startTask,
		resetTask,
		skipTask,
		resetProgress,

		// Utilities
		getTask,
		getCurrentPageTasks,
	};

	return (
		<ModuleProgressContext.Provider value={contextValue}>
			{children}
		</ModuleProgressContext.Provider>
	);
};

export default ModuleProgressContext;
