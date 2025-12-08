/**
 * SmartEdge Component
 *
 * Intelligent edge with curved paths avoiding node overlaps, dynamic path
 * recalculation, labels with background, connection strength indicators,
 * and conditional styling based on edge data.
 *
 * Features:
 * - Curved paths avoiding node overlaps
 * - Dynamic path recalculation on layout changes
 * - Labels with glassmorphism background
 * - Connection strength indicators (thickness, opacity)
 * - Conditional styling based on edge data
 * - Adaptive curvature based on distance
 *
 * @module SmartEdge
 */

import React, { useState, useMemo, useCallback } from 'react';
import { EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath } from 'reactflow';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getStrokeWidth, getStateColor } from './edgeUtils';

/**
 * SmartEdge Component
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
const SmartEdge = ({
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

  // Edge configuration
  const edgeState = data.state || 'default';
  const baseColor = data.color || getStateColor(edgeState);

  // Connection strength (0-1) affects thickness and opacity
  const connectionStrength = data.strength || 0.5;
  const baseStrokeWidth = data.strokeWidth || 2;
  const strengthModifier = 0.5 + connectionStrength * 1.5;
  const strokeWidth = getStrokeWidth(
    isHovered,
    selected,
    baseStrokeWidth * strengthModifier
  );
  const pathOpacity = 0.4 + connectionStrength * 0.6;

  // Path type selection based on configuration or auto-detection
  const pathType = data.pathType || 'auto';

  // Calculate optimal path
  const [edgePath, labelX, labelY] = useMemo(() => {
    const distance = Math.sqrt(
      Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2)
    );

    // Auto-select path type based on layout
    let selectedPathType = pathType;
    if (pathType === 'auto') {
      if (distance < 150) {
        selectedPathType = 'straight';
      } else if (
        (sourcePosition === 'right' && targetPosition === 'left') ||
        (sourcePosition === 'left' && targetPosition === 'right')
      ) {
        selectedPathType = 'bezier';
      } else {
        selectedPathType = 'smoothstep';
      }
    }

    // Calculate path based on selected type
    switch (selectedPathType) {
      case 'straight':
        return getStraightPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
        });

      case 'smoothstep':
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: data.cornerRadius || 10,
        });

      case 'bezier':
      default:
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          curvature: data.curvature || 0.25,
        });
    }
  }, [
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    pathType,
    data.curvature,
    data.cornerRadius,
  ]);

  // Label configuration
  const label = data.label;
  const showLabel = label && (data.showLabel !== false);
  const labelIcon = data.labelIcon;

  // Metadata indicators
  const showStrengthIndicator = data.showStrengthIndicator !== false;
  const showTypeIndicator = data.showTypeIndicator || false;

  // Interaction handlers
  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      if (data.onClick) {
        data.onClick(event, { id, source, target, data });
      }
    },
    [id, source, target, data]
  );

  const handleContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      if (data.onContextMenu) {
        data.onContextMenu(event, { id, source, target, data });
      }
    },
    [id, source, target, data]
  );

  // Get icon based on state
  const getStateIcon = () => {
    switch (edgeState) {
      case 'error':
        return AlertCircle;
      case 'success':
        return CheckCircle;
      case 'active':
        return Activity;
      default:
        return Info;
    }
  };

  const StateIcon = labelIcon || getStateIcon();

  return (
    <>
      <defs>
        {/* Arrow marker */}
        <marker
          id={`smart-arrow-${id}`}
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
            animate={{
              scale: selected ? 1.2 : 1,
            }}
            transition={{ duration: 0.2 }}
          />
        </marker>

        {/* Strength indicator gradient */}
        <linearGradient id={`strength-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            stopColor={baseColor}
            stopOpacity={pathOpacity * 0.5}
          />
          <stop offset="50%" stopColor={baseColor} stopOpacity={pathOpacity} />
          <stop
            offset="100%"
            stopColor={baseColor}
            stopOpacity={pathOpacity * 0.5}
          />
        </linearGradient>

        {/* Glow filter */}
        <filter
          id={`smart-glow-${id}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background glow (when selected or hovered) */}
      {(selected || isHovered) && (
        <motion.path
          d={edgePath}
          stroke={baseColor}
          strokeWidth={strokeWidth * 2}
          fill="none"
          opacity={0.2}
          filter={`url(#smart-glow-${id})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Main edge path */}
      <motion.path
        id={id}
        d={edgePath}
        stroke={showStrengthIndicator ? `url(#strength-gradient-${id})` : baseColor}
        strokeWidth={strokeWidth}
        fill="none"
        className="react-flow__edge-path"
        style={{
          ...style,
          cursor: 'pointer',
          opacity: pathOpacity,
        }}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: 1,
          opacity: pathOpacity,
        }}
        transition={{
          pathLength: { duration: 0.8, ease: 'easeInOut' },
          opacity: { duration: 0.3 },
        }}
        whileHover={{
          opacity: Math.min(pathOpacity + 0.2, 1),
          strokeWidth: strokeWidth * 1.2,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        markerEnd={`url(#smart-arrow-${id})`}
      />

      {/* Connection strength indicator (dashed underline) */}
      {showStrengthIndicator && (
        <motion.path
          d={edgePath}
          stroke={baseColor}
          strokeWidth={strokeWidth * 0.5}
          fill="none"
          strokeDasharray={`${connectionStrength * 10} ${(1 - connectionStrength) * 10}`}
          style={{ opacity: 0.3 }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      )}

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
        onContextMenu={handleContextMenu}
      />

      {/* Edge label with glassmorphism */}
      {showLabel && (
        <EdgeLabelRenderer>
          <motion.div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, type: 'spring' }}
            whileHover={{ scale: 1.05 }}
            className="nodrag nopan"
          >
            <div
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg"
              style={{
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${baseColor}44`,
                color: 'rgba(255, 255, 255, 0.95)',
                boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px ${baseColor}22`,
              }}
            >
              {StateIcon && (
                <StateIcon
                  className="w-3.5 h-3.5"
                  style={{ color: baseColor }}
                />
              )}
              <span>{label}</span>

              {/* Connection strength badge */}
              {showStrengthIndicator && (
                <div
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    background: `${baseColor}33`,
                    color: baseColor,
                  }}
                >
                  {Math.round(connectionStrength * 100)}%
                </div>
              )}

              {/* Type indicator */}
              {showTypeIndicator && data.type && (
                <div
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  {data.type}
                </div>
              )}
            </div>

            {/* Metadata tooltip (on hover) */}
            {isHovered && data.metadata && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: -10 }}
                exit={{ opacity: 0 }}
                className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap"
                style={{
                  background: 'rgba(0, 0, 0, 0.9)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  pointerEvents: 'none',
                }}
              >
                {data.metadata}
              </motion.div>
            )}
          </motion.div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

