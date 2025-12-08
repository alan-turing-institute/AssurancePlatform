/**
 * Node Creator Component
 *
 * Manages the node creation workflow, integrating with React Flow instance.
 * Handles node ID generation, default data, undo/redo, and validation.
 *
 * Features:
 * - Integrates with React Flow instance
 * - Handles node ID generation
 * - Sets default node data based on type
 * - Manages undo/redo for creation
 * - Validates creation position
 * - Manages creation history
 * - Supports batch creation
 *
 * @component
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Undo2, Redo2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import {
  createNodeObject,
  validateNodeCreation,
  findNonOverlappingPosition,
  snapToGrid,
  saveRecentTypes,
  loadRecentTypes,
  loadCreationPreferences,
  saveCreationPreferences,
} from './creationUtils';

/**
 * Node Creator Hook
 * Main hook for managing node creation workflow
 */
export const useNodeCreator = ({
  onNodeCreated,
  onCreationError,
  enableUndo = true,
  maxHistorySize = 50,
} = {}) => {
  const reactFlowInstance = useReactFlow();
  const [creationHistory, setCreationHistory] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [preferences, setPreferences] = useState(loadCreationPreferences());
  const [recentTypes, setRecentTypes] = useState(loadRecentTypes());

  /**
   * Create a new node
   */
  const createNode = useCallback(
    (nodeType, position, customData = {}) => {
      setIsCreating(true);

      try {
        const nodes = reactFlowInstance.getNodes();

        // Validate creation
        const validation = validateNodeCreation(nodeType, position, nodes);
        if (!validation.valid) {
          if (onCreationError) {
            onCreationError(validation.error);
          }
          setIsCreating(false);
          return null;
        }

        // Apply grid snapping if enabled
        let finalPosition = position;
        if (preferences.gridSnap) {
          finalPosition = snapToGrid(position);
        }

        // Find non-overlapping position
        finalPosition = findNonOverlappingPosition(finalPosition, nodes);

        // Create node object
        const newNode = createNodeObject(nodeType, finalPosition, customData);

        // Add node to React Flow
        reactFlowInstance.setNodes((nds) => [...nds, newNode]);

        // Update history
        setCreationHistory((prev) => {
          const newHistory = [...prev, nodeType];
          if (newHistory.length > maxHistorySize) {
            newHistory.shift();
          }
          return newHistory;
        });

        // Update recent types
        const newRecentTypes = [nodeType, ...recentTypes.filter(t => t !== nodeType)].slice(0, 5);
        setRecentTypes(newRecentTypes);
        saveRecentTypes(newRecentTypes);

        // Add to undo stack if enabled
        if (enableUndo) {
          setUndoStack((prev) => [...prev, newNode.id]);
          setRedoStack([]); // Clear redo stack on new action
        }

        // Trigger callback
        if (onNodeCreated) {
          onNodeCreated(newNode);
        }

        setIsCreating(false);
        return newNode;
      } catch (error) {
        console.error('Failed to create node:', error);
        if (onCreationError) {
          onCreationError(error.message);
        }
        setIsCreating(false);
        return null;
      }
    },
    [
      reactFlowInstance,
      preferences,
      recentTypes,
      enableUndo,
      maxHistorySize,
      onNodeCreated,
      onCreationError,
    ]
  );

  /**
   * Create multiple nodes (batch creation)
   */
  const createNodes = useCallback(
    (nodeConfigs) => {
      const createdNodes = [];

      nodeConfigs.forEach((config) => {
        const node = createNode(
          config.type,
          config.position,
          config.customData
        );
        if (node) {
          createdNodes.push(node);
        }
      });

      return createdNodes;
    },
    [createNode]
  );

  /**
   * Create node from template
   */
  const createFromTemplate = useCallback(
    (template, basePosition) => {
      const createdNodes = [];

      template.nodes.forEach((nodeConfig, index) => {
        const position = {
          x: basePosition.x + (nodeConfig.offsetX || 0),
          y: basePosition.y + (nodeConfig.offsetY || 0) + (index * 200),
        };

        const node = createNode(
          nodeConfig.type,
          position,
          { name: nodeConfig.name }
        );

        if (node) {
          createdNodes.push(node);
        }
      });

      // Create edges between template nodes if needed
      if (createdNodes.length > 1) {
        const edges = [];
        for (let i = 0; i < createdNodes.length - 1; i++) {
          edges.push({
            id: `template-edge-${i}`,
            source: createdNodes[i].id,
            target: createdNodes[i + 1].id,
            type: 'default',
          });
        }
        reactFlowInstance.setEdges((eds) => [...eds, ...edges]);
      }

      return createdNodes;
    },
    [createNode, reactFlowInstance]
  );

  /**
   * Undo last creation
   */
  const undo = useCallback(() => {
    if (!enableUndo || undoStack.length === 0) return;

    const nodeIdToRemove = undoStack[undoStack.length - 1];
    const nodes = reactFlowInstance.getNodes();
    const nodeToRemove = nodes.find((n) => n.id === nodeIdToRemove);

    if (nodeToRemove) {
      // Remove node
      reactFlowInstance.setNodes((nds) =>
        nds.filter((n) => n.id !== nodeIdToRemove)
      );

      // Update stacks
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, nodeToRemove]);
    }
  }, [enableUndo, undoStack, reactFlowInstance]);

  /**
   * Redo last undone creation
   */
  const redo = useCallback(() => {
    if (!enableUndo || redoStack.length === 0) return;

    const nodeToRestore = redoStack[redoStack.length - 1];

    // Add node back
    reactFlowInstance.setNodes((nds) => [...nds, nodeToRestore]);

    // Update stacks
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, nodeToRestore.id]);
  }, [enableUndo, redoStack, reactFlowInstance]);

  /**
   * Clear creation history
   */
  const clearHistory = useCallback(() => {
    setCreationHistory([]);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback((newPreferences) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPreferences };
      saveCreationPreferences(updated);
      return updated;
    });
  }, []);

  return {
    createNode,
    createNodes,
    createFromTemplate,
    undo,
    redo,
    clearHistory,
    updatePreferences,
    isCreating,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    creationHistory,
    recentTypes,
    preferences,
  };
};

