# Context Menu System Architecture

This document describes the architecture and implementation details of the context menu system.

## System Overview

The context menu system is organized into several layers:

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│  (React Flow Components, User Interactions)     │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│              Hook Layer                          │
│  useNodeContextMenu, useEdgeContextMenu, etc.   │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│           Component Layer                        │
│  NodeContextMenu, EdgeContextMenu, etc.         │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│          Base Component Layer                    │
│  ContextMenu, MenuItem, MenuSeparator           │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│       Configuration & Action Layer               │
│  menuConfig.js, menuActions.js                  │
└─────────────────────────────────────────────────┘
```

## Module Structure

```
menus/
├── ContextMenu.jsx           # Base context menu component
├── MenuItems.jsx             # Reusable menu item components
├── NodeContextMenu.jsx       # Node-specific context menu
├── EdgeContextMenu.jsx       # Edge-specific context menu
├── CanvasContextMenu.jsx     # Canvas-specific context menu
├── menuConfig.js             # Menu configuration definitions
├── menuActions.js            # Action handler implementations
├── ContextMenuDemo.jsx       # Demo and examples
├── index.js                  # Module exports
├── README.md                 # User documentation
└── ARCHITECTURE.md           # This file
```

## Core Components

### 1. ContextMenu (Base Component)

**Purpose**: Foundational context menu component with positioning, keyboard navigation, and rendering logic.

**Key Features**:
- Auto-positioning to stay on screen
- Click-outside detection
- Keyboard navigation (arrows, enter, escape)
- Smooth animations (fade in/out)
- Glassmorphism styling

**State Management**:
```javascript
{
  adjustedPosition: { x, y },  // Screen-adjusted position
  selectedIndex: number,       // Currently selected item (keyboard nav)
}
```

**Event Handlers**:
- `handleClickOutside`: Closes menu when clicking elsewhere
- `handleKeyDown`: Keyboard navigation logic
- `handleAction`: Executes selected action

**Positioning Algorithm**:
```javascript
// Pseudo-code
const adjustPosition = (position, menuRect, viewport) => {
  let { x, y } = position;

  // Adjust horizontal
  if (x + menuRect.width > viewport.width) {
    x = viewport.width - menuRect.width - 10;
  }

  // Adjust vertical
  if (y + menuRect.height > viewport.height) {
    y = viewport.height - menuRect.height - 10;
  }

  return { x, y };
};
```

### 2. NodeContextMenu

**Purpose**: Specialized menu for nodes with type-specific actions.

**Features**:
- Detects node type and loads appropriate menu
- Supports multi-select (shows different menu)
- Filters items based on node state
- Passes node context to actions

**Decision Logic**:
```javascript
const determineMenu = (node) => {
  if (Array.isArray(node) && node.length > 1) {
    return multiSelectMenuConfig;
  }

  const nodeType = node.type || 'goal';
  return getNodeMenuConfig(nodeType);
};
```

### 3. EdgeContextMenu

**Purpose**: Menu for edge connections with edge-specific actions.

**Features**:
- Edge type modification
- Style and appearance changes
- Connection management
- Waypoint addition

### 4. CanvasContextMenu

**Purpose**: Menu for empty canvas areas.

**Features**:
- Node creation at click position
- Layout operations
- Clipboard operations
- Export functionality

**Coordinate Transformation**:
```javascript
// Convert screen coordinates to flow coordinates
const flowPosition = reactFlowInstance.screenToFlowPosition({
  x: screenX,
  y: screenY,
});
```

## Configuration System

### menuConfig.js

Defines menu structures for each context:

```javascript
// Structure
{
  nodeType: [
    {
      label: string,           // Display text
      icon: LucideIcon,        // Icon component
      action: string,          // Action identifier
      shortcut?: string,       // Keyboard shortcut
      description?: string,    // Tooltip text
      submenu?: Array,         // Nested menu
      disabled?: boolean|function|string,
      dangerous?: boolean,     // Red styling
      color?: string,          // Custom color
    },
    { type: 'separator' },     // Visual separator
  ]
}
```

**Configuration Types**:
1. `nodeMenuConfig`: Per-node-type configurations
2. `edgeMenuConfig`: Edge menu configuration
3. `canvasMenuConfig`: Canvas menu configuration
4. `multiSelectMenuConfig`: Multi-selection menu

**Helper Functions**:
- `getNodeMenuConfig(type)`: Get menu for node type
- `getEdgeMenuConfig()`: Get edge menu
- `getCanvasMenuConfig()`: Get canvas menu
- `filterMenuItems(config, context)`: Filter based on state

## Action System

### menuActions.js

Implements action handlers:

```javascript
// Action handler signature
const actionHandler = ({
  // Node context
  node,
  nodes,
  setNodes,

  // Edge context
  edge,
  edges,
  setEdges,

  // React Flow
  reactFlowInstance,

  // Position (for canvas actions)
  position,

  // Callbacks
  onEdit,
  onDelete,
  // ... other callbacks

  // Clipboard
  clipboard,
  setClipboard,

  // Event
  event,
}) => {
  // Action implementation
};
```

**Action Categories**:

1. **Node Actions**:
   - `edit`: Open edit dialog
   - `delete`: Remove node
   - `duplicate`: Create copy
   - `copyStyle`: Copy styling
   - `focus`: Center view
   - Type-specific actions (setPriority, verify, etc.)

2. **Multi-Select Actions**:
   - `align`: Align nodes (left, right, center, etc.)
   - `distribute`: Even spacing
   - `group`: Group nodes
   - `copyAll`: Copy all selected
   - `deleteAll`: Delete all selected

3. **Edge Actions**:
   - `editLabel`: Edit edge label
   - `changeEdgeType`: Change connection type
   - `changeEdgeStyle`: Change appearance
   - `addWaypoint`: Add control point
   - `changeStrength`: Modify width
   - `reverse`: Flip direction
   - `deleteEdge`: Remove connection

4. **Canvas Actions**:
   - `createNode`: Create at position
   - `paste`: Paste from clipboard
   - `selectAll`: Select all nodes
   - `autoLayout`: Apply layout algorithm
   - `resetView`: Fit view
   - `exportImage`: Export as image

**Action Execution**:
```javascript
// Parse action string (supports parameters)
const executeAction = (actionString, context) => {
  const [action, ...params] = actionString.split(':');
  const param = params.join(':');

  const handler = menuActions[action];
  if (handler) {
    const enhancedContext = param
      ? { ...context, [action]: param }
      : context;

    handler(enhancedContext);
  }
};

