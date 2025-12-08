/**
 * Double Click Handler Component
 *
 * Detects double-click interactions on the React Flow canvas and manages
 * the node creation workflow. Shows visual feedback and handles edge cases.
 *
 * Features:
 * - Double-click detection on canvas (not on nodes/edges)
 * - Visual feedback (ripple effect at click point)
 * - Keyboard shortcuts (Shift+Click for quick create)
 * - Debounced click handling
 * - World coordinate calculation
 *
 * @component
 */

import React, { useCallback, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { screenToFlowPosition, debounce } from './creationUtils';

/**
 * Creation indicator component (ripple effect)
 */
const CreationIndicator = ({ position, onComplete }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2, opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className="absolute pointer-events-none z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="w-16 h-16 rounded-full border-2 border-blue-400 bg-blue-400/20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Plus className="w-8 h-8 text-blue-400" strokeWidth={3} />
      </div>
    </motion.div>
  );
};

/**
 * DoubleClickHandler Props
 * @typedef {Object} DoubleClickHandlerProps
 * @property {Function} onDoubleClick - Callback when double-click detected (receives flow position)
 * @property {Function} onQuickCreate - Callback for Shift+Click quick create
 * @property {boolean} enabled - Whether double-click is enabled
 * @property {number} debounceMs - Debounce time for click detection
 * @property {boolean} showVisualFeedback - Show ripple effect
 * @property {React.ReactNode} children - Child components
 */

/**
 * DoubleClickHandler Component
 */
const DoubleClickHandler = ({
  onDoubleClick,
  onQuickCreate,
  enabled = true,
  debounceMs = 300,
  showVisualFeedback = true,
  children,
}) => {
  const reactFlowInstance = useReactFlow();
  const [indicator, setIndicator] = useState(null);
  const clickTimeoutRef = useRef(null);
  const lastClickRef = useRef(null);

  /**
   * Handle pane click
   */
  const handlePaneClick = useCallback(
    (event) => {
      if (!enabled) return;

      const now = Date.now();
      const lastClick = lastClickRef.current;

      // Check if this is a double-click
      if (lastClick && now - lastClick < debounceMs) {
        // Clear any pending timeout
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }

        // Get click position relative to React Flow pane
        const bounds = event.currentTarget.getBoundingClientRect();
        const screenPosition = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };

        // Convert to flow coordinates
        const flowPosition = screenToFlowPosition(screenPosition, reactFlowInstance);

        // Show visual feedback
        if (showVisualFeedback) {
          setIndicator({
            screen: screenPosition,
            flow: flowPosition,
          });

          // Hide indicator after animation
          setTimeout(() => {
            setIndicator(null);
          }, 600);
        }

        // Trigger double-click callback
        if (onDoubleClick) {
          onDoubleClick(flowPosition, event);
        }

        // Reset last click
        lastClickRef.current = null;
      } else {
        // First click, set last click time
        lastClickRef.current = now;

        // Set timeout to reset if no second click
        clickTimeoutRef.current = setTimeout(() => {
          lastClickRef.current = null;
          clickTimeoutRef.current = null;
        }, debounceMs);
      }
    },
    [enabled, debounceMs, showVisualFeedback, onDoubleClick, reactFlowInstance]
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (!enabled) return;

      // Shift+Click for quick create
      if (event.shiftKey && event.type === 'click' && onQuickCreate) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const screenPosition = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };

        const flowPosition = screenToFlowPosition(screenPosition, reactFlowInstance);
        onQuickCreate(flowPosition, event);
      }
    },
    [enabled, onQuickCreate, reactFlowInstance]
  );

  return (
    <>
      {/* Click handler overlay */}
      <div
        className="absolute inset-0 z-0"
        onClick={handlePaneClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>

      {/* Visual feedback indicator */}
      <AnimatePresence>
        {indicator && (
          <CreationIndicator
            position={indicator.screen}
            onComplete={() => setIndicator(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

/**
 * Hook for using double-click handler
 * @param {Object} options - Configuration options
 * @returns {Object} Handler functions and state
 */
export const useDoubleClickHandler = ({
  onDoubleClick,
  onQuickCreate,
  enabled = true,
  debounceMs = 300,
} = {}) => {
  const reactFlowInstance = useReactFlow();
  const [isProcessing, setIsProcessing] = useState(false);
  const lastClickRef = useRef(null);

  const handleDoubleClick = useCallback(
    (event) => {
      if (!enabled || isProcessing) return;

      setIsProcessing(true);

      const bounds = event.currentTarget.getBoundingClientRect();
      const screenPosition = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      const flowPosition = screenToFlowPosition(screenPosition, reactFlowInstance);

      if (onDoubleClick) {
        onDoubleClick(flowPosition, event);
      }

      // Reset processing state after debounce
      setTimeout(() => {
        setIsProcessing(false);
      }, debounceMs);
    },
    [enabled, isProcessing, debounceMs, onDoubleClick, reactFlowInstance]
  );

  const handleQuickCreate = useCallback(
    (event) => {
      if (!enabled || !event.shiftKey) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const screenPosition = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };

      const flowPosition = screenToFlowPosition(screenPosition, reactFlowInstance);

      if (onQuickCreate) {
        onQuickCreate(flowPosition, event);
      }
    },
    [enabled, onQuickCreate, reactFlowInstance]
  );

  return {
    handleDoubleClick,
    handleQuickCreate,
    isProcessing,
  };
};

/**
 * Higher-order component to add double-click handling
 */
export const withDoubleClickHandler = (Component) => {
  return React.forwardRef((props, ref) => {
    const { onDoubleClick, onQuickCreate, ...restProps } = props;

    return (
      <DoubleClickHandler
        onDoubleClick={onDoubleClick}
        onQuickCreate={onQuickCreate}
      >
        <Component ref={ref} {...restProps} />
      </DoubleClickHandler>
    );
  });
};

export default DoubleClickHandler;
