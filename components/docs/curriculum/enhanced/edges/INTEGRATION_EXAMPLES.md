# Edge Integration Examples

Practical examples showing how to integrate enhanced edges with existing curriculum components.

## Example 1: Basic Curriculum Case Viewer

Integrate edges into the existing InteractiveCaseViewer:

```jsx
import React from 'react';
import ReactFlow from 'reactflow';
import { edgeTypes, edgeStylePresets } from './components/curriculum/enhanced/edges';
import 'reactflow/dist/style.css';

function CurriculumCaseViewer({ caseData }) {
  const nodes = caseData.nodes.map(node => ({
    id: node.id,
    type: node.node_type,
    position: node.position,
    data: {
      label: node.name,
      description: node.short_description,
      element: node.element,
    },
  }));

  const edges = caseData.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smart', // Use smart edge by default
    data: {
      label: getEdgeLabel(edge),
      strength: getRelationshipStrength(edge),
      showStrengthIndicator: true,
    },
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      fitView
    />
  );
}

function getEdgeLabel(edge) {
  const labels = {
    'goal-strategy': 'Decomposed by',
    'strategy-claim': 'Supports',
    'claim-evidence': 'Backed by',
  };
  return labels[`${edge.sourceType}-${edge.targetType}`] || 'Related to';
}

function getRelationshipStrength(edge) {
  // Logic to determine relationship strength
  // Could be based on confidence, evidence weight, etc.
  return edge.confidence || 0.7;
}
```

## Example 2: State-Based Edge Styling

Show different states for curriculum elements:

```jsx
function createStateBasedEdges(caseData) {
  return caseData.edges.map(edge => {
    const edgeConfig = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        label: edge.label,
      },
    };

    // Style based on validation state
    if (edge.validated === true) {
      return {
        ...edgeConfig,
        type: 'successGlow',
        data: {
          ...edgeConfig.data,
          state: 'success',
          pulse: false,
        },
      };
    } else if (edge.validated === false) {
      return {
        ...edgeConfig,
        type: 'errorGlow',
        data: {
          ...edgeConfig.data,
          state: 'error',
          pulse: true,
        },
      };
    } else {
      return {
        ...edgeConfig,
        type: 'animated',
        data: {
          ...edgeConfig.data,
          animated: true,
        },
      };
    }
  });
}
```

## Example 3: Progressive Disclosure with Edges

Animate edges as nodes are revealed:

```jsx
function ProgressiveCaseViewer({ caseData }) {
  const [visibleNodes, setVisibleNodes] = useState(new Set());
  const [visibleEdges, setVisibleEdges] = useState(new Set());

  const revealConnectedNodes = (nodeId) => {
    // Find connected edges
    const connectedEdges = caseData.edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );

    // Animate edge appearance
    connectedEdges.forEach((edge, index) => {
      setTimeout(() => {
        setVisibleEdges(prev => new Set([...prev, edge.id]));

        // Reveal target node
        const targetNode = edge.target === nodeId ? edge.source : edge.target;
        setTimeout(() => {
          setVisibleNodes(prev => new Set([...prev, targetNode]));
        }, 300);
      }, index * 200);
    });
  };

  const edges = caseData.edges
    .filter(edge => visibleEdges.has(edge.id))
    .map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'animated',
      data: {
        label: edge.label,
        animated: true,
        enterDuration: 0.8,
      },
    }));

  return (
    <ReactFlow
      nodes={nodes.filter(n => visibleNodes.has(n.id))}
      edges={edges}
      edgeTypes={edgeTypes}
      onNodeClick={(e, node) => revealConnectedNodes(node.id)}
    />
  );
}
```

## Example 4: Hierarchical Relationships

Different edge types for different relationship types:

