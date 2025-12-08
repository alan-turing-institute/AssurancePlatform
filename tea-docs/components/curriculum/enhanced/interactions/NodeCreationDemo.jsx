/**
 * Node Creation Demo
 *
 * Comprehensive demonstration of the double-click node creation system.
 * Shows all features including type selection, positioning, and keyboard shortcuts.
 *
 * @component
 */

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { Info, Keyboard, MousePointer2, Zap } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { nodeTypes } from '../nodes/nodeTypes';
import { useNodeCreator } from './NodeCreator';
import NodeTypeSelector from './NodeTypeSelector';
import NodePositioner from './NodePositioner';
import { useDoubleClickHandler } from './DoubleClickHandler';

/**
 * Instructions Panel Component
 */
const InstructionsPanel = ({ isVisible, onToggle }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'absolute top-4 left-4 z-50',
        'max-w-sm',
        'bg-background-transparent-black-secondaryAlt',
        'backdrop-blur-lg',
        'border border-transparent',
        'rounded-xl',
        'shadow-3d',
        'p-4'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-text-light font-semibold flex items-center gap-2">
          <Info className="w-4 h-4" />
          How to Create Nodes
        </h3>
      </div>

      <div className="space-y-3 text-sm text-text-light/80">
        <div className="flex items-start gap-3">
          <MousePointer2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
          <div>
            <div className="font-medium text-text-light">Double-Click</div>
            <div className="text-xs text-text-light/60">
              Double-click anywhere on the canvas to open the node type selector
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Keyboard className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" />
          <div>
            <div className="font-medium text-text-light">Keyboard Shortcuts</div>
            <div className="text-xs text-text-light/60 space-y-1">
              <div><kbd className="px-1 py-0.5 bg-background-transparent-white-hover rounded text-xs">G</kbd> = Goal</div>
              <div><kbd className="px-1 py-0.5 bg-background-transparent-white-hover rounded text-xs">S</kbd> = Strategy</div>
              <div><kbd className="px-1 py-0.5 bg-background-transparent-white-hover rounded text-xs">C</kbd> = Claim</div>
              <div><kbd className="px-1 py-0.5 bg-background-transparent-white-hover rounded text-xs">E</kbd> = Evidence</div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-400" />
          <div>
            <div className="font-medium text-text-light">Smart Features</div>
            <div className="text-xs text-text-light/60">
              Grid snapping, overlap avoidance, and alignment guides are enabled automatically
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Stats Panel Component
 */
const StatsPanel = ({ creationHistory, recentTypes, canUndo, canRedo }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'absolute bottom-4 left-4 z-50',
        'bg-background-transparent-black-secondaryAlt',
        'backdrop-blur-lg',
        'border border-transparent',
        'rounded-xl',
        'shadow-3d',
        'p-4'
      )}
    >
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-light/60">Nodes Created:</span>
          <span className="text-text-light font-semibold">
            {creationHistory.length}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-light/60">Can Undo:</span>
          <span className="text-text-light font-semibold">
            {canUndo ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-text-light/60">Can Redo:</span>
          <span className="text-text-light font-semibold">
            {canRedo ? '✓' : '✗'}
          </span>
        </div>
        {recentTypes.length > 0 && (
          <div className="pt-2 border-t border-transparent">
            <div className="text-text-light/60 text-xs mb-1">Recent Types:</div>
            <div className="flex gap-1">
              {recentTypes.map((type, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-background-transparent-white-hover rounded text-xs text-text-light"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Main Demo Component
 */
const NodeCreationDemoInner = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [creationPosition, setCreationPosition] = useState(null);

  // Node creator hook
  const {
    createNode,
    createFromTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
    creationHistory,
    recentTypes,
  } = useNodeCreator({
    onNodeCreated: (node) => {
      console.log('Node created:', node);
    },
    onCreationError: (error) => {
      console.error('Creation error:', error);
    },
  });

  // Handle double-click
  const handleDoubleClick = useCallback((flowPosition, event) => {
    setCreationPosition(flowPosition);
    setIsTypeSelectorOpen(true);
  }, []);

  // Handle node type selection
  const handleSelectType = useCallback(
    (nodeType, position) => {
      createNode(nodeType, position || creationPosition);
      setIsTypeSelectorOpen(false);
      setCreationPosition(null);
    },
    [createNode, creationPosition]
  );

  // Handle template selection
  const handleSelectTemplate = useCallback(
    (template, position) => {
      createFromTemplate(template, position || creationPosition);
      setIsTypeSelectorOpen(false);
      setCreationPosition(null);
    },
    [createFromTemplate, creationPosition]
  );

  // Handle edge connections
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Keyboard shortcuts for undo/redo
  useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        redo();
      }
    }
  }, [undo, redo]);

  return (
    <div className="w-full h-screen bg-gray-950 relative">
      {/* Instructions */}
      <InstructionsPanel />

      {/* Stats */}
      <StatsPanel
        creationHistory={creationHistory}
        recentTypes={recentTypes}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onPaneDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const position = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          handleDoubleClick(position, event);
        }}
        fitView
        className="bg-gray-950"
      >
        <Background
          color="rgba(255, 255, 255, 0.05)"
          gap={20}
          size={1}
        />
        <Controls
          className={cn(
            'bg-background-transparent-black',
            'backdrop-blur-lg',
            'border border-transparent',
            'rounded-xl'
          )}
        />
        <MiniMap
          className={cn(
            'bg-background-transparent-black',
            'backdrop-blur-lg',
            'border border-transparent',
            'rounded-xl'
          )}
          nodeColor={(node) => {
            switch (node.type) {
              case 'goal':
                return '#10b981';
              case 'strategy':
                return '#a855f7';
              case 'propertyClaim':
                return '#f97316';
              case 'evidence':
                return '#06b6d4';
              case 'context':
                return '#6b7280';
              default:
                return '#9ca3af';
            }
          }}
        />
      </ReactFlow>

      {/* Node Type Selector */}
      <NodeTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={() => {
          setIsTypeSelectorOpen(false);
          setCreationPosition(null);
        }}
        onSelectType={handleSelectType}
        onSelectTemplate={handleSelectTemplate}
        position={creationPosition}
        recentTypes={recentTypes}
        showTemplates={true}
        showSearch={true}
      />
    </div>
  );
};

/**
 * Wrapped Demo Component with Provider
 */
const NodeCreationDemo = () => {
  return (
    <ReactFlowProvider>
      <NodeCreationDemoInner />
    </ReactFlowProvider>
  );
};

/**
 * Simple Demo (minimal setup)
 */
export const SimpleNodeCreationDemo = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const { createNode, recentTypes } = useNodeCreator();

  return (
    <ReactFlowProvider>
      <div className="w-full h-96 bg-gray-950 relative">
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onPaneDoubleClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPosition({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
            setIsOpen(true);
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>

        <NodeTypeSelector
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSelectType={(type, pos) => {
            createNode(type, pos || position);
            setIsOpen(false);
          }}
          position={position}
          recentTypes={recentTypes}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default NodeCreationDemo;
