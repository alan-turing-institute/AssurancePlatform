/**
 * Multi Handle Component
 *
 * Handle that supports multiple connections with fan-out layout, connection limit
 * indicators, grouped connection management, and visual stacking of connections.
 *
 * @component
 * @example
 * <MultiHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   maxConnections={5}
 *   fanOutLayout={true}
 *   showConnectionStack={true}
 * />
 */

import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Plus, Minus, Layers2, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import {
  getPositionClasses,
  getConnectionCount,
  getConnectedEdges,
  getConnectionPercentage,
  getHandleSizeClasses,
} from './handleUtils';

/**
 * MultiHandle component for multiple connections
 * @param {object} props - Component props
 * @param {string} props.type - Handle type ('source' or 'target')
 * @param {string} props.position - Handle position
 * @param {string} props.nodeId - Node identifier
 * @param {string} props.id - Handle identifier
 * @param {boolean} props.isConnectable - Whether handle is connectable
 * @param {number} props.maxConnections - Maximum allowed connections
 * @param {boolean} props.fanOutLayout - Enable fan-out layout for multiple edges
 * @param {boolean} props.showConnectionStack - Show visual stacking of connections
 * @param {boolean} props.showConnectionList - Show list of connected nodes
 * @param {boolean} props.groupConnections - Enable grouped connection management
 * @param {string} props.stackDirection - Stack direction ('horizontal', 'vertical', 'radial')
 * @param {string} props.className - Additional CSS classes
 * @returns {React.Element} MultiHandle component
 */
