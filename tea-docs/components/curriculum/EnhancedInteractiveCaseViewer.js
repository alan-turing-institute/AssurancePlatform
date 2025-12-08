/**
 * Enhanced Interactive Case Viewer
 *
 * Full integration of all enhanced React Flow components:
 * - Collapsible nodes with glassmorphism
 * - Custom handles with + decorators
 * - Animated edges with 40 variants
 * - Double-click node creation
 * - Context menus (node, edge, canvas)
 * - Add Block Dialog
 * - Animation system with polish
 * - Progressive disclosure
 *
 * Maintains backward compatibility with existing InteractiveCaseViewer
 * while adding modern FloraFauna.ai-inspired features.
 *
 * @component
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  addEdge,
} from 'reactflow';
import {
  Eye,
  EyeOff,
  Maximize2,
  Info,
  ChevronRight,
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { getLayoutedElements } from '../../lib/layout-helper';
import 'reactflow/dist/style.css';

// Enhanced components
import { NodeStateManager, nodeTypes } from './enhanced/nodes';
import { edgeTypes, edgeStylePresets } from './enhanced/edges';
import { AnimationProvider } from './enhanced/animations';
import {
  useNodeContextMenu,
  useEdgeContextMenu,
  useCanvasContextMenu,
  NodeContextMenu,
  EdgeContextMenu,
  CanvasContextMenu,
} from './enhanced/menus';
import {
  useNodeCreator,
  NodeTypeSelector,
} from './enhanced/interactions';
import { AddBlockDialog } from './enhanced/dialogs';
import CreateNodePopover from './enhanced/dialogs/CreateNodePopover';
import { ThemeContext } from './enhanced/utils/themeConfig';
import { isValidConnection, getValidChildren } from './enhanced/nodes/nodeTypes';

/**
 * Data mapping utilities
 */

/**
 * Convert existing case data node format to enhanced node format
 */
const mapNodeToEnhanced = (id, type, position, data, nodeType) => {
  return {
    id,
    type,
    position,
    data: {
      id,
      name: data.name || 'Unnamed Node',
      description: data.short_description || data.description || '',
      long_description: data.long_description || data.description || '',
      element: data.element || data,
      // Additional metadata
      ...data,
    },
    // Store the node type for rendering
    nodeType,
  };
};

/**
 * Convert existing case data edge format to enhanced edge format
 */
const mapEdgeToEnhanced = (id, source, target, animated = false, type = 'smart') => {
  return {
    id,
    source,
    target,
    sourceHandle: `${source}-source`,
    targetHandle: `${target}-target`,
    type,
    animated,
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    data: {
      strength: 0.7,
      showStrengthIndicator: false,
    },
  };
};

/**
 * Convert case data to enhanced nodes and edges
 */
