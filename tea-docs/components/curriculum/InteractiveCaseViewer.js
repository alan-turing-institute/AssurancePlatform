import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import { motion } from 'framer-motion';
import { getLayoutedElements } from '../../lib/layout-helper';
import {
  ChevronRight,
  Info,
  Target,
  GitBranch,
  FileText,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Maximize2
} from 'lucide-react';
import 'reactflow/dist/style.css';

// Custom node components for different element types
const GoalNode = ({ data, isSelected }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-green-400 bg-green-50 dark:bg-green-900/20'
      } cursor-pointer hover:shadow-xl transition-all`}
    >
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
        <div className="font-bold text-gray-900 dark:text-gray-100">{data.name}</div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {data.description}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  );
};

const StrategyNode = ({ data, isSelected }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
      } cursor-pointer hover:shadow-xl transition-all`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <div className="font-bold text-gray-900 dark:text-gray-100">{data.name}</div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {data.description}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  );
};

const PropertyClaimNode = ({ data, isSelected }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-orange-400 bg-orange-50 dark:bg-orange-900/20'
      } cursor-pointer hover:shadow-xl transition-all`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        <div className="font-bold text-gray-900 dark:text-gray-100">{data.name}</div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {data.description}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </motion.div>
  );
};

const EvidenceNode = ({ data, isSelected }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20'
      } cursor-pointer hover:shadow-xl transition-all`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        <div className="font-bold text-gray-900 dark:text-gray-100">{data.name}</div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {data.description}
      </div>
    </motion.div>
  );
};

