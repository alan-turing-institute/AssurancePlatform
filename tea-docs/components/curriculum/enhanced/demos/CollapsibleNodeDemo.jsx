/**
 * Collapsible Node Demo
 *
 * Demonstration of the collapsible node system with various usage patterns.
 * Shows integration of CollapsibleNode, NodeStateManager, and useNodeState hook.
 *
 * Features demonstrated:
 * - Basic collapsible nodes
 * - Centralized state management
 * - Bulk operations (expand/collapse all)
 * - Progressive disclosure
 * - Focus mode
 * - Persistent state (localStorage)
 *
 * @component
 * @example
 * <CollapsibleNodeDemo />
 */

import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  CollapsibleNode,
  ProgressiveCollapsibleNode,
  ControlledCollapsibleNode,
  NodeStateManager,
  NodeStateControls,
  useNodeStateContext,
} from '../nodes';

/**
 * Demo node types using CollapsibleNode variants
 */
const demoNodeTypes = {
  collapsible: CollapsibleNode,
  progressive: ProgressiveCollapsibleNode,
  controlled: ControlledCollapsibleNode,
};

/**
 * Sample data for demonstration
 */
const createDemoData = () => {
  const nodes = [
    {
      id: 'goal-1',
      type: 'collapsible',
      position: { x: 250, y: 50 },
      data: {
        id: 'goal-1',
        name: 'System Safety Goal',
        description: 'The system shall be safe to operate',
        long_description:
          'The autonomous vehicle system shall operate safely under all normal operating conditions, minimizing risk to passengers, pedestrians, and other road users.',
      },
      nodeType: 'goal',
    },
    {
      id: 'strategy-1',
      type: 'progressive',
      position: { x: 100, y: 200 },
      data: {
        id: 'strategy-1',
        name: 'Argument by Decomposition',
        description: 'Break down into subsystems',
        long_description:
          'Decompose the system safety argument into individual subsystem safety arguments for perception, planning, and control.',
      },
      nodeType: 'strategy',
    },
    {
      id: 'strategy-2',
      type: 'progressive',
      position: { x: 400, y: 200 },
      data: {
        id: 'strategy-2',
        name: 'Argument by Hazard Analysis',
        description: 'Identify and mitigate hazards',
        long_description:
          'Systematically identify all potential hazards and demonstrate appropriate mitigation strategies for each.',
      },
      nodeType: 'strategy',
    },
    {
      id: 'claim-1',
      type: 'controlled',
      position: { x: 50, y: 350 },
      data: {
        id: 'claim-1',
        name: 'Perception is Reliable',
        description: 'Sensor fusion provides accurate world model',
        long_description:
          'The perception subsystem accurately detects and classifies objects in the environment with 99.9% accuracy under nominal conditions.',
      },
      nodeType: 'propertyClaim',
    },
    {
      id: 'claim-2',
      type: 'controlled',
      position: { x: 250, y: 350 },
      data: {
        id: 'claim-2',
        name: 'Planning is Safe',
        description: 'Path planning avoids collisions',
        long_description:
          'The planning subsystem generates collision-free trajectories that respect all traffic rules and safety constraints.',
      },
      nodeType: 'propertyClaim',
    },
    {
      id: 'claim-3',
      type: 'collapsible',
      position: { x: 450, y: 350 },
      data: {
        id: 'claim-3',
        name: 'Control is Stable',
        description: 'Vehicle control maintains stability',
        long_description:
          'The control subsystem maintains vehicle stability and responds appropriately to all planning commands.',
      },
      nodeType: 'propertyClaim',
    },
    {
      id: 'evidence-1',
      type: 'collapsible',
      position: { x: 50, y: 500 },
      data: {
        id: 'evidence-1',
        name: 'Sensor Test Results',
        description: 'Test report showing 99.9% accuracy',
        long_description:
          'Comprehensive testing results demonstrating perception accuracy across 10,000+ test scenarios.',
      },
      nodeType: 'evidence',
    },
    {
      id: 'evidence-2',
      type: 'collapsible',
      position: { x: 250, y: 500 },
      data: {
        id: 'evidence-2',
        name: 'Simulation Results',
        description: 'Million mile simulation with zero collisions',
        long_description:
          'Results from 1 million miles of simulated driving with zero collision events.',
      },
      nodeType: 'evidence',
    },
  ];

  const edges = [
    {
      id: 'e-goal-1-strategy-1',
      source: 'goal-1',
      target: 'strategy-1',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-goal-1-strategy-2',
      source: 'goal-1',
      target: 'strategy-2',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-strategy-1-claim-1',
      source: 'strategy-1',
      target: 'claim-1',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-strategy-1-claim-2',
      source: 'strategy-1',
      target: 'claim-2',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-strategy-1-claim-3',
      source: 'strategy-1',
      target: 'claim-3',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-claim-1-evidence-1',
      source: 'claim-1',
      target: 'evidence-1',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
    {
      id: 'e-claim-2-evidence-2',
      source: 'claim-2',
      target: 'evidence-2',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    },
  ];

  return { nodes, edges };
};

/**
 * Demo Controls Component
 * Shows advanced controls using the node state context
 */
const DemoControls = () => {
  const {
    expandAll,
    collapseAll,
    focusMode,
    expandPathToNode,
    expandNodeTree,
    resetAll,
    getStats,
    allNodeIds,
  } = useNodeStateContext();

  const stats = getStats();

  const handleFocusGoal = useCallback(() => {
    focusMode(['goal-1'], allNodeIds);
  }, [focusMode, allNodeIds]);

  const handleExpandGoalTree = useCallback(() => {
    expandNodeTree('goal-1');
  }, [expandNodeTree]);

  const handleExpandToEvidence = useCallback(() => {
    expandPathToNode('evidence-1');
  }, [expandPathToNode]);

  return (
    <div className="absolute top-4 left-4 z-10 space-y-2">
      {/* State Manager Built-in Controls */}
      <NodeStateControls />

      {/* Advanced Demo Controls */}
      <div
        className="
          p-3
          bg-background-transparent-black
          f-effect-backdrop-blur-lg
          border border-transparent
          rounded-lg
          shadow-glassmorphic
          space-y-2
        "
      >
        <div className="text-xs font-semibold text-text-light mb-2">
          Advanced Controls
        </div>

        <button
          onClick={handleFocusGoal}
          className="
            w-full px-3 py-1.5
            text-xs font-medium
            text-text-light
            bg-background-transparent-white-hover
            hover:bg-background-transparent-white-secondaryHover
            rounded-md
            transition-colors
            duration-200
          "
          title="Focus on goal node only"
        >
          Focus on Goal
        </button>

        <button
          onClick={handleExpandGoalTree}
          className="
            w-full px-3 py-1.5
            text-xs font-medium
            text-text-light
            bg-background-transparent-white-hover
            hover:bg-background-transparent-white-secondaryHover
            rounded-md
            transition-colors
            duration-200
          "
          title="Expand entire goal tree"
        >
          Expand Goal Tree
        </button>

        <button
          onClick={handleExpandToEvidence}
          className="
            w-full px-3 py-1.5
            text-xs font-medium
            text-text-light
            bg-background-transparent-white-hover
            hover:bg-background-transparent-white-secondaryHover
            rounded-md
            transition-colors
            duration-200
          "
          title="Show path to evidence"
        >
          Show Path to Evidence
        </button>

        <button
          onClick={resetAll}
          className="
            w-full px-3 py-1.5
            text-xs font-medium
            text-text-light/70
            hover:text-text-light
            bg-transparent
            hover:bg-background-transparent-white-hover
            rounded-md
            transition-colors
            duration-200
          "
          title="Reset all states"
        >
          Reset All
        </button>
      </div>

      {/* Instructions */}
      <div
        className="
          p-3
          bg-background-transparent-black
          f-effect-backdrop-blur-lg
          border border-transparent
          rounded-lg
          shadow-glassmorphic
          text-xs
          text-text-light/70
          space-y-1
        "
      >
        <div className="font-semibold text-text-light mb-1">
          Interaction Guide
        </div>
        <div>• Click node to expand/collapse</div>
        <div>• Double-click to expand tree</div>
        <div>• Select node to auto-expand</div>
        <div>• Progressive nodes reveal children</div>
        <div>• Controlled nodes show extra controls</div>
      </div>
    </div>
  );
};

/**
 * CollapsibleNodeDemo Flow Component
 */
const CollapsibleNodeDemoFlow = () => {
  const { nodes, edges } = useMemo(() => createDemoData(), []);

  const handleNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
  }, []);

  return (
    <div className="w-full h-[800px] bg-gray-950 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={demoNodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        className="bg-gray-950"
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
          color="rgba(255, 255, 255, 0.1)"
        />
        <Controls
          className="
            bg-background-transparent-black
            f-effect-backdrop-blur-lg
            border border-transparent
            rounded-lg
          "
        />
        <MiniMap
          className="
            bg-background-transparent-black
            f-effect-backdrop-blur-lg
            border border-transparent
            rounded-lg
          "
          nodeColor={(node) => {
            const colors = {
              goal: '#10b981',
              strategy: '#a855f7',
              propertyClaim: '#f97316',
              evidence: '#06b6d4',
              context: '#6b7280',
            };
            return colors[node.nodeType] || '#6b7280';
          }}
        />

        {/* Demo Controls */}
        <DemoControls />
      </ReactFlow>
    </div>
  );
};