const convertCaseDataToEnhanced = (caseData, guidedPath = [], enhancedEdges = true) => {
  if (!caseData || !caseData.goals || caseData.goals.length === 0) {
    return { nodes: [], edges: [] };
  }

  const flowNodes = [];
  const flowEdges = [];
  let yOffset = 0;
  const xSpacing = 500;
  const ySpacing = 180;

  const goal = caseData.goals[0];

  // Add goal node
  flowNodes.push(
    mapNodeToEnhanced(
      'goal-1',
      'goal',
      { x: 400, y: yOffset },
      {
        name: goal.name,
        short_description: goal.short_description || goal.description,
        long_description: goal.long_description || goal.description,
        description: goal.description,
        element: goal,
        // Pass through metadata for badges
        priority: goal.priority,
        status: goal.status,
        context: goal.context,
        assumptions: goal.assumptions,
        justifications: goal.justifications,
        strength: goal.strength,
        confidence: goal.confidence,
      },
      'goal'
    )
  );
  yOffset += ySpacing;

  // Add context nodes
  if (goal.context) {
    goal.context.forEach((ctx, idx) => {
      flowNodes.push(
        mapNodeToEnhanced(
          `context-${idx + 1}`,
          'context',
          { x: 100 + idx * 200, y: yOffset },
          {
            name: ctx.name,
            short_description: ctx.short_description || ctx.description,
            long_description: ctx.long_description || ctx.description,
            description: ctx.description,
            element: ctx,
          },
          'context'
        )
      );
    });
  }

  // Add strategies
  if (goal.strategies) {
    goal.strategies.forEach((strategy, stratIdx) => {
      const strategyId = `strategy-${stratIdx + 1}`;

      flowNodes.push(
        mapNodeToEnhanced(
          strategyId,
          'strategy',
          { x: 200 + stratIdx * xSpacing, y: yOffset + ySpacing },
          {
            name: strategy.name,
            short_description: strategy.short_description || strategy.description,
            long_description: strategy.long_description || strategy.description,
            description: strategy.description,
            element: strategy,
            // Pass through metadata for badges
            priority: strategy.priority,
            status: strategy.status,
            strength: strategy.strength,
            confidence: strategy.confidence,
            context: strategy.context,
            assumptions: strategy.assumptions,
            justifications: strategy.justifications,
          },
          'strategy'
        )
      );

      // Add edge from goal to strategy
      const edgeType = enhancedEdges ? 'smart' : 'smoothstep';
      flowEdges.push(
        mapEdgeToEnhanced(
          `goal-${strategyId}`,
          'goal-1',
          strategyId,
          guidedPath.includes(strategyId),
          edgeType
        )
      );

      // Add property claims for each strategy
      if (strategy.property_claims) {
        strategy.property_claims.forEach((claim, claimIdx) => {
          const claimId = `claim-${stratIdx}-${claimIdx + 1}`;

          flowNodes.push(
            mapNodeToEnhanced(
              claimId,
              'propertyClaim',
              {
                x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                y: yOffset + ySpacing * 2 + Math.floor(claimIdx / 2) * 150,
              },
              {
                name: claim.name,
                short_description: claim.short_description || claim.description,
                long_description: claim.long_description || claim.description,
                description: claim.description,
                element: claim,
                // Pass through metadata for badges
                priority: claim.priority,
                status: claim.status,
                strength: claim.strength,
                confidence: claim.confidence,
                context: claim.context,
                assumptions: claim.assumptions,
                justifications: claim.justifications,
              },
              'propertyClaim'
            )
          );

          // Add edge from strategy to claim
          flowEdges.push(
            mapEdgeToEnhanced(
              `${strategyId}-${claimId}`,
              strategyId,
              claimId,
              guidedPath.includes(claimId),
              edgeType
            )
          );

          // Add evidence for claims
          if (claim.evidence) {
            claim.evidence.forEach((evid, evidIdx) => {
              const evidId = `evidence-${stratIdx}-${claimIdx}-${evidIdx + 1}`;

              flowNodes.push(
                mapNodeToEnhanced(
                  evidId,
                  'evidence',
                  {
                    x: 150 + stratIdx * xSpacing + (claimIdx % 2) * 420,
                    y: yOffset + ySpacing * 3 + Math.floor(claimIdx / 2) * 150,
                  },
                  {
                    name: evid.name,
                    short_description: evid.short_description || evid.description,
                    long_description: evid.long_description || evid.description,
                    description: evid.description,
                    element: evid,
                    // Pass through metadata for badges
                    priority: evid.priority,
                    status: evid.status,
                    strength: evid.strength,
                    confidence: evid.confidence,
                    context: evid.context,
                    assumptions: evid.assumptions,
                    justifications: evid.justifications,
                  },
                  'evidence'
                )
              );

              // Add edge from claim to evidence
              flowEdges.push(
                mapEdgeToEnhanced(
                  `${claimId}-${evidId}`,
                  claimId,
                  evidId,
                  guidedPath.includes(evidId),
                  edgeType
                )
              );
            });
          }
        });
      }
    });
  }

  return { nodes: flowNodes, edges: flowEdges };
};

/**
 * Control buttons component that uses useReactFlow
 */
