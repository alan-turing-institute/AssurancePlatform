/**
 * Node Positioner Component
 *
 * Smart positioning system for new nodes with overlap avoidance,
 * grid snapping, alignment guides, and connection previews.
 *
 * Features:
 * - Smart positioning to avoid overlaps
 * - Grid snapping option
 * - Alignment guides (visual indicators)
 * - Auto-arrange after creation
 * - Connection preview while positioning
 * - Magnetic edges for alignment
 *
 * @component
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useReactFlow, useNodes } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Grid3x3, Magnet, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import {
  snapToGrid,
  findNonOverlappingPosition,
  calculateSmartPosition,
  calculateDistance,
  calculateConnectionHints,
} from './creationUtils';

/**
 * Alignment Guide Component
 */
const AlignmentGuide = ({ position, type, isVisible }) => {
  if (!isVisible) return null;

  const isHorizontal = type === 'horizontal';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute pointer-events-none z-50',
        'bg-blue-400',
        isHorizontal ? 'h-px w-screen left-0' : 'w-px h-screen top-0'
      )}
      style={
        isHorizontal
          ? { top: position.y }
          : { left: position.x }
      }
    />
  );
};

/**
 * Grid Overlay Component
 */
const GridOverlay = ({ visible, gridSize = 20 }) => {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.3 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 pointer-events-none z-40"
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    />
  );
};

/**
 * Connection Preview Component
 */
const ConnectionPreview = ({ start, end, isVisible }) => {
  if (!isVisible || !start || !end) return null;

  const distance = calculateDistance(start, end);
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      exit={{ opacity: 0 }}
      className="absolute pointer-events-none z-40"
      style={{
        left: start.x,
        top: start.y,
        width: distance,
        height: 2,
        transformOrigin: 'left center',
        transform: `rotate(${angle}deg)`,
        background: 'linear-gradient(to right, rgba(59, 130, 246, 0.6), rgba(59, 130, 246, 0.2))',
      }}
    />
  );
};

/**
 * Ghost Node Preview Component
 */
const GhostNodePreview = ({ position, nodeType, isVisible }) => {
  if (!isVisible || !position) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 0.5, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={cn(
        'absolute pointer-events-none z-50',
        'w-[300px] h-[150px]',
        'rounded-xl',
        'border-2 border-dashed border-blue-400',
        'bg-blue-500/10',
        'backdrop-blur-sm',
        'flex items-center justify-center'
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="text-blue-400 font-semibold text-sm">
        {nodeType}
      </div>
    </motion.div>
  );
};

/**
 * Magnetic Snap Indicator
 */
const MagneticSnapIndicator = ({ position, isSnapping }) => {
  if (!isSnapping || !position) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="absolute pointer-events-none z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="w-6 h-6 rounded-full bg-blue-500/50 flex items-center justify-center">
        <Magnet className="w-4 h-4 text-blue-400" />
      </div>
    </motion.div>
  );
};

/**
 * Node Positioner Hook
 */
