# Node Creation Interactions

Double-click node creation system for React Flow, inspired by FloraFauna.ai interface patterns.

## Overview

This module provides a complete node creation workflow with:
- **Double-click detection** on canvas with visual feedback
- **Node type selector** with previews and keyboard navigation
- **Smart positioning** with overlap avoidance and alignment guides
- **Creation utilities** for ID generation, validation, and history management
- **Undo/redo** support for creation operations
- **Template system** for common node patterns

## Components

### DoubleClickHandler

Detects double-click interactions on the React Flow canvas and triggers node creation workflow.

**Features:**
- Double-click detection with debouncing
- Visual feedback (ripple effect at click point)
- Keyboard shortcuts (Shift+Click for quick create)
- Edge case handling (clicking on nodes/edges)
- World coordinate calculation

**Usage:**
```jsx
import { DoubleClickHandler } from './interactions';

function MyFlow() {
  const handleDoubleClick = (flowPosition, event) => {
    console.log('Double-click at:', flowPosition);
    // Open node type selector
  };

  return (
    <DoubleClickHandler
      onDoubleClick={handleDoubleClick}
      enabled={true}
      showVisualFeedback={true}
    >
      <ReactFlow {...props} />
    </DoubleClickHandler>
  );
}
```

**Hook API:**
```jsx
import { useDoubleClickHandler } from './interactions';

const {
  handleDoubleClick,
  handleQuickCreate,
  isProcessing
} = useDoubleClickHandler({
  onDoubleClick: (position) => console.log(position),
  enabled: true,
});
```

### NodeTypeSelector

Modal dialog for selecting node type with visual previews, search, and keyboard navigation.

**Features:**
- Grid layout with node type previews
- Icon and color coding for each type
- Hover effects showing more info
- Quick create shortcuts (G for Goal, S for Strategy, etc.)
- Recent types at the top
- Search/filter functionality
- Keyboard navigation (arrow keys + enter)
- Template system for common patterns

**Usage:**
```jsx
import { NodeTypeSelector } from './interactions';

function MyFlow() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const handleSelectType = (nodeType, position) => {
    // Create node of selected type
    console.log('Selected:', nodeType, 'at', position);
  };

  return (
    <NodeTypeSelector
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSelectType={handleSelectType}
      onSelectTemplate={handleSelectTemplate}
      position={position}
      recentTypes={['goal', 'strategy']}
      showTemplates={true}
      showSearch={true}
    />
  );
}
```

**Compact Version:**
```jsx
import { CompactNodeTypeSelector } from './interactions';

<CompactNodeTypeSelector
  onSelectType={(type) => console.log(type)}
  recentTypes={['goal']}
/>
```

### NodeCreator

Manages the node creation workflow, integrating with React Flow instance.

**Features:**
- Node ID generation
- Default node data based on type
- Undo/redo support
- Position validation
- Creation history management
- Batch creation
- Template-based creation

**Usage:**
```jsx
import { useNodeCreator } from './interactions';

function MyFlow() {
  const {
    createNode,
    createNodes,
    createFromTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
    creationHistory,
    recentTypes,
    preferences,
  } = useNodeCreator({
    onNodeCreated: (node) => console.log('Created:', node),
    onCreationError: (error) => console.error(error),
    enableUndo: true,
  });

  const handleCreate = () => {
    createNode('goal', { x: 100, y: 100 }, {
      name: 'Custom Goal',
      description: 'My custom goal'
    });
  };

  return (
    <div>
      <button onClick={handleCreate}>Create Goal</button>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </div>
  );
}
```

**Batch Creation:**
```jsx
createNodes([
  { type: 'goal', position: { x: 100, y: 100 } },
  { type: 'strategy', position: { x: 100, y: 300 } },
  { type: 'evidence', position: { x: 100, y: 500 } },
]);
```

**Template Creation:**
```jsx
const template = {
  name: 'Simple Goal Pattern',
  nodes: [
    { type: 'goal', name: 'Main Goal' },
    { type: 'strategy', name: 'Strategy', offsetY: 150 },
  ],
};

createFromTemplate(template, { x: 100, y: 100 });
```

### NodePositioner

Smart positioning system with overlap avoidance, grid snapping, and alignment guides.

**Features:**
- Smart positioning to avoid overlaps
- Grid snapping option
- Alignment guides (visual indicators)
- Auto-arrange after creation
- Connection preview while positioning
- Magnetic edges for alignment