```jsx
function getEdgeTypeForRelationship(sourceType, targetType) {
  const relationshipMap = {
    // Goal to Strategy: Strong dependency
    'goal-strategy': {
      type: 'strongConnection',
      data: {
        label: 'Decomposed by',
        strength: 1,
        color: '#8b5cf6',
      },
    },

    // Strategy to Claim: Gradient showing flow
    'strategy-claim': {
      type: 'gradient',
      data: {
        label: 'Supports',
        sourceColor: '#8b5cf6',
        targetColor: '#f59e0b',
      },
    },

    // Claim to Evidence: Data flow
    'claim-evidence': {
      type: 'dataStream',
      data: {
        label: 'Backed by',
        particleCount: 4,
        flowSpeed: 1,
      },
    },

    // Context connections: Subtle
    'context-*': {
      type: 'weakConnection',
      data: {
        label: 'Context',
        strength: 0.3,
        color: '#6b7280',
      },
    },
  };

  const key = `${sourceType}-${targetType}`;
  return relationshipMap[key] || relationshipMap['context-*'];
}

function createHierarchicalEdges(caseData) {
  return caseData.edges.map(edge => {
    const sourceNode = caseData.nodes.find(n => n.id === edge.source);
    const targetNode = caseData.nodes.find(n => n.id === edge.target);

    const edgeConfig = getEdgeTypeForRelationship(
      sourceNode.node_type,
      targetNode.node_type
    );

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...edgeConfig,
    };
  });
}
```

## Example 5: Interactive Edge Editing

Allow users to interact with edges:

```jsx
function InteractiveCaseEditor({ caseData }) {
  const [edges, setEdges] = useEdgesState([]);

  const handleEdgeClick = useCallback((event, edge) => {
    console.log('Edge clicked:', edge);
    // Show edge details modal
  }, []);

  const handleEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    // Show context menu with options:
    // - Edit label
    // - Change type
    // - Delete edge
  }, []);

  const enhancedEdges = edges.map(edge => ({
    ...edge,
    type: edge.type || 'smart',
    data: {
      ...edge.data,
      onClick: handleEdgeClick,
      onContextMenu: handleEdgeContextMenu,
    },
  }));

  return (
    <ReactFlow
      edges={enhancedEdges}
      edgeTypes={edgeTypes}
    />
  );
}
```

## Example 6: Guided Path Highlighting

Highlight a specific path through the curriculum:

```jsx
function GuidedPathViewer({ caseData, guidedPath }) {
  const edges = caseData.edges.map(edge => {
    const isInPath = guidedPath.some(
      step => step.from === edge.source && step.to === edge.target
    );

    if (isInPath) {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'neon',
        data: {
          label: edge.label,
          color: '#10b981',
          glowIntensity: 1.5,
          pulse: true,
        },
      };
    }

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'animated',
      data: {
        label: edge.label,
        color: '#6b7280',
        animated: false,
      },
    };
  });

  return (
    <ReactFlow
      edges={edges}
      edgeTypes={edgeTypes}
    />
  );
}
```

## Example 7: Real-Time Status Updates

Update edge appearance based on real-time status:

```jsx
function LiveCaseViewer({ caseData, statusUpdates }) {
  const [edgeStatuses, setEdgeStatuses] = useState({});

  useEffect(() => {
    // Subscribe to status updates
    const unsubscribe = statusUpdates.subscribe(update => {
      setEdgeStatuses(prev => ({
        ...prev,
        [update.edgeId]: update.status,
      }));
    });

    return unsubscribe;
  }, [statusUpdates]);

  const edges = caseData.edges.map(edge => {
    const status = edgeStatuses[edge.id] || 'default';

    const statusConfig = {
      validating: {
        type: 'pulseAnimated',
        data: { color: '#f59e0b' },
      },
      valid: {
        type: 'successGlow',
        data: { pulse: false },
      },
      invalid: {
        type: 'errorGlow',
        data: { pulse: true },
      },
      default: {
        type: 'smart',
        data: {},
      },
    };

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...statusConfig[status],
      data: {
        ...statusConfig[status].data,
        label: edge.label,
      },
    };
  });

  return (
    <ReactFlow
      edges={edges}
      edgeTypes={edgeTypes}
    />
  );
}
```

## Example 8: Using Presets for Consistency

Apply consistent styling across the application:

```jsx
import { applyEdgePreset, edgeStylePresets } from './edges';

function StyledCaseViewer({ caseData, theme = 'modern' }) {
  const edges = caseData.edges.map(edge => {
    const baseEdge = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: {
        label: edge.label,
      },
    };

    // Apply theme preset
    return applyEdgePreset(baseEdge, theme);
  });

  return (
    <ReactFlow
      edges={edges}
      edgeTypes={edgeTypes}
    />
  );
}

// Usage:
// <StyledCaseViewer caseData={data} theme="neon" />
// <StyledCaseViewer caseData={data} theme="elegant" />
// <StyledCaseViewer caseData={data} theme="minimal" />
```

