/**
 * Context Menu Demo Component
 *
 * Comprehensive demonstration of all context menu types and features.
 *
 * @module menus/ContextMenuDemo
 */

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  useNodeContextMenu,
  useEdgeContextMenu,
  useCanvasContextMenu,
} from './index';

/**
 * Initial demo nodes
 */
const initialNodes = [
  {
    id: '1',
    type: 'goal',
    position: { x: 250, y: 50 },
    data: {
      name: 'System Safety Goal',
      description: 'The system shall be safe to operate',
      priority: 'critical',
    },
  },
  {
    id: '2',
    type: 'strategy',
    position: { x: 100, y: 200 },
    data: {
      name: 'Argument by Decomposition',
      description: 'Break down into sub-goals',
      strategyType: 'and',
    },
  },
  {
    id: '3',
    type: 'strategy',
    position: { x: 400, y: 200 },
    data: {
      name: 'Argument by Evidence',
      description: 'Support with testing evidence',
      strategyType: 'or',
    },
  },
  {
    id: '4',
    type: 'propertyClaim',
    position: { x: 50, y: 350 },
    data: {
      name: 'Hardware Safety',
      description: 'All hardware components are verified',
      status: 'verified',
    },
  },
  {
    id: '5',
    type: 'propertyClaim',
    position: { x: 200, y: 350 },
    data: {
      name: 'Software Safety',
      description: 'Software meets safety requirements',
      status: 'pending',
    },
  },
  {
    id: '6',
    type: 'evidence',
    position: { x: 350, y: 350 },
    data: {
      name: 'Test Results',
      description: '10,000 test cases executed',
      confidence: 'high',
    },
  },
  {
    id: '7',
    type: 'evidence',
    position: { x: 500, y: 350 },
    data: {
      name: 'Code Review',
      description: 'Independent code review completed',
      confidence: 'medium',
    },
  },
  {
    id: '8',
    type: 'context',
    position: { x: 600, y: 50 },
    data: {
      name: 'Regulatory Context',
      description: 'Must comply with ISO 26262',
      importance: 'critical',
    },
  },
];

/**
 * Initial demo edges
 */
const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep' },
  { id: 'e2-4', source: '2', target: '4', type: 'smoothstep' },
  { id: 'e2-5', source: '2', target: '5', type: 'smoothstep' },
  { id: 'e3-6', source: '3', target: '6', type: 'smoothstep' },
  { id: 'e3-7', source: '3', target: '7', type: 'smoothstep' },
  { id: 'e1-8', source: '1', target: '8', type: 'straight', style: { strokeDasharray: '5 5' } },
];

/**
 * Custom node component with context menu indicator
 */
const CustomNode = ({ data, selected }) => {
  const nodeTypes = {
    goal: { color: 'bg-green-500/20 border-green-400/50', icon: 'G' },
    strategy: { color: 'bg-purple-500/20 border-purple-400/50', icon: 'S' },
    propertyClaim: { color: 'bg-orange-500/20 border-orange-400/50', icon: 'C' },
    evidence: { color: 'bg-cyan-500/20 border-cyan-400/50', icon: 'E' },
    context: { color: 'bg-gray-500/20 border-gray-400/50', icon: 'X' },
  };

  const nodeType = nodeTypes[data.type] || nodeTypes.goal;

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2
        ${nodeType.color}
        ${selected ? 'ring-2 ring-blue-500' : ''}
        min-w-[180px] max-w-[220px]
        bg-background-transparent-black
        f-effect-backdrop-blur-lg
        shadow-md
        cursor-pointer
        transition-all duration-200
        hover:shadow-lg
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
          {nodeType.icon}
        </div>
        <div className="font-semibold text-sm text-white truncate">
          {data.name}
        </div>
      </div>
      <div className="text-xs text-gray-300 line-clamp-2">
        {data.description}
      </div>
      {selected && (
        <div className="mt-2 text-xs text-blue-400">
          Right-click for menu
        </div>
      )}
    </div>
  );
};

/**
 * Node types configuration
 */
const nodeTypes = {
  goal: CustomNode,
  strategy: CustomNode,
  propertyClaim: CustomNode,
  evidence: CustomNode,
  context: CustomNode,
};

/**
 * ContextMenuDemo Component
 */