**Usage:**
```jsx
import { useNodePositioner } from './interactions';

function MyFlow() {
  const {
    calculateOptimalPosition,
    getConnectionHints,
    autoArrange,
    alignmentGuides,
    isSnapping,
  } = useNodePositioner({
    gridSize: 20,
    snapThreshold: 10,
    magneticThreshold: 20,
    showGuides: true,
    showGrid: false,
  });

  const position = calculateOptimalPosition(
    { x: 100, y: 100 },
    {
      enableGridSnap: true,
      enableMagneticSnap: true,
      enableOverlapAvoidance: true,
    }
  );

  return (
    <NodePositioner
      nodeType="goal"
      basePosition={{ x: 100, y: 100 }}
      onPositionChange={(pos) => console.log(pos)}
      showControls={true}
    />
  );
}
```

## Utility Functions

### Creation Utilities

```jsx
import {
  generateNodeId,
  screenToFlowPosition,
  snapToGrid,
  calculateDistance,
  checkPositionOverlap,
  findNonOverlappingPosition,
  calculateSmartPosition,
  getDefaultNodeData,
  createNodeObject,
  validateNodeCreation,
  calculateConnectionHints,
  getNodeTemplates,
} from './interactions';

// Generate unique node ID
const id = generateNodeId('goal'); // "goal-1699123456789-abc12"

// Convert screen to flow coordinates
const flowPos = screenToFlowPosition({ x: 100, y: 100 }, reactFlowInstance);

// Snap to grid
const snapped = snapToGrid({ x: 105, y: 205 }, 20); // { x: 100, y: 200 }

// Check overlap
const overlaps = checkPositionOverlap({ x: 100, y: 100 }, nodes);

// Find non-overlapping position
const safePos = findNonOverlappingPosition({ x: 100, y: 100 }, nodes);

// Calculate smart position based on parent nodes
const smartPos = calculateSmartPosition([parentNode], allNodes, 'auto');

// Validate creation
const validation = validateNodeCreation('goal', { x: 100, y: 100 }, nodes);
if (validation.valid) {
  // Create node
}

// Get connection hints
const hints = calculateConnectionHints({ x: 100, y: 100 }, nodes, 300);
// Returns: [{ nodeId, nodeName, direction, distance }]

// Get templates
const templates = getNodeTemplates();
```

### Persistence Utilities

```jsx
import {
  saveRecentTypes,
  loadRecentTypes,
  saveCreationPreferences,
  loadCreationPreferences,
} from './interactions';

// Save/load recent types
saveRecentTypes(['goal', 'strategy', 'evidence']);
const recent = loadRecentTypes(); // ['goal', 'strategy', 'evidence']

// Save/load preferences
saveCreationPreferences({
  gridSnap: true,
  autoConnect: false,
  quickCreateEnabled: true,
  defaultNodeType: 'goal',
});
const prefs = loadCreationPreferences();
```

## Complete Integration Example

```jsx
import React, { useState, useCallback } from 'react';
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import {
  useNodeCreator,
  NodeTypeSelector,
  useDoubleClickHandler,
} from './interactions';
import { nodeTypes } from './nodes/nodeTypes';

function NodeCreationFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [creationPosition, setCreationPosition] = useState(null);

  // Node creator hook
  const {
    createNode,
    createFromTemplate,
    undo,
    redo,
    canUndo,
    canRedo,
    recentTypes,
  } = useNodeCreator({
    onNodeCreated: (node) => console.log('Created:', node),
  });

  // Handle double-click
  const handleDoubleClick = useCallback((flowPosition) => {
    setCreationPosition(flowPosition);
    setIsTypeSelectorOpen(true);
  }, []);

  // Handle type selection
  const handleSelectType = useCallback((nodeType, position) => {
    createNode(nodeType, position || creationPosition);
    setIsTypeSelectorOpen(false);
  }, [createNode, creationPosition]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template, position) => {
    createFromTemplate(template, position || creationPosition);
    setIsTypeSelectorOpen(false);
  }, [createFromTemplate, creationPosition]);

  return (
    <div className="w-full h-screen">
      {/* Undo/Redo Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={undo} disabled={!canUndo}>Undo</button>
        <button onClick={redo} disabled={!canRedo}>Redo</button>
      </div>

      {/* React Flow */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onPaneDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          handleDoubleClick({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Node Type Selector */}
      <NodeTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={() => setIsTypeSelectorOpen(false)}
        onSelectType={handleSelectType}
        onSelectTemplate={handleSelectTemplate}
        position={creationPosition}
        recentTypes={recentTypes}
        showTemplates={true}
        showSearch={true}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <NodeCreationFlow />
    </ReactFlowProvider>
  );
}
```

