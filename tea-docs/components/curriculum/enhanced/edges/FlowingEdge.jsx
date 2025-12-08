/**
 * FlowingEdge Component
 *
 * Edge with animated particles/dots flowing along the path, direction indicators,
 * speed variations, traffic visualization, and bi-directional flow support.
 *
 * Features:
 * - Animated particles flowing along edge
 * - Direction indicators (arrows/chevrons)
 * - Speed variations based on data
 * - Traffic visualization (multiple particles)
 * - Bi-directional flow support
 * - Particle density control
 *
 * @module FlowingEdge
 */

import React, { useState, useMemo } from 'react';
import { EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { motion } from 'framer-motion';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { getStrokeWidth, getStateColor } from './edgeUtils';

/**
 * FlowingEdge Component
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
const FlowingEdge = ({
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

  // Flow configuration
  const edgeState = data.state || 'default';
  const baseColor = data.color || getStateColor(edgeState);
  const strokeWidth = getStrokeWidth(isHovered, selected, data.strokeWidth || 2);

  // Particle configuration
  const particleCount = data.particleCount || 3;
  const particleSize = data.particleSize || 4;
  const flowSpeed = data.flowSpeed || 1;
  const bidirectional = data.bidirectional || false;

  // Direction indicators
  const showDirectionIndicators = data.showDirectionIndicators !== false;
  const indicatorCount = data.indicatorCount || 2;

  // Traffic intensity (affects particle count and speed)
  const trafficIntensity = data.trafficIntensity || 0.5;
  const effectiveParticleCount = Math.max(
    1,
    Math.round(particleCount * trafficIntensity)
  );

  // Generate particle offsets for staggered animation
  const particles = useMemo(() => {
    return Array.from({ length: effectiveParticleCount }, (_, i) => ({
      id: `particle-${id}-${i}`,
      delay: (i / effectiveParticleCount) * (3 / flowSpeed),
    }));
  }, [effectiveParticleCount, id, flowSpeed]);

  // Generate reverse particles for bidirectional flow
  const reverseParticles = useMemo(() => {
    if (!bidirectional) return [];
    return Array.from({ length: Math.max(1, Math.floor(effectiveParticleCount / 2))}, (_, i) => ({
      id: `reverse-particle-${id}-${i}`,
      delay: (i / (effectiveParticleCount / 2)) * (3 / flowSpeed),
    }));
  }, [bidirectional, effectiveParticleCount, id, flowSpeed]);

  // Direction indicators positions
  const indicators = useMemo(() => {
    return Array.from({ length: indicatorCount }, (_, i) => {
      const position = ((i + 1) / (indicatorCount + 1)) * 100;
      return {
        id: `indicator-${id}-${i}`,
        position,
      };
    });
  }, [indicatorCount, id]);

  // Label
  const label = data.label;
  const showLabel = label && (data.showLabel !== false);

  return (
    <>
      <defs>
        {/* Particle gradient for depth effect */}
        <radialGradient id={`particle-gradient-${id}`}>
          <stop offset="0%" stopColor={baseColor} stopOpacity={1} />
          <stop offset="100%" stopColor={baseColor} stopOpacity={0.3} />
        </radialGradient>

        {/* Arrow marker */}
        <marker
          id={`flow-arrow-${id}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={baseColor} />
        </marker>

        {/* Glow filter for particles */}
        <filter
          id={`particle-glow-${id}`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base edge path */}
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
          opacity: 0.5,
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: isHovered ? 0.7 : 0.5,
        }}
        transition={{
          pathLength: { duration: 1, ease: 'easeInOut' },
          opacity: { duration: 0.3 },
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        markerEnd={`url(#flow-arrow-${id})`}
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

      {/* Flowing particles (forward direction) */}
      {particles.map((particle) => (
        <motion.circle
          key={particle.id}
          r={particleSize}
          fill={`url(#particle-gradient-${id})`}
          filter={`url(#particle-glow-${id})`}
          initial={{ offsetDistance: '0%', opacity: 0 }}
          animate={{
            offsetDistance: ['0%', '100%'],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            offsetDistance: {
              duration: 3 / flowSpeed,
              repeat: Infinity,
              ease: 'linear',
              delay: particle.delay,
            },
            opacity: {
              duration: 3 / flowSpeed,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: particle.delay,
              times: [0, 0.1, 0.9, 1],
            },
          }}
          style={{
            offsetPath: `path('${edgePath}')`,
          }}
        />
      ))}

      {/* Flowing particles (reverse direction for bidirectional) */}
      {reverseParticles.map((particle) => (
        <motion.circle
          key={particle.id}
          r={particleSize * 0.8}
          fill={`url(#particle-gradient-${id})`}
          filter={`url(#particle-glow-${id})`}
          style={{ opacity: 0.6 }}
          initial={{ offsetDistance: '100%', opacity: 0 }}
          animate={{
            offsetDistance: ['100%', '0%'],
            opacity: [0, 0.6, 0.6, 0],
          }}
          transition={{
            offsetDistance: {
              duration: 3.5 / flowSpeed,
              repeat: Infinity,
              ease: 'linear',
              delay: particle.delay,
            },
            opacity: {
              duration: 3.5 / flowSpeed,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: particle.delay,
              times: [0, 0.1, 0.9, 1],
            },
          }}
          style={{
            offsetPath: `path('${edgePath}')`,
          }}
        />
      ))}

      {/* Direction indicators (chevrons) */}
      {showDirectionIndicators &&
        indicators.map((indicator) => (
          <g key={indicator.id}>
            <motion.path
              d="M -3 -6 L 3 0 L -3 6"
              stroke={baseColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4 }}
              animate={{
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: (indicator.position / 100) * 0.5,
              }}
              transform={`translate(${
                sourceX + (targetX - sourceX) * (indicator.position / 100)
              }, ${sourceY + (targetY - sourceY) * (indicator.position / 100)})`}
            />
          </g>
        ))}

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
              className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(10px)',
                border: `1px solid ${baseColor}44`,
                color: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              {bidirectional && (
                <span style={{ opacity: 0.5 }}>⇄</span>
              )}
              {label}
              <motion.span
                animate={{
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                →
              </motion.span>
            </div>
          </motion.div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/**
 * Fast Flow Edge
 * Rapid particle movement
 */
export const FastFlowEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      flowSpeed: 2,
      particleCount: 5,
    }}
  />
);

