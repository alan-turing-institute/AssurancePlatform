/**
 * Enhanced Custom Handle Component
 *
 * React Flow handle styled as a decorative + button, inspired by FloraFauna.ai.
 * Features include connection state indicators, validation feedback, drag preview,
 * connection count badges, pulse animations, and tooltips.
 *
 * @component
 * @example
 * <CustomHandle
 *   type="source"
 *   position={Position.Bottom}
 *   nodeId="node-1"
 *   isConnected={false}
 *   connectionCount={2}
 *   maxConnections={5}
 *   onConnect={handleConnect}
 *   validation={{ valid: true }}
 * />
 */

import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Plus, Check, X, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../lib/utils';
import {
  handleStyleConfig,
  handleDecoratorVariants,
} from '../utils/themeConfig';
import {
  getPositionClasses,
  getHandleColors,
  getHandleSizeClasses,
  getHandleShapeClasses,
  isHandleConnected,
  getConnectionCount,
  getConnectionPercentage,
} from './handleUtils';

/**
 * Enhanced CustomHandle component with advanced features
 * @param {object} props - Component props
 * @param {string} props.type - Handle type ('source' or 'target')
 * @param {string} props.position - Handle position (Position.Top, Position.Bottom, etc.)
 * @param {string} props.nodeId - Node identifier
 * @param {string} props.id - Handle identifier (optional)
 * @param {boolean} props.isConnectable - Whether handle is connectable
 * @param {boolean} props.isConnected - Connection state indicator
 * @param {number} props.connectionCount - Number of connections (optional)
 * @param {number} props.maxConnections - Maximum allowed connections (optional)
 * @param {object} props.validation - Validation state {valid: boolean, message: string}
 * @param {boolean} props.showBadge - Show connection count badge
 * @param {boolean} props.showPulse - Enable pulse animation when disconnected
 * @param {boolean} props.showTooltip - Show tooltip on hover
 * @param {string} props.tooltipText - Custom tooltip text
 * @param {string} props.size - Size variant ('small', 'medium', 'large')
 * @param {string} props.shape - Shape variant ('circle', 'square', 'diamond')
 * @param {string} props.variant - Visual variant ('default', 'gradient')
 * @param {string} props.className - Additional CSS classes
 * @param {function} props.onConnect - Connection callback
 * @param {function} props.onHandleClick - Click callback (nodeId, handleId, position, nodeData)
 * @param {object} props.nodeData - Parent node data for validation
 * @returns {React.Element} CustomHandle component
 */
