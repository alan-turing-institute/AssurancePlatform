/**
 * ProgressStorage - localStorage utilities for module progress tracking
 *
 * Handles saving and loading progress for modules across pages and sessions
 */

const STORAGE_PREFIX = 'tea-module-progress';

/**
 * Get the storage key for a module
 * @param {string} courseId - e.g., 'tea-trainee'
 * @param {string} moduleId - e.g., 'first-sip'
 * @returns {string} Storage key
 */
const getStorageKey = (courseId, moduleId) => {
  return `${STORAGE_PREFIX}:${courseId}:${moduleId}`;
};

/**
 * Load module progress from localStorage
 * @param {string} courseId
 * @param {string} moduleId
 * @returns {object|null} Progress data or null if not found
 */
export const loadProgress = (courseId, moduleId) => {
  if (typeof window === 'undefined') return null;

  try {
    const key = getStorageKey(courseId, moduleId);
    const stored = localStorage.getItem(key);

    if (!stored) return null;

    const data = JSON.parse(stored);

    // Validate data structure
    if (!data.tasks || !data.moduleId || !data.courseId) {
      console.warn('Invalid progress data structure, resetting');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading progress:', error);
    return null;
  }
};

/**
 * Save module progress to localStorage
 * @param {string} courseId
 * @param {string} moduleId
 * @param {object} progressData - Progress data to save
 * @returns {boolean} Success status
 */
export const saveProgress = (courseId, moduleId, progressData) => {
  if (typeof window === 'undefined') return false;

  try {
    const key = getStorageKey(courseId, moduleId);
    const data = {
      ...progressData,
      courseId,
      moduleId,
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving progress:', error);
    return false;
  }
};

/**
 * Clear progress for a module
 * @param {string} courseId
 * @param {string} moduleId
 * @returns {boolean} Success status
 */
export const clearProgress = (courseId, moduleId) => {
  if (typeof window === 'undefined') return false;

  try {
    const key = getStorageKey(courseId, moduleId);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error clearing progress:', error);
    return false;
  }
};

/**
 * Get all module progress (for debugging or analytics)
 * @returns {object} Object with all module progress
 */
export const getAllProgress = () => {
  if (typeof window === 'undefined') return {};

  try {
    const allProgress = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key && key.startsWith(STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          allProgress[key] = JSON.parse(data);
        }
      }
    }

    return allProgress;
  } catch (error) {
    console.error('Error getting all progress:', error);
    return {};
  }
};

/**
 * Task completion status
 * @param {object} task - Task object
 * @returns {boolean} Whether task is complete
 */
export const isTaskComplete = (task) => {
  return task && (task.status === 'completed' || task.completed === true);
};

/**
 * Calculate overall module progress
 * @param {array} tasks - Array of task objects
 * @returns {object} Progress stats
 */
export const calculateProgress = (tasks) => {
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
  calculateProgress
};
