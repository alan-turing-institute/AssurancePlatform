# Enhanced React Flow Components

FloraFauna.ai-inspired React Flow components with glassmorphism styling and collapsible nodes.

## Quick Start

```jsx
import { BaseNode, CustomHandle } from '@/components/curriculum/enhanced';

// Use in your React Flow node
const MyNode = ({ data, selected }) => (
  <BaseNode
    data={data}
    selected={selected}
    nodeType="goal"
  />
);
```

## Components

### BaseNode

Collapsible node with glassmorphism styling.

```jsx
<BaseNode
  data={{
    id: 'goal-1',
    name: 'System Safety',
    description: 'Short description',
    long_description: 'Detailed description shown when expanded'
  }}
  selected={false}
  nodeType="goal" // goal, strategy, propertyClaim, evidence, context
  defaultExpanded={false}
  onExpandChange={(isExpanded) => console.log(isExpanded)}
>
  {/* Optional custom content when expanded */}
</BaseNode>
```

**Props:**
- `data` (object) - Node data with id, name, description
- `selected` (boolean) - Selection state
- `nodeType` (string) - Type: goal, strategy, propertyClaim, evidence, context
- `defaultExpanded` (boolean) - Initial expand state
- `onExpandChange` (function) - Callback when expand state changes
- `children` (ReactNode) - Custom content for expanded state
- `className` (string) - Additional CSS classes

**Variants:**
- `BaseNodeWithActions` - Adds action buttons
- `BaseNodeWithMetadata` - Displays metadata
- `CompactBaseNode` - Smaller size
- `LargeBaseNode` - Larger size

### CustomHandle

Connection handle styled as + decorator.

```jsx
<CustomHandle
  type="source" // or "target"
  position={Position.Bottom}
  nodeId="node-1"
  isConnectable={true}
/>
```

**Props:**
- `type` (string) - 'source' or 'target'
- `position` (Position) - Position.Top, .Bottom, .Left, .Right
- `nodeId` (string) - Node identifier
- `isConnectable` (boolean) - Whether handle can connect
- `className` (string) - Additional CSS classes

**Variants:**
- `CustomHandleWithIndicator` - Shows connection state
- `PulsingHandle` - Animated pulse
- `CustomHandleWithTooltip` - With hover tooltip

## Utilities

### Theme Configuration

```jsx
import {
  getNodeTypeConfig,
  getNodeIcon,
  getColorSchemeClasses
} from '@/components/curriculum/enhanced';

const config = getNodeTypeConfig('goal');
const Icon = getNodeIcon('goal');
const colors = getColorSchemeClasses('goal');
```

### Styling Utilities

```jsx
import {
  buildNodeContainerClasses,
  applyGlassmorphism,
  buildInteractionClasses
} from '@/components/curriculum/enhanced';

const classes = buildNodeContainerClasses({
  nodeType: 'goal',
  isSelected: true,
  isHovered: false,
  isCollapsed: false
});
```

### Animation Utilities

```jsx
import { motion } from 'framer-motion';
import {
  nodeEntranceVariants,
  contentCollapseVariants
} from '@/components/curriculum/enhanced';

<motion.div
  initial="hidden"
  animate="visible"
  variants={nodeEntranceVariants}
>
  {/* Content */}
</motion.div>
```

## Node Types

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `goal` | Green | Target | Top-level goals |
| `strategy` | Purple | GitBranch | Decomposition strategies |
| `propertyClaim` | Orange | FileText | Property claims |
| `evidence` | Cyan | CheckCircle | Evidence items |
| `context` | Gray | AlertCircle | Context information |

## Styling

### Color Tokens

**Backgrounds:**
- `bg-background-transparent-black` - Base glassmorphic
- `bg-background-transparent-black-secondary` - Elevated
- `bg-background-transparent-black-secondaryAlt` - Highest

**Text:**
- `text-text-light` - Primary text (95% opacity)
- `text-text-light/80` - Secondary text (80% opacity)
- `text-text-light/70` - Tertiary text (70% opacity)

**Effects:**
- `f-effect-backdrop-blur-lg` - Backdrop blur (40px)
- `shadow-glassmorphic` - Glass shadow
- `shadow-3d` - 3D depth effect

### Glassmorphism Presets

```jsx
import { glassmorphismPresets } from '@/components/curriculum/enhanced';

// Apply preset
<div className={glassmorphismPresets.node.base}>
  {/* Content */}
</div>

// Available presets:
// - glassmorphismPresets.node.base
// - glassmorphismPresets.node.elevated
// - glassmorphismPresets.node.highest
// - glassmorphismPresets.modal
// - glassmorphismPresets.menu
// - glassmorphismPresets.card
```

## Animation Presets

```jsx
import { getAnimationPreset } from '@/components/curriculum/enhanced';

const variants = getAnimationPreset('entrance');
// Available: entrance, fade, scale, collapse, hover, button, handle, selection, modal
```

## Accessibility