/**
 * Main Demo Component with State Manager
 */
const CollapsibleNodeDemo = ({ persistKey = 'collapsible-demo' }) => {
  const handleStateChange = useCallback((event) => {
    console.log('Node state changed:', event);
  }, []);

  return (
    <div className="w-full p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">
          Collapsible Node System Demo
        </h2>
        <p className="text-gray-400">
          Interactive demonstration of the collapsible node system with state
          management, progressive disclosure, and advanced controls.
        </p>
      </div>

      <ReactFlowProvider>
        <NodeStateManager
          persistKey={persistKey}
          defaultExpanded={false}
          onStateChange={handleStateChange}
        >
          <CollapsibleNodeDemoFlow />
        </NodeStateManager>
      </ReactFlowProvider>

      {/* Feature Highlights */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-100 mb-2">
            State Management
          </h3>
          <p className="text-xs text-gray-400">
            Centralized state with localStorage persistence and bulk operations
          </p>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-100 mb-2">
            Progressive Disclosure
          </h3>
          <p className="text-xs text-gray-400">
            Auto-reveal connected nodes with smooth transitions and animations
          </p>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-100 mb-2">
            Focus Mode
          </h3>
          <p className="text-xs text-gray-400">
            Collapse all except selected path for better information density
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollapsibleNodeDemo;
