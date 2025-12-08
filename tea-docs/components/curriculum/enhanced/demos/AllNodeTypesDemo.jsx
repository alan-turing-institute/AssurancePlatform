/**
 * All Node Types Demo
 *
 * Comprehensive demonstration of all enhanced node types with their unique
 * features, styling, and interactions. This demo showcases:
 *
 * - GoalNode with green theme and progress tracking
 * - StrategyNode with purple theme and skewed design
 * - PropertyClaimNode with orange theme and verification status
 * - EvidenceNode with cyan theme and confidence levels
 * - ContextNode with gray theme and importance indicators
 *
 * Usage:
 * This demo can be used in Docusaurus MDX pages or as a standalone component
 * for testing and documentation purposes.
 *
 * @component
 * @example
 * // In an MDX file:
 * import AllNodeTypesDemo from '@/components/curriculum/enhanced/demos/AllNodeTypesDemo';
 *
 * <AllNodeTypesDemo />
 */

import React, { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes } from '../nodes/nodeTypes';
import { NodeStateManager } from '../nodes/NodeStateManager';

/**
 * Sample nodes demonstrating each node type
 */
const initialNodes = [
  // Goal Node (Root)
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 250, y: 50 },
    data: {
      id: 'goal-1',
      name: 'System Safety Goal',
      description: 'The system shall operate safely under all conditions',
      long_description:
        'This top-level goal ensures that the autonomous vehicle system operates safely under all defined operational conditions, including normal operation, degraded modes, and emergency scenarios.',
      importance: 'critical',
      progress: 75,
      subGoalsCount: 3,
      isRoot: true,
      context: [
        { name: 'Urban driving environment' },
        { name: 'Maximum speed: 50 mph' },
        { name: 'Weather: Clear to light rain' },
      ],
      metadata: {
        owner: 'Safety Team',
        lastReview: '2025-11-01',
        status: 'In Progress',
      },
    },
  },

  // Strategy Node
  {
    id: 'strategy-1',
    type: 'strategy',
    position: { x: 250, y: 250 },
    data: {
      id: 'strategy-1',
      name: 'Decomposition by Component',
      description: 'Argument over each major system component',
      long_description:
        'This strategy decomposes the system safety goal into sub-goals for each major component: perception, planning, and control systems.',
      strategyType: 'AND',
      approach: 'decomposition',
      pathCount: 3,
      rationale:
        'Each component must be safe for the overall system to be safe',
      supportingEvidence: [
        { name: 'System Architecture Document' },
        { name: 'Component Interface Specification' },
      ],
      metadata: {
        author: 'John Doe',
        date: '2025-10-15',
      },
    },
  },

  // Property Claim Node
  {
    id: 'claim-1',
    type: 'propertyClaim',
    position: { x: 100, y: 450 },
    data: {
      id: 'claim-1',
      name: 'Perception System Safety',
      description: 'Perception system correctly identifies obstacles',
      long_description:
        'The perception system shall correctly identify and classify all relevant obstacles with 99.9% accuracy under nominal conditions.',
      strength: 'strong',
      verificationStatus: 'verified',
      linkedEvidenceCount: 4,
      author: 'Jane Smith',
      date: '2025-10-20',
      reviewer: 'Bob Johnson',
      lastUpdated: '2025-11-05',
      assumptions: [
        { name: 'Sensors are properly calibrated' },
        { name: 'Environmental conditions are within spec' },
      ],
      metadata: {
        testCoverage: '95%',
        confidence: 'High',
      },
    },
  },

  // Property Claim Node (Pending)
  {
    id: 'claim-2',
    type: 'propertyClaim',
    position: { x: 400, y: 450 },
    data: {
      id: 'claim-2',
      name: 'Planning System Safety',
      description: 'Planning system generates safe trajectories',
      long_description:
        'The planning system shall generate trajectories that maintain safe distances from all obstacles and respect traffic rules.',
      strength: 'moderate',
      verificationStatus: 'in-review',
      linkedEvidenceCount: 2,
      author: 'Alice Brown',
      date: '2025-11-01',
      metadata: {
        testCoverage: '80%',
        confidence: 'Medium',
      },
    },
  },

  // Evidence Nodes
  {
    id: 'evidence-1',
    type: 'evidence',
    position: { x: 0, y: 650 },
    data: {
      id: 'evidence-1',
      name: 'Perception Test Results',
      description: 'Comprehensive test results for perception system',
      long_description:
        'Test report covering 1000+ scenarios including various lighting conditions, weather, and obstacle types.',
      evidenceType: 'test',
      confidence: 95,
      sourceLink: '#',
      sourceName: 'Test Report v2.3',
      lastUpdated: '2025-11-05',
      quality: 'high',
      author: 'Test Team',
      verifiedBy: 'Quality Assurance',
      tags: ['perception', 'safety', 'validation'],
      metadata: {
        testCases: 1247,
        passRate: '99.2%',
      },
    },
  },

  {
    id: 'evidence-2',
    type: 'evidence',
    position: { x: 200, y: 650 },
    data: {
      id: 'evidence-2',
      name: 'Sensor Calibration Certificate',
      description: 'Third-party sensor calibration documentation',
      evidenceType: 'document',
      confidence: 85,
      sourceLink: '#',
      sourceName: 'Calibration Cert',
      lastUpdated: '2025-10-28',
      quality: 'good',
      author: 'Calibration Lab',
      verifiedBy: 'Chief Engineer',
      tags: ['sensors', 'calibration'],
    },
  },

  {
    id: 'evidence-3',
    type: 'evidence',
    position: { x: 400, y: 650 },
    data: {
      id: 'evidence-3',
      name: 'Planning Algorithm Analysis',
      description: 'Formal analysis of planning algorithms',
      evidenceType: 'analysis',
      confidence: 75,
      quality: 'medium',
      author: 'Research Team',
      lastUpdated: '2025-10-15',
      tags: ['planning', 'formal-methods'],
    },
  },

  // Context Nodes
  {
    id: 'context-1',
    type: 'context',
    position: { x: 550, y: 100 },
    data: {
      id: 'context-1',
      name: 'Operating Environment',
      description: 'System operates in controlled urban environment',
      long_description:
        'The system is designed and tested for operation in urban environments with defined characteristics.',
      contextType: 'assumption',
      importance: 'high',
      relatedNodesCount: 2,
      tooltipContent:
        'This assumption constrains the operational design domain (ODD) of the system.',
      validity: 'Valid for current deployment phase',
      scope: 'Urban areas with speed limits up to 50 mph',
      implications: [
        'Highway operation requires additional validation',
        'Rural roads may have different safety requirements',
      ],
      metadata: {
        validFrom: '2025-01-01',
        reviewDate: '2025-12-31',
      },
    },
  },

  {
    id: 'context-2',
    type: 'context',
    position: { x: 550, y: 300 },
    data: {
      id: 'context-2',
      name: 'Sensor Limitations',
      description: 'LiDAR range limited to 100m',
      contextType: 'constraint',
      importance: 'critical',
      relatedNodesCount: 1,
      tooltipContent:
        'Physical limitation of the sensor hardware that affects detection range.',
      scope: 'All perception-related safety claims',
      implications: [
        'Requires complementary sensor modalities',
        'Speed must be limited to allow safe stopping distance',
      ],
    },
  },

  {
    id: 'context-3',
    type: 'context',
    position: { x: 200, y: 550 },
    data: {
      id: 'context-3',
      name: 'Testing Methodology',
      description: 'Justification for simulation-based testing',
      contextType: 'justification',
      importance: 'medium',
      relatedNodesCount: 3,
      scope: 'All test evidence',
    },
  },
];

