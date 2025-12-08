/**
 * GlowingEdge Component
 *
 * Edge with soft glow effects, pulse animations, and neon-like appearance.
 * Features blur filters, shadow effects for depth, and color intensity
 * variations based on data flow.
 *
 * Features:
 * - Soft glow effect with blur filter
 * - Pulse animation on active connections
 * - Color intensity based on data flow
 * - Shadow effects for depth
 * - Neon-like appearance option
 * - Multiple glow layers
 *
 * @module GlowingEdge
 */

import React, { useState, useMemo } from 'react';
import { EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { motion } from 'framer-motion';
import { getStrokeWidth, getStateColor } from './edgeUtils';

/**
 * GlowingEdge Component
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
const GlowingEdge = ({
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

  // Edge configuration
  const edgeState = data.state || 'default';
  const baseColor = data.color || getStateColor(edgeState);
  const strokeWidth = data.strokeWidth || 2;
  const glowIntensity = data.glowIntensity || 1;
  const pulseEffect = data.pulse !== false;
  const neonStyle = data.neon || false;

  // Glow filter IDs
  const softGlowId = `soft-glow-${id}`;
  const mediumGlowId = `medium-glow-${id}`;
  const strongGlowId = `strong-glow-${id}`;
  const neonGlowId = `neon-glow-${id}`;

  // Calculate blur amounts based on intensity
  const softBlur = 3 * glowIntensity;
  const mediumBlur = 6 * glowIntensity;
  const strongBlur = 10 * glowIntensity;

  // Data flow intensity (0-1)
  const flowIntensity = data.flowIntensity || 0.5;

  // Label
  const label = data.label;
  const showLabel = label && (data.showLabel !== false);

  return (
    <>
      <defs>
        {/* Soft glow filter */}
        <filter
          id={softGlowId}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation={softBlur} result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Medium glow filter */}
        <filter
          id={mediumGlowId}
          x="-150%"
          y="-150%"
          width="400%"
          height="400%"
        >
          <feGaussianBlur stdDeviation={mediumBlur} result="coloredBlur" />
          <feColorMatrix
            in="coloredBlur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.5 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Strong glow filter */}
        <filter
          id={strongGlowId}
          x="-200%"
          y="-200%"
          width="500%"
          height="500%"
        >
          <feGaussianBlur stdDeviation={strongBlur} result="coloredBlur" />
          <feColorMatrix
            in="coloredBlur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Neon glow filter */}
        <filter
          id={neonGlowId}
          x="-200%"
          y="-200%"
          width="500%"
          height="500%"
        >
          <feGaussianBlur stdDeviation={strongBlur} result="blur1" />
          <feGaussianBlur stdDeviation={mediumBlur} result="blur2" />
          <feGaussianBlur stdDeviation={softBlur} result="blur3" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="blur3" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Arrow marker with glow */}
        <marker
          id={`glow-arrow-${id}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={baseColor} />
        </marker>
      </defs>

      {/* Outer glow layer (strongest) */}
      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={strokeWidth * 3}
        fill="none"
        opacity={0.2 * flowIntensity}
        filter={`url(#${neonStyle ? neonGlowId : strongGlowId})`}
        animate={
          pulseEffect
            ? {
                opacity: [
                  0.1 * flowIntensity,
                  0.3 * flowIntensity,
                  0.1 * flowIntensity,
                ],
                strokeWidth: [strokeWidth * 3, strokeWidth * 4, strokeWidth * 3],
              }
            : {}
        }
        transition={
          pulseEffect
            ? {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : {}
        }
      />

      {/* Middle glow layer */}
      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={strokeWidth * 2}
        fill="none"
        opacity={0.4 * flowIntensity}
        filter={`url(#${mediumGlowId})`}
        animate={
          pulseEffect
            ? {
                opacity: [
                  0.3 * flowIntensity,
                  0.5 * flowIntensity,
                  0.3 * flowIntensity,
                ],
              }
            : {}
        }
        transition={
          pulseEffect
            ? {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.2,
              }
            : {}
        }
      />

      {/* Inner glow layer */}
      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={strokeWidth * 1.5}
        fill="none"
        opacity={0.6 * flowIntensity}
        filter={`url(#${softGlowId})`}
        animate={
          pulseEffect
            ? {
                opacity: [
                  0.5 * flowIntensity,
                  0.7 * flowIntensity,
                  0.5 * flowIntensity,
                ],
              }
            : {}
        }
        transition={
          pulseEffect
            ? {
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.4,
              }
            : {}
        }
      />

      {/* Core path */}
      <motion.path
        id={id}
        d={edgePath}
        stroke={neonStyle ? '#ffffff' : baseColor}
        strokeWidth={strokeWidth}
        fill="none"
        className="react-flow__edge-path"
        style={{
          ...style,
          cursor: 'pointer',
          filter: neonStyle ? 'brightness(1.2)' : 'none',
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: 1,
        }}
        transition={{
          pathLength: { duration: 1, ease: 'easeInOut' },
          opacity: { duration: 0.5 },
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        markerEnd={`url(#glow-arrow-${id})`}
      />

      {/* Enhanced glow on hover */}
      {isHovered && (
        <motion.path
          d={edgePath}
          stroke={baseColor}
          strokeWidth={strokeWidth * 5}
          fill="none"
          opacity={0.3}
          filter={`url(#${strongGlowId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={Math.max(strokeWidth * 5, 20)}
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Edge label with glow effect */}
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
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${baseColor}`,
                color: 'rgba(255, 255, 255, 0.9)',
                boxShadow: `0 0 20px ${baseColor}66, 0 2px 8px rgba(0, 0, 0, 0.15)`,
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
 * Neon Edge
 * Bright neon-style glowing edge
 */
export const NeonEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      neon: true,
      glowIntensity: 1.5,
      pulse: true,
    }}
  />
);

/**
 * Soft Glow Edge
 * Subtle glow effect
 */
export const SoftGlowEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      glowIntensity: 0.5,
      pulse: false,
    }}
  />
);

/**
 * Intense Glow Edge
 * Strong glow with high intensity
 */
export const IntenseGlowEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      glowIntensity: 2,
      pulse: true,
      flowIntensity: 1,
    }}
  />
);

