/**
 * StrategyNode Component
 *
 * Specialized node type for strategies in assurance cases.
 * Features purple glassmorphism theme, skewed/tilted design, strategy type badges,
 * and connection path visualization.
 *
 * Features:
 * - GitBranch icon from Lucide React
 * - Purple glassmorphism (violet color scheme)
 * - Skewed/tilted design (transform: skewY(-1deg))
 * - Strategy type badge (AND/OR decomposition)
 * - Connection paths visualization
 * - Both source and target handles
 * - Approach type indicator
 * - Path highlighting support
 *
 * @component
 * @example
 * <StrategyNode
 *   data={{
 *     id: 'strategy-1',
 *     name: 'Decomposition by Components',
 *     description: 'Break down system by major components',
 *     strategyType: 'AND',
 *     approach: 'decomposition',
 *     pathCount: 3
 *   }}
 *   selected={false}
 * />
 */

import React from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Split, Workflow, Network } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import CollapsibleNode from './CollapsibleNode';
import { Badge } from '../../../ui/badge';

/**
 * Strategy type badge with appropriate styling
 */
const StrategyTypeBadge = ({ strategyType = 'AND' }) => {
  const typeConfig = {
    AND: {
      label: 'AND',
      description: 'All paths must be satisfied',
      className: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
      icon: Split,
    },
    OR: {
      label: 'OR',
      description: 'Any path can satisfy',
      className: 'bg-violet-500/20 text-violet-300 border-violet-400/30',
      icon: Network,
    },
  };

  const config = typeConfig[strategyType] || typeConfig.AND;
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
 * Approach type indicator
 */
const ApproachIndicator = ({ approach = 'decomposition' }) => {
  const approachConfig = {
    decomposition: {
      label: 'Decomposition',
      icon: '🔷',
      description: 'Break down into smaller parts',
    },
    'substitution': {
      label: 'Substitution',
      icon: '🔄',
      description: 'Replace with equivalent claims',
    },
    'evidence': {
      label: 'Evidence',
      icon: '📊',
      description: 'Direct evidence approach',
    },
    'assumption': {
      label: 'Assumption',
      icon: '💭',
      description: 'Based on assumptions',
    },
  };

  const config = approachConfig[approach] || approachConfig.decomposition;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span>{config.icon}</span>
      <span className="text-text-light/70">{config.label}</span>
    </div>
  );
};

/**
 * Connection paths visualization
 */
const ConnectionPaths = ({ pathCount = 0 }) => {
  if (pathCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-400/20">
      <Workflow className="w-4 h-4 text-purple-400" />
      <div className="flex flex-col">
        <span className="text-xs text-text-light/50">Paths</span>
        <span className="text-sm font-semibold text-purple-300">
          {pathCount}
        </span>
      </div>
    </div>
  );
};

/**
 * StrategyNode Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Node ID
 * @param {Object} props.data - Node data
 * @param {string} props.data.name - Strategy name
 * @param {string} props.data.description - Strategy description
 * @param {string} props.data.strategyType - Type (AND/OR)
 * @param {string} props.data.approach - Approach type
 * @param {number} props.data.pathCount - Number of paths
 * @param {Array} props.data.supportingEvidence - Supporting evidence items
 * @param {boolean} props.selected - Is node selected
 * @param {boolean} props.isConnectable - Can node connect
 * @returns {React.Element} StrategyNode component
 */