All components support:
- ✅ Keyboard navigation (Tab, Enter, Space)
- ✅ Screen readers (ARIA labels)
- ✅ Focus indicators
- ✅ Reduced motion (automatically detected)

```jsx
// Reduced motion support
import { withReducedMotion } from '@/components/curriculum/enhanced';

const variants = withReducedMotion(nodeEntranceVariants);
```

## React Flow Integration

```jsx
import ReactFlow from 'reactflow';
import { BaseNode } from '@/components/curriculum/enhanced';
import 'reactflow/dist/style.css';

const nodeTypes = {
  goal: (props) => <BaseNode {...props} nodeType="goal" />,
  strategy: (props) => <BaseNode {...props} nodeType="strategy" />,
  // ... other types
};

<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  className="bg-gray-950"
>
  {/* Background, Controls, etc. */}
</ReactFlow>
```

## Examples

### Custom Expanded Content

```jsx
<BaseNode data={data} nodeType="goal">
  <div className="space-y-2">
    <div className="text-xs text-text-light/70">
      <strong>Status:</strong> Active
    </div>
    <button className="w-full px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-md transition-colors">
      View Details
    </button>
  </div>
</BaseNode>
```

### With Actions

```jsx
<BaseNodeWithActions
  data={data}
  nodeType="evidence"
  actions={[
    {
      label: 'View',
      onClick: () => console.log('View clicked')
    },
    {
      label: 'Edit',
      onClick: () => console.log('Edit clicked')
    }
  ]}
/>
```

### With Metadata

```jsx
<BaseNodeWithMetadata
  data={data}
  nodeType="strategy"
  metadata={{
    'Created': '2025-11-10',
    'Status': 'In Progress',
    'Owner': 'John Doe'
  }}
/>
```

## File Structure

```
enhanced/
├── nodes/
│   ├── BaseNode.jsx
│   └── index.js
├── handles/
│   ├── CustomHandle.jsx
│   └── index.js
├── utils/
│   ├── themeConfig.js
│   ├── nodeStyles.js
│   ├── animations.js
│   └── index.js
├── index.js
└── README.md (this file)
```

## Performance Tips

1. **Memoize nodes in production:**
```jsx
const MemoizedNode = React.memo(BaseNode);
```

2. **Limit simultaneously expanded nodes:**
```jsx
// Keep track of expanded nodes and limit to 5-10
```

3. **Use backdrop blur sparingly:**
```jsx
// Consider disabling for graphs with 50+ nodes
```

4. **Lazy load for large graphs:**
```jsx
const BaseNode = React.lazy(() => import('./BaseNode'));
```

## Browser Support

- ✅ Chrome 76+ (backdrop-filter support)
- ✅ Safari 9+ (webkit-backdrop-filter)
- ✅ Firefox 103+ (backdrop-filter)
- ✅ Edge 79+ (Chromium-based)

Fallback to opaque backgrounds provided for older browsers.

## Collapsible Node System (NEW)

Complete state management system for collapsible nodes with progressive disclosure.

### Quick Start

```jsx
import {
  CollapsibleNode,
  NodeStateManager,
  NodeStateControls,
} from '@/components/curriculum/enhanced';

const nodeTypes = {
  collapsible: CollapsibleNode,
};

<ReactFlowProvider>
  <NodeStateManager persistKey="my-flow" showControls={true}>
    <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
  </NodeStateManager>
</ReactFlowProvider>
```

### Features

- **Centralized State**: Context-based state management
- **Bulk Operations**: Expand/collapse all, focus mode
- **Progressive Disclosure**: Auto-reveal connected nodes
- **Persistent State**: localStorage integration
- **Tree Operations**: Expand path, expand tree
- **Performance Optimized**: Memoization & debouncing

### Components

- `CollapsibleNode` - Basic collapsible wrapper
- `ProgressiveCollapsibleNode` - Auto-reveals children
- `FocusCollapsibleNode` - Collapses siblings
- `ControlledCollapsibleNode` - With tree controls
- `NodeStateManager` - Context provider
- `NodeStateControls` - Built-in toolbar
- `useNodeState` - State management hook
- `useNodeStateContext` - Access context
- `useNodeStateWithFlow` - Enhanced utilities

### Documentation

See **COLLAPSIBLE_NODES.md** for complete documentation including:
- Architecture overview
- API reference
- Usage examples
- Integration guide
- Performance tips
- Troubleshooting

### Demos

```jsx
import { CollapsibleNodeDemo, IntegrationExample } from '@/components/curriculum/enhanced/demos';

// Interactive demo
<CollapsibleNodeDemo />

// Migration example
<IntegrationExample />
```

## Reference

- See `REACT_FLOW.md` for complete specification
- See `COLLAPSIBLE_NODES.md` for collapsible node system docs
- See `TASK_1_2_IMPLEMENTATION.md` for implementation details
- See `SHADCN_SETUP.md` for theme configuration

## Support

For questions or issues, refer to:
- Component JSDoc comments
- `COLLAPSIBLE_NODES.md` documentation
- Implementation report
- REACT_FLOW specification document