export const useNodePositioner = ({
  gridSize = 20,
  snapThreshold = 10,
  magneticThreshold = 20,
  showGuides = true,
  showGrid = false,
  showPreview = true,
} = {}) => {
  const reactFlowInstance = useReactFlow();
  const nodes = useNodes();
  const [isDragging, setIsDragging] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [snappedPosition, setSnappedPosition] = useState(null);
  const [alignmentGuides, setAlignmentGuides] = useState({ horizontal: null, vertical: null });
  const [isSnapping, setIsSnapping] = useState(false);

  /**
   * Find alignment guides for position
   */
  const findAlignmentGuides = useCallback(
    (position) => {
      if (!showGuides) return { horizontal: null, vertical: null };

      const guides = { horizontal: null, vertical: null };

      nodes.forEach((node) => {
        const nodeCenter = {
          x: node.position.x + (node.width || 300) / 2,
          y: node.position.y + (node.height || 150) / 2,
        };

        // Check horizontal alignment
        if (Math.abs(position.y - nodeCenter.y) < snapThreshold) {
          guides.horizontal = nodeCenter.y;
        }

        // Check vertical alignment
        if (Math.abs(position.x - nodeCenter.x) < snapThreshold) {
          guides.vertical = nodeCenter.x;
        }
      });

      return guides;
    },
    [nodes, showGuides, snapThreshold]
  );

  /**
   * Calculate optimal position with all features
   */
  const calculateOptimalPosition = useCallback(
    (basePosition, options = {}) => {
      const {
        enableGridSnap = true,
        enableMagneticSnap = true,
        enableOverlapAvoidance = true,
        sourceNode = null,
      } = options;

      let position = { ...basePosition };

      // Apply grid snapping
      if (enableGridSnap) {
        position = snapToGrid(position, gridSize);
      }

      // Apply magnetic snapping to nearby nodes
      if (enableMagneticSnap) {
        const guides = findAlignmentGuides(position);

        if (guides.horizontal !== null) {
          position.y = guides.horizontal;
          setIsSnapping(true);
        }
        if (guides.vertical !== null) {
          position.x = guides.vertical;
          setIsSnapping(true);
        }

        if (guides.horizontal === null && guides.vertical === null) {
          setIsSnapping(false);
        }

        setAlignmentGuides(guides);
      }

      // Avoid overlaps
      if (enableOverlapAvoidance) {
        position = findNonOverlappingPosition(position, nodes);
      }

      // Smart positioning based on source node
      if (sourceNode) {
        position = calculateSmartPosition([sourceNode], nodes);
      }

      return position;
    },
    [nodes, gridSize, findAlignmentGuides]
  );

  /**
   * Get connection hints for position
   */
  const getConnectionHints = useCallback(
    (position) => {
      return calculateConnectionHints(position, nodes);
    },
    [nodes]
  );

  /**
   * Auto-arrange nodes
   */
  const autoArrange = useCallback(
    (algorithm = 'hierarchical') => {
      // Simple hierarchical layout
      if (algorithm === 'hierarchical') {
        const sortedNodes = [...nodes].sort((a, b) => {
          // Sort by dependencies (nodes with no incoming edges first)
          return 0; // Simplified for now
        });

        let currentY = 100;
        const levelSpacing = 200;
        const nodeSpacing = 350;

        sortedNodes.forEach((node, index) => {
          const x = (index % 4) * nodeSpacing + 100;
          const y = Math.floor(index / 4) * levelSpacing + currentY;

          reactFlowInstance.setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id
                ? { ...n, position: { x, y } }
                : n
            )
          );
        });
      }
    },
    [nodes, reactFlowInstance]
  );

  return {
    calculateOptimalPosition,
    getConnectionHints,
    autoArrange,
    isDragging,
    setIsDragging,
    currentPosition,
    setCurrentPosition,
    snappedPosition,
    setSnappedPosition,
    alignmentGuides,
    isSnapping,
  };
};

/**
 * Node Positioner Component
 */
const NodePositioner = ({
  nodeType,
  basePosition,
  onPositionChange,
  showControls = true,
  children,
  className,
}) => {
  const {
    calculateOptimalPosition,
    autoArrange,
    alignmentGuides,
    isSnapping,
  } = useNodePositioner();

  const [gridVisible, setGridVisible] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(null);

  useEffect(() => {
    if (basePosition) {
      const optimal = calculateOptimalPosition(basePosition);
      setPreviewPosition(optimal);
      if (onPositionChange) {
        onPositionChange(optimal);
      }
    }
  }, [basePosition, calculateOptimalPosition, onPositionChange]);

  return (
    <div className={cn('relative', className)}>
      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setGridVisible(!gridVisible)}
            className={cn(
              'p-2 rounded-lg',
              'bg-background-transparent-black',
              'backdrop-blur-lg',
              'border border-transparent',
              'hover:bg-background-transparent-white-hover',
              'transition-all duration-200',
              gridVisible && 'bg-blue-500/20'
            )}
            title="Toggle Grid"
          >
            <Grid3x3 className="w-4 h-4 text-text-light" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => autoArrange()}
            className={cn(
              'p-2 rounded-lg',
              'bg-background-transparent-black',
              'backdrop-blur-lg',
              'border border-transparent',
              'hover:bg-background-transparent-white-hover',
              'transition-all duration-200'
            )}
            title="Auto Arrange"
          >
            <AlignHorizontalDistributeCenter className="w-4 h-4 text-text-light" />
          </motion.button>
        </div>
      )}

      {/* Visual Aids */}
      <GridOverlay visible={gridVisible} />

      <AnimatePresence>
        <AlignmentGuide
          position={{ y: alignmentGuides.horizontal }}
          type="horizontal"
          isVisible={alignmentGuides.horizontal !== null}
        />
        <AlignmentGuide
          position={{ x: alignmentGuides.vertical }}
          type="vertical"
          isVisible={alignmentGuides.vertical !== null}
        />
      </AnimatePresence>

      <AnimatePresence>
        <GhostNodePreview
          position={previewPosition}
          nodeType={nodeType}
          isVisible={!!previewPosition}
        />
      </AnimatePresence>

      <AnimatePresence>
        <MagneticSnapIndicator
          position={previewPosition}
          isSnapping={isSnapping}
        />
      </AnimatePresence>

      {children}
    </div>
  );
};

export default NodePositioner;
