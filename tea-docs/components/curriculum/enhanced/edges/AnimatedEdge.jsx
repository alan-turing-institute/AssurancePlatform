/**
 * AnimatedEdge Component
 *
 * Smooth animated edge with hover states, thickness changes, ripple effects,
 * dash array animations, color transitions, and animated arrows.
 *
 * Features:
 * - Smooth path animations on creation
 * - Hover state with thickness change
 * - Click interactions with ripple effect
 * - Dash array animations for flow indication
 * - Color transitions based on state
 * - Animated arrow markers
 *
 * @module AnimatedEdge
 */

import React, { useState, useCallback, useMemo } from 'react';
import { EdgeLabelRenderer, getBezierPath, BaseEdge } from 'reactflow';
import { motion } from 'framer-motion';
import {
  getStrokeWidth,
  getStateColor,
  createArrowMarker,
  generateGradientId,
  animationPresets,
} from './edgeUtils';

/**
 * AnimatedEdge Component
 *
 * @param {Object} props - Component props
 * @param {string} props.id - Edge ID
 * @param {string} props.source - Source node ID
 * @param {string} props.target - Target node ID
 * @param {number} props.sourceX - Source X position
 * @param {number} props.sourceY - Source Y position
 * @param {number} props.targetX - Target X position
 * @param {number} props.targetY - Target Y position
 * @param {string} props.sourcePosition - Source handle position
 * @param {string} props.targetPosition - Target handle position
 * @param {Object} props.data - Edge data
 * @param {boolean} props.selected - Whether edge is selected
 * @param {Object} props.style - Additional styles
 * @param {string} props.markerEnd - Marker end configuration
 */
const AnimatedEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data = {},
  selected = false,
  style = {},
  markerEnd,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);

  // Calculate bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine edge state and color
  const edgeState = data.state || 'default';
  const baseColor = data.color || getStateColor(edgeState);
  const strokeWidth = getStrokeWidth(isHovered, selected, data.strokeWidth || 2);

  // Animation configuration
  const animated = data.animated !== false;
  const animationSpeed = data.animationSpeed || 1;

  // Handle click with ripple effect
  const handleClick = useCallback((event) => {
    event.stopPropagation();
    setRippleKey(prev => prev + 1);

    if (data.onClick) {
      data.onClick(event, { id, source, target });
    }
  }, [id, source, target, data]);

  // Handle double click
  const handleDoubleClick = useCallback((event) => {
    event.stopPropagation();

    if (data.onDoubleClick) {
      data.onDoubleClick(event, { id, source, target });
    }
  }, [id, source, target, data]);

  // Context menu handler
  const handleContextMenu = useCallback((event) => {
    event.preventDefault();

    if (data.onContextMenu) {
      data.onContextMenu(event, { id, source, target });
    }
  }, [id, source, target, data]);

  // Marker ID for arrow
  const markerId = `arrow-${id}`;

  // Animation variants
  const pathVariants = {
    initial: {
      pathLength: 0,
      opacity: 0,
    },
    animate: {
      pathLength: 1,
      opacity: 1,
      transition: {
        duration: data.enterDuration || 1,
        ease: 'easeInOut',
      },
    },
    hover: {
      filter: 'drop-shadow(0 0 8px currentColor)',
      transition: {
        duration: 0.2,
      },
    },
  };

  // Dash animation for flowing effect
  const dashAnimation = animated
    ? {
        strokeDasharray: '10 5',
        strokeDashoffset: [0, -15],
        transition: {
          strokeDashoffset: {
            duration: 1 / animationSpeed,
            repeat: Infinity,
            ease: 'linear',
          },
        },
      }
    : {};

  // Label content
  const label = data.label;
  const showLabel = label && (data.showLabel !== false);

  return (
    <>
      <defs>
        {/* Animated arrow marker */}
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <motion.path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={baseColor}
            initial={{ scale: 0.8 }}
            animate={{
              scale: isHovered ? 1.2 : selected ? 1.1 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
        </marker>

        {/* Glow filter for hover effect */}
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main edge path */}
      <motion.path
        id={id}
        d={edgePath}
        stroke={baseColor}
        strokeWidth={strokeWidth}
        fill="none"
        className="react-flow__edge-path"
        style={{
          ...style,
          cursor: 'pointer',
        }}
        initial="initial"
        animate={isHovered ? ['animate', 'hover'] : 'animate'}
        variants={pathVariants}
        {...dashAnimation}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        markerEnd={`url(#${markerId})`}
      />

      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth * 3, 20)}
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Ripple effect on click */}
      {rippleKey > 0 && (
        <motion.circle
          key={rippleKey}
          cx={labelX}
          cy={labelY}
          r={0}
          fill="none"
          stroke={baseColor}
          strokeWidth={2}
          initial={{ r: 0, opacity: 0.8 }}
          animate={{
            r: 50,
            opacity: 0,
          }}
          transition={{
            duration: 0.8,
            ease: 'easeOut',
          }}
        />
      )}

      {/* Edge label */}
      {showLabel && (
        <EdgeLabelRenderer>
          <motion.div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="nodrag nopan"
          >
            <div
              className="px-2 py-1 rounded-md text-xs font-medium"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              {label}
            </div>
          </motion.div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/**
 * AnimatedEdge with custom animation preset
 */
export const FastAnimatedEdge = (props) => (
  <AnimatedEdge
    {...props}
    data={{
      ...props.data,
      enterDuration: 0.5,
      animationSpeed: 2,
    }}
  />
);

/**
 * AnimatedEdge with slow animation
 */
export const SlowAnimatedEdge = (props) => (
  <AnimatedEdge
    {...props}
    data={{
      ...props.data,
      enterDuration: 2,
      animationSpeed: 0.5,
    }}
  />
);

/**
 * AnimatedEdge with pulse effect
 */
export const PulseAnimatedEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || getStateColor(props.data?.state || 'default');

  return (
    <>
      <AnimatedEdge {...props} />
      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={props.data?.strokeWidth || 2}
        fill="none"
        style={{ opacity: 0.5 }}
        animate={{
          strokeWidth: [2, 6, 2],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </>
  );
};

/**
 * AnimatedEdge with glow effect
 */
export const GlowAnimatedEdge = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || getStateColor(props.data?.state || 'default');

  return (
    <>
      <defs>
        <filter id={`strong-glow-${props.id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={props.data?.strokeWidth || 3}
        fill="none"
        filter={isHovered ? `url(#strong-glow-${props.id})` : 'none'}
        animate={{
          filter: isHovered
            ? `drop-shadow(0 0 10px ${baseColor})`
            : 'drop-shadow(0 0 0px transparent)',
        }}
        transition={{ duration: 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      <AnimatedEdge {...props} />
    </>
  );
};

/**
 * AnimatedEdge with thickness animation
 */
export const ThicknessAnimatedEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || getStateColor(props.data?.state || 'default');

  return (
    <>
      <motion.path
        d={edgePath}
        stroke={baseColor}
        fill="none"
        animate={{
          strokeWidth: [2, 4, 2],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </>
  );
};

export default AnimatedEdge;