/**
 * Sample edges connecting the nodes
 */
const initialEdges = [
  {
    id: 'e-goal-strategy',
    source: 'goal-1',
    target: 'strategy-1',
    animated: true,
    style: { stroke: '#a855f7', strokeWidth: 2 },
  },
  {
    id: 'e-strategy-claim1',
    source: 'strategy-1',
    target: 'claim-1',
    style: { stroke: '#f97316', strokeWidth: 2 },
  },
  {
    id: 'e-strategy-claim2',
    source: 'strategy-1',
    target: 'claim-2',
    style: { stroke: '#f97316', strokeWidth: 2 },
  },
  {
    id: 'e-claim1-evidence1',
    source: 'claim-1',
    target: 'evidence-1',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },
  {
    id: 'e-claim1-evidence2',
    source: 'claim-1',
    target: 'evidence-2',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },
  {
    id: 'e-claim2-evidence3',
    source: 'claim-2',
    target: 'evidence-3',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },
  {
    id: 'e-context1-goal',
    source: 'context-1',
    target: 'goal-1',
    type: 'step',
    style: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '5,5' },
  },
  {
    id: 'e-context2-claim1',
    source: 'context-2',
    target: 'claim-1',
    type: 'step',
    style: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '5,5' },
  },
  {
    id: 'e-context3-claim1',
    source: 'context-3',
    target: 'claim-1',
    type: 'step',
    style: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '5,5' },
  },
];

