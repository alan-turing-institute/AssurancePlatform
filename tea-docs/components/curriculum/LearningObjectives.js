import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  CheckCircle2,
  Circle,
  BookOpen,
  Lightbulb,
  Award,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

/**
 * LearningObjectives - Display module learning objectives
 *
 * Can be used standalone or integrated with ModuleProgressContext
 * to show completion status of objectives
 *
 * @param {object} props
 * @param {array} props.objectives - Array of learning objective objects
 * @param {string} props.title - Component title (default: "Learning Objectives")
 * @param {boolean} props.showProgress - Whether to show completion checkboxes
 * @param {string} props.variant - Display variant: 'card' | 'list' | 'compact' (default: 'card')
 * @param {boolean} props.collapsible - Whether objectives can be collapsed (default: false)
 */
const LearningObjectives = ({
  objectives = [],
  title = "Learning Objectives",
  showProgress = false,
  variant = 'card',
  collapsible = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [completedIds, setCompletedIds] = useState(new Set());

  if (objectives.length === 0) {
    return null;
  }

  const toggleComplete = (id) => {
    if (!showProgress) return;

    const newCompleted = new Set(completedIds);
    if (newCompleted.has(id)) {
      newCompleted.delete(id);
    } else {
      newCompleted.add(id);
    }
    setCompletedIds(newCompleted);
  };

  const completionPercentage = showProgress
    ? Math.round((completedIds.size / objectives.length) * 100)
    : 0;

  // Compact variant - simple list
  if (variant === 'compact') {
    return (
      <div className="my-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">{title}</h3>
        </div>
        <ul className="space-y-2">
          {objectives.map((objective, idx) => (
            <li key={objective.id || idx} className="flex items-start gap-2 text-sm">
              <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
              <span className="text-blue-900 dark:text-blue-100">{objective.text}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // List variant - simple checkable list
  if (variant === 'list') {
    return (
      <div className="my-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xl font-semibold">{title}</h3>
          </div>
          {showProgress && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {completedIds.size}/{objectives.length} completed
            </span>
          )}
        </div>
        <ul className="space-y-3">
          {objectives.map((objective, idx) => {
            const isComplete = completedIds.has(objective.id);
            return (
              <li
                key={objective.id || idx}
                className="flex items-start gap-3"
              >
                {showProgress ? (
                  <button
                    onClick={() => toggleComplete(objective.id)}
                    className="mt-0.5 transition-colors"
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                ) : (
                  <Lightbulb className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={isComplete ? 'line-through text-gray-500' : ''}>
                    {objective.text}
                  </p>
                  {objective.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {objective.description}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Card variant (default) - rich display with optional collapsing
  return (
    <div className="my-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
      {/* Header */}
      <div
        className={`p-6 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                By the end of this module, you will be able to:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showProgress && (
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {completionPercentage}%
                </div>
                <div className="text-xs text-gray-500">complete</div>
              </div>
            )}
            {collapsible && (
              <button className="p-2 hover:bg-white/50 dark:hover:bg-black/20 rounded-lg transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="mt-4">
            <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Objectives List */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="px-6 pb-6"
        >
          <div className="space-y-4">
            {objectives.map((objective, idx) => {
              const isComplete = completedIds.has(objective.id);
              const Icon = objective.icon || BookOpen;

              return (
                <motion.div
                  key={objective.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                    isComplete
                      ? 'bg-green-100 dark:bg-green-900/20'
                      : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  {showProgress ? (
                    <button
                      onClick={() => toggleComplete(objective.id)}
                      className="mt-0.5 transition-colors flex-shrink-0"
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  ) : (
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}

                  <div className="flex-1">
                    <p
                      className={`font-medium mb-1 ${
                        isComplete
                          ? 'line-through text-gray-600 dark:text-gray-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {objective.text}
                    </p>
                    {objective.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {objective.description}
                      </p>
                    )}
                    {objective.relatedTask && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        Related: {objective.relatedTask}
                      </p>
                    )}
                  </div>

                  {objective.badge && (
                    <div className="flex-shrink-0">
                      <Award className="w-5 h-5 text-yellow-500" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Example usage data structure
export const exampleObjectives = [
  {
    id: 'obj-1',
    text: 'Identify the key components of an assurance case',
    description: 'Recognize goals, strategies, evidence, and context elements',
    icon: Target,
    relatedTask: 'Exploration tasks 1-5'
  },
  {
    id: 'obj-2',
    text: 'Explain how structured arguments build trust',
    description: 'Understand the logical flow from claims to evidence',
    icon: BookOpen,
    relatedTask: 'Reflection prompts'
  },
  {
    id: 'obj-3',
    text: 'Evaluate the strength of assurance arguments',
    description: 'Critically assess completeness and convincingness',
    icon: Lightbulb,
    relatedTask: 'Assessment quiz'
  }
];

export default LearningObjectives;
