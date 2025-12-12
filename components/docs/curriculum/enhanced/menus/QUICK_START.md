# Context Menu System - Quick Start Guide

Get up and running with context menus in 5 minutes.

## Installation

No additional dependencies needed! The context menu system uses existing packages:
- `react`, `reactflow`, `framer-motion`, `lucide-react`, `tailwindcss`

## Basic Setup (3 Steps)

### Step 1: Import Hooks

```javascript
import {
  useNodeContextMenu,
  useEdgeContextMenu,
  useCanvasContextMenu,
} from '@/components/curriculum/enhanced/menus';
```

### Step 2: Initialize Hooks

```javascript
function MyFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();

  const {
    handleNodeContextMenu,
    NodeContextMenu,
  } = useNodeContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
  });

  const { handleEdgeContextMenu, EdgeContextMenu } = useEdgeContextMenu({
    edges,
    setEdges,
    reactFlowInstance,
  });

  const { handlePaneContextMenu, CanvasContextMenu } = useCanvasContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
  });

  // ... rest of component
}
```

### Step 3: Attach Handlers & Render Menus

```javascript
return (
  <>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeContextMenu={handleNodeContextMenu}
      onEdgeContextMenu={handleEdgeContextMenu}
      onPaneContextMenu={handlePaneContextMenu}
    />
    {NodeContextMenu}
    {EdgeContextMenu}
    {CanvasContextMenu}
  </>
);
```

That's it! You now have fully functional context menus.

## Usage

- **Right-click a node** → Node-specific menu appears
- **Right-click an edge** → Edge menu appears
- **Right-click empty space** → Canvas menu appears
- **Select multiple nodes** → Multi-select menu appears

## Adding Custom Actions

```javascript
const callbacks = {
  onEdit: (node) => {
    console.log('Editing:', node.data.name);
    // Your custom edit logic
  },
  onDelete: (node) => {
    if (confirm('Delete?')) {
      setNodes(nodes.filter(n => n.id !== node.id));
    }
  },
};

const { NodeContextMenu } = useNodeContextMenu({
  nodes, edges, setNodes, setEdges,
  reactFlowInstance,
  callbacks, // Pass custom callbacks
});
```

## Menu Contents

### Node Menus (by type)

**Goal Nodes**:
- Edit, Set Priority, Mark Complete, Duplicate, Delete

**Strategy Nodes**:
- Edit, Change Type (AND/OR), Expand All, Collapse All, Delete

**Property Claim**:
- Edit, Verify, Add Evidence, Update Status, Delete

**Evidence**:
- Edit, Update Confidence, Link Source, View Details, Delete

**Context**:
- Edit, Change Importance, Show/Hide, Delete

### Edge Menu
- Edit Label, Change Type, Change Style, Delete

### Canvas Menu
- Create Node, Paste, Select All, Auto Layout, Export

## Keyboard Shortcuts

While menu is open:
- **Arrow Up/Down** - Navigate items
- **Enter** - Execute selected action
- **Escape** - Close menu

## Common Patterns

### Pattern 1: Custom Menu Items

```javascript
import { getNodeMenuConfig } from '@/components/curriculum/enhanced/menus';

const customConfig = [
  ...getNodeMenuConfig('goal'),
  { type: 'separator' },
  { label: 'Custom Action', icon: MyIcon, action: 'myAction' },
];
```

### Pattern 2: Conditional Actions

```javascript
const callbacks = {
  onEdit: (node) => {
    if (node.data.locked) {
      alert('Node is locked');
      return;
    }
    // Edit logic
  },
};
```

### Pattern 3: Clipboard Integration

The hooks automatically manage clipboard state:

```javascript
const {
  clipboard,       // Current clipboard data
  setClipboard,    // Set clipboard
  NodeContextMenu,
} = useNodeContextMenu({...});

// Copy action automatically sets clipboard
// Paste action automatically reads clipboard
```

## Styling

Menus use glassmorphism styling by default. To customize:

```javascript
<ContextMenu
  className="my-custom-class"
  // Override default width
  width={300}
  // Override max height
  maxHeight={500}
/>
```