// Examples:
// "delete" -> executes delete action
// "setPriority:high" -> executes setPriority with param "high"
```

## Hooks Architecture

### useContextMenu (Base Hook)

Low-level hook for custom implementations:

```javascript
const {
  contextMenu: { position, data },
  isOpen: boolean,
  position: { x, y },
  data: any,
  openContextMenu: (position, data) => void,
  closeContextMenu: () => void,
  handleContextMenu: (event, data) => void,
} = useContextMenu();
```

### useNodeContextMenu

High-level hook with full integration:

```javascript
const {
  contextMenu: object,
  isOpen: boolean,
  position: { x, y },
  node: Node|Node[],
  clipboard: object,
  setClipboard: (data) => void,
  handleNodeContextMenu: (event, node) => void,
  closeContextMenu: () => void,
  NodeContextMenu: JSX.Element,
} = useNodeContextMenu({
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes) => void,
  setEdges: (edges) => void,
  reactFlowInstance: ReactFlowInstance,
  callbacks: object,
});
```

**Hook Pattern**:
1. Initialize state (menu position, data)
2. Provide event handlers (handleContextMenu)
3. Return render component (NodeContextMenu)
4. Manage clipboard internally

### useEdgeContextMenu

Similar pattern for edges:

```javascript
const {
  handleEdgeContextMenu,
  closeContextMenu,
  EdgeContextMenu,
} = useEdgeContextMenu({ ... });
```

### useCanvasContextMenu

Canvas-specific with position transformation:

```javascript
const {
  handlePaneContextMenu,
  clipboard,
  setClipboard,
  CanvasContextMenu,
} = useCanvasContextMenu({ ... });
```

## State Management

### Component State

Each menu component manages:
```javascript
{
  contextMenu: {
    position: { x, y },
    data: node|edge|null,
  },
  clipboard: {
    type: 'nodes'|'style',
    data: any,
  },
}
```

### React Flow State

Operates on React Flow state:
```javascript
{
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes) => void,
  setEdges: (edges) => void,
  reactFlowInstance: ReactFlowInstance,
}
```

### Callback System

Custom callbacks override default behavior:
```javascript
const callbacks = {
  onEdit: (node) => void,
  onDelete: (node) => void,
  onAddEvidence: (node) => void,
  // ... other callbacks
};
```

**Callback Precedence**:
1. Custom callback (if provided)
2. Default action handler
3. Console log (fallback)

## Event Flow

### Node Context Menu Flow

```
User right-clicks node
    ↓
