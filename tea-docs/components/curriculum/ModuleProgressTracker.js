import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Target,
  Minimize2,
  Maximize2,
  X,
  ChevronDown,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { useModuleProgress } from './ModuleProgressContext';
import { TaskStatus } from './TaskRegistry';

/**
 * ModuleProgressTracker - Global progress tracker for curriculum modules
 *
 * Displays module progress and tasks in a floating, non-intrusive UI
 * Works across multiple pages with state persistence
 *
 * @param {object} props
 * @param {boolean} props.show - Whether to show the tracker (default: true)
 * @param {boolean} props.showHints - Whether to show hints (default: true)
 * @param {function} props.onNavigate - Callback when user clicks on a task to navigate
 */
const ModuleProgressTracker = ({ show = true, showHints = true, onNavigate = null }) => {
  const {
    tasks,
    progress,
    currentPage,
    completeTask,
    startTask,
    resetProgress
  } = useModuleProgress();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [expandedHints, setExpandedHints] = useState(new Set());

  // Get the current incomplete task
  const currentTask = tasks.find(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.SKIPPED) || null;
  const currentTaskIndex = currentTask ? tasks.findIndex(t => t.id === currentTask.id) : tasks.length;

  const toggleHint = (taskId) => {
    const newExpanded = new Set(expandedHints);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedHints(newExpanded);
  };

  const handleTaskClick = (task) => {
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
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:bg-blue-700"
          title="Show progress tracker"
        >
          <Target className="w-4 h-4" />
          <span className="text-sm font-medium">
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
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-6 right-6 z-50 w-full max-w-md"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700">
          {/* Header Bar */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 flex-1">
              <Target className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">
                    Task {currentTaskIndex + 1} of {tasks.length}
                  </span>
                  <span>•</span>
                  <span>{progress.percentage}% complete</span>
                </div>
                {currentTask && (
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {currentTask.title}
                  </h3>
                )}
                {!currentTask && progress.completed === tasks.length && (
                  <h3 className="font-semibold text-green-600 dark:text-green-400">
                    All tasks complete! 🎉
                  </h3>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Expand tracker"
                title="View all tasks"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Minimize tracker"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Dismiss tracker"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Current Task Details */}
          {currentTask && (
            <div className="p-4">
              {currentTask.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {currentTask.description}
                </p>
              )}

              {showHints && currentTask.hint && (
                <div className="mb-3">
                  <button
                    onClick={() => toggleHint(currentTask.id)}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <HelpCircle className="w-4 h-4" />
                    {expandedHints.has(currentTask.id) ? 'Hide hint' : 'Show hint'}
                  </button>

                  <AnimatePresence>
                    {expandedHints.has(currentTask.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex gap-2">
                          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-200">
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
                  onClick={() => completeTask(currentTask.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Mark as Complete
                </button>
              )}
            </div>
          )}

          {/* Progress Bar */}
          <div className="px-4 pb-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => setIsExpanded(false)}
      />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-hidden"
      >
        <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Module Progress
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {progress.completed} of {progress.total} completed ({progress.percentage}%)
              </p>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="Collapse tracker"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-[60vh] p-6">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* All Tasks */}
            <div className="space-y-3">
              {tasks.map((task) => {
                const isComplete = task.status === TaskStatus.COMPLETED;
                const isSkipped = task.status === TaskStatus.SKIPPED;
                const isHintExpanded = expandedHints.has(task.id);

                return (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-4 transition-all ${
                      isComplete
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                        : isSkipped
                        ? 'border-gray-300 bg-gray-50 dark:bg-gray-800/50'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => {
                          if (!isComplete) {
                            completeTask(task.id);
                          }
                        }}
                        className="mt-0.5 transition-colors"
                        disabled={task.autoTrack}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <button
                              onClick={() => handleTaskClick(task)}
                              className={`font-medium text-left hover:underline ${
                                isComplete || isSkipped
                                  ? 'text-gray-600 line-through dark:text-gray-400'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              {task.title}
                            </button>
                            {task.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {task.description}
                              </p>
                            )}
                            {task.page && (
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                Page: {task.page}
                              </p>
                            )}
                          </div>

                          {showHints && task.hint && (
                            <button
                              onClick={() => toggleHint(task.id)}
                              className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <HelpCircle className="w-4 h-4 text-blue-500" />
                            </button>
                          )}
                        </div>

                        <AnimatePresence>
                          {showHints && task.hint && isHintExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
                            >
                              <div className="flex gap-2">
                                <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-blue-800 dark:text-blue-200">
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
                onClick={resetProgress}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