const StrategyNode = ({
  id,
  data = {},
  selected = false,
  isConnectable = true,
  ...restProps
}) => {
  // Extract strategy-specific data
  const {
    strategyType = 'AND',
    approach = 'decomposition',
    pathCount = 0,
    supportingEvidence = [],
    rationale,
    metadata = {},
  } = data;

  return (
    <div className="strategy-node-wrapper">
      {/* Outer skewed container for visual effect */}
      <motion.div
        className="relative"
        style={{
          transform: 'skewY(-1deg)',
        }}
        whileHover={{
          transform: 'skewY(-1.5deg)',
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Inner container with reverse skew to keep content straight */}
        <div
          style={{
            transform: 'skewY(1deg)',
          }}
        >
          <CollapsibleNode
            id={id}
            data={data}
            selected={selected}
            isConnectable={isConnectable}
            nodeType="strategy"
            className={cn(
              'min-w-[250px] max-w-[380px]',
              'strategy-node',
              'relative',
              // Purple glow for selected state
              selected && 'shadow-[0_0_20px_rgba(168,85,247,0.3)]'
            )}
            {...restProps}
          >
            {/* Strategy-specific expanded content */}
            <div className="space-y-3">
              {/* Strategy Type and Approach Row */}
              <div className="flex items-center justify-between gap-2">
                <StrategyTypeBadge strategyType={strategyType} />
                <ApproachIndicator approach={approach} />
              </div>

              {/* Connection Paths */}
              {pathCount > 0 && <ConnectionPaths pathCount={pathCount} />}

              {/* Rationale */}
              {rationale && (
                <div className="space-y-1">
                  <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
                    Rationale
                  </div>
                  <p className="text-xs text-text-light/70 italic">
                    {rationale}
                  </p>
                </div>
              )}

              {/* Supporting Evidence */}
              {supportingEvidence && supportingEvidence.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-text-light/50 uppercase tracking-wider font-medium">
                    Supporting Evidence
                  </div>
                  <ul className="space-y-1">
                    {supportingEvidence.slice(0, 3).map((evidence, i) => (
                      <li
                        key={i}
                        className="text-xs text-text-light/70 flex items-start gap-2"
                      >
                        <span className="text-purple-400 mt-0.5">→</span>
                        <span>{evidence.name || evidence}</span>
                      </li>
                    ))}
                    {supportingEvidence.length > 3 && (
                      <li className="text-xs text-text-light/50 italic">
                        + {supportingEvidence.length - 3} more...
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
                      <span className="text-text-light/70 font-medium">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual indicator for AND strategy */}
              {strategyType === 'AND' && (
                <div className="flex items-center justify-center gap-1 opacity-40">
                  <div className="h-px w-8 bg-purple-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <div className="h-px w-8 bg-purple-400" />
                </div>
              )}

              {/* Visual indicator for OR strategy */}
              {strategyType === 'OR' && (
                <div className="relative h-8 opacity-40">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 100 30"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M 0 15 Q 25 5, 50 15 T 100 15"
                      stroke="rgba(167, 139, 250, 0.6)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M 0 15 Q 25 25, 50 15 T 100 15"
                      stroke="rgba(167, 139, 250, 0.6)"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
            </div>
          </CollapsibleNode>
        </div>
      </motion.div>

      {/* Decorative gradient border overlay */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0"
        animate={{
          opacity: selected ? [0.3, 0.5, 0.3] : 0,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
        style={{
          background:
            'linear-gradient(45deg, rgba(168,85,247,0.2), rgba(139,92,246,0.2))',
          transform: 'skewY(-1deg)',
        }}
      />
    </div>
  );
};

/**
 * Compact StrategyNode variant
 */
export const CompactStrategyNode = (props) => {
  return (
    <StrategyNode
      {...props}
      className={cn('min-w-[200px] max-w-[300px]', props.className)}
    />
  );
};

/**
 * StrategyNode with emphasis on decomposition paths
 */
export const DecompositionStrategyNode = (props) => {
  return (
    <StrategyNode
      {...props}
      data={{ ...props.data, strategyType: 'AND', approach: 'decomposition' }}
    />
  );
};

/**
 * StrategyNode with emphasis on alternative paths
 */
export const AlternativeStrategyNode = (props) => {
  return (
    <StrategyNode
      {...props}
      data={{ ...props.data, strategyType: 'OR', approach: 'substitution' }}
    />
  );
};

export default StrategyNode;
