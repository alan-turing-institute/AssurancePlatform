/**
 * Handle Showcase Component
 *
 * Comprehensive demonstration of all handle types and their features.
 * Displays CustomHandle, AnimatedHandle, SmartHandle, MultiHandle,
 * and ConditionalHandle with various configurations.
 *
 * @component
 * @example
 * <HandleShowcase />
 */

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  Position,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Import all handle types
import CustomHandle from '../handles/CustomHandle';
import AnimatedHandle, {
  PulseHandle,
  GlowHandle,
  SpringHandle,
  BreatheHandle,
  ParticleHandle,
} from '../handles/AnimatedHandle';
import SmartHandle, {
  AutoHideHandle,
  HoverShowHandle,
  AndGateHandle,
  OrGateHandle,
} from '../handles/SmartHandle';
import MultiHandle, {
  FanOutHandle,
  StackedHandle,
  GroupedHandle,
  LimitedMultiHandle,
} from '../handles/MultiHandle';
import ConditionalHandle, {
  ApprovedHandle,
  LockedHandle,
  ErrorHandle,
  PendingHandle,
  DependencyHandle,
} from '../handles/ConditionalHandle';

/**
 * Custom node component for showcasing handles
 */
const ShowcaseNode = ({ data, id, isConnectable }) => {
  return (
    <div
      className="
        px-4 py-3
        bg-white
        border-2 border-gray-300
        rounded-xl
        shadow-lg
        min-w-[200px]
        text-center
      "
    >
      <div className="font-semibold text-gray-800 mb-1">{data.label}</div>
      {data.description && (
        <div className="text-xs text-gray-600">{data.description}</div>
      )}

      {/* Render handles based on node configuration */}
      {data.handles &&
        data.handles.map((handle, index) => {
          const HandleComponent = handle.component;
          return (
            <HandleComponent
              key={`${handle.type}-${handle.position}-${index}`}
              type={handle.type}
              position={handle.position}
              nodeId={id}
              id={handle.id || `${handle.type}-${index}`}
              isConnectable={isConnectable}
              {...handle.props}
            />
          );
        })}
    </div>
  );
};

const nodeTypes = {
  showcase: ShowcaseNode,
};

/**
 * Initial nodes configuration
 */