/**
 * Strong Connection Edge
 * High strength connection
 */
export const StrongConnectionEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      strength: 1,
      showStrengthIndicator: true,
      strokeWidth: 3,
    }}
  />
);

/**
 * Weak Connection Edge
 * Low strength connection
 */
export const WeakConnectionEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      strength: 0.3,
      showStrengthIndicator: true,
      strokeWidth: 1.5,
    }}
  />
);

/**
 * Typed Smart Edge
 * Edge with type indicator
 */
export const TypedSmartEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      showTypeIndicator: true,
      showStrengthIndicator: true,
    }}
  />
);

/**
 * Dependency Edge
 * Represents a dependency relationship
 */
export const DependencyEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      type: 'depends',
      color: '#f59e0b', // amber
      pathType: 'bezier',
      curvature: 0.3,
    }}
  />
);

/**
 * Inheritance Edge
 * Represents an inheritance relationship
 */
export const InheritanceEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      type: 'inherits',
      color: '#8b5cf6', // purple
      pathType: 'smoothstep',
    }}
  />
);

/**
 * Association Edge
 * Represents an association relationship
 */
export const AssociationEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      type: 'associates',
      color: '#3b82f6', // blue
      pathType: 'auto',
    }}
  />
);

/**
 * Adaptive Path Edge
 * Automatically adapts path based on node positions
 */
export const AdaptivePathEdge = (props) => {
  const distance = Math.sqrt(
    Math.pow(props.targetX - props.sourceX, 2) +
      Math.pow(props.targetY - props.sourceY, 2)
  );

  let pathType = 'bezier';
  let curvature = 0.25;

  if (distance < 100) {
    pathType = 'straight';
  } else if (distance > 400) {
    curvature = 0.15; // Less curved for long distances
  }

  return (
    <SmartEdge
      {...props}
      data={{
        ...props.data,
        pathType,
        curvature,
      }}
    />
  );
};

/**
 * Info Edge
 * Edge with informational styling
 */
export const InfoEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      state: 'default',
      color: '#3b82f6',
      labelIcon: Info,
    }}
  />
);

/**
 * Activity Edge
 * Edge showing active connection
 */
export const ActivityEdge = (props) => (
  <SmartEdge
    {...props}
    data={{
      ...props.data,
      state: 'active',
      color: '#10b981',
      labelIcon: Activity,
      strength: 0.8,
    }}
  />
);

export default SmartEdge;
