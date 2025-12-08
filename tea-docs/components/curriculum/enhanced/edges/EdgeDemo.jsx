/**
 * Edge Demo Component
 *
 * Comprehensive demonstration of all edge types with interactive controls
 * and visual examples. Shows different edge styles, animations, and configurations.
 *
 * @module EdgeDemo
 */

import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import {
  edgeTypes,
  edgeStylePresets,
  applyEdgePreset,
} from './index';

/**
 * Initial demo nodes
 */
const initialNodes = [
  // Animated edges demo
  {
    id: 'animated-1',
    type: 'default',
    position: { x: 50, y: 50 },
    data: { label: 'Animated Start' },
  },
  {
    id: 'animated-2',
    type: 'default',
    position: { x: 300, y: 50 },
    data: { label: 'Animated End' },
  },

  // Gradient edges demo
  {
    id: 'gradient-1',
    type: 'default',
    position: { x: 50, y: 150 },
    data: { label: 'Gradient Start' },
  },
  {
    id: 'gradient-2',
    type: 'default',
    position: { x: 300, y: 150 },
    data: { label: 'Gradient End' },
  },

  // Glowing edges demo
  {
    id: 'glow-1',
    type: 'default',
    position: { x: 50, y: 250 },
    data: { label: 'Glow Start' },
  },
  {
    id: 'glow-2',
    type: 'default',
    position: { x: 300, y: 250 },
    data: { label: 'Glow End' },
  },

  // Flowing edges demo
  {
    id: 'flow-1',
    type: 'default',
    position: { x: 50, y: 350 },
    data: { label: 'Flow Start' },
  },
  {
    id: 'flow-2',
    type: 'default',
    position: { x: 300, y: 350 },
    data: { label: 'Flow End' },
  },

  // Smart edges demo
  {
    id: 'smart-1',
    type: 'default',
    position: { x: 50, y: 450 },
    data: { label: 'Smart Start' },
  },
  {
    id: 'smart-2',
    type: 'default',
    position: { x: 300, y: 450 },
    data: { label: 'Smart End' },
  },

  // Complex network
  {
    id: 'center',
    type: 'default',
    position: { x: 550, y: 250 },
    data: { label: 'Hub Node' },
  },
  {
    id: 'top',
    type: 'default',
    position: { x: 550, y: 50 },
    data: { label: 'Top' },
  },
  {
    id: 'right',
    type: 'default',
    position: { x: 750, y: 250 },
    data: { label: 'Right' },
  },
  {
    id: 'bottom',
    type: 'default',
    position: { x: 550, y: 450 },
    data: { label: 'Bottom' },
  },
  {
    id: 'left',
    type: 'default',
    position: { x: 350, y: 250 },
    data: { label: 'Left' },
  },
];

/**
 * Initial demo edges showcasing different types
 */
const initialEdges = [
  // Animated edges
  {
    id: 'e-animated-1',
    source: 'animated-1',
    target: 'animated-2',
    type: 'animated',
    label: 'Animated',
    data: {
      label: 'Animated Edge',
      animated: true,
    },
  },

  // Gradient edges
  {
    id: 'e-gradient-1',
    source: 'gradient-1',
    target: 'gradient-2',
    type: 'gradient',
    data: {
      label: 'Gradient',
      sourceColor: '#3b82f6',
      targetColor: '#8b5cf6',
      gradientStops: 3,
    },
  },

  // Glowing edges
  {
    id: 'e-glow-1',
    source: 'glow-1',
    target: 'glow-2',
    type: 'neon',
    data: {
      label: 'Neon Glow',
      color: '#10b981',
    },
  },

  // Flowing edges
  {
    id: 'e-flow-1',
    source: 'flow-1',
    target: 'flow-2',
    type: 'flowing',
    data: {
      label: 'Data Flow',
      particleCount: 4,
      flowSpeed: 1,
    },
  },

  // Smart edges
  {
    id: 'e-smart-1',
    source: 'smart-1',
    target: 'smart-2',
    type: 'smart',
    data: {
      label: 'Smart Edge',
      strength: 0.8,
      showStrengthIndicator: true,
    },
  },

  // Complex network with different types
  {
    id: 'e-center-top',
    source: 'center',
    target: 'top',
    type: 'strongConnection',
    data: { label: 'Strong', strength: 1 },
  },
  {
    id: 'e-center-right',
    source: 'center',
    target: 'right',
    type: 'gradient',
    data: {
      sourceColor: '#3b82f6',
      targetColor: '#f59e0b',
    },
  },
  {
    id: 'e-center-bottom',
    source: 'center',
    target: 'bottom',
    type: 'dataStream',
    data: { particleCount: 6 },
  },
  {
    id: 'e-center-left',
    source: 'center',
    target: 'left',
    type: 'weakConnection',
    data: { label: 'Weak', strength: 0.3 },
  },
];

