/**
 * Conditional Handle Component
 *
 * Handle that shows/hides based on node state, displays different styles for
 * different conditions, supports dynamic positioning based on content,
 * state-based animations, and custom validation rules.
 *
 * @component
 * @example
 * <ConditionalHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   condition={(nodeData) => nodeData.isComplete}
 *   dynamicPosition={true}
 *   stateStyles={{
 *     active: 'bg-green-500',
 *     inactive: 'bg-gray-400',
 *     error: 'bg-red-500'
 *   }}
 * />
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import {
  Plus,
  Check,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import {
  getPositionClasses,
  getHandleSizeClasses,
  validateConnection,
} from './handleUtils';

/**
 * ConditionalHandle component with state-based behavior
 * @param {object} props - Component props
 * @param {string} props.type - Handle type ('source' or 'target')
 * @param {string} props.position - Handle position
 * @param {string} props.nodeId - Node identifier
 * @param {string} props.id - Handle identifier
 * @param {boolean} props.isConnectable - Whether handle is connectable
 * @param {Function} props.condition - Condition function (nodeData) => boolean
 * @param {string} props.state - Current state ('active', 'inactive', 'error', 'locked', 'pending')
 * @param {object} props.stateStyles - Style configuration for each state
 * @param {object} props.stateIcons - Icon configuration for each state
 * @param {boolean} props.dynamicPosition - Enable dynamic positioning based on content
 * @param {Function} props.customValidation - Custom validation function
 * @param {boolean} props.requiresApproval - Requires approval before connection
 * @param {Array<string>} props.dependencies - List of required node IDs
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} ConditionalHandle component
 */
