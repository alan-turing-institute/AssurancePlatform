# Context Menu System

Comprehensive context menu system for React Flow with node, edge, and canvas-specific actions. Features glassmorphism styling, keyboard navigation, and extensive customization options.

## Overview

This module provides a complete context menu solution for React Flow applications, following the specifications in `REACT_FLOW.md` Section 4.2 and 5.4.2.

### Features

- **Three Context Menu Types**: Node, Edge, and Canvas menus
- **Node-Specific Actions**: Tailored menus for each node type (Goal, Strategy, Evidence, etc.)
- **Multi-Select Support**: Bulk actions for multiple nodes
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Smart Positioning**: Auto-adjusts to stay on screen
- **Glassmorphism Styling**: Dark theme with backdrop blur
- **Submenu Support**: Nested menu options
- **Action History**: Track and log menu actions
- **Customizable**: Extend with custom actions and callbacks

## Quick Start

### Basic Integration

```jsx
import React from 'react';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import {
  useNodeContextMenu,
  useEdgeContextMenu,
  useCanvasContextMenu,
} from './menus';

function MyFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowInstance = useReactFlow();

  // Initialize context menus
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

  const {
    handleEdgeContextMenu,
    EdgeContextMenu,
  } = useEdgeContextMenu({
    edges,
    setEdges,
    reactFlowInstance,
  });

  const {
    handlePaneContextMenu,
    CanvasContextMenu,
  } = useCanvasContextMenu({
    nodes,
    edges,
    setNodes,
    setEdges,
    reactFlowInstance,
  });

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
}
```

## Components

### ContextMenu (Base Component)

Base context menu component with positioning, keyboard navigation, and styling.

```jsx
import { ContextMenu } from './menus';

<ContextMenu
  isOpen={true}
  position={{ x: 100, y: 100 }}
  menuItems={[
    { label: 'Edit', icon: Edit, action: 'edit', shortcut: 'E' },
    { type: 'separator' },
    { label: 'Delete', icon: Trash, action: 'delete', dangerous: true }
  ]}
  onClose={() => console.log('closed')}
  onAction={(action) => console.log('action:', action)}
/>
```

**Props:**
- `isOpen` (boolean): Whether menu is visible
- `position` (object): `{ x, y }` screen coordinates
- `menuItems` (array): Menu configuration array
- `onClose` (function): Called when menu closes
- `onAction` (function): Called when action selected
- `width` (number): Menu width in pixels (default: 220)
- `maxHeight` (number): Max height before scrolling (default: 400)

### NodeContextMenu

Context menu for nodes with type-specific actions.

```jsx
import { NodeContextMenu } from './menus';

<NodeContextMenu
  isOpen={true}
  position={{ x: 100, y: 100 }}
  node={selectedNode}
  nodes={allNodes}
  edges={allEdges}
  setNodes={setNodes}
  setEdges={setEdges}
  reactFlowInstance={reactFlowInstance}
  onClose={() => setMenuOpen(false)}
  callbacks={{
    onEdit: (node) => console.log('Edit:', node),
    onDelete: (node) => console.log('Delete:', node),
  }}
/>
```

### EdgeContextMenu

Context menu for edges.

```jsx
import { EdgeContextMenu } from './menus';

<EdgeContextMenu
  isOpen={true}
  position={{ x: 100, y: 100 }}
  edge={selectedEdge}
  edges={allEdges}
  setEdges={setEdges}
  reactFlowInstance={reactFlowInstance}
  onClose={() => setMenuOpen(false)}
/>
```

### CanvasContextMenu

Context menu for empty canvas areas.

```jsx
import { CanvasContextMenu } from './menus';

<CanvasContextMenu
  isOpen={true}
  position={{ x: 100, y: 100 }}
  nodes={allNodes}
  edges={allEdges}
  setNodes={setNodes}
  setEdges={setEdges}
  reactFlowInstance={reactFlowInstance}
  onClose={() => setMenuOpen(false)}
  callbacks={{
    onCreate: (type, position) => console.log('Create:', type, position),
  }}
/>
```

## Hooks

### useNodeContextMenu

React hook for managing node context menu state.

```jsx
const {
  contextMenu,
  isOpen,
  position,
  node,
  clipboard,
  setClipboard,
  handleNodeContextMenu,
  closeContextMenu,
  NodeContextMenu,
} = useNodeContextMenu({
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
  callbacks: {
    onEdit: (node) => { /* custom edit logic */ },
    onDelete: (node) => { /* custom delete logic */ },
  },
});
```

### useEdgeContextMenu

React hook for managing edge context menu state.