/**
 * Active Data Flow Edge
 * Glowing edge indicating active data transfer
 */
export const ActiveDataFlowEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || '#10b981'; // green for active

  return (
    <>
      <GlowingEdge
        {...props}
        data={{
          ...props.data,
          color: baseColor,
          glowIntensity: 1.5,
          pulse: true,
          flowIntensity: 1,
        }}
      />

      {/* Flowing particles effect */}
      {[0, 0.33, 0.66].map((offset, i) => (
        <motion.circle
          key={i}
          r={3}
          fill={baseColor}
          filter={`url(#soft-glow-${props.id})`}
          animate={{
            offsetDistance: ['0%', '100%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
            delay: offset * 2,
          }}
          style={{
            offsetPath: `path('${edgePath}')`,
          }}
        />
      ))}
    </>
  );
};

/**
 * Error Glow Edge
 * Red glowing edge for error states
 */
export const ErrorGlowEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      color: '#ef4444', // red
      state: 'error',
      glowIntensity: 1.2,
      pulse: true,
      flowIntensity: 0.8,
    }}
  />
);

/**
 * Success Glow Edge
 * Green glowing edge for success states
 */
export const SuccessGlowEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      color: '#10b981', // green
      state: 'success',
      glowIntensity: 1,
      pulse: false,
      flowIntensity: 1,
    }}
  />
);

/**
 * Warning Glow Edge
 * Amber glowing edge for warning states
 */
export const WarningGlowEdge = (props) => (
  <GlowingEdge
    {...props}
    data={{
      ...props.data,
      color: '#f59e0b', // amber
      state: 'warning',
      glowIntensity: 1,
      pulse: true,
      flowIntensity: 0.7,
    }}
  />
);

/**
 * Breathing Glow Edge
 * Gentle breathing animation
 */
export const BreathingGlowEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || '#8b5cf6';

  return (
    <>
      <defs>
        <filter
          id={`breathing-glow-${props.id}`}
          x="-200%"
          y="-200%"
          width="500%"
          height="500%"
        >
          <feGaussianBlur stdDeviation="8" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.path
        d={edgePath}
        stroke={baseColor}
        strokeWidth={props.data?.strokeWidth || 2}
        fill="none"
        filter={`url(#breathing-glow-${props.id})`}
        animate={{
          opacity: [0.4, 0.8, 0.4],
          strokeWidth: [2, 4, 2],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </>
  );
};

export default GlowingEdge;