onNodeContextMenu fires
    ↓
handleNodeContextMenu called
    ↓
Check for multi-selection
    ↓
Set contextMenu state
    ↓
NodeContextMenu renders
    ↓
Get menu config for node type
    ↓
Render menu items
    ↓
User clicks item
    ↓
handleAction called
    ↓
executeAction with context
    ↓
Action handler executes
    ↓
State updated / Callback fired
    ↓
Menu closes
```

### Keyboard Navigation Flow

```
Menu is open
    ↓
User presses arrow key
    ↓
handleKeyDown captures event
    ↓
Update selectedIndex
    ↓
Highlight changes
    ↓
User presses Enter
    ↓
Get selected item
    ↓
Execute action
    ↓
Menu closes
```

## Rendering Pipeline

### Menu Rendering

```javascript
// Simplified rendering pipeline
const render = () => {
  if (!isOpen) return null;

  // 1. Calculate position
  const adjustedPos = adjustPosition(position);

  // 2. Get menu items
  const items = getMenuItems(context);

  // 3. Filter items
  const filteredItems = filterItems(items, state);

  // 4. Render
  return (
    <motion.div position={adjustedPos}>
      {filteredItems.map(item =>
        item.type === 'separator'
          ? <MenuSeparator />
          : <MenuItem {...item} />
      )}
    </motion.div>
  );
};
```

### MenuItem Rendering

```javascript
const MenuItem = ({ item, onClick }) => {
  return (
    <button onClick={() => onClick(item.action)}>
      {item.icon && <Icon />}
      <span>{item.label}</span>
      {item.shortcut && <kbd>{item.shortcut}</kbd>}
      {item.submenu && <ChevronRight />}

      {item.submenu && showSubmenu && (
        <Submenu items={item.submenu} />
      )}
    </button>
  );
};
```

## Performance Optimizations

### 1. Lazy Rendering

Menus only render when `isOpen` is true:
```javascript
if (!isOpen) return null;
```

### 2. Memoized Configurations

Menu configs are memoized with `useMemo`:
```javascript
const menuItems = useMemo(() => {
  return getNodeMenuConfig(nodeType);
}, [nodeType]);
```

### 3. Debounced Opens

Prevent rapid menu opens:
```javascript
const useDebounceContextMenu = (delay = 100) => {
  // Debounce implementation
};
```

### 4. Efficient Event Listeners

Event listeners cleaned up properly:
```javascript
useEffect(() => {
  document.addEventListener('mousedown', handleClickOutside);

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [isOpen]);
```

### 5. Conditional Rendering

Items filtered before rendering:
```javascript
const visibleItems = filterMenuItems(config, context);
```

## Styling System

### Glassmorphism Implementation

```css
/* Base menu styling */
.menu-container {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### Tailwind Classes

```javascript
const menuClasses = `
  bg-background-transparent-black-secondary
  border border-transparent
  f-effect-backdrop-blur-lg
  rounded-lg
  shadow-3d
`;

const itemClasses = `
  text-text-light
  hover:bg-background-transparent-white-hover
  transition-all duration-200
`;

const dangerousClasses = `
  text-red-400
  hover:bg-red-500/10
`;
```

### Animation System

Using Framer Motion:
```javascript
<motion.div
  initial={{ opacity: 0, scale: 0.95, y: -10 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.95, y: -10 }}
  transition={{ duration: 0.15, ease: 'easeOut' }}
>
  {/* Menu content */}
</motion.div>
```

## Extension Points

### 1. Custom Actions

Add new actions to `menuActions`:
```javascript
menuActions.myCustomAction = ({ node, ...context }) => {
  // Implementation
};
```

### 2. Custom Menu Items

Extend configuration:
```javascript
const customConfig = [
  ...getNodeMenuConfig('goal'),
  { type: 'separator' },
  { label: 'Custom', icon: Icon, action: 'custom' },
];
```

### 3. Custom Callbacks

Override behavior:
```javascript
const callbacks = {
  onEdit: (node) => {
    // Custom edit implementation
  },
};
```

### 4. Custom Styling

Override CSS classes:
```javascript
<ContextMenu
  className="my-custom-menu"
  menuItems={items}
/>
```

### 5. Custom Filtering

Filter items dynamically:
```javascript
const filteredItems = filterMenuItems(config, {
  node,
  customCondition: () => checkCondition(),
});
```

## Testing Strategy

### Unit Tests

Test individual components:
```javascript
describe('ContextMenu', () => {
  test('renders when open', () => {});
  test('closes on escape', () => {});
  test('positions correctly', () => {});
  test('executes actions', () => {});
});
```

### Integration Tests

Test full workflow:
```javascript
describe('Node Context Menu Integration', () => {
  test('opens on right-click', () => {});
  test('shows correct items for node type', () => {});
  test('executes actions and updates state', () => {});
});
```

### Visual Tests

Using Storybook or similar:
```javascript
export const NodeMenu = {
  args: {
    isOpen: true,
    node: mockGoalNode,
  },
};
```

## Security Considerations

### 1. XSS Prevention

All text content is escaped:
```javascript
<span>{sanitize(item.label)}</span>
```

### 2. Action Validation

Actions validated before execution:
```javascript
if (!menuActions[action]) {
  console.warn('Unknown action:', action);
  return;
}
```

### 3. Callback Safety

Callbacks wrapped in try-catch:
```javascript
try {
  callback?.(data);
} catch (error) {
  console.error('Callback failed:', error);
}
```

## Accessibility

### 1. Keyboard Navigation

Full keyboard support:
- Arrow keys for navigation
- Enter to select
- Escape to close

### 2. ARIA Attributes

```jsx
<div
  role="menu"
  aria-label="Context menu"
  aria-orientation="vertical"
>
  <button
    role="menuitem"
    aria-label={item.label}
    aria-disabled={item.disabled}
  >
    {item.label}
  </button>
</div>
```

### 3. Focus Management

```javascript
useEffect(() => {
  if (isOpen && menuRef.current) {
    menuRef.current.focus();
  }
}, [isOpen]);
```

## Browser Compatibility

### Required Features

- CSS `backdrop-filter` (with fallback)
- React 18+
- ES6+ JavaScript
- Flexbox/Grid layout

### Fallbacks

```javascript
const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(40px)');

const backgroundStyle = supportsBackdropFilter
  ? 'bg-background-transparent-black'
  : 'bg-gray-900';
```

## Future Enhancements

### Planned Features

1. **Command Palette**: Searchable command menu (Cmd+K)
2. **Action Macros**: Record and replay action sequences
3. **Touch Support**: Long-press for context menu on mobile
4. **Floating Toolbar**: Context-sensitive floating toolbar
5. **Voice Commands**: Voice-activated actions
6. **AI Suggestions**: Smart action suggestions based on context
7. **Undo/Redo**: Built-in action history with undo
8. **Collaborative Indicators**: Show when others are using menus

### Technical Debt

1. Add TypeScript definitions
2. Improve test coverage (target: 90%+)
3. Add Storybook stories
4. Performance profiling and optimization
5. Accessibility audit and improvements
6. Documentation localization

## Contributing

When contributing to the context menu system:

1. **Add Tests**: Unit tests for new features
2. **Update Docs**: Keep README and ARCHITECTURE in sync
3. **Follow Patterns**: Use existing code patterns
4. **Performance**: Profile changes for performance impact
5. **Accessibility**: Test with keyboard and screen readers
6. **Browser Testing**: Test in all supported browsers

## References

- [React Flow Documentation](https://reactflow.dev/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- FloraFauna.ai (design inspiration)