const ControlButtons = ({ nodes, edges, setNodes, setEdges, setRevealedNodes, showAllNodes, setShowAllNodes }) => {
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
        onClick={() => {
          setShowAllNodes(true);
          setRevealedNodes(new Set(nodes.map((n) => n.id)));
        }}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center gap-1"
        title="Reveal all nodes"
      >
        <Eye className="w-4 h-4" />
        Reveal All
      </button>
      <button
        onClick={() => {
          setShowAllNodes(false);
          setRevealedNodes(new Set(['goal-1']));
        }}
        className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition flex items-center gap-1"
        title="Reset to initial view"
      >
        <EyeOff className="w-4 h-4" />
        Reset
      </button>
      <button
        onClick={handleAutoLayout}
        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition flex items-center gap-1"
        title="Auto-arrange nodes with proper spacing"
      >
        <Maximize2 className="w-4 h-4" />
        Auto Layout
      </button>
    </div>
  );
};

/**
 * Legend component
 */
const Legend = ({ showLegend, setShowLegend }) => {
  return (
    <div className="absolute top-4 right-4 z-10">
      {showLegend ? (
        <div className="bg-background-transparent-black f-effect-backdrop-blur-lg border border-transparent p-3 rounded-xl shadow-glassmorphic">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-text-light">Element Types</h3>
            <button
              onClick={() => setShowLegend(false)}
              className="text-icon-light-secondary hover:text-text-light transition"
              aria-label="Hide legend"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-text-light">Goal</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              <span className="text-text-light">Strategy</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-400" />
              <span className="text-text-light">Property Claim</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-text-light">Evidence</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <span className="text-text-light">Context</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowLegend(true)}
          className="p-2 bg-background-transparent-black f-effect-backdrop-blur-lg border border-transparent rounded-xl shadow-glassmorphic hover:shadow-3d transition"
          aria-label="Show element types legend"
          title="Show element types"
        >
          <Info className="w-5 h-5 text-icon-light-secondary" />
        </button>
      )}
    </div>
  );
};

/**
 * Enhanced Interactive Case Viewer Inner Component
 * (Needs to be inside ReactFlowProvider to use useReactFlow)
 */
