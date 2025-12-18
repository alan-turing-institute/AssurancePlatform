"use client";

import type { ProgressData, Task } from "@/types/curriculum";

/**
 * ProgressStorage - localStorage utilities for module progress tracking
 *
 * Handles saving and loading progress for modules across pages and sessions
 */

const STORAGE_PREFIX = "tea-module-progress";

/**
 * Get the storage key for a module
 */
const getStorageKey = (courseId: string, moduleId: string): string =>
	`${STORAGE_PREFIX}:${courseId}:${moduleId}`;

/**
 * Stored progress data structure in localStorage
 */
type StoredProgressData = ProgressData & {
	tasks: Task[];
	moduleId: string;
	courseId: string;
	lastUpdated?: string;
};

/**
 * Load module progress from localStorage
 */
export const loadProgress = (
	courseId: string,
	moduleId: string
): StoredProgressData | null => {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const key = getStorageKey(courseId, moduleId);
		const stored = localStorage.getItem(key);

		if (!stored) {
			return null;
		}

		const data = JSON.parse(stored) as StoredProgressData;

		// Validate data structure
		if (!(data.tasks && data.moduleId && data.courseId)) {
			console.warn("Invalid progress data structure, resetting");
			return null;
		}

		return data;
	} catch (error) {
		console.error("Error loading progress:", error);
		return null;
	}
};

/**
 * Save module progress to localStorage
 */
export const saveProgress = (
	courseId: string,
	moduleId: string,
	progressData: Partial<ProgressData>
): boolean => {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		const key = getStorageKey(courseId, moduleId);
		const data: StoredProgressData = {
			...progressData,
			tasks: progressData.tasks ?? [],
			progress: progressData.progress ?? {
				completed: 0,
				total: 0,
				percentage: 0,
			},
			courseId,
			moduleId,
			lastUpdated: new Date().toISOString(),
		};

		localStorage.setItem(key, JSON.stringify(data));
		return true;
	} catch (error) {
		console.error("Error saving progress:", error);
		return false;
	}
};

/**
 * Clear progress for a module
 */
export const clearProgress = (courseId: string, moduleId: string): boolean => {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		const key = getStorageKey(courseId, moduleId);
		localStorage.removeItem(key);
		return true;
	} catch (error) {
		console.error("Error clearing progress:", error);
		return false;
	}
};

/**
 * Get all module progress (for debugging or analytics)
 */
export const getAllProgress = (): Record<string, StoredProgressData> => {
	if (typeof window === "undefined") {
		return {};
	}

	try {
		const allProgress: Record<string, StoredProgressData> = {};

		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);

			if (key?.startsWith(STORAGE_PREFIX)) {
				const data = localStorage.getItem(key);
				if (data) {
					allProgress[key] = JSON.parse(data) as StoredProgressData;
				}
			}
		}

		return allProgress;
	} catch (error) {
		console.error("Error getting all progress:", error);
		return {};
	}
};

/**
 * Task completion status
 */
export const isTaskComplete = (task: Task | null | undefined): boolean =>
	Boolean(task && (task.status === "completed" || task.completed === true));

/**
 * Calculate overall module progress
 */
export const calculateProgress = (
	tasks: Task[] | null | undefined
): ProgressData["progress"] => {
	if (!tasks || tasks.length === 0) {
		return { completed: 0, total: 0, percentage: 0 };
	}

	const completed = tasks.filter(isTaskComplete).length;
	const total = tasks.length;
	const percentage = Math.round((completed / total) * 100);

	return { completed, total, percentage };
};

export default {
	loadProgress,
	saveProgress,
	clearProgress,
	getAllProgress,
	isTaskComplete,
	calculateProgress,
};