/**
 * Node Creator Component
 * Visual component for node creation with feedback
 */
const NodeCreator = ({
  onNodeCreated,
  onCreationError,
  showControls = true,
  className,
}) => {
  const {
    createNode,
    undo,
    redo,
    canUndo,
    canRedo,
    isCreating,
    creationHistory,
  } = useNodeCreator({
    onNodeCreated,
    onCreationError,
  });

  const [feedback, setFeedback] = useState(null);

  // Show feedback message
  const showFeedback = useCallback((message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  }, []);

  return (
    <div className={cn('relative', className)}>
      {/* Creation Controls */}
      {showControls && (
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={undo}
            disabled={!canUndo}
            className={cn(
              'p-2 rounded-lg',
              'bg-background-transparent-white-hover',
              'hover:bg-background-transparent-white-secondaryHover',
              'border border-transparent',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 text-text-light" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={redo}
            disabled={!canRedo}
            className={cn(
              'p-2 rounded-lg',
              'bg-background-transparent-white-hover',
              'hover:bg-background-transparent-white-secondaryHover',
              'border border-transparent',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4 text-text-light" />
          </motion.button>
        </div>
      )}

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              'absolute top-0 right-0',
              'px-4 py-2 rounded-lg',
              'backdrop-blur-lg',
              'border border-transparent',
              'shadow-lg',
              'flex items-center gap-2',
              feedback.type === 'success'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            )}
          >
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Creation Indicator */}
      {isCreating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
          />
        </div>
      )}
    </div>
  );
};

export default NodeCreator;