const ContextNode = ({ data, isSelected }) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 max-w-sm ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-400 bg-gray-50 dark:bg-gray-900/20'
      } cursor-pointer hover:shadow-xl transition-all`}
    >
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <div className="font-bold text-gray-900 dark:text-gray-100">{data.name}</div>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {data.description}
      </div>
    </motion.div>
  );
};

const nodeTypes = {
  goal: GoalNode,
  strategy: StrategyNode,
  propertyClaimNode: PropertyClaimNode,
  evidence: EvidenceNode,
  context: ContextNode,
};

// Control buttons component that uses useReactFlow
const ControlButtons = ({ nodes, edges, setNodes, setEdges, setRevealedNodes }) => {
  const { fitView } = useReactFlow();

  const handleAutoLayout = useCallback(() => {
    // Apply Dagre layout to arrange nodes
    const layouted = getLayoutedElements(nodes, edges, { direction: 'TB' });

    // Update nodes with new positions
    setNodes(layouted.nodes);
    setEdges(layouted.edges);

    // Fit view to show all nodes after layout
    window.requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 400 });
    });
  }, [nodes, edges, setNodes, setEdges, fitView]);

  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2">
      <button
        onClick={() => setRevealedNodes(new Set(nodes.map(n => n.id)))}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-1"
      >
        <Eye className="w-4 h-4" />
        Reveal All
      </button>
      <button
        onClick={() => setRevealedNodes(new Set(['goal-1']))}
        className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition flex items-center gap-1"
      >
        <EyeOff className="w-4 h-4" />
        Reset
      </button>
      <button
        onClick={handleAutoLayout}
        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center gap-1"
      >
        <Maximize2 className="w-4 h-4" />
        Auto Layout
      </button>
    </div>
  );
};

// Main Interactive Case Viewer Component
const InteractiveCaseViewer = ({
  caseData,
  onNodeClick,
  guidedPath = [],
  showAllNodes = false,
  highlightedNodes = [],
  enableExploration = true
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [revealedNodes, setRevealedNodes] = useState(new Set(['goal-1']));
  const [showLegend, setShowLegend] = useState(false);

  // Convert case data to ReactFlow nodes and edges
  useEffect(() => {
    console.log('InteractiveCaseViewer received caseData:', caseData);
    if (!caseData) {
      console.log('No caseData provided to InteractiveCaseViewer');
      return;
    }

    const flowNodes = [];
    const flowEdges = [];
    let yOffset = 0;
    const xSpacing = 500;
    const ySpacing = 180;

    // Add goal node
    if (caseData.goals && caseData.goals[0]) {
      const goal = caseData.goals[0];
      flowNodes.push({
        id: 'goal-1',
        type: 'goal',
        position: { x: 400, y: yOffset },
        data: {
          name: goal.name,
          description: goal.description,
          element: goal
        },
      });
      yOffset += ySpacing;

      // Add context nodes
      if (goal.context) {
        goal.context.forEach((ctx, idx) => {
          flowNodes.push({
            id: `context-${idx + 1}`,
            type: 'context',
            position: { x: 100 + idx * 200, y: yOffset },
            data: {
              name: ctx.name,
              description: ctx.description,
              element: ctx
            },
          });
        });
      }

      // Add strategies
      if (goal.strategies) {
        goal.strategies.forEach((strategy, stratIdx) => {
          const strategyId = `strategy-${stratIdx + 1}`;
          flowNodes.push({
            id: strategyId,
            type: 'strategy',
            position: { x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
            data: {
              name: strategy.name,
              description: strategy.description,
              element: strategy
            },
          });

          // Add edge from goal to strategy
          flowEdges.push({
            id: `goal-${strategyId}`,
            source: 'goal-1',
            target: strategyId,
            type: 'smoothstep',
            animated: guidedPath.includes(strategyId),
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          });

          // Add property claims for each strategy
          if (strategy.property_claims) {
            strategy.property_claims.forEach((claim, claimIdx) => {
              const claimId = `claim-${stratIdx}-${claimIdx + 1}`;
              flowNodes.push({
                id: claimId,
                type: 'propertyClaimNode',
                position: {
                  x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                  y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150
                },
                data: {
                  name: claim.name,
                  description: claim.description,
                  element: claim
                },
              });

              // Add edge from strategy to claim
              flowEdges.push({
                id: `${strategyId}-${claimId}`,
                source: strategyId,
                target: claimId,
                type: 'smoothstep',
                animated: guidedPath.includes(claimId),
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                },
              });

              // Add evidence for claims
              if (claim.evidence) {
                claim.evidence.forEach((evid, evidIdx) => {
                  const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;
                  flowNodes.push({
                    id: evidId,
                    type: 'evidence',
                    position: {
                      x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                      y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150
                    },
                    data: {
                      name: evid.name,
                      description: evid.description,
                      element: evid
                    },
                  });

                  // Add edge from claim to evidence
                  flowEdges.push({
                    id: `${claimId}-${evidId}`,
                    source: claimId,
                    target: evidId,
                    type: 'smoothstep',
                    animated: guidedPath.includes(evidId),
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                    },
                  });
                });
              }
            });
          }
        });
      }
    }

    // Apply progressive disclosure if not showing all nodes
    const visibleNodes = showAllNodes
      ? flowNodes
      : flowNodes.map(node => ({
          ...node,
          hidden: !revealedNodes.has(node.id) && !guidedPath.includes(node.id)
        }));

    setNodes(visibleNodes);
    setEdges(flowEdges);
  }, [caseData, showAllNodes, revealedNodes, guidedPath]);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);

    // Toggle visibility of connected nodes on click
    if (enableExploration && !showAllNodes) {
      const newRevealed = new Set(revealedNodes);
      newRevealed.add(node.id);

      // Find all child nodes
      const childNodes = edges
        .filter(edge => edge.source === node.id)
        .map(edge => edge.target);

      // Check if all children are currently visible
      const allChildrenVisible = childNodes.length > 0 &&
        childNodes.every(childId => revealedNodes.has(childId));

      if (allChildrenVisible) {
        // Hide children
        childNodes.forEach(childId => {
          newRevealed.delete(childId);
        });
      } else {
        // Show children
        childNodes.forEach(childId => {
          newRevealed.add(childId);
        });
      }

      setRevealedNodes(newRevealed);
    }

    // Call parent handler if provided
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [enableExploration, showAllNodes, revealedNodes, edges, onNodeClick]);

  return (
    <div className="relative w-full h-[600px] border rounded-lg shadow-lg bg-white dark:bg-gray-900">

      {/* Legend Toggle */}
      <div className="absolute top-4 right-4 z-10">
        {showLegend ? (
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">Element Types</h3>
              <button
                onClick={() => setShowLegend(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label="Hide legend"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-600" />
                <span>Goal</span>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-600" />
                <span>Strategy</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>Property Claim</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-600" />
                <span>Evidence</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-gray-600" />
                <span>Context</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLegend(true)}
            className="p-2 bg-white dark:bg-gray-800 rounded shadow-lg hover:shadow-xl transition"
            aria-label="Show element types legend"
            title="Show element types"
          >
            <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* ReactFlow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <ControlButtons
          nodes={nodes}
          edges={edges}
          setNodes={setNodes}
          setEdges={setEdges}
          setRevealedNodes={setRevealedNodes}
        />
        <Background variant="dots" gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default InteractiveCaseViewer;
