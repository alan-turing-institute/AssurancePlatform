/**
 * GradientEdge Component
 *
 * Edge with dynamic gradients from source to target node colors.
 * Supports gradient direction, opacity variations, animated gradient positions,
 * and multiple gradient stops.
 *
 * Features:
 * - Dynamic gradient from source to target node colors
 * - Gradient direction based on flow direction
 * - Opacity variations based on importance
 * - Animated gradient positions
 * - Multiple gradient stops support
 * - Custom color interpolation
 *
 * @module GradientEdge
 */

import React, { useState, useMemo } from 'react';
import { EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { motion } from 'framer-motion';
import {
  generateGradientId,
  createGradientStops,
  interpolateGradient,
  getStrokeWidth,
} from './edgeUtils';

/**
 * GradientEdge Component
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
 */
const GradientEdge = ({
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
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate bezier path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Gradient configuration
  const sourceColor = data.sourceColor || '#3b82f6'; // blue-500
  const targetColor = data.targetColor || '#8b5cf6'; // purple-500
  const gradientId = generateGradientId(id);

  // Calculate gradient angle based on edge direction
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
  const angleDeg = (angle * 180) / Math.PI;

  // Gradient stops
  const stopCount = data.gradientStops || 3;
  const gradientColors = useMemo(
    () => interpolateGradient(sourceColor, targetColor, stopCount),
    [sourceColor, targetColor, stopCount]
  );

  // Stroke width
  const strokeWidth = getStrokeWidth(isHovered, selected, data.strokeWidth || 3);

  // Opacity configuration
  const baseOpacity = data.opacity || 0.8;
  const opacityVariation = data.opacityVariation || 0.2;

  // Animated gradient offset
  const animateGradient = data.animateGradient !== false;

  // Label
  const label = data.label;
  const showLabel = label && (data.showLabel !== false);

  return (
    <>
      <defs>
        {/* Linear gradient definition */}
        <linearGradient
          id={gradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
          gradientTransform={`rotate(${angleDeg} 0.5 0.5)`}
        >
          {gradientColors.map((color, index) => {
            const offset = (index / (gradientColors.length - 1)) * 100;
            const opacity =
              baseOpacity -
              Math.abs(index - gradientColors.length / 2) *
                (opacityVariation / (gradientColors.length / 2));

            return (
              <motion.stop
                key={index}
                offset={`${offset}%`}
                stopColor={color}
                stopOpacity={opacity}
                animate={
                  animateGradient
                    ? {
                        stopColor: [color, color, color],
                        stopOpacity: [opacity, opacity * 0.7, opacity],
                      }
                    : {}
                }
                transition={
                  animateGradient
                    ? {
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: index * 0.2,
                      }
                    : {}
                }
              />
            );
          })}
        </linearGradient>

        {/* Animated gradient with offset */}
        {animateGradient && (
          <linearGradient
            id={`${gradientId}-animated`}
            x1="0%"
            y1="0%"
            x2="200%"
            y2="0%"
            gradientTransform={`rotate(${angleDeg} 0.5 0.5)`}
          >
            {gradientColors.map((color, index) => {
              const offset = (index / (gradientColors.length - 1)) * 100;
              return (
                <stop key={index} offset={`${offset}%`} stopColor={color} />
              );
            })}
          </linearGradient>
        )}

        {/* Arrow marker with gradient */}
        <marker
          id={`gradient-arrow-${id}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={targetColor} />
        </marker>

        {/* Glow filter */}
        <filter
          id={`gradient-glow-${id}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow (when hovered) */}
      {isHovered && (
        <motion.path
          d={edgePath}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth * 2}
          fill="none"
          opacity={0.3}
          filter={`url(#gradient-glow-${id})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Main gradient path */}
      <motion.path
        id={id}
        d={edgePath}
        stroke={animateGradient ? `url(#${gradientId}-animated)` : `url(#${gradientId})`}
        strokeWidth={strokeWidth}
        fill="none"
        className="react-flow__edge-path"
        style={{
          ...style,
          cursor: 'pointer',
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: 1,
          strokeDashoffset: animateGradient ? [-100, 0] : 0,
        }}
        transition={{
          pathLength: { duration: 1, ease: 'easeInOut' },
          opacity: { duration: 0.5 },
          strokeDashoffset: animateGradient
            ? {
                duration: 4,
                repeat: Infinity,
                ease: 'linear',
              }
            : {},
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        markerEnd={`url(#gradient-arrow-${id})`}
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
      />

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
                background: `linear-gradient(90deg, ${sourceColor}22, ${targetColor}22)`,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${targetColor}44`,
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
 * Rainbow Gradient Edge
 * Multi-color gradient edge with vibrant colors
 */
export const RainbowGradientEdge = (props) => {
  const rainbowColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  const gradientId = `rainbow-${props.id}`;

  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {rainbowColors.map((color, index) => (
            <stop
              key={index}
              offset={`${(index / (rainbowColors.length - 1)) * 100}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>

      <motion.path
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={props.data?.strokeWidth || 3}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />
    </>
  );
};

/**
 * Pulsing Gradient Edge
 * Gradient with pulsing opacity animation
 */
export const PulsingGradientEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <GradientEdge {...props} />
      <motion.path
        d={edgePath}
        stroke={`url(#${generateGradientId(props.id)})`}
        strokeWidth={(props.data?.strokeWidth || 3) + 2}
        fill="none"
        style={{ opacity: 0.5 }}
        animate={{
          opacity: [0.2, 0.6, 0.2],
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
 * Radial Gradient Edge
 * Edge with radial gradient emanating from center
 */
export const RadialGradientEdge = (props) => {
  const gradientId = `radial-${props.id}`;
  const sourceColor = props.data?.sourceColor || '#3b82f6';
  const targetColor = props.data?.targetColor || '#8b5cf6';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={1} />
          <stop offset="50%" stopColor={targetColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={sourceColor} stopOpacity={0.5} />
        </radialGradient>
      </defs>

      <motion.path
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={props.data?.strokeWidth || 3}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />
    </>
  );
};

/**
 * Shimmer Gradient Edge
 * Gradient with animated shimmer effect
 */
export const ShimmerGradientEdge = (props) => {
  const gradientId = `shimmer-${props.id}`;
  const baseColor = props.data?.sourceColor || '#3b82f6';

  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <motion.stop
            offset="0%"
            stopColor={baseColor}
            animate={{
              stopOpacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.stop
            offset="50%"
            stopColor="#ffffff"
            animate={{
              stopOpacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          />
          <motion.stop
            offset="100%"
            stopColor={baseColor}
            animate={{
              stopOpacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
        </linearGradient>
      </defs>

      <motion.path
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={props.data?.strokeWidth || 3}
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />
    </>
  );
};

/**
 * Temperature Gradient Edge
 * Cold to hot color gradient (blue to red)
 */
export const TemperatureGradientEdge = (props) => (
  <GradientEdge
    {...props}
    data={{
      ...props.data,
      sourceColor: '#3b82f6', // blue (cold)
      targetColor: '#ef4444', // red (hot)
      gradientStops: 5,
    }}
  />
);

export default GradientEdge;
