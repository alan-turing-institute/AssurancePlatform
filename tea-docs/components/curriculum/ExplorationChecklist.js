import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  Award,
  Target,
  Minimize2,
  Maximize2,
  X
} from 'lucide-react';
import { useModuleProgress } from './ModuleProgressContext';

const ExplorationChecklist = ({
  items = [],
  onComplete,
  onItemCheck,
  showProgress = true,
  allowHints = true,
  autoSave = false,
  displayMode = 'default', // 'default' or 'floating'
  useGlobalProgress = false // Whether to integrate with ModuleProgressContext
}) => {
  // Try to use context if available, but don't fail if not present
  let contextProgress = null;
  try {
    if (useGlobalProgress) {
      contextProgress = useModuleProgress();
    }
  } catch (e) {
    // Context not available, continue with local state
  }
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [expandedHints, setExpandedHints] = useState(new Set());
  const [showCongrats, setShowCongrats] = useState(false);

  // Floating mode states
  const [isFloatingExpanded, setIsFloatingExpanded] = useState(false);
  const [isFloatingMinimized, setIsFloatingMinimized] = useState(false);
  const [isFloatingDismissed, setIsFloatingDismissed] = useState(false);

  // Load saved progress from localStorage if autoSave is enabled
  useEffect(() => {
    if (autoSave && typeof window !== 'undefined') {
      const saved = localStorage.getItem('exploration-checklist-progress');
      if (saved) {
        setCheckedItems(new Set(JSON.parse(saved)));
      }
    }
  }, [autoSave]);

  // Save progress to localStorage
  useEffect(() => {
    if (autoSave && typeof window !== 'undefined') {
      localStorage.setItem(
        'exploration-checklist-progress',
        JSON.stringify(Array.from(checkedItems))
      );
    }
  }, [checkedItems, autoSave]);

  // Check if all items are complete
  useEffect(() => {
    if (checkedItems.size === items.length && items.length > 0) {
      setShowCongrats(true);
      if (onComplete) {
        onComplete();
      }
    }
  }, [checkedItems, items.length, onComplete]);

  const toggleItem = (itemId) => {
    const newChecked = new Set(checkedItems);
    const isNowChecked = !newChecked.has(itemId);

    if (newChecked.has(itemId)) {
      newChecked.delete(itemId);
    } else {
      newChecked.add(itemId);
    }
    setCheckedItems(newChecked);

    // Integrate with global progress context if enabled
    if (contextProgress && isNowChecked) {
      contextProgress.completeTask(itemId);
    } else if (contextProgress && !isNowChecked) {
      contextProgress.resetTask(itemId);
    }

    if (onItemCheck) {
      onItemCheck(itemId, isNowChecked);
    }
  };

  const toggleHint = (itemId) => {
    const newExpanded = new Set(expandedHints);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedHints(newExpanded);
  };

  const resetProgress = () => {
    setCheckedItems(new Set());
    setExpandedHints(new Set());
    setShowCongrats(false);
    if (autoSave && typeof window !== 'undefined') {
      localStorage.removeItem('exploration-checklist-progress');
    }
  };

  const progressPercentage = items.length > 0
    ? Math.round((checkedItems.size / items.length) * 100)
    : 0;

  // Get the current incomplete task for floating mode
  const getCurrentTask = () => {
    const currentIndex = items.findIndex(item => !checkedItems.has(item.id));
    return currentIndex >= 0 ? { item: items[currentIndex], index: currentIndex } : null;
  };

  const currentTask = getCurrentTask();

  // Render floating mode
  if (displayMode === 'floating') {
    if (isFloatingDismissed) {
      return null;
    }

    // Minimized pill
    if (isFloatingMinimized) {
      return (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <button
            onClick={() => setIsFloatingMinimized(false)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:bg-blue-700"
          >
            <Target className="w-4 h-4" />
            <span className="text-sm font-medium">
              {checkedItems.size}/{items.length} tasks
            </span>
          </button>
        </motion.div>
      );
    }

    // Compact card (default floating state)
    if (!isFloatingExpanded) {
      return (
        <>
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
                      <span className="font-medium">Task {currentTask ? currentTask.index + 1 : checkedItems.size} of {items.length}</span>
                      <span>•</span>
                      <span>{progressPercentage}% complete</span>
                    </div>
                    {currentTask && (
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {currentTask.item.title}
                      </h3>
                    )}
                    {!currentTask && checkedItems.size === items.length && (
                      <h3 className="font-semibold text-green-600 dark:text-green-400">
                        All tasks complete! 🎉
                      </h3>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsFloatingExpanded(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Expand checklist"
                    title="View all tasks"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsFloatingMinimized(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Minimize checklist"
                    title="Minimize"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsFloatingDismissed(true)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    aria-label="Dismiss checklist"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Current Task Details */}
              {currentTask && (
                <div className="p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {currentTask.item.description}
                  </p>

                  {allowHints && currentTask.item.hint && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleHint(currentTask.item.id)}
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <HelpCircle className="w-4 h-4" />
                        {expandedHints.has(currentTask.item.id) ? 'Hide hint' : 'Show hint'}
                      </button>
                    </div>
                  )}

                  <AnimatePresence>
                    {allowHints && currentTask.item.hint && expandedHints.has(currentTask.item.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex gap-2">
                          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {currentTask.item.hint}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {currentTask && (
                    <button
                      onClick={() => toggleItem(currentTask.item.id)}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
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
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Congratulations Modal */}
          <AnimatePresence>
            {showCongrats && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                onClick={() => setShowCongrats(false)}
              >
                <div className="absolute inset-0 bg-black/50" />
                <motion.div
                  className="relative bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center">
                    <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Congratulations! 🎉</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      You've completed all the exploration tasks! You now have a solid understanding
                      of the assurance case structure.
                    </p>
                    <button
                      onClick={() => setShowCongrats(false)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      );
    }

    // Expanded full checklist modal
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsFloatingExpanded(false)}
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
                  Exploration Checklist
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {checkedItems.size} of {items.length} completed ({progressPercentage}%)
                </p>
              </div>
              <button
                onClick={() => setIsFloatingExpanded(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Collapse checklist"
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
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* All Tasks */}
              <div className="space-y-3">
                {items.map((item, index) => {
                  const isChecked = checkedItems.has(item.id);
                  const isHintExpanded = expandedHints.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 transition-all ${
                        isChecked
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="mt-0.5 transition-colors"
                        >
                          {isChecked ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3
                                className={`font-medium ${
                                  isChecked
                                    ? 'text-gray-600 line-through dark:text-gray-400'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                {item.title}
                              </h3>
                              {item.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {allowHints && item.hint && (
                              <button
                                onClick={() => toggleHint(item.id)}
                                className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <HelpCircle className="w-4 h-4 text-blue-500" />
                              </button>
                            )}
                          </div>

                          <AnimatePresence>
                            {allowHints && item.hint && isHintExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
                              >
                                <div className="flex gap-2">
                                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-blue-800 dark:text-blue-200">
                                    {item.hint}
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

        {/* Congratulations Modal */}
        <AnimatePresence>
          {showCongrats && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center z-[60] p-4"
              onClick={() => setShowCongrats(false)}
            >
              <div className="absolute inset-0 bg-black/50" />
              <motion.div
                className="relative bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Congratulations! 🎉</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You've completed all the exploration tasks! You now have a solid understanding
                    of the assurance case structure.
                  </p>
                  <button
                    onClick={() => setShowCongrats(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Default mode rendering
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Exploration Checklist
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Complete these discovery tasks to understand the assurance case structure
        </p>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {checkedItems.size} of {items.length} completed ({progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-3">
        {items.map((item, index) => {
          const isChecked = checkedItems.has(item.id);
          const isHintExpanded = expandedHints.has(item.id);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`border rounded-lg p-4 transition-all ${
                isChecked
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => toggleItem(item.id)}
                  className="mt-0.5 transition-colors"
                  aria-label={`Mark ${item.title} as ${isChecked ? 'incomplete' : 'complete'}`}
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3
                        className={`font-medium ${
                          isChecked
                            ? 'text-gray-600 line-through dark:text-gray-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Hint Button */}
                    {allowHints && item.hint && (
                      <button
                        onClick={() => toggleHint(item.id)}
                        className="ml-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label={`${isHintExpanded ? 'Hide' : 'Show'} hint for ${item.title}`}
                      >
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                  </div>

                  {/* Hint Content */}
                  <AnimatePresence>
                    {allowHints && item.hint && isHintExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                          <div className="flex gap-2">
                            <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              {item.hint}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Sub-items */}
                  {item.subItems && item.subItems.length > 0 && (
                    <div className="mt-3 ml-6 space-y-2">
                      {item.subItems.map((subItem, subIndex) => {
                        const isSubChecked = checkedItems.has(subItem.id);
                        return (
                          <div
                            key={subItem.id}
                            className="flex items-center gap-2"
                          >
                            <button
                              onClick={() => toggleItem(subItem.id)}
                              aria-label={`Mark ${subItem.title} as ${isSubChecked ? 'incomplete' : 'complete'}`}
                            >
                              {isSubChecked ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                            <span
                              className={`text-sm ${
                                isSubChecked
                                  ? 'text-gray-500 line-through dark:text-gray-400'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {subItem.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={resetProgress}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Reset Progress
        </button>
      </div>

      {/* Congratulations Modal */}
      <AnimatePresence>
        {showCongrats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCongrats(false)}
          >
            <div className="absolute inset-0 bg-black/50" />
            <motion.div
              className="relative bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <Award className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Congratulations! 🎉</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You've completed all the exploration tasks! You now have a solid understanding
                  of the assurance case structure.
                </p>
                <button
                  onClick={() => setShowCongrats(false)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Example usage data structure
export const exampleChecklistItems = [
  {
    id: 'task-1',
    title: 'Find the main goal',
    description: 'Locate the top-level goal that describes the overall claim',
    hint: 'Look for the green node at the top of the diagram. It should describe fairness in AI recruitment.'
  },
  {
    id: 'task-2',
    title: 'Identify the three strategies',
    description: 'Discover how the main goal is broken down into approaches',
    hint: 'Purple nodes represent strategies. Each one addresses a different aspect of fairness.',
    subItems: [
      { id: 'task-2-1', title: 'Find the bias detection strategy' },
      { id: 'task-2-2', title: 'Find the transparency strategy' },
      { id: 'task-2-3', title: 'Find the monitoring strategy' }
    ]
  },
  {
    id: 'task-3',
    title: 'Explore the property claims',
    description: 'Find the specific claims that support each strategy',
    hint: 'Orange nodes are property claims. They make specific, measurable statements.'
  },
  {
    id: 'task-4',
    title: 'Locate the evidence',
    description: 'Find what evidence supports the property claims',
    hint: 'Cyan nodes represent evidence. They provide concrete proof for the claims.'
  },
  {
    id: 'task-5',
    title: 'Understand the context',
    description: 'Identify the contextual information that scopes the case',
    hint: 'Gray nodes provide context. They define important boundaries and definitions.'
  }
];

export default ExplorationChecklist;