const ConditionalHandle = ({
  type,
  position,
  nodeId,
  id,
  isConnectable = true,
  condition = null,
  state = 'active',
  stateStyles = {},
  stateIcons = {},
  dynamicPosition = false,
  customValidation = null,
  requiresApproval = false,
  dependencies = [],
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [currentState, setCurrentState] = useState(state);
  const [validationMessage, setValidationMessage] = useState('');
  const reactFlowInstance = useReactFlow();

  // Evaluate condition to determine visibility
  useEffect(() => {
    if (condition && reactFlowInstance && nodeId) {
      const nodes = reactFlowInstance.getNodes();
      const node = nodes.find((n) => n.id === nodeId);

      if (node) {
        const shouldShow = condition(node.data, node);
        setIsVisible(shouldShow);
      }
    }
  }, [condition, reactFlowInstance, nodeId]);

  // Check dependencies
  useEffect(() => {
    if (dependencies.length > 0 && reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();

      const allDependenciesMet = dependencies.every((depId) => {
        return edges.some(
          (edge) =>
            (edge.source === depId && edge.target === nodeId) ||
            (edge.target === depId && edge.source === nodeId)
        );
      });

      if (!allDependenciesMet) {
        setCurrentState('locked');
        setValidationMessage('Dependencies not met');
      } else if (currentState === 'locked') {
        setCurrentState('active');
        setValidationMessage('');
      }
    }
  }, [dependencies, reactFlowInstance, nodeId, currentState]);

  // Custom validation
  useEffect(() => {
    if (customValidation && reactFlowInstance && nodeId) {
      const nodes = reactFlowInstance.getNodes();
      const node = nodes.find((n) => n.id === nodeId);

      if (node) {
        const validation = customValidation(node.data, node);
        if (!validation.valid) {
          setCurrentState('error');
          setValidationMessage(validation.message || 'Validation failed');
        } else if (currentState === 'error') {
          setCurrentState('active');
          setValidationMessage('');
        }
      }
    }
  }, [customValidation, reactFlowInstance, nodeId, currentState]);

  // State configurations
  const defaultStateStyles = {
    active: {
      bg: 'bg-green-500',
      border: 'border-green-400',
      icon: 'text-white',
      glow: 'shadow-green-500/50',
    },
    inactive: {
      bg: 'bg-gray-400',
      border: 'border-gray-300',
      icon: 'text-gray-700',
      glow: 'shadow-gray-500/50',
    },
    error: {
      bg: 'bg-red-500',
      border: 'border-red-400',
      icon: 'text-white',
      glow: 'shadow-red-500/50',
    },
    locked: {
      bg: 'bg-yellow-500',
      border: 'border-yellow-400',
      icon: 'text-white',
      glow: 'shadow-yellow-500/50',
    },
    pending: {
      bg: 'bg-blue-500',
      border: 'border-blue-400',
      icon: 'text-white',
      glow: 'shadow-blue-500/50',
    },
    warning: {
      bg: 'bg-orange-500',
      border: 'border-orange-400',
      icon: 'text-white',
      glow: 'shadow-orange-500/50',
    },
  };

  const defaultStateIcons = {
    active: Check,
    inactive: Plus,
    error: X,
    locked: Lock,
    pending: Clock,
    warning: AlertTriangle,
  };

  // Merge default with custom styles
  const styles = { ...defaultStateStyles, ...stateStyles };
  const icons = { ...defaultStateIcons, ...stateIcons };

  // Get current style and icon
  const currentStyle = styles[currentState] || styles.active;
  const CurrentIcon = icons[currentState] || icons.active;

  // Determine if handle should be connectable
  const canConnect = useMemo(() => {
    return (
      isVisible &&
      isConnectable &&
      currentState !== 'locked' &&
      currentState !== 'error'
    );
  }, [isVisible, isConnectable, currentState]);

  // Get styling
  const positionClass = getPositionClasses(position);
  const sizeClasses = getHandleSizeClasses('medium');

  // State-based animations
  const getStateAnimation = () => {
    switch (currentState) {
      case 'pending':
        return {
          rotate: [0, 360],
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          },
        };
      case 'error':
        return {
          scale: [1, 1.1, 1],
          transition: {
            duration: 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
      case 'warning':
        return {
          opacity: [1, 0.6, 1],
          transition: {
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
      case 'locked':
        return {
          y: [0, -2, 0],
          transition: {
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
      default:
        return {};
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <Handle
          type={type}
          position={position}
          id={id}
          isConnectable={canConnect}
          {...props}
          className={cn(
            '!bg-transparent',
            '!border-0',
            sizeClasses.outer,
            'flex items-center justify-center',
            positionClass,
            'group/handle',
            canConnect ? 'cursor-pointer' : 'cursor-not-allowed',
            'z-10',
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Animated handle decorator */}
          <motion.div
            className="pointer-events-none relative"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, ...getStateAnimation() }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
          >
            {/* Main handle button */}
            <motion.div
              className={cn(
                sizeClasses.inner,
                'rounded-full',
                currentStyle.bg,
                'border-2',
                currentStyle.border,
                'flex items-center justify-center',
                'shadow-md',
                currentStyle.glow,
                'transition-all duration-300',
                isHovered && 'shadow-lg'
              )}
              whileHover={canConnect ? { scale: 1.1 } : {}}
            >
              <CurrentIcon
                className={cn(
                  sizeClasses.icon,
                  currentStyle.icon,
                  'transition-transform duration-200'
                )}
                strokeWidth={2.5}
              />
            </motion.div>

            {/* State indicator badge */}
            {currentState !== 'active' && currentState !== 'inactive' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'absolute -top-1 -right-1',
                  'w-3 h-3',
                  'rounded-full',
                  currentState === 'error' && 'bg-red-600',
                  currentState === 'locked' && 'bg-yellow-600',
                  currentState === 'pending' && 'bg-blue-600',
                  currentState === 'warning' && 'bg-orange-600',
                  'border border-white',
                  'shadow-sm'
                )}
              />
            )}

            {/* Pulse ring for active state */}
            {currentState === 'active' && canConnect && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full border-2',
                  currentStyle.border
                )}
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Lock indicator */}
            {currentState === 'locked' && (
              <motion.div
                className={cn(
                  'absolute -bottom-2 left-1/2 -translate-x-1/2',
                  'flex items-center gap-0.5'
                )}
                animate={{
                  y: [0, -2, 0],
                  transition: {
                    duration: 1.5,
                    repeat: Infinity,
                  },
                }}
              >
                <div className="w-1 h-1 rounded-full bg-yellow-500" />
                <div className="w-1 h-1 rounded-full bg-yellow-500" />
                <div className="w-1 h-1 rounded-full bg-yellow-500" />
              </motion.div>
            )}

            {/* Approval required indicator */}
            {requiresApproval && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'absolute -bottom-1 -left-1',
                  'w-4 h-4 rounded-full',
                  'bg-purple-500 border border-white',
                  'flex items-center justify-center'
                )}
              >
                <Zap className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.div>
            )}

            {/* Dynamic position indicator */}
            {dynamicPosition && (
              <motion.div
                className="absolute -top-4 left-1/2 -translate-x-1/2"
                animate={{
                  y: [0, -2, 0],
                  transition: {
                    duration: 1,
                    repeat: Infinity,
                  },
                }}
              >
                <div className="w-1 h-1 rounded-full bg-blue-400" />
              </motion.div>
            )}
          </motion.div>

          {/* Tooltip with state information */}
          {isHovered && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={cn(
                  'absolute',
                  'px-3 py-1.5',
                  'bg-gray-900',
                  'text-white',
                  'text-xs',
                  'rounded-md',
                  'whitespace-nowrap',
                  'pointer-events-none',
                  'z-50',
                  'max-w-48',
                  position === Position.Top && 'top-full mt-2',
                  position === Position.Bottom && 'bottom-full mb-2',
                  position === Position.Left && 'left-full ml-2',
                  position === Position.Right && 'right-full mr-2',
                  'left-1/2 -translate-x-1/2'
                )}
              >
                <div className="font-semibold capitalize">{currentState}</div>
                {validationMessage && (
                  <div className="text-xs opacity-80 mt-0.5">
                    {validationMessage}
                  </div>
                )}
                {requiresApproval && (
                  <div className="text-xs opacity-80 mt-0.5">
                    Requires approval
                  </div>
                )}
                {dependencies.length > 0 && currentState === 'locked' && (
                  <div className="text-xs opacity-80 mt-0.5">
                    Missing {dependencies.length} dependencies
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Handle>
      )}
    </AnimatePresence>
  );
};

/**
 * Preset: Approved Handle (requires approval)
 */
export const ApprovedHandle = (props) => (
  <ConditionalHandle {...props} requiresApproval={true} state="active" />
);

/**
 * Preset: Locked Handle
 */
export const LockedHandle = (props) => (
  <ConditionalHandle {...props} state="locked" isConnectable={false} />
);

/**
 * Preset: Error Handle
 */
export const ErrorHandle = (props) => (
  <ConditionalHandle {...props} state="error" isConnectable={false} />
);

/**
 * Preset: Pending Handle
 */
export const PendingHandle = (props) => (
  <ConditionalHandle {...props} state="pending" />
);

/**
 * Preset: Dependency Handle
 */
export const DependencyHandle = ({ dependencies = [], ...props }) => (
  <ConditionalHandle
    {...props}
    dependencies={dependencies}
    state={dependencies.length > 0 ? 'locked' : 'active'}
  />
);

/**
 * Preset: Conditional Visibility Handle
 */
export const ConditionalVisibilityHandle = ({ condition, ...props }) => (
  <ConditionalHandle
    {...props}
    condition={condition || ((data) => data.showHandle !== false)}
  />
);

export default ConditionalHandle;