```jsx
const {
  handleEdgeContextMenu,
  closeContextMenu,
  EdgeContextMenu,
} = useEdgeContextMenu({
  edges,
  setEdges,
  reactFlowInstance,
  callbacks: {
    onEditLabel: (edge) => { /* custom label edit */ },
  },
});
```

### useCanvasContextMenu

React hook for managing canvas context menu state.

```jsx
const {
  handlePaneContextMenu,
  clipboard,
  setClipboard,
  CanvasContextMenu,
} = useCanvasContextMenu({
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
  callbacks: {
    onCreate: (type, position) => { /* custom create logic */ },
    onAutoLayout: (layoutType) => { /* custom layout */ },
  },
});
```

### useContextMenu

Low-level hook for custom context menu implementations.

```jsx
const {
  contextMenu,
  isOpen,
  position,
  data,
  openContextMenu,
  closeContextMenu,
  handleContextMenu,
} = useContextMenu();
```

## Menu Configuration

### Node Menus by Type

Each node type has a tailored menu configuration:

#### Goal Node Menu
- Edit Goal
- Set Priority (Critical, High, Medium, Low)
- Mark Complete
- Duplicate
- Copy Style
- Focus Node
- Delete

#### Strategy Node Menu
- Edit Strategy
- Change Type (AND/OR)
- Duplicate
- Copy Style
- Expand/Collapse All
- Focus Node
- Delete

#### Property Claim Menu
- Edit Claim
- Verify Claim
- Add Evidence
- Update Status (Verified, Pending, Disputed)
- Duplicate
- Copy Style
- Focus Node
- Delete

#### Evidence Menu
- Edit Evidence
- Update Confidence (High, Medium, Low, Unverified)
- Link Source
- View Details
- Duplicate
- Copy Style
- Focus Node
- Delete

#### Context Menu
- Edit Context
- Change Importance (Critical, Important, Normal, Reference)
- Show/Hide
- Duplicate
- Copy Style
- Focus Node
- Delete

### Multi-Select Menu

When multiple nodes are selected:
- Align Nodes (Left, Center, Right, Top, Middle, Bottom)
- Distribute (Horizontally, Vertically)
- Group
- Copy All
- Delete All

### Edge Menu

- Edit Label
- Change Type (Straight, Smooth Step, Bezier, Step)
- Edge Style (Solid, Dashed, Dotted, Animated, Gradient)
- Add Waypoint
- Change Strength (Strong, Normal, Weak)
- Reverse Direction
- Delete

### Canvas Menu

- Create Node Here (Goal, Strategy, Property Claim, Evidence, Context)
- Paste
- Select All
- Auto Layout (Hierarchical, Force Directed, Grid)
- Reset View
- Export as Image (PNG, SVG, JPEG)

## Customization

### Custom Menu Items

```jsx
import { getNodeMenuConfig } from './menus';

// Get default config
const defaultConfig = getNodeMenuConfig('goal');

// Add custom items
const customConfig = [
  ...defaultConfig,
  { type: 'separator' },
  {
    label: 'Custom Action',
    icon: CustomIcon,
    action: 'customAction',
    description: 'My custom action',
  },
];
```

### Custom Actions

```jsx
import { executeAction, menuActions } from './menus';

// Add custom action handler
menuActions.customAction = ({ node, ...context }) => {
  console.log('Custom action for node:', node.id);
  // Your custom logic here
};

// Execute action
executeAction('customAction', { node, nodes, setNodes });
```

### Custom Callbacks

```jsx
const callbacks = {
  // Override default edit behavior
  onEdit: (node) => {
    // Open custom edit dialog
    openMyCustomDialog(node);
  },

  // Add custom evidence workflow
  onAddEvidence: (node) => {
    // Custom evidence creation
    createEvidence(node);
  },

  // Custom delete with confirmation
  onDelete: async (node) => {
    const confirmed = await showConfirmDialog(node);
    if (confirmed) {
      deleteNode(node);
    }
  },
};

const { NodeContextMenu } = useNodeContextMenu({
  nodes,
  edges,
  setNodes,
  setEdges,
  reactFlowInstance,
  callbacks,
});
```

## Menu Items Component

### MenuItem

```jsx
import { MenuItem } from './menus';

<MenuItem
  label="Edit"
  icon={Edit}
  shortcut="E"
  description="Edit this item"
  action="edit"
  onClick={(action) => console.log(action)}
/>
```

### MenuItem with Submenu

