# Collapsible Node System Documentation

**Version:** 1.0
**Date:** 2025-11-10
**Status:** Implemented

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Integration Guide](#integration-guide)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Collapsible Node System provides a comprehensive state management solution for React Flow nodes that can expand and collapse. It implements the specifications from `REACT_FLOW.md` Sections 3.2 and 5.2, offering:

- **Centralized State Management**: Global state for all collapsible nodes via Context API
- **Progressive Disclosure**: Automatically reveal/hide connected nodes
- **Smooth Animations**: Framer Motion-powered transitions
- **Persistent State**: Optional localStorage persistence
- **Bulk Operations**: Expand/collapse all, focus mode, tree operations
- **Performance Optimized**: Memoization, debouncing, and efficient re-renders

### Key Features

✅ Click to expand/collapse individual nodes
✅ Double-click to expand entire subtree
✅ Auto-expand on node selection
✅ Preview mode (collapsed) showing title + first line
✅ Full mode (expanded) showing complete content
✅ Smooth height transitions (300ms with spring physics)
✅ Focus mode - collapse all except selected path
✅ localStorage persistence of state

---

## Architecture

### Component Hierarchy

```
NodeStateManager (Context Provider)
├── NodeStateControls (Toolbar)
└── ReactFlow
    └── CollapsibleNode (Wrapper)
        └── BaseNode (Visual Component)
```

### State Flow

```
User Interaction
    ↓
CollapsibleNode
    ↓
useNodeStateContext (if available)
    ↓
NodeStateManager
    ↓
useNodeState hook
    ↓
Update state + localStorage
    ↓
Re-render affected nodes
```

---

## Components

### 1. useNodeState Hook

Custom hook for managing collapsed/expanded state of nodes.

**Location:** `components/curriculum/enhanced/nodes/useNodeState.js`

**Features:**
- Track collapsed/expanded state per node ID
- Bulk operations (expand all, collapse all)
- Optional localStorage persistence
- Tree operations (expand path, expand tree)
- Focus mode
- Statistics and debugging

**Example:**
```javascript
import { useNodeState } from './enhanced/nodes';

const MyComponent = () => {
  const {
    isNodeExpanded,
    toggleNode,
    expandAll,
    collapseAll,
    focusMode,
  } = useNodeState({
    persistKey: 'my-flow',
    defaultExpanded: false,
    debounceMs: 100,
  });

  return (
    <button onClick={() => toggleNode('node-1')}>
      {isNodeExpanded('node-1') ? 'Collapse' : 'Expand'}
    </button>
  );
};
```

### 2. NodeStateManager Component

Context provider for centralized state management.

**Location:** `components/curriculum/enhanced/nodes/NodeStateManager.jsx`

**Props:**
```typescript
interface NodeStateManagerProps {
  children: React.ReactNode;
  persistKey?: string | null;          // localStorage key
  defaultExpanded?: boolean;            // Default state for new nodes
  autoExpandOnSelect?: boolean;         // Auto-expand on selection
  debounceMs?: number;                  // Debounce delay
  onStateChange?: (event) => void;      // State change callback
  showControls?: boolean;               // Show built-in controls
  className?: string;                   // Additional CSS classes
}
```

**Example:**
```javascript
import { NodeStateManager } from './enhanced/nodes';

<NodeStateManager
  persistKey="my-case-viewer"
  defaultExpanded={false}
  showControls={true}
  onStateChange={(event) => console.log('State changed:', event)}
>
  <ReactFlow nodes={nodes} edges={edges} />
</NodeStateManager>
```

### 3. CollapsibleNode Component

Wrapper around BaseNode with state integration.

**Location:** `components/curriculum/enhanced/nodes/CollapsibleNode.jsx`

**Props:**
```typescript
interface CollapsibleNodeProps {
  id: string;                           // Node ID
  data: {
    id: string;
    name: string;
    description?: string;
    long_description?: string;
  };
  selected?: boolean;                   // Is selected
  isConnectable?: boolean;              // Can connect
  children?: React.ReactNode;           // Extra content
  nodeType?: string;                    // goal, strategy, etc.
  defaultExpanded?: boolean;            // Initial state
  onExpandChange?: (expanded) => void;  // Callback
  onClick?: (event) => void;            // Click handler
  onDoubleClick?: (event) => void;      // Double-click handler
  enableDoubleClickExpand?: boolean;    // Enable double-click tree expand
  autoExpandOnSelect?: boolean;         // Auto-expand on select
  className?: string;                   // Additional classes
}
```

**Example:**
```javascript
import { CollapsibleNode } from './enhanced/nodes';

const nodeTypes = {
  collapsible: CollapsibleNode,
};

const node = {
  id: 'goal-1',
  type: 'collapsible',
  position: { x: 100, y: 100 },
  data: {
    id: 'goal-1',
    name: 'Safety Goal',
    description: 'System shall be safe',
  },
  nodeType: 'goal',
};

<ReactFlow nodes={[node]} nodeTypes={nodeTypes} />
```

### 4. CollapsibleNode Variants

#### FocusCollapsibleNode
Auto-collapses sibling nodes when expanded.

```javascript
import { FocusCollapsibleNode } from './enhanced/nodes';

const nodeTypes = {
  focus: FocusCollapsibleNode,
};
```

#### ProgressiveCollapsibleNode
Auto-reveals connected child nodes when expanded.

```javascript
import { ProgressiveCollapsibleNode } from './enhanced/nodes';

const nodeTypes = {
  progressive: ProgressiveCollapsibleNode,
};
```

#### ControlledCollapsibleNode
Shows additional control buttons (Expand Tree, Collapse Tree, Show Path).

```javascript
import { ControlledCollapsibleNode } from './enhanced/nodes';

const nodeTypes = {
  controlled: ControlledCollapsibleNode,
};
```

### 5. NodeStateControls Component

Built-in toolbar for bulk operations.

**Location:** `components/curriculum/enhanced/nodes/NodeStateManager.jsx`

**Features:**
- Displays expansion statistics
- Expand All button
- Collapse All button
- Reset button

**Example:**
```javascript
import { NodeStateControls } from './enhanced/nodes';

<div className="absolute top-4 left-4 z-10">
  <NodeStateControls />
</div>
```

---

## Usage Examples

### Basic Implementation

```javascript
import React from 'react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import {
  CollapsibleNode,
  NodeStateManager,
} from './components/curriculum/enhanced/nodes';
import 'reactflow/dist/style.css';

const nodeTypes = {
  collapsible: CollapsibleNode,
};

const BasicExample = () => {
  const nodes = [
    {
      id: '1',
      type: 'collapsible',
      position: { x: 100, y: 100 },
      data: {
        id: '1',
        name: 'Goal',
        description: 'Short description',
        long_description: 'Full description shown when expanded',
      },
      nodeType: 'goal',
    },
  ];

  return (
    <ReactFlowProvider>
      <NodeStateManager persistKey="basic-example">
        <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
      </NodeStateManager>
    </ReactFlowProvider>
  );
};
```

### With Controls and Callbacks

```javascript
import {
  CollapsibleNode,
  NodeStateManager,
  NodeStateControls,
} from './components/curriculum/enhanced/nodes';

const AdvancedExample = () => {
  const handleStateChange = (event) => {
    console.log('Operation:', event.operation);
    console.log('Stats:', event.stats);
  };

  return (
    <ReactFlowProvider>
      <NodeStateManager
        persistKey="advanced-example"
        defaultExpanded={false}
        onStateChange={handleStateChange}
      >
        {/* Controls */}
        <div className="absolute top-4 left-4 z-10">
          <NodeStateControls />
        </div>

        {/* Flow */}
        <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
      </NodeStateManager>
    </ReactFlowProvider>
  );
};
```

### Using the Hook Directly

```javascript
import { useNodeState } from './components/curriculum/enhanced/nodes';

const CustomControls = () => {
  const {
    expandAll,
    collapseAll,
    focusMode,
    getStats,
    allNodeIds,
  } = useNodeState({ persistKey: 'custom' });

  const stats = getStats();

  const handleFocusFirstNode = () => {
    focusMode([allNodeIds[0]], allNodeIds);
  };

  return (
    <div>
      <p>Expanded: {stats.expanded}/{stats.total}</p>
      <button onClick={expandAll}>Expand All</button>
      <button onClick={collapseAll}>Collapse All</button>
      <button onClick={handleFocusFirstNode}>Focus First</button>
    </div>
  );
};
```

### Integration with Existing InteractiveCaseViewer

See `IntegrationExample.jsx` for a complete migration example.

Key changes:
1. Wrap ReactFlow with `NodeStateManager`
2. Change node type to `'collapsible'`
3. Add `nodeType` to node data
4. Add `NodeStateControls` for controls

---

## API Reference

### useNodeState Hook

```typescript
const {
  // State queries
  isNodeExpanded: (nodeId: string) => boolean,
  nodeStates: Record<string, boolean>,
  getStats: () => { total, expanded, collapsed, percentExpanded },

  // Individual operations
  setNodeState: (nodeId: string, isExpanded: boolean) => void,
  toggleNode: (nodeId: string) => void,
  expandNode: (nodeId: string) => void,
  collapseNode: (nodeId: string) => void,

  // Bulk operations
  expandNodes: (nodeIds: string[]) => void,
  collapseNodes: (nodeIds: string[]) => void,
  expandAll: (allNodeIds?: string[]) => void,
  collapseAll: (allNodeIds?: string[]) => void,

  // Advanced operations
  focusMode: (focusNodeIds: string[], allNodeIds: string[]) => void,
  expandPathToNode: (nodeId: string, nodes, edges) => void,
  expandNodeTree: (nodeId: string, nodes, edges) => void,
  resetAll: () => void,

  // Debounced operations
  debouncedExpandAll: (...args) => void,
  debouncedCollapseAll: (...args) => void,
  debouncedFocusMode: (...args) => void,
} = useNodeState(config);
```

### useNodeStateContext Hook

Access the node state context from within a `NodeStateManager`.

```typescript
const context = useNodeStateContext();
// Returns same API as useNodeState, plus:
// - allNodeIds: string[]
// - nodes: ReactFlow nodes array
// - edges: ReactFlow edges array
```

### useNodeStateWithFlow Hook

Enhanced version with additional React Flow utilities.

```typescript
const {
  ...nodeStateAPI,
  toggleNodeRecursive: (nodeId: string, recursive: boolean) => void,
  expandSelected: (selectedNodeIds: string[]) => void,
  getExpansionMap: () => Map<string, boolean>,
} = useNodeStateWithFlow();
```

---

## Integration Guide

### Step 1: Install Dependencies

Already included in the project:
- `reactflow`
- `framer-motion`
- `lucide-react`

### Step 2: Import Components

```javascript
import {
  CollapsibleNode,
  NodeStateManager,
  NodeStateControls,
} from './components/curriculum/enhanced/nodes';
```

### Step 3: Update Node Types

```javascript
const nodeTypes = {
  collapsible: CollapsibleNode,
  // Or use variants:
  progressive: ProgressiveCollapsibleNode,
  controlled: ControlledCollapsibleNode,
};
```

### Step 4: Add nodeType to Node Data

```javascript
const nodes = [
  {
    id: 'goal-1',
    type: 'collapsible',
    data: {
      id: 'goal-1',
      name: 'Goal',
      description: 'Description',
    },
    nodeType: 'goal', // Add this!
  },
];
```

### Step 5: Wrap with NodeStateManager

```javascript
<ReactFlowProvider>
  <NodeStateManager persistKey="my-flow">
    <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
  </NodeStateManager>
</ReactFlowProvider>
```

### Step 6: Add Controls (Optional)

```javascript
<NodeStateManager>
  <NodeStateControls />
  <ReactFlow ... />
</NodeStateManager>
```

---

## Performance Considerations

### Optimization Strategies

1. **Use Memoization**
   ```javascript
   import { MemoizedCollapsibleNode } from './enhanced/nodes';

   const nodeTypes = {
     collapsible: MemoizedCollapsibleNode,
   };
   ```

2. **Debounce Rapid Actions**
   ```javascript
   const { debouncedExpandAll } = useNodeState({
     debounceMs: 200, // Increase for slower systems
   });
   ```

3. **Limit Persisted State**
   ```javascript
   // Don't persist for large diagrams
   <NodeStateManager persistKey={null}>
   ```

4. **Use Selective Updates**
   ```javascript
   // Only expand specific nodes instead of all
   expandNodes(['node-1', 'node-2', 'node-3']);
   ```

### Performance Tips

- **Collapsed state**: 200-250px width (per spec)
- **Expanded state**: 350-400px width (per spec)
- **Transition duration**: 300ms (optimal for perceived speed)
- **Debounce**: 100ms default (adjust based on diagram size)

### Bundle Size Impact

- `useNodeState.js`: ~3KB
- `NodeStateManager.jsx`: ~4KB
- `CollapsibleNode.jsx`: ~5KB
- **Total**: ~12KB (minified + gzipped)

---

## Troubleshooting

### Issue: Nodes not collapsing/expanding

**Solution 1**: Ensure you're inside `NodeStateManager`
```javascript
// ❌ Wrong
<ReactFlow nodes={nodes} nodeTypes={{ collapsible: CollapsibleNode }} />

// ✅ Correct
<NodeStateManager>
  <ReactFlow nodes={nodes} nodeTypes={{ collapsible: CollapsibleNode }} />
</NodeStateManager>
```

**Solution 2**: Check node data structure
```javascript
// Node data must have 'id' field
data: {
  id: 'node-1', // Required!
  name: 'Node Name',
}
```

### Issue: State not persisting

**Solution**: Check `persistKey` is set
```javascript
<NodeStateManager persistKey="my-unique-key">
```

**Debug**: Check localStorage
```javascript
// In browser console:
localStorage.getItem('my-unique-key');
```

### Issue: Performance degradation with many nodes

**Solutions**:
1. Use `MemoizedCollapsibleNode`
2. Increase debounce delay
3. Disable persistence for large diagrams
4. Use `onlyRenderVisibleElements` in ReactFlow

### Issue: Double-click not expanding tree

**Solution**: Ensure `enableDoubleClickExpand` is true
```javascript
<CollapsibleNode
  enableDoubleClickExpand={true}
  ...
/>
```

Also ensure node is inside `NodeStateManager` for tree operations.

### Issue: Animations not smooth

**Solutions**:
1. Check `prefers-reduced-motion` setting
2. Verify Framer Motion is installed
3. Ensure transitions aren't being overridden by CSS

---

## Migration from InteractiveCaseViewer

See `IntegrationExample.jsx` for a complete working example.

### Before (Current)
```javascript
import InteractiveCaseViewer from './InteractiveCaseViewer';

<InteractiveCaseViewer caseData={data} />
```

### After (Enhanced)
```javascript
import { EnhancedInteractiveCaseViewer } from './enhanced/demos';

<EnhancedInteractiveCaseViewer
  caseData={data}
  persistKey="my-viewer"
  showControls={true}
/>
```

### Minimal Changes Required

1. Import new component
2. Add `persistKey` prop (optional)
3. Add `showControls` prop (optional)

All other props remain compatible!

---

## Future Enhancements

Potential additions for future versions:

1. **Keyboard Shortcuts**
   - `Ctrl+E`: Expand all
   - `Ctrl+C`: Collapse all
   - `Arrow keys`: Navigate between nodes

2. **Animation Variants**
   - Custom easing functions
   - Stagger animations for children
   - Directional reveals

3. **Advanced State**
   - Undo/redo state changes
   - State history/timeline
   - Sync state across browser tabs

4. **Accessibility**
   - Screen reader announcements
   - ARIA live regions for state changes
   - Keyboard navigation improvements

---

## Resources

- **REACT_FLOW.md**: Main specification document
- **CollapsibleNodeDemo.jsx**: Interactive demonstration
- **IntegrationExample.jsx**: Migration guide with examples
- [React Flow Documentation](https://reactflow.dev/)
- [Framer Motion Documentation](https://www.framer.com/motion/)

---

## Support

For issues or questions:

1. Check this documentation
2. Review demo implementations
3. Check REACT_FLOW.md specification
4. Examine component source code (heavily commented)

---

**End of Documentation**