## Example 9: Performance Optimization

Optimize for large graphs:

```jsx
function OptimizedCaseViewer({ caseData }) {
  const [viewport, setViewport] = useState({ zoom: 1 });

  const edges = useMemo(() => {
    // Use simpler edge types when zoomed out
    const edgeType = viewport.zoom < 0.5 ? 'animated' : 'smart';

    return caseData.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edgeType,
      data: {
        label: viewport.zoom > 0.7 ? edge.label : undefined,
        animated: viewport.zoom > 0.5,
        particleCount: Math.floor(viewport.zoom * 3),
      },
    }));
  }, [caseData.edges, viewport.zoom]);

  return (
    <ReactFlow
      edges={edges}
      edgeTypes={edgeTypes}
      onViewportChange={setViewport}
      onlyRenderVisibleElements={true}
    />
  );
}
```

## Example 10: Custom Edge Data Integration

Integrate with existing curriculum data structure:

```jsx
function mapCurriculumEdges(caseData) {
  return caseData.edges.map(edge => {
    // Extract curriculum-specific data
    const element = edge.element || {};

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: determineEdgeType(element),
      data: {
        label: element.name || edge.label,

        // Curriculum-specific metadata
        metadata: [
          element.long_description,
          `ID: ${element.id}`,
          `Type: ${element.element_type}`,
        ].filter(Boolean).join(' • '),

        // Strength based on curriculum metrics
        strength: calculateStrength(element),

        // Show indicators
        showStrengthIndicator: true,
        showTypeIndicator: true,
        type: element.element_type,

        // State based on completion
        state: element.completed ? 'success' : 'default',

        // Interactive handlers
        onClick: (e, edge) => {
          // Open curriculum element details
          showElementDetails(element);
        },
      },
    };
  });
}

function determineEdgeType(element) {
  if (element.completed) return 'successGlow';
  if (element.in_progress) return 'activeDataFlow';
  if (element.requires_attention) return 'warningGlow';
  return 'smart';
}

function calculateStrength(element) {
  // Calculate based on curriculum-specific factors
  const factors = [
    element.confidence || 0.5,
    element.evidence_count ? Math.min(element.evidence_count / 10, 1) : 0.5,
    element.review_status === 'approved' ? 1 : 0.5,
  ];
  return factors.reduce((a, b) => a + b, 0) / factors.length;
}
```

---

## Integration Checklist

When integrating enhanced edges:

- [ ] Import `edgeTypes` and register with ReactFlow
- [ ] Map existing edge data to new format
- [ ] Choose appropriate edge types for relationships
- [ ] Add labels and metadata
- [ ] Configure interaction handlers
- [ ] Apply consistent styling (use presets)
- [ ] Test performance with production data
- [ ] Verify accessibility
- [ ] Add error handling for missing nodes
- [ ] Document custom configurations

---

## Common Patterns

### Pattern 1: Type-Based Styling
```jsx
const getEdgeConfig = (sourceType, targetType) => {
  // Return appropriate edge config based on node types
};
```

### Pattern 2: State-Based Styling
```jsx
const getEdgeState = (edge) => {
  // Return edge config based on validation/completion state
};
```

### Pattern 3: Interactive Edges
```jsx
const addEdgeHandlers = (edge) => ({
  ...edge,
  data: {
    ...edge.data,
    onClick: handleClick,
    onContextMenu: handleContextMenu,
  },
});
```

### Pattern 4: Progressive Enhancement
```jsx
// Start with simple edges
const baseEdges = edges.map(e => ({ ...e, type: 'animated' }));

// Enhance based on context
const enhancedEdges = shouldEnhance
  ? baseEdges.map(e => applyEdgePreset(e, 'elegant'))
  : baseEdges;
```

---

## Best Practices

1. **Start Simple** - Use `smart` or `animated` as defaults
2. **Progressive Enhancement** - Add complex edges only where needed
3. **Consistent Theming** - Use presets for uniform appearance
4. **Performance First** - Monitor FPS with large graphs
5. **Meaningful Labels** - Provide clear relationship descriptions
6. **State Indication** - Use visual cues for status
7. **Accessibility** - Ensure color contrast and alternatives
8. **Error Handling** - Validate edge data before rendering

---

These examples demonstrate how to integrate the enhanced edges with the existing TEA curriculum components while maintaining performance and usability.