```jsx
<MenuItem
  label="Set Priority"
  icon={Flag}
  action="setPriority"
  submenu={[
    { label: 'Critical', action: 'setPriority:critical', color: 'red' },
    { label: 'High', action: 'setPriority:high', color: 'orange' },
    { label: 'Medium', action: 'setPriority:medium', color: 'yellow' },
  ]}
  onClick={(action) => console.log(action)}
/>
```

### MenuSeparator

```jsx
import { MenuSeparator } from './menus';

<MenuSeparator />
```

### MenuHeader

```jsx
import { MenuHeader } from './menus';

<MenuHeader label="Node Actions" />
```

## Keyboard Shortcuts

The context menu supports keyboard navigation:

- **Arrow Down/Up**: Navigate menu items
- **Enter**: Execute selected action
- **Escape**: Close menu
- **Home**: Jump to first item
- **End**: Jump to last item

### Global Shortcuts (when menu is closed)

- **E**: Edit selected node
- **F**: Focus on selected node
- **Del/Backspace**: Delete selected node(s)
- **Ctrl+D**: Duplicate selected node
- **Ctrl+C**: Copy selected node(s)
- **Ctrl+V**: Paste from clipboard
- **Ctrl+A**: Select all nodes
- **Ctrl+0**: Reset view

## Styling

The context menus use glassmorphism styling with Tailwind CSS classes:

```css
/* Menu container */
.bg-background-transparent-black-secondary
.f-effect-backdrop-blur-lg
.rounded-lg
.shadow-3d

/* Menu items */
.text-text-light
.hover:bg-background-transparent-white-hover

/* Dangerous actions */
.text-red-400
.hover:bg-red-500/10
```

### Custom Styling

Override styles by passing `className`:

```jsx
<ContextMenu
  className="custom-menu-class"
  menuItems={items}
  // ...
/>
```

## Advanced Features

### Action History

Track menu actions for undo/redo:

```jsx
const [actionHistory, setActionHistory] = useState([]);

const callbacks = {
  onEdit: (node) => {
    setActionHistory([...actionHistory, { action: 'edit', node }]);
    // Edit logic
  },
};
```

### Conditional Menu Items

Show/hide menu items based on state:

```jsx
import { filterMenuItems } from './menus';

const menuItems = filterMenuItems(defaultConfig, {
  node,
  clipboard,
  checkClipboard: () => !!clipboard,
});
```

### Debounced Context Menu

Prevent rapid menu opens:

```jsx
import { useDebounceContextMenu } from './menus';

const { menu, openMenu, closeMenu } = useDebounceContextMenu(100);
```

### Recent Actions

Show recently used actions:

```jsx
import { RecentActionsMenu } from './menus';

<RecentActionsMenu
  recentActions={recentActions}
  onClick={handleAction}
  maxItems={3}
/>
```

## Demo

Run the interactive demo:

```jsx
import { ContextMenuDemo } from './menus/ContextMenuDemo';

<ContextMenuDemo />
```

The demo includes:
- All three menu types (node, edge, canvas)
- Example nodes and edges
- Action log to see what actions fire
- Visual feedback for interactions

## Performance

The context menu system is optimized for performance:

- **Lazy Rendering**: Menus only render when open
- **Memoized Configs**: Menu configurations are cached
- **Debounced Opens**: Prevents rapid menu creation
- **Click Outside**: Efficient event listener cleanup
- **Keyboard Navigation**: Minimal re-renders

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires support for:
- CSS `backdrop-filter`
- React 18+
- React Flow 11+

## Troubleshooting

### Menu not appearing

1. Check that `isOpen` is true
2. Verify `position` is valid
3. Ensure menu is not behind other elements (check z-index)
4. Confirm `menuItems` array is not empty

### Actions not firing

1. Verify `onAction` callback is provided
2. Check action names match configuration
3. Ensure `executeAction` has required context
4. Check console for error messages

### Menu positioned incorrectly

1. Ensure `position` uses screen coordinates (not flow coordinates)
2. Check that `reactFlowInstance` is available
3. Verify menu container has fixed positioning
4. Test with `adjustedPosition` calculation

### Keyboard navigation not working

1. Ensure menu is focused
2. Check that keyboard event listeners are attached
3. Verify no other handlers are preventing default
4. Test in different browsers

## API Reference

See `ARCHITECTURE.md` for detailed API documentation.

## Examples

See `ContextMenuDemo.jsx` for comprehensive examples of all features.

## Contributing

When adding new menu actions:

1. Add action to `menuConfig.js`
2. Implement handler in `menuActions.js`
3. Update type definitions if using TypeScript
4. Add tests for new functionality
5. Update documentation

## License

Part of the TEA Platform Enhanced Components.
