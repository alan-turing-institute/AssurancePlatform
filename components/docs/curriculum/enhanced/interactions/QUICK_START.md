# Node Creation System - Quick Start Guide

## 30-Second Setup

```jsx
import { ReactFlowProvider, useNodesState } from 'reactflow';
import { useNodeCreator, NodeTypeSelector } from './interactions';
import { nodeTypes } from './nodes';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const { createNode, recentTypes } = useNodeCreator();

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        onPaneDoubleClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setIsOpen(true);
        }}
      />
      <NodeTypeSelector
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelectType={(type, position) => {
          createNode(type, position || pos);
          setIsOpen(false);
        }}
        position={pos}
        recentTypes={recentTypes}
      />
    </ReactFlowProvider>
  );
}
```

## Essential Hooks

### useNodeCreator
```jsx
const {
  createNode,         // (type, position, data?) => node
  undo,              // () => void
  redo,              // () => void
  canUndo,           // boolean
  canRedo,           // boolean
  recentTypes,       // string[]
} = useNodeCreator();
```

### useNodePositioner
```jsx
const {
  calculateOptimalPosition,  // (pos, options?) => position
  getConnectionHints,        // (pos) => hint[]
  autoArrange,              // () => void
} = useNodePositioner();
```

## Common Patterns

### Basic Node Creation
```jsx
createNode('goal', { x: 100, y: 100 });
```

### With Custom Data
```jsx
createNode('goal', { x: 100, y: 100 }, {
  name: 'Custom Name',
  description: 'Custom description',
  importance: 'critical'
});
```

### Batch Creation
```jsx
createNodes([
  { type: 'goal', position: { x: 100, y: 100 } },
  { type: 'strategy', position: { x: 100, y: 300 } }
]);
```

### Template Creation
```jsx
createFromTemplate(template, { x: 100, y: 100 });
```

## Keyboard Shortcuts

**In Type Selector:**
- `G` - Goal
- `S` - Strategy
- `C` - Claim
- `E` - Evidence
- `X` - Context
- `↑↓` - Navigate
- `Enter` - Select
- `Esc` - Close

**Global:**
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Shift + Z` - Redo

## Utility Functions

```jsx
import {
  generateNodeId,
  snapToGrid,
  findNonOverlappingPosition,
  validateNodeCreation,
} from './interactions';

// Generate ID
const id = generateNodeId('goal'); // "goal-1699123456-abc12"

// Snap to grid
const snapped = snapToGrid({ x: 105, y: 205 }, 20); // {x:100, y:200}

// Find safe position
const safe = findNonOverlappingPosition(position, nodes);

// Validate
const { valid, error } = validateNodeCreation('goal', position, nodes);
```

## Configuration

### Positioning Options
```jsx
const position = calculateOptimalPosition(basePosition, {
  enableGridSnap: true,
  enableMagneticSnap: true,
  enableOverlapAvoidance: true,
  sourceNode: parentNode,
});
```

### Creation Preferences
```jsx
import { saveCreationPreferences } from './interactions';

saveCreationPreferences({
  gridSnap: true,
  autoConnect: false,
  quickCreateEnabled: true,
  defaultNodeType: 'goal'
});
```

## Styling

All components use Tailwind + glassmorphism:

```jsx
// Custom styling example
<NodeTypeSelector
  className="custom-class"
  // Uses: bg-background-transparent-black, backdrop-blur-lg
/>
```

## Error Handling

```jsx
const { createNode } = useNodeCreator({
  onNodeCreated: (node) => console.log('✓', node),
  onCreationError: (error) => console.error('✗', error),
});
```

## Visual Feedback

```jsx
// Enable/disable ripple effect
<DoubleClickHandler
  showVisualFeedback={true}
  onDoubleClick={handleClick}
/>

// Show positioning guides
const { alignmentGuides, isSnapping } = useNodePositioner({
  showGuides: true,
  showGrid: false,
});
```

## Testing

```jsx
import { render, fireEvent } from '@testing-library/react';

test('creates node on double-click', () => {
  const { createNode } = useNodeCreator();
  const node = createNode('goal', { x: 100, y: 100 });

  expect(node.type).toBe('goal');
  expect(node.id).toMatch(/^goal-/);
  expect(node.position).toEqual({ x: 100, y: 100 });
});
```

## Common Issues

**Type selector not opening?**
- Ensure ReactFlowProvider wraps component
- Check `isOpen` state is being set
- Verify `onPaneDoubleClick` is bound

**Nodes overlapping?**
- Enable overlap avoidance in positioner
- Use `findNonOverlappingPosition()`
- Increase padding between nodes

**Undo not working?**
- Enable undo in hook options: `enableUndo: true`
- Check `canUndo` state
- Verify node was created via `createNode()`

## Performance Tips

1. **Debounce**: Already handled (300ms)
2. **Lazy Load**: Selector only mounts when open
3. **Memoize**: Position calculations cached
4. **Local Storage**: Recent types persisted

## Examples

### Full-Featured Demo
```bash
# See: NodeCreationDemo.jsx
import { NodeCreationDemo } from './interactions';
<NodeCreationDemo />
```

### Minimal Demo
```bash
# See: SimpleNodeCreationDemo
import { SimpleNodeCreationDemo } from './interactions';
<SimpleNodeCreationDemo />
```

## Documentation

- **README.md** - Complete API documentation
- **ARCHITECTURE.md** - System architecture & flow
- **TASK_4_1_SUMMARY.md** - Implementation summary

## Support

For issues or questions:
1. Check README.md for detailed docs
2. Review NodeCreationDemo.jsx for examples
3. See ARCHITECTURE.md for system design

---

**Quick Start Guide v1.0**
*Updated: 2025-11-10*
