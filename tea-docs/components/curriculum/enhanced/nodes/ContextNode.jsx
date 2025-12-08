/**
 * ContextNode Component
 *
 * Specialized node type for contextual information and assumptions in assurance cases.
 * Features subtle gray glassmorphism theme, importance levels, info tooltips,
 * and special positioning support.
 *
 * Features:
 * - AlertCircle icon from Lucide React
 * - Subtle gray glassmorphism theme
 * - Smaller default size (more compact)
 * - Info tooltip on hover
 * - Can be attached to any node type
 * - Special positioning (often to the side)
 * - Importance level indicator
 * - Related nodes indicator
 * - Assumption/constraint type badges
 *
 * @component
 * @example
 * <ContextNode
 *   data={{
 *     id: 'context-1',
 *     name: 'Operating Environment',
 *     description: 'System operates in controlled environment',
 *     contextType: 'assumption',
 *     importance: 'high',
 *     relatedNodesCount: 2
 *   }}
 *   selected={false}
 * />
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Info,
  Link2,
  MessageSquare,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import CollapsibleNode from './CollapsibleNode';
import { Badge } from '../../../ui/badge';

/**
 * Context type configuration
 */
const contextTypeConfig = {
  assumption: {
    label: 'Assumption',
    icon: AlertTriangle,
    className: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
    description: 'Assumed condition',
  },
  constraint: {
    label: 'Constraint',
    icon: Shield,
    className: 'bg-red-500/20 text-red-300 border-red-400/30',
    description: 'System constraint',
  },
  justification: {
    label: 'Justification',
    icon: MessageSquare,
    className: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    description: 'Justification note',
  },
  definition: {
    label: 'Definition',
    icon: Info,
    className: 'bg-gray-500/20 text-gray-300 border-gray-400/30',
    description: 'Term definition',
  },
};

/**
 * Context type badge
 */
const ContextTypeBadge = ({ contextType = 'assumption' }) => {
  const config = contextTypeConfig[contextType] || contextTypeConfig.assumption;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs px-2 py-0.5',
        'border',
        'backdrop-blur-sm',
        config.className
      )}
      title={config.description}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
};

/**
 * Importance level indicator
 */
const ImportanceLevelIndicator = ({ importance = 'medium' }) => {
  const importanceConfig = {
    critical: {
      label: 'Critical',
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-400/30',
      icon: '🔴',
    },
    high: {
      label: 'High',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-400/30',
      icon: '🟠',
    },
    medium: {
      label: 'Medium',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-400/30',
      icon: '🟡',
    },
    low: {
      label: 'Low',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/20',
      borderColor: 'border-gray-400/30',
      icon: '⚪',
    },
  };

  const config = importanceConfig[importance] || importanceConfig.medium;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2 py-1 rounded text-xs',
        config.bgColor,
        'border',
        config.borderColor
      )}
    >
      <span>{config.icon}</span>
      <span className={config.color}>{config.label}</span>
    </div>
  );
};

/**
 * Related nodes indicator
 */
const RelatedNodesIndicator = ({ count = 0 }) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-500/10 border border-gray-400/20">
      <Link2 className="w-4 h-4 text-gray-400" />
      <div className="flex flex-col">
        <span className="text-xs text-text-light/50">Applies to</span>
        <span className="text-sm font-semibold text-gray-300">
          {count} {count === 1 ? 'node' : 'nodes'}
        </span>
      </div>
    </div>
  );
};

/**
 * Info tooltip component
 */
const InfoTooltip = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && content && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
              'px-3 py-2 rounded-lg',
              'bg-background-transparent-black-secondaryAlt',
              'border border-gray-400/30',
              'backdrop-blur-lg',
              'text-xs text-text-light',
              'max-w-xs',
              'z-50',
              'pointer-events-none',
              'whitespace-normal'
            )}
          >
            {content}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 -mt-1"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid rgba(0, 0, 0, 0.85)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ContextNode Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Node ID
 * @param {Object} props.data - Node data
 * @param {string} props.data.name - Context name
 * @param {string} props.data.description - Context description
 * @param {string} props.data.contextType - Type (assumption, constraint, justification, definition)
 * @param {string} props.data.importance - Importance level (critical, high, medium, low)
 * @param {number} props.data.relatedNodesCount - Number of related nodes
 * @param {string} props.data.tooltipContent - Extended tooltip content
 * @param {boolean} props.selected - Is node selected
 * @param {boolean} props.isConnectable - Can node connect
 * @returns {React.Element} ContextNode component
 */