## Keyboard Shortcuts

When the NodeTypeSelector is open:

- **Arrow Keys**: Navigate between node types
- **Enter**: Select highlighted node type
- **Escape**: Close selector
- **G**: Quick select Goal
- **S**: Quick select Strategy
- **C**: Quick select Claim
- **E**: Quick select Evidence
- **X**: Quick select Context

Global shortcuts:

- **Ctrl/Cmd + Z**: Undo last creation
- **Ctrl/Cmd + Shift + Z**: Redo last undone creation
- **Shift + Click**: Quick create with default type

## Customization

### Custom Node Templates

```jsx
import { getNodeTemplates } from './interactions';

const customTemplates = [
  {
    id: 'my-pattern',
    name: 'My Custom Pattern',
    description: 'A custom node pattern',
    nodes: [
      { type: 'goal', name: 'Top Goal' },
      { type: 'strategy', name: 'Main Strategy', offsetY: 150 },
      { type: 'propertyClaim', name: 'Claim 1', offsetY: 300, offsetX: -100 },
      { type: 'propertyClaim', name: 'Claim 2', offsetY: 300, offsetX: 100 },
    ],
  },
  ...getNodeTemplates(), // Include default templates
];
```

### Custom Positioning Logic

```jsx
import { useNodePositioner } from './interactions';

const { calculateOptimalPosition } = useNodePositioner({
  gridSize: 50, // Larger grid
  snapThreshold: 15, // More sensitive snapping
  magneticThreshold: 30, // Wider magnetic field
});

const customPosition = calculateOptimalPosition(basePosition, {
  enableGridSnap: true,
  enableMagneticSnap: false, // Disable magnetic snapping
  enableOverlapAvoidance: true,
});
```

### Custom Creation Preferences

```jsx
import { saveCreationPreferences } from './interactions';

saveCreationPreferences({
  gridSnap: false, // Disable grid snapping
  autoConnect: true, // Automatically connect new nodes
  quickCreateEnabled: true,
  defaultNodeType: 'strategy', // Default to strategy instead of goal
});
```

## Performance Considerations

1. **Debounced Click Detection**: Double-click detection is debounced to prevent rapid-fire events
2. **Lazy Loading**: Type selector is only rendered when open
3. **Memoization**: Position calculations are memoized to avoid recalculation
4. **Optimized Rendering**: Visual feedback components use AnimatePresence for smooth transitions
5. **Local Storage**: Recent types and preferences are cached in local storage

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

All modern browsers with support for:
- ES6+ features
- Local Storage
- CSS backdrop-filter (with fallbacks)

## Accessibility

- **Keyboard Navigation**: Full keyboard support in type selector
- **ARIA Labels**: Proper ARIA labels for screen readers
- **Focus Management**: Automatic focus management in dialogs
- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **Color Contrast**: WCAG AA compliant color contrasts

## Testing

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { useNodeCreator } from './interactions';

test('creates node with correct type and position', () => {
  const { createNode } = useNodeCreator();
  const node = createNode('goal', { x: 100, y: 100 });

  expect(node.type).toBe('goal');
  expect(node.position).toEqual({ x: 100, y: 100 });
  expect(node.id).toMatch(/^goal-/);
});
```

## Troubleshooting

**Issue: Double-click not detected**
- Ensure ReactFlowProvider wraps your component
- Check that `onPaneDoubleClick` is not overridden
- Verify debounce time is appropriate

**Issue: Nodes overlapping**
- Enable overlap avoidance in positioning options
- Increase minimum padding between nodes
- Use `findNonOverlappingPosition` utility

**Issue: Grid snapping not working**
- Check that `gridSnap` preference is enabled
- Verify grid size matches your design
- Ensure snap calculations use correct units

## Future Enhancements

- [ ] AI-suggested node connections
- [ ] Multi-select bulk operations
- [ ] Drag-and-drop from palette
- [ ] Node creation animations
- [ ] Connection validation rules
- [ ] Custom node creation wizards
- [ ] Collaborative creation indicators

## License

Part of the TEA Assurance Platform project.