const MultiHandle = ({
  type,
  position,
  nodeId,
  id,
  isConnectable = true,
  maxConnections = 5,
  fanOutLayout = true,
  showConnectionStack = true,
  showConnectionList = false,
  groupConnections = false,
  stackDirection = 'radial',
  className = '',
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [connections, setConnections] = useState([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const reactFlowInstance = useReactFlow();

  // Update connection information
  useEffect(() => {
    if (reactFlowInstance && nodeId) {
      const edges = reactFlowInstance.getEdges();
      const connectedEdges = getConnectedEdges(nodeId, id, edges, type);
      const count = getConnectionCount(nodeId, edges, type);

      setConnections(connectedEdges);
      setConnectionCount(count);
    }
  }, [reactFlowInstance, nodeId, id, type]);

  // Calculate derived values
  const isAtLimit = connectionCount >= maxConnections;
  const hasConnections = connectionCount > 0;
  const percentage = getConnectionPercentage(connectionCount, maxConnections);

  // Get styling
  const positionClass = getPositionClasses(position);
  const sizeClasses = getHandleSizeClasses('medium');

  // Calculate stack positions
  const getStackPositions = () => {
    if (!showConnectionStack || connectionCount === 0) return [];

    const positions = [];
    const maxVisible = Math.min(connectionCount, 3);

    if (stackDirection === 'horizontal') {
      for (let i = 0; i < maxVisible; i++) {
        positions.push({ x: i * 4, y: 0, z: i });
      }
    } else if (stackDirection === 'vertical') {
      for (let i = 0; i < maxVisible; i++) {
        positions.push({ x: 0, y: i * 4, z: i });
      }
    } else {
      // Radial
      for (let i = 0; i < maxVisible; i++) {
        const angle = (i * 360) / maxVisible;
        const rad = (angle * Math.PI) / 180;
        positions.push({
          x: Math.cos(rad) * 8,
          y: Math.sin(rad) * 8,
          z: i,
        });
      }
    }

    return positions;
  };

  const stackPositions = getStackPositions();

  // Get connected node names
  const getConnectedNodeNames = () => {
    if (!reactFlowInstance) return [];

    const nodes = reactFlowInstance.getNodes();
    return connections
      .map((edge) => {
        const connectedNodeId = type === 'source' ? edge.target : edge.source;
        const node = nodes.find((n) => n.id === connectedNodeId);
        return node?.data?.name || node?.data?.label || connectedNodeId;
      })
      .slice(0, 5); // Show max 5 in tooltip
  };

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      isConnectable={isConnectable && !isAtLimit}
      {...props}
      className={cn(
        '!bg-transparent',
        '!border-0',
        sizeClasses.outer,
        'flex items-center justify-center',
        positionClass,
        'group/handle',
        'cursor-pointer',
        'z-10',
        isAtLimit && 'cursor-not-allowed',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (hasConnections) {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      {/* Main handle with connection stack */}
      <motion.div
        className="pointer-events-none relative"
        whileHover={{ scale: 1.05 }}
      >
        {/* Connection stack visualization */}
        {showConnectionStack && stackPositions.length > 0 && (
          <div className="absolute inset-0">
            {stackPositions.map((pos, index) => (
              <motion.div
                key={index}
                className={cn(
                  sizeClasses.inner,
                  'rounded-full',
                  'bg-blue-100',
                  'border border-blue-300',
                  'absolute top-1/2 left-1/2'
                )}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: 0.3 + index * 0.2,
                  scale: 1,
                  x: pos.x - 16,
                  y: pos.y - 16,
                }}
                style={{ zIndex: pos.z }}
                transition={{
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 300,
                }}
              />
            ))}
          </div>
        )}

        {/* Primary handle button */}
        <motion.div
          className={cn(
            sizeClasses.inner,
            'rounded-full',
            hasConnections ? 'bg-blue-500' : 'bg-white',
            'border-2',
            hasConnections ? 'border-blue-400' : 'border-gray-300',
            'flex items-center justify-center',
            'shadow-md',
            'transition-all duration-300',
            'relative z-10',
            isHovered && 'shadow-lg',
            isAtLimit && 'opacity-50'
          )}
          animate={
            hasConnections && !isAtLimit
              ? {
                  scale: [1, 1.05, 1],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
              : {}
          }
        >
          {/* Dynamic icon based on state */}
          {hasConnections ? (
            groupConnections ? (
              <Layers2
                className={cn(sizeClasses.icon, 'text-white')}
                strokeWidth={2.5}
              />
            ) : (
              <Network
                className={cn(sizeClasses.icon, 'text-white')}
                strokeWidth={2.5}
              />
            )
          ) : (
            <Plus
              className={cn(
                sizeClasses.icon,
                'text-gray-700',
                'transition-transform',
                isHovered && 'scale-110'
              )}
              strokeWidth={2.5}
            />
          )}
        </motion.div>

        {/* Connection count badge */}
        {hasConnections && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'absolute -top-1 -right-1 z-20',
              'min-w-5 h-5 px-1',
              'rounded-full',
              'bg-blue-500',
              'border-2 border-white',
              'flex items-center justify-center',
              'text-white text-xs font-bold',
              'shadow-md'
            )}
          >
            {connectionCount}
          </motion.div>
        )}

        {/* Connection limit indicator bar */}
        <div
          className={cn(
            'absolute -bottom-2 left-1/2 -translate-x-1/2',
            'w-full h-1.5',
            'bg-gray-200 rounded-full overflow-hidden'
          )}
        >
          <motion.div
            className={cn(
              'h-full rounded-full',
              percentage >= 100
                ? 'bg-red-500'
                : percentage >= 75
                ? 'bg-orange-500'
                : percentage >= 50
                ? 'bg-yellow-500'
                : 'bg-blue-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Limit reached indicator */}
        {isAtLimit && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'absolute -bottom-1 -left-1 z-20',
              'w-4 h-4',
              'rounded-full',
              'bg-red-500',
              'border border-white',
              'flex items-center justify-center'
            )}
          >
            <Minus className="w-3 h-3 text-white" strokeWidth={3} />
          </motion.div>
        )}

        {/* Fan-out indicator */}
        {fanOutLayout && hasConnections && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {[...Array(Math.min(connectionCount, 5))].map((_, i) => {
              const angle = -60 + (i * 120) / (connectionCount - 1);
              const rad = (angle * Math.PI) / 180;
              const length = 20;

              return (
                <motion.div
                  key={i}
                  className="absolute w-0.5 h-4 bg-blue-400 origin-bottom"
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.05 }}
                />
              );
            })}
          </motion.div>
        )}

        {/* Available connections pulse */}
        {!isAtLimit && hasConnections && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-blue-400"
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
      </motion.div>

      {/* Expanded connection list */}
      <AnimatePresence>
        {isExpanded && showConnectionList && hasConnections && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className={cn(
              'absolute',
              'min-w-48 max-w-64',
              'bg-white',
              'border border-gray-300',
              'rounded-lg',
              'shadow-xl',
              'p-2',
              'pointer-events-auto',
              'z-50',
              position === Position.Top && 'top-full mt-2',
              position === Position.Bottom && 'bottom-full mb-2',
              position === Position.Left && 'left-full ml-2',
              position === Position.Right && 'right-full mr-2'
            )}
          >
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Connected Nodes ({connectionCount})
            </div>
            <div className="space-y-1">
              {getConnectedNodeNames().map((name, index) => (
                <div
                  key={index}
                  className="text-xs text-gray-600 py-1 px-2 bg-gray-50 rounded"
                >
                  {name}
                </div>
              ))}
              {connectionCount > 5 && (
                <div className="text-xs text-gray-400 italic">
                  +{connectionCount - 5} more
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      {isHovered && !isExpanded && (
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
              position === Position.Top && 'top-full mt-2',
              position === Position.Bottom && 'bottom-full mb-2',
              position === Position.Left && 'left-full ml-2',
              position === Position.Right && 'right-full mr-2',
              'left-1/2 -translate-x-1/2'
            )}
          >
            {isAtLimit
              ? `Maximum connections (${maxConnections}) reached`
              : hasConnections
              ? `${connectionCount}/${maxConnections} connections${
                  showConnectionList ? ' - click to expand' : ''
                }`
              : `Add connection (max ${maxConnections})`}
          </motion.div>
        </AnimatePresence>
      )}
    </Handle>
  );
};

/**
 * Preset: Fan-out Multi Handle
 */
export const FanOutHandle = (props) => (
  <MultiHandle {...props} fanOutLayout={true} maxConnections={5} />
);

/**
 * Preset: Stacked Multi Handle
 */
export const StackedHandle = (props) => (
  <MultiHandle
    {...props}
    showConnectionStack={true}
    stackDirection="radial"
    maxConnections={5}
  />
);

/**
 * Preset: Grouped Multi Handle
 */
export const GroupedHandle = (props) => (
  <MultiHandle
    {...props}
    groupConnections={true}
    showConnectionList={true}
    maxConnections={10}
  />
);

/**
 * Preset: Limited Multi Handle (3 connections max)
 */
export const LimitedMultiHandle = (props) => (
  <MultiHandle
    {...props}
    maxConnections={3}
    showConnectionStack={true}
    fanOutLayout={true}
  />
);

export default MultiHandle;
