import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useModuleProgress } from './ModuleProgressContext';
import { TaskStatus } from './TaskRegistry';

/**
 * TaskCheckpoint - Wrapper for content sections with manual completion
 *
 * Integrates with ModuleProgressContext to track task completion
 * Provides visual feedback and manual completion trigger
 *
 * @param {object} props
 * @param {string} props.id - Task ID (must match task in TaskRegistry)
 * @param {string} props.title - Task title (optional, uses task definition if not provided)
 * @param {string} props.section - Section anchor for navigation (optional)
 * @param {React.ReactNode} props.children - Content to wrap
 * @param {boolean} props.showButton - Whether to show completion button (default: true)
 * @param {string} props.buttonPosition - Button position: 'top' or 'bottom' (default: 'bottom')
 * @param {boolean} props.showHeader - Whether to show the header with title and status icon (default: false)
 */
const TaskCheckpoint = ({
  id,
  title = null,
  section = null,
  children,
  showButton = true,
  buttonPosition = 'bottom',
  showHeader = false
}) => {
  const { getTask, completeTask, resetTask } = useModuleProgress();

  const task = getTask(id);

  if (!task) {
    console.warn(`TaskCheckpoint: Task with id "${id}" not found in registry`);
    return <div>{children}</div>;
  }

  const isComplete = task.status === TaskStatus.COMPLETED;
  const displayTitle = title || task.title;

  const handleComplete = () => {
    if (!isComplete) {
      completeTask(id);
    } else {
      resetTask(id);
    }
  };

  const completionButton = showButton && !task.autoTrack && (
    <div className="mt-4">
      <button
        onClick={handleComplete}
        className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
          isComplete
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
        }`}
      >
        {isComplete ? (
          <>
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
          </>
        ) : (
          <>
            <Circle className="w-4 h-4" />
            <span>Mark as Complete</span>
          </>
        )}
      </button>
      {task.description && !isComplete && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {task.description}
        </p>
      )}
    </div>
  );

  return (
    <div
      id={section || id}
      className={`task-checkpoint ${isComplete ? 'task-checkpoint--complete' : ''}`}
    >
      {/* Optional header with completion status */}
      {showHeader && displayTitle && (
        <div className="flex items-center gap-2 mb-4">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {displayTitle}
          </h3>
        </div>
      )}

      {/* Button at top if specified */}
      {buttonPosition === 'top' && completionButton}

      {/* Content */}
      <div className={isComplete ? 'opacity-75' : ''}>
        {children}
      </div>

      {/* Button at bottom (default) */}
      {buttonPosition === 'bottom' && completionButton}
    </div>
  );
};

export default TaskCheckpoint;
