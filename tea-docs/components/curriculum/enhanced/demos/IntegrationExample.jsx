/**
 * Integration Example
 *
 * Shows how to integrate CollapsibleNode system with existing InteractiveCaseViewer.
 * Provides migration path from current implementation to enhanced collapsible nodes.
 *
 * @component
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
  NodeStateManager,
  NodeStateControls,
} from '../nodes';

/**
 * Convert existing node data to collapsible node format
 */
const convertToCollapsibleNodes = (caseData) => {
  if (!caseData || !caseData.goals) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  let yOffset = 0;
  const xSpacing = 500;
  const ySpacing = 180;

  // Process goals
  const goal = caseData.goals[0];
  if (goal) {
    nodes.push({
      id: 'goal-1',
      type: 'collapsible',
      position: { x: 400, y: yOffset },
      data: {
        id: 'goal-1',
        name: goal.name,
        description: goal.short_description || goal.description,
        long_description: goal.long_description || goal.description,
      },
      nodeType: 'goal',
    });
    yOffset += ySpacing;

    // Process strategies
    if (goal.strategies) {
      goal.strategies.forEach((strategy, stratIdx) => {
        const strategyId = `strategy-${stratIdx + 1}`;

        nodes.push({
          id: strategyId,
          type: 'collapsible',
          position: { x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
          data: {
            id: strategyId,
            name: strategy.name,
            description: strategy.short_description || strategy.description,
            long_description: strategy.long_description || strategy.description,
          },
          nodeType: 'strategy',
        });

        edges.push({
          id: `goal-${strategyId}`,
          source: 'goal-1',
          target: strategyId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        });

        // Process property claims
        if (strategy.property_claims) {
          strategy.property_claims.forEach((claim, claimIdx) => {
            const claimId = `claim-${stratIdx}-${claimIdx + 1}`;

            nodes.push({
              id: claimId,
              type: 'collapsible',
              position: {
                x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
              },
              data: {
                id: claimId,
                name: claim.name,
                description: claim.short_description || claim.description,
                long_description: claim.long_description || claim.description,
              },
              nodeType: 'propertyClaim',
            });

            edges.push({
              id: `${strategyId}-${claimId}`,
              source: strategyId,
              target: claimId,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
            });

            // Process evidence
            if (claim.evidence) {
              claim.evidence.forEach((evid, evidIdx) => {
                const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;

                nodes.push({
                  id: evidId,
                  type: 'collapsible',
                  position: {
                    x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                    y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
                  },
                  data: {
                    id: evidId,
                    name: evid.name,
                    description: evid.short_description || evid.description,
                    long_description: evid.long_description || evid.description,
                  },
                  nodeType: 'evidence',
                });

                edges.push({
                  id: `${claimId}-${evidId}`,
                  source: claimId,
                  target: evidId,
                  type: 'smoothstep',
                  markerEnd: { type: MarkerType.ArrowClosed },
                });
              });
            }
          });
        }
      });
    }

    // Process context
    if (goal.context) {
      goal.context.forEach((ctx, idx) => {
        nodes.push({
          id: `context-${idx + 1}`,
          type: 'collapsible',
          position: { x: 100 + idx * 200, y: yOffset },
          data: {
            id: `context-${idx + 1}`,
            name: ctx.name,
            description: ctx.short_description || ctx.description,
            long_description: ctx.long_description || ctx.description,
          },
          nodeType: 'context',
        });
      });
    }
  }

  return { nodes, edges };
};

/**
 * Enhanced Interactive Case Viewer with Collapsible Nodes
 */
const EnhancedInteractiveCaseViewer = ({
  caseData,
  onNodeClick,
  persistKey = 'enhanced-case-viewer',
  showControls = true,
}) => {
  // Convert case data to collapsible nodes
  const { nodes, edges } = useMemo(
    () => convertToCollapsibleNodes(caseData),
    [caseData]
  );

  const nodeTypes = useMemo(
    () => ({
      collapsible: CollapsibleNode,
    }),
    []
  );

  const handleNodeClick = useCallback(
    (event, node) => {
      console.log('Node clicked:', node);
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  return (
    <div className="relative w-full h-[600px] bg-gray-950 rounded-lg overflow-hidden">
      <ReactFlowProvider>
        <NodeStateManager
          persistKey={persistKey}
          defaultExpanded={false}
          showControls={false}
        >
          {showControls && (
            <div className="absolute top-4 left-4 z-10">
              <NodeStateControls />
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
          </ReactFlow>
        </NodeStateManager>
      </ReactFlowProvider>
    </div>
  );
};

/**
 * Usage Example Component
 */
const IntegrationExample = () => {
  // Sample case data
  const sampleCaseData = {
    goals: [
      {
        name: 'System Safety',
        short_description: 'System operates safely',
        long_description:
          'The system shall operate safely under all normal operating conditions.',
        strategies: [
          {
            name: 'Decomposition Strategy',
            short_description: 'Break down by subsystem',
            long_description:
              'Decompose safety argument into subsystem arguments.',
            property_claims: [
              {
                name: 'Perception Safety',
                short_description: 'Perception is accurate',
                long_description:
                  'Perception subsystem provides accurate environmental model.',
                evidence: [
                  {
                    name: 'Test Results',
                    short_description: '99.9% accuracy',
                    long_description: 'Test report showing 99.9% accuracy.',
                  },
                ],
              },
            ],
          },
        ],
        context: [
          {
            name: 'Operating Environment',
            short_description: 'Urban roads, daylight',
            long_description:
              'System operates on urban roads during daylight hours.',
          },
        ],
      },
    ],
  };

  return (
    <div className="w-full p-4 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">
          Integration Example
        </h2>
        <p className="text-gray-400 mb-4">
          Enhanced Interactive Case Viewer with collapsible nodes
        </p>
      </div>

      <EnhancedInteractiveCaseViewer
        caseData={sampleCaseData}
        showControls={true}
      />

      {/* Code Example */}
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Usage Example
        </h3>
        <pre className="text-xs text-gray-300 overflow-x-auto">
          {`import { EnhancedInteractiveCaseViewer } from './components/curriculum/enhanced/demos/IntegrationExample';

// In your component:
<EnhancedInteractiveCaseViewer
  caseData={yourCaseData}
  persistKey="my-case-viewer"
  showControls={true}
  onNodeClick={(node) => console.log('Clicked:', node)}
/>`}
        </pre>
      </div>

      {/* Migration Guide */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Migration Steps
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>
            Import <code className="text-cyan-400">NodeStateManager</code> and{' '}
            <code className="text-cyan-400">CollapsibleNode</code>
          </li>
          <li>
            Wrap your ReactFlow component with{' '}
            <code className="text-cyan-400">NodeStateManager</code>
          </li>
          <li>
            Change node type to <code className="text-cyan-400">'collapsible'</code>
          </li>
          <li>
            Add <code className="text-cyan-400">nodeType</code> prop to node data
            (goal, strategy, etc.)
          </li>
          <li>
            Optionally add <code className="text-cyan-400">NodeStateControls</code>{' '}
            for bulk operations
          </li>
          <li>Test collapsible behavior and adjust as needed</li>
        </ol>
      </div>
    </div>
  );
};

export { EnhancedInteractiveCaseViewer, IntegrationExample };
export default IntegrationExample;
