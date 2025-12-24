# Enhanced Handle Components

Comprehensive collection of React Flow handle components with advanced features including connection state indicators, animations, smart positioning, multiple connections, and conditional rendering.

## Overview

This package provides five main handle types, each with multiple variants and presets:

1. **CustomHandle** - Enhanced base handle with validation and state indicators
2. **AnimatedHandle** - Handles with continuous animations and effects
3. **SmartHandle** - Intelligent handles with auto-hide and compatibility checking
4. **MultiHandle** - Handles supporting multiple connections with visual management
5. **ConditionalHandle** - State-based handles with dynamic behavior

## Installation

All handle components are available in the `/handles` directory:

```javascript
// Import specific handles
import {
  CustomHandle,
  AnimatedHandle,
  SmartHandle,
  MultiHandle,
  ConditionalHandle,
} from '@/components/curriculum/enhanced/handles';

// Import specific variants
import {
  PulseHandle,
  GlowHandle,
  AndGateHandle,
  FanOutHandle,
  LockedHandle,
} from '@/components/curriculum/enhanced/handles';
```

## 1. CustomHandle

Enhanced base handle with connection state indicators, validation feedback, drag preview, connection count badges, pulse animations, and tooltips.

### Features

- Connection state indicators (connected/disconnected)
- Validation feedback (valid/invalid)
- Drag preview during connection
- Connection count badge
- Pulse animation for available connections
- Dynamic tooltips
- Size variants (small, medium, large)
- Shape variants (circle, square, diamond)

### Basic Usage

```jsx
import CustomHandle from './handles/CustomHandle';
import { Position } from 'reactflow';

<CustomHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
  isConnected={false}
  connectionCount={2}
  maxConnections={5}
  validation={{ valid: true, message: 'Compatible connection' }}
  showBadge={true}
  showPulse={true}
  showTooltip={true}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `string` | - | Handle type ('source' or 'target') |
| `position` | `Position` | - | Handle position (Top, Bottom, Left, Right) |
| `nodeId` | `string` | - | Node identifier |
| `isConnected` | `boolean` | `false` | Connection state indicator |
| `connectionCount` | `number` | `0` | Number of connections |
| `maxConnections` | `number` | `Infinity` | Maximum allowed connections |
| `validation` | `object` | `null` | Validation state `{valid: boolean, message: string}` |
| `showBadge` | `boolean` | `false` | Show connection count badge |
| `showPulse` | `boolean` | `true` | Enable pulse animation |
| `showTooltip` | `boolean` | `true` | Show tooltip on hover |
| `tooltipText` | `string` | `''` | Custom tooltip text |
| `size` | `string` | `'medium'` | Size variant ('small', 'medium', 'large') |
| `shape` | `string` | `'circle'` | Shape variant ('circle', 'square', 'diamond') |

### Variants

```jsx
// With Connection Indicator
<CustomHandleWithIndicator
  type="source"
  position={Position.Bottom}
  isConnected={true}
/>

// Pulsing Handle
<PulsingHandle
  type="source"
  position={Position.Bottom}
/>

// With Tooltip
<CustomHandleWithTooltip
  type="source"
  position={Position.Bottom}
  tooltip="Click to connect nodes"
/>
```

## 2. AnimatedHandle

Advanced handle with continuous animations, glow effects, ripples, and spring physics.

### Features

- Multiple animation types (pulse, glow, ripple, spring, breathe)
- Glow intensity control (low, medium, high)
- Color themes (blue, green, purple, orange, cyan)
- Particle effects
- Ripple on connection
- Spring animation on drag

### Basic Usage

```jsx
import AnimatedHandle from './handles/AnimatedHandle';

<AnimatedHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
  animationType="pulse"
  glowIntensity="high"
  colorTheme="blue"
  showParticles={false}
  continuousAnimation={true}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `animationType` | `string` | `'pulse'` | Animation type ('pulse', 'glow', 'ripple', 'spring', 'breathe') |