/**
 * Main demo component
 */
const AllNodeTypesDemo = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeType, setSelectedNodeType] = useState('all');

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Filter nodes by type for demonstration
  const filteredNodes =
    selectedNodeType === 'all'
      ? nodes
      : nodes.filter((node) => node.type === selectedNodeType);

  const filteredEdges =
    selectedNodeType === 'all'
      ? edges
      : edges.filter((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          return (
            sourceNode?.type === selectedNodeType ||
            targetNode?.type === selectedNodeType
          );
        });

  return (
    <div className="w-full h-screen bg-gray-950">
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-10 bg-background-transparent-black-secondaryAlt backdrop-blur-lg border border-transparent rounded-xl p-4 shadow-3d">
        <h3 className="text-text-light font-semibold mb-3">Node Type Filter</h3>
        <div className="flex flex-col gap-2">
          {[
            { id: 'all', label: 'All Nodes', color: 'gray' },
            { id: 'goal', label: 'Goals', color: 'green' },
            { id: 'strategy', label: 'Strategies', color: 'purple' },
            { id: 'propertyClaim', label: 'Claims', color: 'orange' },
            { id: 'evidence', label: 'Evidence', color: 'cyan' },
            { id: 'context', label: 'Context', color: 'gray' },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedNodeType(type.id)}
              className={`
                px-3 py-2 rounded-lg text-sm text-left transition-all
                ${
                  selectedNodeType === type.id
                    ? `bg-${type.color}-500/20 text-${type.color}-300 border border-${type.color}-400/30`
                    : 'bg-background-transparent-white-hover text-text-light hover:bg-background-transparent-white-secondaryHover'
                }
              `}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-border-transparent text-xs text-text-light/50">
          <p>Click nodes to expand/collapse</p>
          <p>Double-click to expand tree</p>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-background-transparent-black-secondaryAlt backdrop-blur-lg border border-transparent rounded-xl p-4 shadow-3d max-w-xs">
        <h3 className="text-text-light font-semibold mb-3">Legend</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-text-light">Goal - System properties</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-text-light">Strategy - Decomposition approach</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-text-light">Claim - Specific claims</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
            <span className="text-text-light">Evidence - Supporting evidence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-text-light">Context - Assumptions/constraints</span>
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <NodeStateManager nodes={filteredNodes} edges={filteredEdges}>
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-gray-950"
          minZoom={0.5}
          maxZoom={2}
        >
          <Background
            color="rgba(255, 255, 255, 0.05)"
            gap={16}
            size={1}
            className="bg-gray-950"
          />
          <Controls className="bg-background-transparent-black backdrop-blur-lg border border-transparent rounded-xl" />
          <MiniMap
            nodeColor={(node) => {
              const colors = {
                goal: '#10b981',
                strategy: '#a855f7',
                propertyClaim: '#f97316',
                evidence: '#06b6d4',
                context: '#6b7280',
              };
              return colors[node.type] || '#6b7280';
            }}
            className="bg-background-transparent-black backdrop-blur-lg border border-transparent rounded-xl"
          />
        </ReactFlow>
      </NodeStateManager>
    </div>
  );
};

export default AllNodeTypesDemo;