/**
 * EdgeDemo Component
 */
const EdgeDemo = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedPreset, setSelectedPreset] = useState('modern');

  // Handle new connections
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        type: 'smart',
        data: { label: 'New Connection' },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Apply preset to all edges
  const applyPresetToAll = (presetName) => {
    setSelectedPreset(presetName);
    setEdges((edges) =>
      edges.map((edge) => applyEdgePreset(edge, presetName))
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-950">
      {/* Control Panel */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-4 bg-black/80 backdrop-blur-lg border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">
            Enhanced Edges Demo
          </h1>

          {/* Preset Selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-400 self-center mr-2">
              Edge Presets:
            </span>
            {Object.keys(edgeStylePresets).map((preset) => (
              <button
                key={preset}
                onClick={() => applyPresetToAll(preset)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${
                    selectedPreset === preset
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }
                `}
              >
                {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span>Animated</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <span>Gradient</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500 shadow-lg shadow-green-500/50"></div>
              <span>Glowing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-purple-500"></div>
              <span>• • • Flowing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-amber-500"></div>
              <span>Smart</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* React Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          edgeTypes={edgeTypes}
          fitView
          className="bg-gray-950"
          defaultEdgeOptions={{
            animated: true,
          }}
        >
          <Background
            color="#374151"
            gap={20}
            size={1}
            variant="dots"
          />
          <Controls className="bg-black/80 backdrop-blur-lg border border-white/10" />
          <MiniMap
            className="bg-black/80 backdrop-blur-lg border border-white/10"
            nodeColor={(node) => {
              return '#3b82f6';
            }}
          />
        </ReactFlow>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-4 left-4 p-4 bg-black/80 backdrop-blur-lg
                     border border-white/10 rounded-lg text-sm text-gray-300 max-w-sm"
        >
          <h3 className="font-semibold text-white mb-2">Instructions</h3>
          <ul className="space-y-1 text-xs">
            <li>• Hover over edges to see hover effects</li>
            <li>• Click edges to select them</li>
            <li>• Try different presets from the top panel</li>
            <li>• Drag nodes to see dynamic edge recalculation</li>
            <li>• Connect nodes to create new edges</li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
};

/**
 * Simple Edge Showcase
 * Minimal demo showing all edge types side by side
 */
export const SimpleEdgeShowcase = () => {
  const showcaseNodes = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Source' } },
    { id: '2', position: { x: 250, y: 0 }, data: { label: 'Target' } },
  ];

  const edgeTypesList = [
    'animated',
    'gradient',
    'glowing',
    'flowing',
    'smart',
    'neon',
    'dataStream',
    'strongConnection',
  ];

  const showcaseEdges = edgeTypesList.map((type, index) => ({
    id: `edge-${index}`,
    source: '1',
    target: '2',
    type,
    data: {
      label: type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1'),
    },
    style: {
      transform: `translateY(${index * 80}px)`,
    },
  }));

  return (
    <div className="w-full h-screen bg-gray-950">
      <ReactFlow
        nodes={showcaseNodes}
        edges={showcaseEdges}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#374151" gap={20} size={1} variant="dots" />
      </ReactFlow>
    </div>
  );
};

export default EdgeDemo;