| `glowIntensity` | `string` | `'medium'` | Glow intensity ('low', 'medium', 'high') |
| `colorTheme` | `string` | `'blue'` | Color theme ('blue', 'green', 'purple', 'orange', 'cyan') |
| `showParticles` | `boolean` | `false` | Show particle effects on hover |
| `continuousAnimation` | `boolean` | `true` | Enable continuous animation |

### Presets

```jsx
// Pulse Animation
<PulseHandle type="source" position={Position.Bottom} colorTheme="blue" />

// Glow Effect
<GlowHandle type="source" position={Position.Bottom} colorTheme="purple" />

// Spring Animation
<SpringHandle type="source" position={Position.Bottom} colorTheme="green" />

// Breathe Animation
<BreatheHandle type="source" position={Position.Bottom} colorTheme="cyan" />

// Particle Effects
<ParticleHandle type="source" position={Position.Bottom} colorTheme="orange" />
```

## 3. SmartHandle

Intelligent handle with auto-hide, compatibility checking, and connection type indicators.

### Features

- Auto-hide when not needed
- Show only on node hover
- Connection type indicators (AND/OR/single)
- Compatible node type checking
- Visual feedback for valid/invalid connections
- Intelligent positioning to avoid overlaps
- Real-time compatibility validation

### Basic Usage

```jsx
import SmartHandle from './handles/SmartHandle';

<SmartHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
  autoHide={false}
  showOnNodeHover={true}
  connectionType="AND"
  compatibleTypes={['strategy', 'evidence']}
  nodeType="goal"
  showCompatibilityIndicator={true}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoHide` | `boolean` | `false` | Auto-hide when not needed |
| `showOnNodeHover` | `boolean` | `true` | Show only when node is hovered |
| `connectionType` | `string` | `'single'` | Connection logic ('AND', 'OR', 'single') |
| `compatibleTypes` | `Array<string>` | `[]` | List of compatible node types |
| `nodeType` | `string` | `'default'` | Current node type |
| `showCompatibilityIndicator` | `boolean` | `true` | Show compatibility feedback |
| `smartPositioning` | `boolean` | `false` | Enable intelligent positioning |

### Presets

```jsx
// Auto-hide Handle
<AutoHideHandle type="source" position={Position.Bottom} />

// Hover-show Handle
<HoverShowHandle type="source" position={Position.Bottom} />

// AND Gate Handle
<AndGateHandle type="source" position={Position.Bottom} />

// OR Gate Handle
<OrGateHandle type="source" position={Position.Bottom} />

// Smart Positioning
<SmartPositionHandle type="source" position={Position.Bottom} />
```

## 4. MultiHandle

Handle supporting multiple connections with fan-out layout, visual stacking, and connection management.

### Features

- Multiple connection support
- Fan-out visual layout
- Connection stacking display
- Connection limit indicators
- Grouped connection management
- Connection list expansion
- Visual progress bar
- Radial/horizontal/vertical stack modes

### Basic Usage

```jsx
import MultiHandle from './handles/MultiHandle';

<MultiHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
  maxConnections={5}
  fanOutLayout={true}
  showConnectionStack={true}
  showConnectionList={false}
  groupConnections={false}
  stackDirection="radial"
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxConnections` | `number` | `5` | Maximum allowed connections |
| `fanOutLayout` | `boolean` | `true` | Enable fan-out layout |
| `showConnectionStack` | `boolean` | `true` | Show visual stacking |
| `showConnectionList` | `boolean` | `false` | Show expandable connection list |
| `groupConnections` | `boolean` | `false` | Enable grouped management |
| `stackDirection` | `string` | `'radial'` | Stack direction ('horizontal', 'vertical', 'radial') |

### Presets

```jsx
// Fan-out Multi Handle
<FanOutHandle type="source" position={Position.Bottom} />

// Stacked Multi Handle
<StackedHandle type="source" position={Position.Bottom} />

// Grouped Multi Handle
<GroupedHandle type="source" position={Position.Bottom} />

// Limited (3 max)
<LimitedMultiHandle type="source" position={Position.Bottom} />
```

