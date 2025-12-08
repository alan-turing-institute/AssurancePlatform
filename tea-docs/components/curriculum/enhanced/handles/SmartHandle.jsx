/**
 * Smart Handle Component
 *
 * Intelligent handle that auto-hides, shows only on node hover, avoids overlaps,
 * displays connection type indicators (AND/OR), and provides visual feedback
 * for compatible connections.
 *
 * @component
 * @example
 * <SmartHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   autoHide={true}
 *   connectionType="AND"
 *   compatibleTypes={['strategy', 'evidence']}
 * />
 */

import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow, useStore } from 'reactflow';
import { Plus, GitMerge, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import {
  getPositionClasses,
  areNodeTypesCompatible,
  adjustHandlePosition,
  getHandleSizeClasses,
} from './handleUtils';

/**
 * SmartHandle component with intelligent behavior
 * @param {object} props - Component props
 * @param {string} props.type - Handle type ('source' or 'target')
 * @param {string} props.position - Handle position
 * @param {string} props.nodeId - Node identifier
 * @param {string} props.id - Handle identifier
 * @param {boolean} props.isConnectable - Whether handle is connectable
 * @param {boolean} props.autoHide - Auto-hide when not needed
 * @param {boolean} props.showOnNodeHover - Show only when node is hovered
 * @param {string} props.connectionType - Connection logic type ('AND', 'OR', 'single')
 * @param {Array<string>} props.compatibleTypes - List of compatible node types
 * @param {boolean} props.smartPositioning - Enable intelligent positioning to avoid overlaps
 * @param {string} props.nodeType - Current node type for compatibility checking
 * @param {boolean} props.showCompatibilityIndicator - Show visual indicator for compatible connections
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} SmartHandle component
 */
const SmartHandle = ({
  type,
  position,
  nodeId,
  id,
  isConnectable = true,
  autoHide = false,
  showOnNodeHover = true,
  connectionType = 'single',
  compatibleTypes = [],
  smartPositioning = false,
  nodeType = 'default',
  showCompatibilityIndicator = true,
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(!autoHide && !showOnNodeHover);
  const [isHovered, setIsHovered] = useState(false);
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [targetNodeType, setTargetNodeType] = useState(null);
  const [isCompatible, setIsCompatible] = useState(null);
  const handleRef = useRef(null);
  const reactFlowInstance = useReactFlow();

  // Detect if connection drag is active
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const connectionHandleType = useStore((state) => state.connectionHandleType);

  useEffect(() => {
    setIsDragActive(connectionNodeId !== null);
  }, [connectionNodeId]);

  // Show handle when node is hovered
  useEffect(() => {
    if (showOnNodeHover) {
      setIsVisible(isNodeHovered || isDragActive);
    } else if (autoHide) {
      setIsVisible(isDragActive || isHovered);
    } else {
      setIsVisible(true);
    }
  }, [isNodeHovered, isDragActive, isHovered, showOnNodeHover, autoHide]);

  // Check compatibility when dragging
  useEffect(() => {
    if (isDragActive && connectionNodeId && reactFlowInstance) {
      const nodes = reactFlowInstance.getNodes();
      const sourceNode = nodes.find((n) => n.id === connectionNodeId);
      const targetNode = nodes.find((n) => n.id === nodeId);

      if (sourceNode && targetNode) {
        const sourceType = sourceNode.type || sourceNode.data?.type || 'default';
        const targetType = targetNode.type || targetNode.data?.type || 'default';

        setTargetNodeType(targetType);

        // Check compatibility
        if (connectionHandleType === 'source' && type === 'target') {
          const compatible = areNodeTypesCompatible(sourceType, targetType);
          setIsCompatible(compatible);
        } else if (connectionHandleType === 'target' && type === 'source') {
          const compatible = areNodeTypesCompatible(targetType, sourceType);
          setIsCompatible(compatible);
        }
      }
    } else {
      setIsCompatible(null);
      setTargetNodeType(null);
    }
  }, [
    isDragActive,
    connectionNodeId,
    connectionHandleType,
    nodeId,
    type,
    reactFlowInstance,
  ]);

  // Get styling
  const positionClass = getPositionClasses(position);
  const sizeClasses = getHandleSizeClasses('medium');

  // Connection type icon
  const getConnectionTypeIcon = () => {
    switch (connectionType) {
      case 'AND':
        return GitMerge;
      case 'OR':
        return Layers;
      default:
        return Plus;
    }
  };

  const ConnectionIcon = getConnectionTypeIcon();

  // Get colors based on compatibility
  const getColors = () => {
    if (isCompatible === false) {
      return {
        bg: 'bg-red-500',
        border: 'border-red-400',
        icon: 'text-white',
        glow: 'shadow-red-500/50',
      };
    }

    if (isCompatible === true) {
      return {
        bg: 'bg-green-500',
        border: 'border-green-400',
        icon: 'text-white',
        glow: 'shadow-green-500/50',
      };
    }

    return {
      bg: 'bg-white',
      border: 'border-gray-300',
      icon: 'text-gray-700',
      glow: 'shadow-gray-500/50',
    };
  };

  const colors = getColors();

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      isConnectable={isConnectable && isCompatible !== false}
      {...props}
      ref={handleRef}
      className={cn(
        '!bg-transparent',
        '!border-0',
        sizeClasses.outer,
        'flex items-center justify-center',
        positionClass,
        'group/handle',
        'cursor-pointer',
        'z-10',
        className
      )}
      onMouseEnter={() => {
        setIsHovered(true);
        setIsNodeHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setTimeout(() => setIsNodeHovered(false), 100);
      }}
    >
      {/* Animated handle decorator */}
      <AnimatePresence>
        {isVisible && isConnectable && (
          <motion.div
            className="pointer-events-none relative"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
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
                colors.bg,
                'border-2',
                colors.border,
                'flex items-center justify-center',
                'shadow-md',
                colors.glow,
                'transition-all duration-300'
              )}
              whileHover={{ scale: 1.1 }}
              animate={
                isDragActive && isCompatible === true
                  ? {
                      scale: [1, 1.15, 1],
                      transition: {
                        duration: 1,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
                  : {}
              }
            >
              {/* Dynamic icon based on state */}
              {showCompatibilityIndicator && isCompatible === true ? (
                <CheckCircle2
                  className={cn(sizeClasses.icon, colors.icon)}
                  strokeWidth={2.5}
                />
              ) : showCompatibilityIndicator && isCompatible === false ? (
                <AlertCircle
                  className={cn(sizeClasses.icon, colors.icon)}
                  strokeWidth={2.5}
                />
              ) : (
                <ConnectionIcon
                  className={cn(
                    sizeClasses.icon,
                    colors.icon,
                    'transition-transform duration-200',
                    isHovered && 'scale-110'
                  )}
                  strokeWidth={2.5}
                />
              )}
            </motion.div>

            {/* Connection type badge */}
            {connectionType !== 'single' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  'absolute -top-1 -right-1',
                  'px-1.5 py-0.5',
                  'rounded-full',
                  'bg-purple-500',
                  'text-white',
                  'text-[10px]',
                  'font-bold',
                  'shadow-sm'
                )}
              >
                {connectionType}
              </motion.div>
            )}

            {/* Compatibility ring when dragging */}
            {isDragActive && isCompatible !== null && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full border-2',
                  isCompatible ? 'border-green-400' : 'border-red-400'
                )}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.7, 0.3, 0.7],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Pulse indicator for compatible connections */}
            {isDragActive && isCompatible === true && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-green-400"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-green-400"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: 0.5,
                  }}
                />
              </>
            )}

            {/* Smart positioning indicator */}
            {smartPositioning && (
              <div
                className={cn(
                  'absolute -bottom-3 left-1/2 -translate-x-1/2',
                  'w-1 h-1 rounded-full bg-blue-500'
                )}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip showing compatible types */}
      {isHovered && compatibleTypes.length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={cn(
              'absolute',
              'px-2 py-1',
              'bg-gray-900',
              'text-white',
              'text-xs',
              'rounded',
              'whitespace-nowrap',
              'pointer-events-none',
              'z-50',
              position === Position.Top && 'top-full mt-2',
              position === Position.Bottom && 'bottom-full mb-2',
              position === Position.Left && 'left-full ml-2',
              position === Position.Right && 'right-full mr-2',
              'left-1/2 -translate-x-1/2'
            )}
          >
            {isCompatible === false
              ? 'Incompatible connection'
              : isCompatible === true
              ? 'Compatible - drop to connect'
              : `Connects to: ${compatibleTypes.join(', ')}`}
          </motion.div>
        </AnimatePresence>
      )}
    </Handle>
  );
};

/**
 * Preset: Auto-hide Handle
 */
export const AutoHideHandle = (props) => (
  <SmartHandle {...props} autoHide={true} showOnNodeHover={false} />
);

/**
 * Preset: Hover-show Handle
 */
export const HoverShowHandle = (props) => (
  <SmartHandle {...props} autoHide={false} showOnNodeHover={true} />
);

/**
 * Preset: AND Gate Handle
 */
export const AndGateHandle = (props) => (
  <SmartHandle {...props} connectionType="AND" />
);

/**
 * Preset: OR Gate Handle
 */
export const OrGateHandle = (props) => (
  <SmartHandle {...props} connectionType="OR" />
);

/**
 * Preset: Smart Positioning Handle
 */
export const SmartPositionHandle = (props) => (
  <SmartHandle {...props} smartPositioning={true} />
);

export default SmartHandle;
