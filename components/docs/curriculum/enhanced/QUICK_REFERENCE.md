# Collapsible Node System - Quick Reference

One-page reference for the collapsible node system.

---

## 5-Minute Quick Start

```javascript
// 1. Import components
import {
  CollapsibleNode,
  NodeStateManager,
  NodeStateControls,
} from '@/components/curriculum/enhanced';

// 2. Define node types
const nodeTypes = {
  collapsible: CollapsibleNode,
};

// 3. Create nodes with nodeType
const nodes = [
  {
    id: 'goal-1',
    type: 'collapsible',
    position: { x: 100, y: 100 },
    data: {
      id: 'goal-1',
      name: 'Goal Name',
      description: 'Short description',
      long_description: 'Full description when expanded',
    },
    nodeType: 'goal', // Important!
  },
];

// 4. Wrap with NodeStateManager
<ReactFlowProvider>
  <NodeStateManager persistKey="my-flow" showControls={true}>
    <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
  </NodeStateManager>
</ReactFlowProvider>
```

Done! You now have collapsible nodes.

---

## Component Cheat Sheet

### CollapsibleNode
```javascript
<CollapsibleNode
  id="node-1"
  data={{ id, name, description, long_description }}
  selected={false}
  nodeType="goal"  // goal, strategy, propertyClaim, evidence, context
/>
```

### NodeStateManager
```javascript
<NodeStateManager
  persistKey="my-key"        // localStorage key
  defaultExpanded={false}    // initial state
  showControls={true}        // show built-in controls
  onStateChange={callback}   // state change events
>
  {children}
</NodeStateManager>
```

### NodeStateControls
```javascript
<NodeStateControls />
// Shows: stats, expand all, collapse all, reset
```

---

## Variants

```javascript
import {
  CollapsibleNode,           // Basic
  ProgressiveCollapsibleNode, // Auto-reveals children
  FocusCollapsibleNode,       // Collapses siblings
  ControlledCollapsibleNode,  // Shows tree controls
  MemoizedCollapsibleNode,    // Performance-optimized
} from '@/components/curriculum/enhanced';
```

---

## Hook Usage

### Basic Hook
```javascript
import { useNodeState } from '@/components/curriculum/enhanced';

const { isNodeExpanded, toggleNode, expandAll } = useNodeState({
  persistKey: 'my-key',
  defaultExpanded: false,
  debounceMs: 100,
});
```

### With Context
```javascript
import { useNodeStateContext } from '@/components/curriculum/enhanced';

const context = useNodeStateContext();
// Same API as useNodeState, plus nodes/edges
```

### With Flow Integration
```javascript
import { useNodeStateWithFlow } from '@/components/curriculum/enhanced';

const {
  toggleNodeRecursive,
  expandSelected,
  getExpansionMap,
} = useNodeStateWithFlow();
```

---

## Common Operations

### Expand/Collapse Individual Nodes
```javascript
const { toggleNode, expandNode, collapseNode } = useNodeStateContext();

toggleNode('node-1');           // Toggle
expandNode('node-1');           // Expand
collapseNode('node-1');         // Collapse
```

### Bulk Operations
```javascript
const { expandAll, collapseAll } = useNodeStateContext();

expandAll();                    // Expand all
collapseAll();                  // Collapse all
```

### Focus Mode
```javascript
const { focusMode, allNodeIds } = useNodeStateContext();

focusMode(['node-1', 'node-2'], allNodeIds);
// Collapse all except node-1 and node-2
```

### Tree Operations
```javascript
const { expandPathToNode, expandNodeTree } = useNodeStateContext();

expandPathToNode('node-5');     // Expand path from root to node-5
expandNodeTree('node-1');       // Expand node-1 and all descendants
```

### Statistics
```javascript
const { getStats } = useNodeStateContext();

const stats = getStats();
// { total, expanded, collapsed, percentExpanded }
```

---

## Node Data Structure

```javascript
{
  id: 'unique-id',              // Required
  type: 'collapsible',          // Node type for ReactFlow
  position: { x: 100, y: 100 }, // Position
  data: {
    id: 'unique-id',            // Same as parent id
    name: 'Node Title',         // Required
    description: 'Short',       // Optional (for preview)
    long_description: 'Full',   // Optional (for expanded)
  },
  nodeType: 'goal',             // Required: goal, strategy, propertyClaim, evidence, context
}
```