## 5. ConditionalHandle

State-based handle with dynamic behavior based on conditions, dependencies, and custom validation.

### Features

- Show/hide based on node state
- Multiple state styles (active, inactive, error, locked, pending)
- Dynamic positioning based on content
- State-based animations
- Custom validation rules
- Dependency checking
- Approval requirements
- Conditional visibility

### Basic Usage

```jsx
import ConditionalHandle from './handles/ConditionalHandle';

<ConditionalHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
  condition={(nodeData) => nodeData.isComplete}
  state="active"
  stateStyles={{
    active: { bg: 'bg-green-500', border: 'border-green-400' },
    error: { bg: 'bg-red-500', border: 'border-red-400' }
  }}
  dynamicPosition={false}
  customValidation={(data) => ({ valid: true })}
  requiresApproval={false}
  dependencies={[]}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `condition` | `Function` | `null` | Condition function `(nodeData) => boolean` |
| `state` | `string` | `'active'` | Current state ('active', 'inactive', 'error', 'locked', 'pending') |
| `stateStyles` | `object` | `{}` | Custom styles for each state |
| `stateIcons` | `object` | `{}` | Custom icons for each state |
| `dynamicPosition` | `boolean` | `false` | Enable dynamic positioning |
| `customValidation` | `Function` | `null` | Custom validation function |
| `requiresApproval` | `boolean` | `false` | Requires approval before connection |
| `dependencies` | `Array<string>` | `[]` | List of required node IDs |

### Presets

```jsx
// Approved Handle
<ApprovedHandle type="source" position={Position.Bottom} />

// Locked Handle
<LockedHandle type="source" position={Position.Bottom} />

// Error Handle
<ErrorHandle type="source" position={Position.Bottom} />

// Pending Handle
<PendingHandle type="source" position={Position.Bottom} />

// Dependency Handle
<DependencyHandle
  type="source"
  position={Position.Bottom}
  dependencies={['node-1', 'node-2']}
/>

// Conditional Visibility
<ConditionalVisibilityHandle
  type="source"
  position={Position.Bottom}
  condition={(data) => data.showHandle !== false}
/>
```

## Utilities

The `handleUtils.js` file provides helper functions for all handle components:

### Position Helpers

```javascript
import { getPositionClasses, calculateHandlePosition } from './handleUtils';

// Get CSS classes for positioning
const classes = getPositionClasses(Position.Bottom);

// Calculate absolute position
const pos = calculateHandlePosition(Position.Bottom, nodeBounds, 24);
```

### Connection Validation

```javascript
import { validateConnection, areNodeTypesCompatible } from './handleUtils';

// Validate connection
const result = validateConnection(sourceNode, targetNode, rules);

// Check type compatibility
const compatible = areNodeTypesCompatible('goal', 'strategy');
```

### State Management

```javascript
import {
  getConnectionCount,
  isHandleConnected,
  getConnectedEdges,
} from './handleUtils';

// Get connection count
const count = getConnectionCount(nodeId, edges, 'source');

// Check if connected
const connected = isHandleConnected(nodeId, handleId, edges, 'source');

// Get connected edges
const connectedEdges = getConnectedEdges(nodeId, handleId, edges, 'source');
```

### Style Generation

```javascript
import {
  getHandleColors,
  getHandleSizeClasses,
  getHandleShapeClasses,
} from './handleUtils';

// Get colors based on state
const colors = getHandleColors(isConnected, isValid, isHovered);

// Get size classes
const sizes = getHandleSizeClasses('medium');

// Get shape classes
const shape = getHandleShapeClasses('circle');
```

## Demo Component

A comprehensive showcase of all handle types is available in `HandleShowcase.jsx`:

```jsx
import HandleShowcase from './demos/HandleShowcase';