export const ContextMenuDemo = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map(n => ({ ...n, data: { ...n.data, type: n.type } }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useReactFlow();

  const [actionLog, setActionLog] = useState([]);

  /**
   * Log actions for demonstration
   */
  const logAction = useCallback((action, details) => {
    const timestamp = new Date().toLocaleTimeString();
    setActionLog(prev => [
      { timestamp, action, details },
      ...prev.slice(0, 9), // Keep last 10 actions
    ]);
  }, []);

  /**
   * Custom callbacks for menu actions
   */
  const nodeCallbacks = {
    onEdit: (node) => {
      logAction('Edit Node', `Editing ${node.data.name}`);
      alert(`Edit dialog would open for: ${node.data.name}`);
    },
    onDelete: (node) => {
      logAction('Delete Node', `Deleted ${node.data.name}`);
      setNodes(nodes.filter(n => n.id !== node.id));
      setEdges(edges.filter(e => e.source !== node.id && e.target !== node.id));
    },
    onAddEvidence: (node) => {
      logAction('Add Evidence', `Adding evidence to ${node.data.name}`);
      alert(`Add evidence dialog would open for: ${node.data.name}`);
    },
    onLinkSource: (node) => {
      logAction('Link Source', `Linking source to ${node.data.name}`);
      alert(`Link source dialog would open for: ${node.data.name}`);
    },
    onViewDetails: (node) => {
      logAction('View Details', `Viewing details for ${node.data.name}`);
      alert(`Details dialog would open for: ${node.data.name}`);
    },
  };

  const edgeCallbacks = {
    onEditLabel: (edge) => {
      logAction('Edit Edge Label', `Editing label for edge ${edge.id}`);
      alert(`Edit label dialog would open for edge: ${edge.id}`);
    },
    onAddWaypoint: (edge) => {
      logAction('Add Waypoint', `Adding waypoint to edge ${edge.id}`);
      alert(`Waypoint mode would activate for edge: ${edge.id}`);
    },
  };

  const canvasCallbacks = {
    onCreate: (nodeType, position) => {
      logAction('Create Node', `Creating ${nodeType} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
      const newNode = {
        id: `node-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          name: `New ${nodeType}`,
          description: 'Right-click to edit',
          type: nodeType,
        },
      };
      setNodes([...nodes, newNode]);
    },
    onAutoLayout: (layoutType) => {
      logAction('Auto Layout', `Applying ${layoutType} layout`);
      alert(`Auto layout (${layoutType}) would be applied`);
    },
  };

  /**
   * Initialize context menus
   */
  const {
    handleNodeContextMenu,
    NodeContextMenu,
  } = useNodeContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
    callbacks: nodeCallbacks,
  });

  const {
    handleEdgeContextMenu,
    EdgeContextMenu,
  } = useEdgeContextMenu({
    edges,
    setEdges,
    reactFlowInstance,
    callbacks: edgeCallbacks,
  });

  const {
    handlePaneContextMenu,
    CanvasContextMenu,
  } = useCanvasContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
    callbacks: canvasCallbacks,
  });

  /**
   * Handle connection creation
   */
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds));
      logAction('Create Connection', `Connected ${params.source} to ${params.target}`);
    },
    [setEdges, logAction]
  );

  return (
    <div className="w-full h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-white mb-2">
          Context Menu System Demo
        </h1>
        <p className="text-gray-400 text-sm">
          Right-click on nodes, edges, or canvas to see context menus in action
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-950"
          >
            <Background color="#333" gap={16} />
            <Controls className="bg-gray-800 border-gray-700" />
            <MiniMap
              nodeColor={(node) => {
                const colors = {
                  goal: '#22c55e',
                  strategy: '#a855f7',
                  propertyClaim: '#fb923c',
                  evidence: '#06b6d4',
                  context: '#6b7280',
                };
                return colors[node.type] || '#3b82f6';
              }}
              className="bg-gray-800 border-gray-700"
            />
          </ReactFlow>

          {/* Context Menus */}
          {NodeContextMenu}
          {EdgeContextMenu}
          {CanvasContextMenu}

          {/* Instructions Overlay */}
          <div className="absolute top-4 left-4 bg-background-transparent-black-secondary border border-transparent f-effect-backdrop-blur-lg rounded-lg p-4 max-w-xs shadow-3d">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Quick Guide
            </h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Right-click <strong>nodes</strong> for node actions</li>
              <li>• Right-click <strong>edges</strong> for connection options</li>
              <li>• Right-click <strong>canvas</strong> to create nodes</li>
              <li>• Select multiple nodes for bulk actions</li>
              <li>• Use keyboard shortcuts (E, F, Del)</li>
            </ul>
          </div>
        </div>

        {/* Action Log Sidebar */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Action Log</h2>
            <p className="text-xs text-gray-400 mt-1">
              Recent menu actions
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {actionLog.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                No actions yet. Try right-clicking!
              </div>
            ) : (
              actionLog.map((log, index) => (
                <div
                  key={index}
                  className="bg-gray-800 rounded p-3 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400">
                      {log.timestamp}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {log.action}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {log.details}
                  </div>
                </div>
              ))
            )}
          </div>

          {actionLog.length > 0 && (
            <div className="p-4 border-t border-gray-800">
              <button
                onClick={() => setActionLog([])}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors"
              >
                Clear Log
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ContextMenuDemoWrapper Component
 *
 * Wraps demo with ReactFlowProvider
 */
export const ContextMenuDemoWrapper = () => {
  return (
    <div className="w-full h-screen">
      <ReactFlow>
        <ContextMenuDemo />
      </ReactFlow>
    </div>
  );
};

export default ContextMenuDemo;