---

## Node Types & Colors

| nodeType | Color | Icon | Use Case |
|----------|-------|------|----------|
| `goal` | Green | Target | Top-level goals |
| `strategy` | Purple | GitBranch | Decomposition strategies |
| `propertyClaim` | Orange | FileText | Property claims |
| `evidence` | Cyan | CheckCircle | Evidence items |
| `context` | Gray | AlertCircle | Context information |

---

## Specifications (from REACT_FLOW.md)

- **Collapsed width**: 200-250px
- **Expanded width**: 350-400px
- **Transition**: 300ms spring physics
- **Click**: Toggle expand/collapse
- **Double-click**: Expand tree
- **Selection**: Auto-expand

---

## Performance Tips

```javascript
// 1. Use memoized variant for large diagrams
import { MemoizedCollapsibleNode } from '@/components/curriculum/enhanced';

// 2. Increase debounce for slower systems
<NodeStateManager debounceMs={200}>

// 3. Disable persistence for very large diagrams
<NodeStateManager persistKey={null}>

// 4. Use selective expansion
focusMode([...selectedNodes], allNodeIds);
```

---

## Troubleshooting

### Nodes not collapsing?
1. Check you're inside `<NodeStateManager>`
2. Verify node data has `id` field
3. Check node has `nodeType` prop

### State not persisting?
1. Verify `persistKey` is set
2. Check localStorage is enabled
3. Try clearing localStorage

### Performance issues?
1. Use `MemoizedCollapsibleNode`
2. Increase `debounceMs`
3. Disable persistence
4. Limit simultaneous operations

---

## Custom Content

```javascript
<CollapsibleNode data={data} nodeType="goal">
  <div className="space-y-2">
    {/* Your custom content here */}
    <p>Status: Active</p>
    <button onClick={...}>View Details</button>
  </div>
</CollapsibleNode>
```

---

## Events

```javascript
<NodeStateManager
  onStateChange={(event) => {
    console.log('Operation:', event.operation);
    console.log('Args:', event.args);
    console.log('Stats:', event.stats);
  }}
>
```

Operations: `toggle`, `expand`, `collapse`, `expandAll`, `collapseAll`, `focusMode`, `expandPath`, `expandTree`, `reset`

---

## Migration from InteractiveCaseViewer

```javascript
// Before
import InteractiveCaseViewer from './InteractiveCaseViewer';
<InteractiveCaseViewer caseData={data} />

// After
import { EnhancedInteractiveCaseViewer } from './enhanced/demos';
<EnhancedInteractiveCaseViewer
  caseData={data}
  persistKey="viewer"
  showControls={true}
/>
```

---

## Documentation

- **Complete docs**: `COLLAPSIBLE_NODES.md`
- **Examples**: `demos/CollapsibleNodeDemo.jsx`
- **Migration**: `demos/IntegrationExample.jsx`
- **Spec**: `REACT_FLOW.md` (Sections 3.2, 5.2)

---

## File Locations

```
/components/curriculum/enhanced/
├── nodes/
│   ├── CollapsibleNode.jsx
│   ├── NodeStateManager.jsx
│   └── useNodeState.js
└── demos/
    ├── CollapsibleNodeDemo.jsx
    └── IntegrationExample.jsx
```

---

## Common Patterns

### Pattern 1: Progressive Disclosure
```javascript
const nodeTypes = {
  progressive: ProgressiveCollapsibleNode,
};
// Children auto-reveal when parent expands
```

### Pattern 2: Focus Mode Navigation
```javascript
const handleNodeClick = (event, node) => {
  focusMode([node.id], allNodeIds);
};
// Click to focus on one node
```

### Pattern 3: Guided Path
```javascript
useEffect(() => {
  expandPathToNode(currentStepId);
}, [currentStepId]);
// Show path as user progresses
```

---

## Accessibility

✅ Keyboard: Tab, Enter, Space
✅ ARIA: Proper labels and roles
✅ Screen readers: Full support
✅ Reduced motion: Auto-detected
✅ Focus indicators: Visible

---

**For complete documentation, see COLLAPSIBLE_NODES.md**