const getInitialNodes = () => [
  // Row 1: CustomHandle variants
  {
    id: 'custom-basic',
    type: 'showcase',
    position: { x: 50, y: 50 },
    data: {
      label: 'Basic CustomHandle',
      description: 'Standard + button',
      handles: [
        {
          component: CustomHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'custom-connected',
    type: 'showcase',
    position: { x: 300, y: 50 },
    data: {
      label: 'Connected State',
      description: 'Shows connection badge',
      handles: [
        {
          component: CustomHandle,
          type: 'source',
          position: Position.Bottom,
          props: {
            isConnected: true,
            connectionCount: 3,
            showBadge: true,
          },
        },
      ],
    },
  },
  {
    id: 'custom-limited',
    type: 'showcase',
    position: { x: 550, y: 50 },
    data: {
      label: 'Connection Limit',
      description: 'Max 5 connections',
      handles: [
        {
          component: CustomHandle,
          type: 'source',
          position: Position.Bottom,
          props: {
            connectionCount: 4,
            maxConnections: 5,
            showBadge: true,
          },
        },
      ],
    },
  },
  {
    id: 'custom-validation',
    type: 'showcase',
    position: { x: 800, y: 50 },
    data: {
      label: 'With Validation',
      description: 'Valid connection',
      handles: [
        {
          component: CustomHandle,
          type: 'source',
          position: Position.Bottom,
          props: {
            validation: { valid: true, message: 'Compatible connection' },
          },
        },
      ],
    },
  },

  // Row 2: AnimatedHandle variants
  {
    id: 'animated-pulse',
    type: 'showcase',
    position: { x: 50, y: 200 },
    data: {
      label: 'Pulse Animation',
      description: 'Continuous pulse',
      handles: [
        {
          component: PulseHandle,
          type: 'source',
          position: Position.Bottom,
          props: { colorTheme: 'blue' },
        },
      ],
    },
  },
  {
    id: 'animated-glow',
    type: 'showcase',
    position: { x: 300, y: 200 },
    data: {
      label: 'Glow Effect',
      description: 'High intensity glow',
      handles: [
        {
          component: GlowHandle,
          type: 'source',
          position: Position.Bottom,
          props: { colorTheme: 'purple' },
        },
      ],
    },
  },
  {
    id: 'animated-spring',
    type: 'showcase',
    position: { x: 550, y: 200 },
    data: {
      label: 'Spring Animation',
      description: 'Bouncy hover effect',
      handles: [
        {
          component: SpringHandle,
          type: 'source',
          position: Position.Bottom,
          props: { colorTheme: 'green' },
        },
      ],
    },
  },
  {
    id: 'animated-particle',
    type: 'showcase',
    position: { x: 800, y: 200 },
    data: {
      label: 'Particle Effects',
      description: 'Hover for particles',
      handles: [
        {
          component: ParticleHandle,
          type: 'source',
          position: Position.Bottom,
          props: { colorTheme: 'cyan' },
        },
      ],
    },
  },

  // Row 3: SmartHandle variants
  {
    id: 'smart-basic',
    type: 'showcase',
    position: { x: 50, y: 350 },
    data: {
      label: 'Smart Handle',
      description: 'Auto compatibility check',
      handles: [
        {
          component: SmartHandle,
          type: 'source',
          position: Position.Bottom,
          props: {
            nodeType: 'goal',
            compatibleTypes: ['strategy', 'evidence'],
            showCompatibilityIndicator: true,
          },
        },
      ],
    },
  },
  {
    id: 'smart-autohide',
    type: 'showcase',
    position: { x: 300, y: 350 },
    data: {
      label: 'Auto-hide Handle',
      description: 'Shows on interaction',
      handles: [
        {
          component: AutoHideHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'smart-and',
    type: 'showcase',
    position: { x: 550, y: 350 },
    data: {
      label: 'AND Gate',
      description: 'Requires all inputs',
      handles: [
        {
          component: AndGateHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'smart-or',
    type: 'showcase',
    position: { x: 800, y: 350 },
    data: {
      label: 'OR Gate',
      description: 'Any input works',
      handles: [
        {
          component: OrGateHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },

  // Row 4: MultiHandle variants
  {
    id: 'multi-basic',
    type: 'showcase',
    position: { x: 50, y: 500 },
    data: {
      label: 'Multi Handle',
      description: 'Multiple connections',
      handles: [
        {
          component: MultiHandle,
          type: 'source',
          position: Position.Bottom,
          props: {
            maxConnections: 5,
            fanOutLayout: true,
          },
        },
      ],
    },
  },
  {
    id: 'multi-fanout',
    type: 'showcase',
    position: { x: 300, y: 500 },
    data: {
      label: 'Fan-out Layout',
      description: 'Visual connection spread',
      handles: [
        {
          component: FanOutHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'multi-stacked',
    type: 'showcase',
    position: { x: 550, y: 500 },
    data: {
      label: 'Stacked Connections',
      description: 'Radial stack display',
      handles: [
        {
          component: StackedHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'multi-limited',
    type: 'showcase',
    position: { x: 800, y: 500 },
    data: {
      label: 'Limited (3 max)',
      description: 'Connection limit',
      handles: [
        {
          component: LimitedMultiHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },

  // Row 5: ConditionalHandle variants
  {
    id: 'conditional-active',
    type: 'showcase',
    position: { x: 50, y: 650 },
    data: {
      label: 'Active State',
      description: 'Ready to connect',
      handles: [
        {
          component: ConditionalHandle,
          type: 'source',
          position: Position.Bottom,
          props: { state: 'active' },
        },
      ],
    },
  },
  {
    id: 'conditional-locked',
    type: 'showcase',
    position: { x: 300, y: 650 },
    data: {
      label: 'Locked State',
      description: 'Requires unlock',
      handles: [
        {
          component: LockedHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'conditional-error',
    type: 'showcase',
    position: { x: 550, y: 650 },
    data: {
      label: 'Error State',
      description: 'Validation failed',
      handles: [
        {
          component: ErrorHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
  {
    id: 'conditional-pending',
    type: 'showcase',
    position: { x: 800, y: 650 },
    data: {
      label: 'Pending State',
      description: 'Processing...',
      handles: [
        {
          component: PendingHandle,
          type: 'source',
          position: Position.Bottom,
          props: {},
        },
      ],
    },
  },
];

const initialEdges = [];

/**
 * HandleShowcase Component
 */
const HandleShowcase = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-screen bg-gray-50">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 z-10 bg-white rounded-lg shadow-lg p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Enhanced Handle Components Showcase
        </h1>
        <p className="text-sm text-gray-600">
          Demonstrating all handle variants with their unique features and
          animations. Try connecting nodes and hovering over handles to see
          interactive behaviors.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
            CustomHandle
          </span>
          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
            AnimatedHandle
          </span>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
            SmartHandle
          </span>
          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
            MultiHandle
          </span>
          <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
            ConditionalHandle
          </span>
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 120, zoom: 0.8 }}
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            return '#ffffff';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
};

/**
 * Wrapper with ReactFlowProvider
 */
const HandleShowcaseWrapper = () => {
  return (
    <ReactFlowProvider>
      <HandleShowcase />
    </ReactFlowProvider>
  );
};

export default HandleShowcaseWrapper;