const CustomHandle = ({
  type,
  position,
  nodeId,
  id,
  isConnectable = true,
  isConnected = false,
  connectionCount = 0,
  maxConnections = Infinity,
  validation = null,
  showBadge = false,
  showPulse = true,
  showTooltip = true,
  tooltipText = '',
  size = 'medium',
  shape = 'circle',
  variant = 'default',
  className = '',
  onConnect,
  onHandleClick,
  nodeData,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltipState, setShowTooltipState] = useState(false);
  const [clickStartTime, setClickStartTime] = useState(null);
  const [clickStartPosition, setClickStartPosition] = useState(null);
  const reactFlowInstance = useReactFlow();

  // Auto-detect connection state from React Flow if not explicitly provided
  useEffect(() => {
    if (reactFlowInstance && nodeId) {
      const edges = reactFlowInstance.getEdges();
      const connected = isHandleConnected(nodeId, id, edges, type);
      if (connected !== isConnected) {
        // Connection state has changed
      }
    }
  }, [reactFlowInstance, nodeId, id, type, isConnected]);

  // Clean up dragging state on global mouseup (in case drag ends outside handle)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Calculate derived states
  const actualConnectionCount = connectionCount || 0;
  const isAtLimit = actualConnectionCount >= maxConnections;
  const hasValidation = validation !== null;
  const isValid = validation?.valid;
  const shouldPulse = showPulse && !isConnected && isConnectable && !isAtLimit;
  const shouldShowBadge = showBadge && actualConnectionCount > 0;
  const percentage = getConnectionPercentage(actualConnectionCount, maxConnections);

  // Get dynamic styling
  const positionClass = getPositionClasses(position);
  const colors = getHandleColors(isConnected, isValid, isHovered);
  const sizeClasses = getHandleSizeClasses(size);
  const shapeClass = getHandleShapeClasses(shape);

  // Generate tooltip text
  const getTooltipText = () => {
    if (tooltipText) return tooltipText;

    if (isAtLimit) return `Maximum connections reached (${maxConnections})`;
    if (isConnected) return 'Connected - click to disconnect';
    if (hasValidation && !isValid) return validation.message || 'Invalid connection';
    if (hasValidation && isValid) return validation.message || 'Valid connection';

    return type === 'source' ? 'Click to create connection' : 'Connect here';
  };

  // Determine icon based on state
  const getIcon = () => {
    if (isConnected) return Minus;
    if (hasValidation && isValid === false) return X;
    if (hasValidation && isValid === true) return Check;
    return Plus;
  };

  const Icon = getIcon();

  // Animation variant based on state
  const getAnimationVariant = () => {
    if (!isConnectable || isAtLimit) return 'connected';
    if (isDragging) return 'hover';
    if (shouldPulse) return 'pulse';
    if (isHovered) return 'hover';
    return 'visible';
  };

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      isConnectable={isConnectable && !isAtLimit}
      {...props}
      className={cn(
        // Reset default handle styles
        '!bg-transparent',
        '!border-0',
        sizeClasses.outer,

        // Layout
        'flex',
        'items-center',
        'justify-center',

        // Positioning
        positionClass,

        // Interaction
        'group/handle',
        'cursor-pointer',
        'z-10',

        // Disabled state
        (!isConnectable || isAtLimit) && 'cursor-not-allowed opacity-50',

        // Custom classes
        className
      )}
      onMouseEnter={() => {
        setIsHovered(true);
        setShowTooltipState(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowTooltipState(false);
        setIsDragging(false); // Clean up dragging state
        setClickStartTime(null);
        setClickStartPosition(null);
      }}
      onMouseDown={(e) => {
        setIsDragging(true);
        setClickStartTime(Date.now());
        setClickStartPosition({ x: e.clientX, y: e.clientY });
      }}
      onMouseUp={(e) => {
        setIsDragging(false);

        // Detect if this was a click vs drag
        if (clickStartTime && clickStartPosition) {
          const timeDiff = Date.now() - clickStartTime;
          const distanceX = Math.abs(e.clientX - clickStartPosition.x);
          const distanceY = Math.abs(e.clientY - clickStartPosition.y);
          const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

          // Click if < 200ms and < 5px movement
          const isClick = timeDiff < 200 && distance < 5;

          if (isClick && onHandleClick && isConnectable && !isAtLimit) {
            // Get flow position for node creation
            const flowPosition = reactFlowInstance?.screenToFlowPosition({
              x: e.clientX,
              y: e.clientY,
            }) || { x: e.clientX, y: e.clientY };

            onHandleClick(nodeId, id, flowPosition, nodeData);
          }
        }

        setClickStartTime(null);
        setClickStartPosition(null);
      }}
    >
      {/* Visual Decorator (now clickable for better UX) */}
      <AnimatePresence>
        {isConnectable && (
          <motion.div
            className="relative"
            initial="visible"
            animate={getAnimationVariant()}
            exit="hidden"
            variants={handleDecoratorVariants}
          >
            {/* Main handle button */}
            <div
              className={cn(
                // Size
                sizeClasses.inner,

                // Shape
                shapeClass,

                // Colors - dynamic based on state
                colors.bg,
                'border',
                colors.border,

                // Layout
                'flex',
                'items-center',
                'justify-center',

                // Shadow
                'shadow-md',

                // Transitions
                'transition-all',
                'duration-300',

                // Hover states
                isHovered && 'shadow-lg',

                // Validation states
                hasValidation && isValid === false && 'ring-2 ring-red-500/50',
                hasValidation && isValid === true && 'ring-2 ring-green-500/50'
              )}
            >
              <Icon
                className={cn(
                  sizeClasses.icon,
                  colors.icon,
                  'transition-transform',
                  'duration-200',
                  isHovered && 'scale-110'
                )}
                strokeWidth={2.5}
              />
            </div>

            {/* Connection count badge */}
            {shouldShowBadge && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className={cn(
                  'absolute',
                  '-top-1 -right-1',
                  'w-5 h-5',
                  'rounded-full',
                  'bg-blue-500',
                  'border-2 border-white',
                  'flex items-center justify-center',
                  'text-white text-xs font-semibold',
                  'shadow-sm'
                )}
              >
                {actualConnectionCount}
              </motion.div>
            )}

            {/* Connection limit indicator */}
            {maxConnections !== Infinity && (
              <div
                className={cn(
                  'absolute -bottom-1 left-1/2 -translate-x-1/2',
                  'w-full h-1',
                  'bg-gray-200 rounded-full overflow-hidden'
                )}
              >
                <motion.div
                  className={cn(
                    'h-full',
                    percentage >= 100 ? 'bg-red-500' :
                    percentage >= 75 ? 'bg-orange-500' : 'bg-blue-500'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}

            {/* Pulse ring for available connections */}
            {shouldPulse && (
              <motion.div
                className={cn(
                  'absolute inset-0 rounded-full border-2',
                  isValid === true ? 'border-green-400' :
                  isValid === false ? 'border-red-400' : 'border-blue-400'
                )}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Drag preview indicator */}
            {isDragging && (
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.2 }}
                className={cn(
                  'absolute inset-0 rounded-full',
                  'border-2 border-blue-500',
                  'bg-blue-500/20'
                )}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip */}
      {showTooltip && showTooltipState && isConnectable && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
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
              // Position tooltip opposite to handle position
              position === Position.Top && 'top-full mt-2',
              position === Position.Bottom && 'bottom-full mb-2',
              position === Position.Left && 'left-full ml-2',
              position === Position.Right && 'right-full mr-2',
              'left-1/2 -translate-x-1/2'
            )}
          >
            {getTooltipText()}
            {/* Arrow */}
            <div
              className={cn(
                'absolute left-1/2 -translate-x-1/2',
                position === Position.Top && 'top-0 -mt-1',
                position === Position.Bottom && 'bottom-0 -mb-1 rotate-180',
                position === Position.Left && 'left-0 -ml-1 -rotate-90',
                position === Position.Right && 'right-0 -mr-1 rotate-90'
              )}
            >
              <div className="border-4 border-transparent border-t-gray-900" />
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </Handle>
  );
};

/**
 * CustomHandle with connection indicator
 * Shows different visual state when connected
 */
export const CustomHandleWithIndicator = ({
  isConnected = false,
  ...props
}) => {
  return (
    <CustomHandle
      {...props}
      isConnected={isConnected}
      showBadge={isConnected}
    />
  );
};

/**
 * Pulsing Handle - Continuously pulses to draw attention
 */
export const PulsingHandle = ({
  ...props
}) => {
  return (
    <CustomHandle
      {...props}
      showPulse={true}
    />
  );
};

/**
 * Handle with tooltip
 */
export const CustomHandleWithTooltip = ({
  tooltip = 'Click to connect',
  ...props
}) => {
  return (
    <CustomHandle
      {...props}
      showTooltip={true}
      tooltipText={tooltip}
    />
  );
};

export default CustomHandle;