/**
 * Slow Flow Edge
 * Gentle particle movement
 */
export const SlowFlowEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      flowSpeed: 0.5,
      particleCount: 2,
    }}
  />
);

/**
 * Heavy Traffic Edge
 * Many particles indicating high data flow
 */
export const HeavyTrafficEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      particleCount: 8,
      flowSpeed: 1.5,
      trafficIntensity: 1,
      strokeWidth: 3,
    }}
  />
);

/**
 * Light Traffic Edge
 * Few particles indicating low data flow
 */
export const LightTrafficEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      particleCount: 2,
      flowSpeed: 0.7,
      trafficIntensity: 0.3,
      strokeWidth: 2,
    }}
  />
);

/**
 * Bidirectional Flow Edge
 * Particles flowing in both directions
 */
export const BidirectionalFlowEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      bidirectional: true,
      particleCount: 4,
      flowSpeed: 1,
    }}
  />
);

/**
 * Data Stream Edge
 * Continuous stream of data particles
 */
export const DataStreamEdge = (props) => (
  <FlowingEdge
    {...props}
    data={{
      ...props.data,
      particleCount: 10,
      particleSize: 3,
      flowSpeed: 1.2,
      trafficIntensity: 0.8,
      showDirectionIndicators: true,
      indicatorCount: 3,
    }}
  />
);

/**
 * Pulse Flow Edge
 * Particles with pulsing size animation
 */
export const PulseFlowEdge = (props) => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const baseColor = props.data?.color || getStateColor(props.data?.state || 'default');
  const particleCount = props.data?.particleCount || 3;

  return (
    <>
      <FlowingEdge {...props} />
      {Array.from({ length: particleCount }, (_, i) => (
        <motion.circle
          key={`pulse-${i}`}
          r={6}
          fill={baseColor}
          style={{ opacity: 0.3 }}
          animate={{
            r: [4, 8, 4],
            opacity: [0.2, 0.5, 0.2],
            offsetDistance: ['0%', '100%'],
          }}
          transition={{
            r: {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            opacity: {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            offsetDistance: {
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              delay: (i / particleCount) * 3,
            },
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
 * Trail Flow Edge
 * Particles with trailing effect
 */
export const TrailFlowEdge = (props) => {
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
      <FlowingEdge {...props} />
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={`trail-${i}`}
          r={4 - i}
          fill={baseColor}
          animate={{
            opacity: [0, 0.6 - i * 0.2, 0],
            offsetDistance: ['0%', '100%'],
          }}
          transition={{
            offsetDistance: {
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              delay: -i * 0.15,
            },
            opacity: {
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: -i * 0.15,
              times: [0, 0.5, 1],
            },
          }}
          style={{
            offsetPath: `path('${edgePath}')`,
          }}
        />
      ))}
    </>
  );
};

export default FlowingEdge;