const EnhancedInteractiveCaseViewerInner = ({
  caseData,
  onNodeClick,
  guidedPath = [],
  showAllNodes: initialShowAllNodes = false,
  highlightedNodes = [],
  enableExploration = true,
  // Feature toggles
  enableCollapsible = true,
  enableContextMenus = true,
  enableNodeCreation = true,
  enableAnimations = true,
  enableEnhancedEdges = true,
  // Styling
  className = '',
  height = '600px',
  // Persistence
  persistKey = 'enhanced-case-viewer',
}) => {
  // Detect dark mode from DOM instead of using Docusaurus hook
  // This avoids context issues while still respecting the theme
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [colorMode, setColorMode] = useState('dark');

  useEffect(() => {
    // Check document data-theme attribute (Docusaurus sets this)
    const updateTheme = () => {
      const htmlElement = document.documentElement;
      const theme = htmlElement.getAttribute('data-theme') || 'dark';
      setColorMode(theme);
      setIsDarkMode(theme === 'dark');
    };

    // Initial check
    updateTheme();

    // Watch for theme changes using MutationObserver
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [revealedNodes, setRevealedNodes] = useState(new Set(['goal-1']));
  const [showLegend, setShowLegend] = useState(false);
  const [showAllNodes, setShowAllNodes] = useState(initialShowAllNodes);
  const [connectionSource, setConnectionSource] = useState(null);

  // Double-click detection for pane
  const lastPaneClickRef = useRef(0);

  // Get React Flow instance
  const reactFlowInstance = useReactFlow();

  // Node creation
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addPosition, setAddPosition] = useState(null);
  const [parentNodeForCreation, setParentNodeForCreation] = useState(null);
  const nodeCreator = useNodeCreator();

  // Handle connection creation (drag from one node to another)
  const onConnect = useCallback((connection) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return;

    // Validate connection based on node types
    const isValid = isValidConnection(sourceNode.type, targetNode.type);

    if (isValid) {
      // Add the new edge with proper handle IDs
      setEdges((eds) => addEdge({
        ...connection,
        sourceHandle: connection.sourceHandle || `${connection.source}-source`,
        targetHandle: connection.targetHandle || `${connection.target}-target`,
        type: enableEnhancedEdges ? 'smart' : 'smoothstep',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }, eds));
    } else {
      // Show error message (you can implement a toast/notification here)
      console.warn(`Invalid connection: ${sourceNode.type} cannot connect to ${targetNode.type}`);
    }
  }, [nodes, setEdges, enableEnhancedEdges]);

  // Track connection start for drag operations
  const onConnectStart = useCallback((event, { nodeId, handleType, handleId }) => {
    setConnectionSource({ nodeId, handleType, handleId });
  }, []);

  // Handle connection end - detect drag to empty space (Mode 2)
  const onConnectEnd = useCallback((event) => {
    // Check if we didn't connect to a node (dragged to empty space)
    const targetIsPane = event.target.classList.contains('react-flow__pane');

    if (targetIsPane && connectionSource && reactFlowInstance) {
      // Find the source node
      const sourceNode = nodes.find(n => n.id === connectionSource.nodeId);

      if (sourceNode) {
        // Use screen coordinates for the popover (fixed positioning)
        const screenPosition = {
          x: event.clientX,
          y: event.clientY,
        };

        // Open dialog to create new node at this position
        setParentNodeForCreation(sourceNode);
        setAddPosition(screenPosition);
        setIsAddDialogOpen(true);
      }
    }

    // Reset connection source
    setConnectionSource(null);
  }, [connectionSource, nodes, reactFlowInstance]);

  // Handle node creation from dialog (Mode 1 & Mode 2)
  const handleCreateNode = useCallback((nodeData) => {
    const { nodeType, name, description, position: dialogPosition, parentNode } = nodeData;

    // Generate unique ID
    const newNodeId = `${nodeType}-${Date.now()}`;

    // Determine position: use provided position or calculate near parent
    let nodePosition = dialogPosition;

    // If we have addPosition (screen coordinates), convert to flow coordinates
    if (!nodePosition && addPosition && reactFlowInstance) {
      nodePosition = reactFlowInstance.screenToFlowPosition(addPosition);
    }

    if (!nodePosition && parentNode) {
      // Calculate position below parent
      const parentPosition = parentNode.position || { x: 0, y: 0 };
      nodePosition = {
        x: parentPosition.x,
        y: parentPosition.y + 150,
      };
    }

    // Create new node using existing mapping helper
    const newNode = mapNodeToEnhanced(
      newNodeId,
      nodeType,
      nodePosition,
      {
        name,
        description,
        short_description: description,
        long_description: description,
      },
      nodeType
    );

    // Add node to state
    setNodes((nds) => [...nds, newNode]);

    // Add to revealed nodes so it's visible
    setRevealedNodes((revealed) => new Set([...revealed, newNodeId]));

    // Create edge to parent if provided
    if (parentNode) {
      const newEdge = {
        id: `edge-${parentNode.id}-${newNodeId}`,
        source: parentNode.id,
        target: newNodeId,
        sourceHandle: `${parentNode.id}-source`,
        targetHandle: `${newNodeId}-target`,
        type: enableEnhancedEdges ? 'smart' : 'smoothstep',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };

      setEdges((eds) => [...eds, newEdge]);
    }

    // Optionally trigger auto-layout after a short delay
    setTimeout(() => {
      const layouted = getLayoutedElements(nodes.concat(newNode), edges, { direction: 'TB' });
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    }, 100);
  }, [nodes, edges, setNodes, setEdges, addPosition, enableEnhancedEdges, reactFlowInstance]);

  // Handle click on handle (Mode 1 - click to create)
  const handleHandleClick = useCallback((nodeId, handleId, position, nodeData) => {
    const sourceNode = nodes.find(n => n.id === nodeId);

    if (sourceNode) {
      // Open dialog to create new node with auto-positioning
      setParentNodeForCreation(sourceNode);
      setAddPosition(null); // Let handleCreateNode calculate position
      setIsAddDialogOpen(true);
    }
  }, [nodes]);

  // Progressive Disclosure Functions (for context menu)

  /**
   * Reveal immediate children of a node
   */
  const revealChildren = useCallback((nodeId) => {
    const newRevealed = new Set(revealedNodes);
    newRevealed.add(nodeId);

    // Find all child nodes
    const childNodes = edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);

    // Add children to revealed set
    childNodes.forEach((childId) => {
      newRevealed.add(childId);
    });

    setRevealedNodes(newRevealed);
  }, [revealedNodes, edges]);

  /**
   * Hide immediate children of a node
   */
  const hideChildren = useCallback((nodeId) => {
    const newRevealed = new Set(revealedNodes);

    // Find all child nodes
    const childNodes = edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);

    // Remove children from revealed set
    childNodes.forEach((childId) => {
      newRevealed.delete(childId);
    });

    setRevealedNodes(newRevealed);
  }, [revealedNodes, edges]);

  /**
   * Toggle visibility of immediate children (show if hidden, hide if shown)
   */
  const toggleChildren = useCallback((nodeId) => {
    const newRevealed = new Set(revealedNodes);
    newRevealed.add(nodeId);

    // Find all child nodes
    const childNodes = edges
      .filter((edge) => edge.source === nodeId)
      .map((edge) => edge.target);

    // Check if all children are currently visible
    const allChildrenVisible =
      childNodes.length > 0 &&
      childNodes.every((childId) => revealedNodes.has(childId));

    if (allChildrenVisible) {
      // Hide children
      childNodes.forEach((childId) => {
        newRevealed.delete(childId);
      });
    } else {
      // Show children
      childNodes.forEach((childId) => {
        newRevealed.add(childId);
      });
    }

    setRevealedNodes(newRevealed);
  }, [revealedNodes, edges]);

  /**
   * Recursively reveal all descendants of a node
   */
  const revealAllDescendants = useCallback((nodeId) => {
    const newRevealed = new Set(revealedNodes);
    newRevealed.add(nodeId);

    // Recursive function to reveal all descendants
    const revealDescendantsRecursive = (currentNodeId) => {
      const childNodes = edges
        .filter((edge) => edge.source === currentNodeId)
        .map((edge) => edge.target);

      childNodes.forEach((childId) => {
        if (!newRevealed.has(childId)) {
          newRevealed.add(childId);
          revealDescendantsRecursive(childId); // Recurse
        }
      });
    };

    revealDescendantsRecursive(nodeId);
    setRevealedNodes(newRevealed);
  }, [revealedNodes, edges]);

  // Context menus with required props (initialized after progressive disclosure functions)
  const nodeContextMenu = useNodeContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
    callbacks: {
      revealChildren,
      hideChildren,
      toggleChildren,
      revealAllDescendants,
    },
  });
  const edgeContextMenu = useEdgeContextMenu({
    edges,
    setEdges,
    reactFlowInstance,
  });
  const canvasContextMenu = useCanvasContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
  });

  // Convert case data to ReactFlow nodes and edges
  useEffect(() => {
    if (!caseData) {
      console.warn('No caseData provided to EnhancedInteractiveCaseViewer');
      return;
    }

    const { nodes: flowNodes, edges: flowEdges } = convertCaseDataToEnhanced(
      caseData,
      guidedPath,
      enableEnhancedEdges
    );

    // Apply progressive disclosure if not showing all nodes
    const visibleNodes = showAllNodes
      ? flowNodes
      : flowNodes.map((node) => ({
          ...node,
          hidden: !revealedNodes.has(node.id) && !guidedPath.includes(node.id),
        }));

    setNodes(visibleNodes);
    setEdges(flowEdges);
  }, [caseData, showAllNodes, revealedNodes, guidedPath, enableEnhancedEdges, setNodes, setEdges]);

  // Node click handler (selection only - progressive disclosure moved to context menu)
  const handleNodeClick = useCallback(
    (event, node) => {
      setSelectedNode(node);

      // Call parent handler if provided
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  // Handle pane click with double-click detection
  const handlePaneClick = useCallback(
    (event) => {
      // Check for double-click
      const currentTime = Date.now();
      const timeSinceLastClick = currentTime - lastPaneClickRef.current;

      if (timeSinceLastClick < 300 && enableNodeCreation) {
        // This is a double-click - create node
        const bounds = event.target.getBoundingClientRect();
        const position = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };

        setAddPosition(position);
        setIsAddDialogOpen(true);
      }

      lastPaneClickRef.current = currentTime;
    },
    [enableNodeCreation]
  );


  // Node context menu handlers
  const handleNodeContextMenu = useCallback(
    (event, node) => {
      if (!enableContextMenus) return;

      // Use the handler from the hook
      nodeContextMenu.handleNodeContextMenu(event, node);
    },
    [enableContextMenus, nodeContextMenu]
  );

  // Edge context menu handlers
  const handleEdgeContextMenu = useCallback(
    (event, edge) => {
      if (!enableContextMenus) return;

      // Use the handler from the hook
      edgeContextMenu.handleEdgeContextMenu(event, edge);
    },
    [enableContextMenus, edgeContextMenu]
  );

  // Canvas context menu handler
  const handlePaneContextMenu = useCallback(
    (event) => {
      if (!enableContextMenus) return;

      // Use the handler from the hook
      canvasContextMenu.handlePaneContextMenu(event);
    },
    [enableContextMenus, canvasContextMenu]
  );

  // Define node types based on features
  const enhancedNodeTypes = useMemo(() => {
    return enableCollapsible ? nodeTypes : {};
  }, [enableCollapsible]);

  // Define edge types based on features
  const enhancedEdgeTypes = useMemo(() => {
    return enableEnhancedEdges ? edgeTypes : {};
  }, [enableEnhancedEdges]);

  // Theme-aware colors
  const canvasBg = isDarkMode ? 'bg-gray-950' : 'bg-gray-100';
  const backgroundDotColor = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)';

  // Theme context value
  const themeContextValue = {
    isDarkMode,
    colorMode,
    onHandleClick: handleHandleClick,
  };

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <div
        className={`relative w-full rounded-lg shadow-lg overflow-hidden ${canvasBg} ${className}`}
        style={{ height }}
      >
      {/* Control Buttons */}
      <ControlButtons
        nodes={nodes}
        edges={edges}
        setNodes={setNodes}
        setEdges={setEdges}
        setRevealedNodes={setRevealedNodes}
        showAllNodes={showAllNodes}
        setShowAllNodes={setShowAllNodes}
      />

      {/* Legend */}
      <Legend showLegend={showLegend} setShowLegend={setShowLegend} />

      {/* ReactFlow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={enhancedNodeTypes}
        edgeTypes={enhancedEdgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={4}
        attributionPosition="bottom-left"
        className={canvasBg}
      >
        <Background
          variant="dots"
          gap={12}
          size={1}
          color={backgroundDotColor}
        />
        <Controls className="bg-background-transparent-black f-effect-backdrop-blur-lg border border-transparent rounded-lg" />
        <MiniMap
          className="bg-background-transparent-black f-effect-backdrop-blur-lg border border-transparent rounded-lg"
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

      {/* Context Menus */}
      {enableContextMenus && (
        <>
          {nodeContextMenu.NodeContextMenu}
          {edgeContextMenu.EdgeContextMenu}
          {canvasContextMenu.CanvasContextMenu}
        </>
      )}

      {/* Create Node Popover (for + button interactions) */}
      <CreateNodePopover
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setParentNodeForCreation(null);
            setAddPosition(null);
          }
        }}
        onSelect={handleCreateNode}
        parentNode={parentNodeForCreation}
        position={addPosition}
      />
      </div>
    </ThemeContext.Provider>
  );
};

/**
 * Enhanced Interactive Case Viewer
 * Main component with providers
 */
const EnhancedInteractiveCaseViewer = (props) => {
  const {
    enableAnimations = true,
    enableCollapsible = true,
    persistKey = 'enhanced-case-viewer',
  } = props;

  return (
    <ReactFlowProvider>
      {enableAnimations ? (
        <AnimationProvider>
          {enableCollapsible ? (
            <NodeStateManager persistKey={persistKey} defaultExpanded={false}>
              <EnhancedInteractiveCaseViewerInner {...props} />
            </NodeStateManager>
          ) : (
            <EnhancedInteractiveCaseViewerInner {...props} />
          )}
        </AnimationProvider>
      ) : enableCollapsible ? (
        <NodeStateManager persistKey={persistKey} defaultExpanded={false}>
          <EnhancedInteractiveCaseViewerInner {...props} />
        </NodeStateManager>
      ) : (
        <EnhancedInteractiveCaseViewerInner {...props} />
      )}
    </ReactFlowProvider>
  );
};

// Default export
export default EnhancedInteractiveCaseViewer;

// Named exports for utilities
export {
  convertCaseDataToEnhanced,
  mapNodeToEnhanced,
  mapEdgeToEnhanced,
};