## Demo

Run the interactive demo to see all features:

```javascript
import { ContextMenuDemo } from '@/components/curriculum/enhanced/menus';

<ContextMenuDemo />
```

## Troubleshooting

### Menu not appearing?
1. Check `reactFlowInstance` is defined
2. Ensure handlers are attached to ReactFlow
3. Verify menu components are rendered

### Actions not working?
1. Check console for errors
2. Verify action names in config
3. Ensure context includes required data

### Menu positioned wrong?
1. Use screen coordinates for position (not flow coordinates)
2. Auto-positioning handles overflow automatically
3. Check menu container has fixed positioning

## Next Steps

- Read [README.md](./README.md) for detailed API
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for internals
- Explore [ContextMenuDemo.jsx](./ContextMenuDemo.jsx) for examples
- Customize actions in `menuActions.js`
- Extend configs in `menuConfig.js`

## Examples

### Example 1: Minimal Setup

```javascript
import ReactFlow, { useReactFlow, useNodesState, useEdgesState } from 'reactflow';
import { useNodeContextMenu } from '@/components/curriculum/enhanced/menus';

function MinimalExample() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    { id: '1', position: { x: 0, y: 0 }, data: { name: 'Test' } }
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();

  const { handleNodeContextMenu, NodeContextMenu } = useNodeContextMenu({
    nodes, edges, setNodes, setEdges, reactFlowInstance,
  });

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeContextMenu={handleNodeContextMenu}
      />
      {NodeContextMenu}
    </>
  );
}
```

### Example 2: With Custom Callbacks

```javascript
const callbacks = {
  onEdit: (node) => openEditDialog(node),
  onDelete: (node) => confirmDelete(node),
  onAddEvidence: (node) => openEvidenceCreator(node),
};

const { NodeContextMenu } = useNodeContextMenu({
  nodes, edges, setNodes, setEdges,
  reactFlowInstance, callbacks,
});
```

### Example 3: All Three Menus

```javascript
function FullExample() {
  // ... state setup

  const node = useNodeContextMenu({
    nodes, edges, setNodes, setEdges, reactFlowInstance,
  });

  const edge = useEdgeContextMenu({
    edges, setEdges, reactFlowInstance,
  });

  const canvas = useCanvasContextMenu({
    nodes, edges, setNodes, setEdges, reactFlowInstance,
  });

  return (
    <>
      <ReactFlow
        onNodeContextMenu={node.handleNodeContextMenu}
        onEdgeContextMenu={edge.handleEdgeContextMenu}
        onPaneContextMenu={canvas.handlePaneContextMenu}
        // ... other props
      />
      {node.NodeContextMenu}
      {edge.EdgeContextMenu}
      {canvas.CanvasContextMenu}
    </>
  );
}
```

## Tips & Tricks

1. **Multi-Select**: Select multiple nodes (Shift+Click or drag box), then right-click for bulk actions

2. **Keyboard First**: Navigate menus with keyboard for faster workflows

3. **Recent Actions**: Keep track of frequently used actions to show in a "Recent" section

4. **Custom Icons**: Use any Lucide React icon in menu items

5. **Submenus**: Use submenus to organize related actions

6. **Conditional Items**: Show/hide items based on node state

7. **Action Parameters**: Use `action:parameter` format (e.g., `setPriority:high`)

## Common Issues

**Issue**: Menu appears then immediately closes
**Solution**: Add small delay in click-outside handler (already implemented)

**Issue**: Submenu appears off-screen
**Solution**: Auto-positioning handles this (already implemented)

**Issue**: Keyboard nav doesn't work
**Solution**: Ensure menu has focus (auto-focused on open)

## Resources

- [React Flow Docs](https://reactflow.dev/)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [REACT_FLOW.md](../REACT_FLOW.md) - Design specs

## Support

For issues or questions:
1. Check [README.md](./README.md) for detailed docs
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
3. Examine [ContextMenuDemo.jsx](./ContextMenuDemo.jsx) for examples
4. Check React Flow documentation

---

**You're all set!** Right-click on any node, edge, or canvas to see context menus in action.
