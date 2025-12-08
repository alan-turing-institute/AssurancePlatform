/**
 * Add Block Dialog Demo Component
 *
 * Comprehensive demonstration of the Add Block Dialog system
 * showing all features, modes, and integration patterns.
 *
 * Features demonstrated:
 * - Standard dialog mode
 * - Quick create mode
 * - Template selection
 * - Connection hints
 * - Form validation
 * - Draft auto-save
 * - Keyboard shortcuts
 * - Bulk creation
 *
 * @component
 */

import React, { useState, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { cn } from '../../../../lib/utils';
import {
  Plus,
  Zap,
  Layers,
  Info,
  Code,
  Play,
  RefreshCw,
} from 'lucide-react';

import AddBlockDialog, { CompactAddBlockDialog } from './AddBlockDialog';
import { nodeTypes } from '../nodes/nodeTypes';
import { generateNodeId } from '../interactions/creationUtils';
import 'reactflow/dist/style.css';

/**
 * Initial demo nodes
 */
const initialNodes = [
  {
    id: 'demo-goal-1',
    type: 'goal',
    position: { x: 250, y: 50 },
    data: {
      name: 'System Safety Goal',
      description: 'Ensure the system operates safely under all conditions',
      priority: 'critical',
    },
  },
  {
    id: 'demo-strategy-1',
    type: 'strategy',
    position: { x: 250, y: 250 },
    data: {
      name: 'Decomposition by Component',
      description: 'Break down safety argument by system components',
      strategyType: 'AND',
    },
  },
];

const initialEdges = [
  {
    id: 'edge-1',
    source: 'demo-goal-1',
    target: 'demo-strategy-1',
    type: 'smoothstep',
  },
];

/**
 * Demo Section Component
 */
const DemoSection = ({ title, description, children, code }) => {
  const [showCode, setShowCode] = useState(false);

  return (
    <Card className="bg-background-transparent-black-secondary border-transparent">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-text-light text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="text-text-light/70 mt-1">
                {description}
              </CardDescription>
            )}
          </div>
          {code && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowCode(!showCode)}
              className="text-text-light/70"
            >
              <Code className="w-4 h-4 mr-2" />
              {showCode ? 'Hide' : 'Show'} Code
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCode && code && (
          <pre className="p-4 rounded-lg bg-gray-950 text-xs text-text-light/80 overflow-x-auto">
            <code>{code}</code>
          </pre>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

/**
 * AddBlockDialogDemo Component
 */
const AddBlockDialogDemo = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Dialog states
  const [standardDialogOpen, setStandardDialogOpen] = useState(false);
  const [compactDialogOpen, setCompactDialogOpen] = useState(false);
  const [quickModeDialogOpen, setQuickModeDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const [clickPosition, setClickPosition] = useState(null);
  const [stats, setStats] = useState({
    nodesCreated: 0,
    templatesUsed: 0,
    draftsRestored: 0,
  });

  // Handle canvas double-click
  const handlePaneDoubleClick = useCallback((event) => {
    const rect = event.target.getBoundingClientRect();
    const position = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setClickPosition(position);
    setStandardDialogOpen(true);
  }, []);

  // Handle add node
  const handleAddNode = useCallback((nodeData) => {
    if (nodeData.type === 'template') {
      // Handle template creation
      const template = nodeData.template;
      const basePosition = clickPosition || { x: 100, y: 100 };

      const newNodes = template.nodes.map((nodeConfig, index) => {
        const x = basePosition.x + (nodeConfig.offsetX || 0);
        const y = basePosition.y + (nodeConfig.offsetY || index * 150);

        return {
          id: generateNodeId(nodeConfig.type),
          type: nodeConfig.type,
          position: { x, y },
          data: {
            name: nodeConfig.name,
            description: nodeConfig.description || 'Template node',
          },
        };
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setStats((prev) => ({
        ...prev,
        nodesCreated: prev.nodesCreated + newNodes.length,
        templatesUsed: prev.templatesUsed + 1,
      }));
    } else {
      // Handle single node creation
      setNodes((nds) => [...nds, nodeData]);
      setStats((prev) => ({
        ...prev,
        nodesCreated: prev.nodesCreated + 1,
      }));
    }
  }, [clickPosition, setNodes]);

  // Handle bulk add
  const handleBulkAdd = useCallback((nodesList) => {
    setNodes((nds) => [...nds, ...nodesList]);
    setStats((prev) => ({
      ...prev,
      nodesCreated: prev.nodesCreated + nodesList.length,
    }));
  }, [setNodes]);

  // Reset demo
  const handleReset = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setStats({
      nodesCreated: 0,
      templatesUsed: 0,
      draftsRestored: 0,
    });
  }, [setNodes, setEdges]);

  // Sample code snippets
  const standardDialogCode = `<AddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddBlock}
  currentNodes={nodes}
  position={clickPosition}
  enableTemplates={true}
  enableQuickMode={true}
  showConnectionHints={true}
/>`;

  const compactDialogCode = `<CompactAddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddBlock}
  position={clickPosition}
/>`;

  const doubleClickCode = `const handlePaneDoubleClick = (event) => {
  const rect = event.target.getBoundingClientRect();
  const position = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  setClickPosition(position);
  setDialogOpen(true);
};

<ReactFlow
  onPaneDoubleClick={handlePaneDoubleClick}
  // ... other props
/>`;

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-text-light flex items-center gap-3">
            <Plus className="w-8 h-8 text-blue-400" />
            Add Block Dialog Demo
          </h1>
          <p className="text-text-light/70">
            Comprehensive demonstration of the Add Block Dialog system with all features and integration patterns.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-background-transparent-black-secondary border-transparent">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-text-light">{nodes.length}</div>
              <div className="text-xs text-text-light/60">Total Nodes</div>
            </CardContent>
          </Card>
          <Card className="bg-background-transparent-black-secondary border-transparent">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-text-light">{stats.nodesCreated}</div>
              <div className="text-xs text-text-light/60">Nodes Created</div>
            </CardContent>
          </Card>
          <Card className="bg-background-transparent-black-secondary border-transparent">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-text-light">{stats.templatesUsed}</div>
              <div className="text-xs text-text-light/60">Templates Used</div>
            </CardContent>
          </Card>
          <Card className="bg-background-transparent-black-secondary border-transparent">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-text-light">{edges.length}</div>
              <div className="text-xs text-text-light/60">Connections</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="demos" className="space-y-4">
          <TabsList className="bg-background-transparent-black-secondary">
            <TabsTrigger value="demos">
              <Play className="w-4 h-4 mr-2" />
              Demos
            </TabsTrigger>
            <TabsTrigger value="canvas">
              <Layers className="w-4 h-4 mr-2" />
              Canvas
            </TabsTrigger>
            <TabsTrigger value="docs">
              <Info className="w-4 h-4 mr-2" />
              Documentation
            </TabsTrigger>
          </TabsList>

          {/* Demos Tab */}
          <TabsContent value="demos" className="space-y-6">
            {/* Standard Dialog */}
            <DemoSection
              title="1. Standard Dialog"
              description="Full-featured dialog with all options: node types, templates, form fields, and preview."
              code={standardDialogCode}
            >
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setClickPosition({ x: 400, y: 400 });
                    setStandardDialogOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Open Standard Dialog
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Two-panel layout</Badge>
                  <Badge variant="secondary">Search & filter</Badge>
                  <Badge variant="secondary">Template library</Badge>
                  <Badge variant="secondary">Live preview</Badge>
                  <Badge variant="secondary">Connection hints</Badge>
                </div>
              </div>
            </DemoSection>

            {/* Compact Dialog */}
            <DemoSection
              title="2. Compact Dialog"
              description="Minimal version with essential features only - perfect for quick node creation."
              code={compactDialogCode}
            >
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setClickPosition({ x: 300, y: 300 });
                    setCompactDialogOpen(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Open Compact Dialog
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Smaller size</Badge>
                  <Badge variant="secondary">Quick mode enabled</Badge>
                  <Badge variant="secondary">No templates</Badge>
                  <Badge variant="secondary">Fast workflow</Badge>
                </div>
              </div>
            </DemoSection>

            {/* Double-Click Integration */}
            <DemoSection
              title="3. Double-Click Integration"
              description="Create nodes by double-clicking on the canvas - FloraFauna.ai style interaction."
              code={doubleClickCode}
            >
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-background-transparent-white-hover border border-blue-500/30">
                  <p className="text-sm text-text-light mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400" />
                    Try double-clicking on the canvas below to create a node at that position
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Canvas interaction</Badge>
                  <Badge variant="secondary">Position-aware</Badge>
                  <Badge variant="secondary">Smart defaults</Badge>
                </div>
              </div>
            </DemoSection>

            {/* Keyboard Shortcuts */}
            <DemoSection
              title="4. Keyboard Shortcuts"
              description="Navigate and create nodes using keyboard shortcuts."
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-background-transparent-white-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-light">Create Goal</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 border border-transparent rounded">
                        G
                      </kbd>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-background-transparent-white-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-light">Create Strategy</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 border border-transparent rounded">
                        S
                      </kbd>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-background-transparent-white-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-light">Create Claim</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 border border-transparent rounded">
                        C
                      </kbd>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-background-transparent-white-hover">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-text-light">Create Evidence</span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-gray-800 border border-transparent rounded">
                        E
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </DemoSection>
          </TabsContent>

          {/* Canvas Tab */}
          <TabsContent value="canvas" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-light">Interactive Canvas</h3>
                <p className="text-sm text-text-light/70">
                  Double-click anywhere on the canvas to create a new node
                </p>
              </div>
              <Button
                onClick={handleReset}
                variant="ghost"
                className="text-text-light"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            <div
              className="w-full h-[600px] rounded-lg overflow-hidden border border-border-transparent"
              style={{ background: 'rgb(10, 10, 10)' }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onPaneDoubleClick={handlePaneDoubleClick}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.5}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="rgba(255, 255, 255, 0.05)" gap={20} />
                <Controls className="bg-background-transparent-black-secondary border-transparent" />
                <MiniMap
                  className="bg-background-transparent-black-secondary border-transparent"
                  nodeColor={(node) => {
                    switch (node.type) {
                      case 'goal': return '#10b981';
                      case 'strategy': return '#a855f7';
                      case 'propertyClaim': return '#f97316';
                      case 'evidence': return '#06b6d4';
                      case 'context': return '#6b7280';
                      default: return '#6b7280';
                    }
                  }}
                />
              </ReactFlow>
            </div>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-4">
            <Card className="bg-background-transparent-black-secondary border-transparent">
              <CardHeader>
                <CardTitle className="text-text-light">Usage Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-text-light/80">
                <div>
                  <h4 className="font-semibold text-text-light mb-2">Features</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Two-panel layout with node type selection and live preview</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Template library with pre-configured node patterns</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Dynamic form fields based on node type</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Connection hints showing nearby nodes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Keyboard shortcuts for quick creation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>Auto-save draft functionality</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-text-light mb-2">Integration</h4>
                  <p className="text-sm mb-2">
                    The Add Block Dialog integrates seamlessly with React Flow:
                  </p>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Import the AddBlockDialog component</li>
                    <li>Add state for dialog open/close and click position</li>
                    <li>Handle the onAdd callback to add nodes to your flow</li>
                    <li>Optionally enable double-click to create</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AddBlockDialog
        open={standardDialogOpen}
        onClose={() => setStandardDialogOpen(false)}
        onAdd={handleAddNode}
        onBulkAdd={handleBulkAdd}
        position={clickPosition}
        currentNodes={nodes}
        enableTemplates={true}
        enableQuickMode={true}
        enableBulkMode={false}
        showConnectionHints={true}
      />

      <CompactAddBlockDialog
        open={compactDialogOpen}
        onClose={() => setCompactDialogOpen(false)}
        onAdd={handleAddNode}
        position={clickPosition}
      />
    </div>
  );
};

export default AddBlockDialogDemo;
