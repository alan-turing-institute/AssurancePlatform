import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadProgress, saveProgress, clearProgress, calculateProgress } from './ProgressStorage';
import { TaskStatus } from './TaskRegistry';

/**
 * Module Progress Context
 *
 * Provides global state management for module progress tracking
 */

const ModuleProgressContext = createContext(null);

/**
 * Hook to use module progress context
 * @returns {object} Context value
 */
export const useModuleProgress = () => {
  const context = useContext(ModuleProgressContext);

  if (!context) {
    throw new Error('useModuleProgress must be used within a ModuleProgressProvider');
  }

  return context;
};

/**
 * Module Progress Provider
 * Wraps module pages to provide progress tracking functionality
 *
 * @param {object} props
 * @param {string} props.courseId - Course identifier (e.g., 'tea-trainee')
 * @param {string} props.moduleId - Module identifier (e.g., 'first-sip')
 * @param {array} props.tasks - Task definitions for this module
 * @param {string} props.currentPage - Current page identifier
 * @param {React.ReactNode} props.children
 */
export const ModuleProgressProvider = ({
  courseId,
  moduleId,
  tasks: initialTasks,
  currentPage = null,
  children
}) => {
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState({ completed: 0, total: 0, percentage: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved progress on mount
  useEffect(() => {
    const savedProgress = loadProgress(courseId, moduleId);

    if (savedProgress && savedProgress.tasks) {
      // Merge saved progress with task definitions
      const mergedTasks = initialTasks.map(taskDef => {
        const savedTask = savedProgress.tasks.find(t => t.id === taskDef.id);

        if (savedTask) {
          return {
            ...taskDef,
            status: savedTask.status || TaskStatus.PENDING,
            completed: savedTask.completed || false,
            completedAt: savedTask.completedAt || null
          };
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
    if (!isLoaded) return;

    const newProgress = calculateProgress(tasks);
    setProgress(newProgress);

    // Save to localStorage
    saveProgress(courseId, moduleId, {
      tasks,
      progress: newProgress,
      currentPage
    });
  }, [tasks, courseId, moduleId, currentPage, isLoaded]);

  /**
   * Mark a task as complete
   * @param {string} taskId - Task identifier
   */
  const completeTask = useCallback((taskId) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? {
              ...task,
              status: TaskStatus.COMPLETED,
              completed: true,
              completedAt: new Date().toISOString()
            }
          : task
      )
    );
  }, []);

  /**
   * Mark a task as in progress
   * @param {string} taskId - Task identifier
   */
  const startTask = useCallback((taskId) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId && task.status === TaskStatus.PENDING
          ? { ...task, status: TaskStatus.IN_PROGRESS }
          : task
      )
    );
  }, []);

  /**
   * Reset a task to pending
   * @param {string} taskId - Task identifier
   */
  const resetTask = useCallback((taskId) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId
          ? {
              ...task,
              status: TaskStatus.PENDING,
              completed: false,
              completedAt: null
            }
          : task
      )
    );
  }, []);

  /**
   * Skip a task (for optional tasks)
   * @param {string} taskId - Task identifier
   */
  const skipTask = useCallback((taskId) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId && !task.required
          ? { ...task, status: TaskStatus.SKIPPED }
          : task
      )
    );
  }, []);

  /**
   * Reset all progress for this module
   */
  const resetProgress = useCallback(() => {
    setTasks(initialTasks);
    clearProgress(courseId, moduleId);
  }, [courseId, moduleId, initialTasks]);

  /**
   * Get task by ID
   * @param {string} taskId
   * @returns {object|null}
   */
  const getTask = useCallback((taskId) => {
    return tasks.find(t => t.id === taskId) || null;
  }, [tasks]);

  /**
   * Get tasks for current page
   * @returns {array}
   */
  const getCurrentPageTasks = useCallback(() => {
    return tasks.filter(task => task.page === currentPage);
  }, [tasks, currentPage]);

  const contextValue = {
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
    getCurrentPageTasks
  };

  return (
    <ModuleProgressContext.Provider value={contextValue}>
      {children}
    </ModuleProgressContext.Provider>
  );
};

export default ModuleProgressContext;
