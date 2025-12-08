/**
 * GoalNode Component
 *
 * Specialized node type for top-level goals in assurance cases.
 * Features green glassmorphism theme, importance badges, progress tracking,
 * and special root node styling.
 *
 * Features:
 * - Target icon from Lucide React
 * - Green glassmorphism (emerald color scheme)
 * - Importance/priority badge
 * - Larger default size (expanded: 400px)
 * - Special "root node" styling option
 * - Progress indicator (optional)
 * - No source handle (top-level nodes)
 * - Achievement percentage display
 * - Sub-goals count display
 *
 * @component
 * @example
 * <GoalNode
 *   data={{
 *     id: 'goal-1',
 *     name: 'System Safety',
 *     description: 'System is acceptably safe to operate',
 *     importance: 'critical',
 *     progress: 75,
 *     subGoalsCount: 5,
 *     isRoot: true
 *   }}
 *   selected={false}
 * />
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Layers } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import CollapsibleNode from './CollapsibleNode';
import { Badge } from '../../../ui/badge';

/**
 * Progress indicator component for goals
 */
const ProgressIndicator = ({ progress = 0, showLabel = true }) => {
  const percentage = Math.min(100, Math.max(0, progress));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r={radius}
            stroke="rgba(16, 185, 129, 0.2)"
            strokeWidth="3"
            fill="none"
          />
          {/* Progress circle */}
          <motion.circle
            cx="20"
            cy="20"
            r={radius}
            stroke="#10b981"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        {/* Percentage text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-green-400">
            {percentage}%
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="text-xs text-text-light/70">
          Progress
        </div>
      )}
    </div>
  );
};

/**
 * Importance badge with appropriate styling
 */
const ImportanceBadge = ({ importance = 'medium' }) => {
  const importanceConfig = {
    critical: {
      label: 'Critical',
      className: 'bg-red-500/20 text-red-300 border-red-400/30',
      icon: '🔴',
    },
    high: {
      label: 'High',
      className: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
      icon: '🟠',
    },
    medium: {
      label: 'Medium',
      className: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
      icon: '🟡',
    },
    low: {
      label: 'Low',
      className: 'bg-green-500/20 text-green-300 border-green-400/30',
      icon: '🟢',
    },
  };

  const config = importanceConfig[importance] || importanceConfig.medium;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs px-2 py-0.5',
        'border',
        'backdrop-blur-sm',
        config.className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
};

/**
 * GoalNode Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Node ID
 * @param {Object} props.data - Node data
 * @param {string} props.data.name - Goal name
 * @param {string} props.data.description - Goal description
 * @param {string} props.data.importance - Importance level (critical, high, medium, low)
 * @param {number} props.data.progress - Progress percentage (0-100)
 * @param {number} props.data.subGoalsCount - Number of sub-goals
 * @param {boolean} props.data.isRoot - Is this a root node
 * @param {Array} props.data.context - Related context items
 * @param {boolean} props.selected - Is node selected
 * @param {boolean} props.isConnectable - Can node connect
 * @returns {React.Element} GoalNode component
 */
const GoalNode = ({
  id,
  data = {},
  selected = false,
  isConnectable = true,
  ...restProps
}) => {
  // Extract goal-specific data
  const {
    importance = 'medium',
    progress,
    subGoalsCount = 0,
    isRoot = false,
    context = [],
    metadata = {},
  } = data;

  // Determine if we should show progress
  const hasProgress = typeof progress === 'number';

  // Build custom className for root nodes
  const rootNodeClasses = isRoot
    ? cn(
        'ring-2 ring-green-500/30',
        'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
        'min-w-[300px]',
        'max-w-[450px]'
      )
    : 'min-w-[250px] max-w-[400px]';

  return (
    <CollapsibleNode
      id={id}
      data={data}
      selected={selected}
      isConnectable={isConnectable}
      nodeType="goal"
      className={cn(rootNodeClasses, 'goal-node')}
      {...restProps}
    >
      {/* Goal-specific expanded content */}
      <div className="space-y-3">
        {/* Importance and Status Row */}
        <div className="flex items-center justify-between gap-2">
          <ImportanceBadge importance={importance} />

          {hasProgress && (
            <ProgressIndicator progress={progress} showLabel={false} />
          )}
        </div>

        {/* Statistics Row */}
        {(subGoalsCount > 0 || hasProgress) && (
          <div className="grid grid-cols-2 gap-2">
            {/* Sub-goals count */}
            {subGoalsCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-400/20">
                <Layers className="w-4 h-4 text-green-400" />
                <div className="flex flex-col">
                  <span className="text-xs text-text-light/50">Sub-goals</span>
                  <span className="text-sm font-semibold text-green-300">
                    {subGoalsCount}
                  </span>
                </div>
              </div>
            )}

            {/* Progress indicator (if available) */}
            {hasProgress && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-400/20">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <div className="flex flex-col">
                  <span className="text-xs text-text-light/50">Complete</span>
                  <span className="text-sm font-semibold text-green-300">
                    {progress}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Root node indicator */}
        {isRoot && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'px-3 py-2',
              'rounded-lg',
              'bg-gradient-to-r from-green-500/20 to-emerald-500/20',
              'border border-green-400/30',
              'text-center'
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Target className="w-4 h-4 text-green-300" />
              <span className="text-xs font-medium text-green-200">
                Root Goal
              </span>
            </div>
          </motion.div>
        )}

        {/* Context items */}
        {context && context.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Context
            </div>
            <ul className="space-y-1">
              {context.slice(0, 3).map((ctx, i) => (
                <li
                  key={i}
                  className="text-xs text-text-light/70 flex items-start gap-2"
                >
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>{ctx.name || ctx}</span>
                </li>
              ))}
              {context.length > 3 && (
                <li className="text-xs text-text-light/50 italic">
                  + {context.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border-transparent/50">
            {Object.entries(metadata).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-text-light/50 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                </span>
                <span className="text-text-light/70 font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pulse effect for important nodes */}
        {importance === 'critical' && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(239, 68, 68, 0)',
                '0 0 0 8px rgba(239, 68, 68, 0.1)',
                '0 0 0 0 rgba(239, 68, 68, 0)',
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        )}
      </div>
    </CollapsibleNode>
  );
};

/**
 * Compact GoalNode variant for smaller displays
 */
export const CompactGoalNode = (props) => {
  return (
    <GoalNode
      {...props}
      className={cn('min-w-[200px] max-w-[300px]', props.className)}
    />
  );
};

/**
 * Large GoalNode variant for emphasized display
 */
export const LargeGoalNode = (props) => {
  return (
    <GoalNode
      {...props}
      data={{ ...props.data, isRoot: true }}
      className={cn('min-w-[350px] max-w-[500px]', props.className)}
    />
  );
};

export default GoalNode;