// Render the showcase
<HandleShowcase />
```

The demo displays:
- All 5 handle types with their variants
- Interactive connection testing
- Hover effects and animations
- Connection state indicators
- Real-time behavior demonstrations

## Performance Considerations

### Optimization Tips

1. **Use React.memo** for handle components in large graphs
2. **Debounce rapid state changes** using provided utilities
3. **Minimize re-renders** by managing state efficiently
4. **Use CSS animations** where possible (already implemented)
5. **Lazy load** heavy animations for better initial render

### Memory Management

- Handles automatically clean up event listeners
- Animations use `requestAnimationFrame` efficiently
- State updates are batched when possible

## Browser Support

All handle components are compatible with:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

CSS features used:
- CSS Grid and Flexbox
- CSS Transforms and Transitions
- Backdrop filter (with fallbacks)
- CSS Custom Properties

## Accessibility

All handle components include:
- ARIA labels for screen readers
- Keyboard navigation support
- Focus indicators
- Color contrast compliance (WCAG AA)
- Descriptive tooltips

## Migration from Basic Handles

To migrate from basic React Flow handles:

```jsx
// Before
<Handle type="source" position={Position.Bottom} />

// After - Basic replacement
<CustomHandle type="source" position={Position.Bottom} nodeId={nodeId} />

// After - With enhanced features
<CustomHandle
  type="source"
  position={Position.Bottom}
  nodeId={nodeId}
  showBadge={true}
  showPulse={true}
  maxConnections={5}
/>
```

## Examples

### Example 1: Goal Node with Strategy Connections

```jsx
import { SmartHandle } from './handles';
import { Position } from 'reactflow';

<div className="goal-node">
  <h3>System Safety Goal</h3>
  <SmartHandle
    type="source"
    position={Position.Bottom}
    nodeId="goal-1"
    nodeType="goal"
    compatibleTypes={['strategy', 'context']}
    connectionType="OR"
    showCompatibilityIndicator={true}
  />
</div>
```

### Example 2: Strategy Node with Multiple Connections

```jsx
import { MultiHandle } from './handles';
import { Position } from 'reactflow';

<div className="strategy-node">
  <h3>Argument Strategy</h3>
  <MultiHandle
    type="target"
    position={Position.Top}
    nodeId="strategy-1"
  />
  <FanOutHandle
    type="source"
    position={Position.Bottom}
    nodeId="strategy-1"
    maxConnections={5}
  />
</div>
```

### Example 3: Evidence Node with Conditional Availability

```jsx
import { ConditionalHandle } from './handles';
import { Position } from 'reactflow';

<div className="evidence-node">
  <h3>Test Results</h3>
  <ConditionalHandle
    type="target"
    position={Position.Top}
    nodeId="evidence-1"
    condition={(data) => data.verified === true}
    state={isVerified ? 'active' : 'locked'}
    requiresApproval={true}
  />
</div>
```

## Troubleshooting

### Common Issues

**Issue**: Handles not showing
- **Solution**: Ensure `isConnectable={true}` and handle is within node bounds

**Issue**: Tooltips not appearing
- **Solution**: Check `showTooltip={true}` and z-index of parent elements

**Issue**: Animations not smooth
- **Solution**: Reduce number of simultaneous animations, use `continuousAnimation={false}`

**Issue**: Connection validation not working
- **Solution**: Ensure React Flow instance is available and nodeId is correct

## Contributing

To add new handle variants:

1. Create new component in `/handles` directory
2. Follow existing naming conventions
3. Export from `index.js`
4. Add documentation to this README
5. Create demo in `HandleShowcase.jsx`

## License

MIT License - Part of TEA Curriculum Platform

## Related Documentation

- [REACT_FLOW.md](../../REACT_FLOW.md) - React Flow integration guide
- [themeConfig.js](../utils/themeConfig.js) - Theme configuration
- [Collapsible Nodes](../nodes/README.md) - Node components documentation