const ContextNode = ({
  id,
  data = {},
  selected = false,
  isConnectable = true,
  ...restProps
}) => {
  // Extract context-specific data
  const {
    contextType = 'assumption',
    importance = 'medium',
    relatedNodesCount = 0,
    tooltipContent,
    validity,
    scope,
    implications = [],
    metadata = {},
  } = data;

  const isCritical = importance === 'critical';

  return (
    <CollapsibleNode
      id={id}
      data={data}
      selected={selected}
      isConnectable={isConnectable}
      nodeType="context"
      className={cn(
        'min-w-[200px] max-w-[320px]',
        'context-node',
        // Subtle glow for selected state
        selected && 'shadow-[0_0_15px_rgba(156,163,175,0.2)]',
        // Warning glow for critical context
        isCritical && 'shadow-[0_0_15px_rgba(239,68,68,0.2)]'
      )}
      {...restProps}
    >
      {/* Context-specific expanded content */}
      <div className="space-y-3">
        {/* Context Type and Importance Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <ContextTypeBadge contextType={contextType} />
          <ImportanceLevelIndicator importance={importance} />
        </div>

        {/* Info tooltip trigger */}
        {tooltipContent && (
          <InfoTooltip content={tooltipContent}>
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2',
                'rounded-lg cursor-help',
                'bg-blue-500/10 border border-blue-400/20',
                'hover:bg-blue-500/20 transition-colors'
              )}
            >
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-blue-300">Hover for details</span>
            </div>
          </InfoTooltip>
        )}

        {/* Related Nodes */}
        <RelatedNodesIndicator count={relatedNodesCount} />

        {/* Validity */}
        {validity && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Validity
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-text-light/70">{validity}</span>
            </div>
          </div>
        )}

        {/* Scope */}
        {scope && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Scope
            </div>
            <p className="text-xs text-text-light/70">{scope}</p>
          </div>
        )}

        {/* Implications */}
        {implications && implications.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
              Implications
            </div>
            <ul className="space-y-1">
              {implications.slice(0, 3).map((implication, i) => (
                <li
                  key={i}
                  className="text-xs text-text-light/70 flex items-start gap-2"
                >
                  <span className="text-gray-400 mt-0.5">→</span>
                  <span>{implication}</span>
                </li>
              ))}
              {implications.length > 3 && (
                <li className="text-xs text-text-light/50 italic">
                  + {implications.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Additional Metadata */}
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

        {/* Critical context warning */}
        {isCritical && (
          <motion.div
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-400/20"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-300 font-medium">
              Critical Context
            </span>
          </motion.div>
        )}

        {/* Context type specific visual indicator */}
        {contextType === 'assumption' && (
          <div className="flex items-center justify-center gap-2 text-xs text-text-light/40">
            <div className="h-px w-8 bg-yellow-400/30" />
            <span className="text-yellow-400/50">Assumed</span>
            <div className="h-px w-8 bg-yellow-400/30" />
          </div>
        )}

        {contextType === 'constraint' && (
          <div className="flex items-center justify-center gap-2 text-xs text-text-light/40">
            <div className="h-px w-8 bg-red-400/30" />
            <span className="text-red-400/50">Limited</span>
            <div className="h-px w-8 bg-red-400/30" />
          </div>
        )}
      </div>
    </CollapsibleNode>
  );
};

/**
 * Compact ContextNode variant (even smaller)
 */
export const CompactContextNode = (props) => {
  return (
    <ContextNode
      {...props}
      className={cn('min-w-[150px] max-w-[250px]', props.className)}
    />
  );
};

/**
 * ContextNode for assumptions
 */
export const AssumptionContextNode = (props) => {
  return (
    <ContextNode
      {...props}
      data={{
        ...props.data,
        contextType: 'assumption',
      }}
    />
  );
};

/**
 * ContextNode for constraints
 */
export const ConstraintContextNode = (props) => {
  return (
    <ContextNode
      {...props}
      data={{
        ...props.data,
        contextType: 'constraint',
      }}
    />
  );
};

/**
 * ContextNode for justifications
 */
export const JustificationContextNode = (props) => {
  return (
    <ContextNode
      {...props}
      data={{
        ...props.data,
        contextType: 'justification',
      }}
    />
  );
};

/**
 * Critical ContextNode with emphasis
 */
export const CriticalContextNode = (props) => {
  return (
    <ContextNode
      {...props}
      data={{
        ...props.data,
        importance: 'critical',
      }}
    />
  );
};

export default ContextNode;
