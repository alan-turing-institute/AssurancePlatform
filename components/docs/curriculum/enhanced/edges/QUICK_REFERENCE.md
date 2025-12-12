# Enhanced Edges - Quick Reference

Fast reference guide for all edge types and their common configurations.

## Edge Types Cheat Sheet

### AnimatedEdge
```jsx
type: 'animated'
data: {
  animated: true,
  animationSpeed: 1,
  strokeWidth: 2,
}
```

### GradientEdge
```jsx
type: 'gradient'
data: {
  sourceColor: '#3b82f6',
  targetColor: '#8b5cf6',
  gradientStops: 3,
}
```

### GlowingEdge
```jsx
type: 'glowing'
data: {
  glowIntensity: 1,
  pulse: true,
  color: '#10b981',
}
```

### FlowingEdge
```jsx
type: 'flowing'
data: {
  particleCount: 3,
  flowSpeed: 1,
  showDirectionIndicators: true,
}
```

### SmartEdge
```jsx
type: 'smart'
data: {
  strength: 0.7,
  showStrengthIndicator: true,
  pathType: 'auto',
}
```

## All Edge Variants

| Type | Use Case | Key Features |
|------|----------|--------------|
| `animated` | Basic connections | Dash animation, hover effects |
| `fastAnimated` | Quick transitions | 2x speed |
| `slowAnimated` | Subtle movements | 0.5x speed |
| `pulseAnimated` | Attention grabbing | Pulsing thickness |
| `gradient` | Visual hierarchy | Color interpolation |
| `rainbowGradient` | Multi-color | 5 color stops |
| `neon` | High visibility | Bright glow |
| `softGlow` | Subtle emphasis | Light glow |
| `intenseGlow` | Strong emphasis | Strong glow |
| `flowing` | Data flow | Particle animation |
| `dataStream` | Heavy traffic | Many particles |
| `bidirectionalFlow` | Two-way flow | Both directions |
| `smart` | Adaptive routing | Auto path selection |
| `strongConnection` | Strong relationships | Thick line, 100% strength |
| `weakConnection` | Weak relationships | Thin line, 30% strength |
| `dependency` | Dependencies | Amber color |
| `errorGlow` | Errors | Red glow |
| `successGlow` | Success | Green glow |

## Common Configurations

### Basic Edge
```jsx
{
  id: 'e1',
  source: 'node1',
  target: 'node2',
  type: 'smart',
  data: { label: 'Connection' }
}
```

### Styled Edge
```jsx
{
  id: 'e1',
  source: 'node1',
  target: 'node2',
  type: 'gradient',
  data: {
    label: 'Data Flow',
    sourceColor: '#3b82f6',
    targetColor: '#8b5cf6',
  }
}
```

### Interactive Edge
```jsx
{
  id: 'e1',
  source: 'node1',
  target: 'node2',
  type: 'smart',
  data: {
    label: 'Click Me',
    onClick: (e, edge) => console.log('Clicked', edge),
  }
}
```

### State-Based Edge
```jsx
{
  id: 'e1',
  source: 'node1',
  target: 'node2',
  type: 'successGlow',
  data: {
    label: 'Completed',
    state: 'success',
  }
}
```

## Presets

```jsx
import { edgeStylePresets, applyEdgePreset } from './edges';

// Available presets
presets = [
  'modern',
  'dataFlow',
  'elegant',
  'neon',
  'minimal',
  'active',
  'error',
  'success',
  'strong',
  'weak',
]

// Apply preset
const styledEdge = applyEdgePreset(edge, 'neon');
```

## Color Reference

### State Colors
- `default`: `#8b5cf6` (purple)
- `active`: `#3b82f6` (blue)
- `error`: `#ef4444` (red)
- `success`: `#10b981` (green)
- `warning`: `#f59e0b` (amber)
- `inactive`: `#6b7280` (gray)

### Common Gradients
```jsx
// Blue to Purple
sourceColor: '#3b82f6', targetColor: '#8b5cf6'

// Green to Blue
sourceColor: '#10b981', targetColor: '#3b82f6'

// Temperature (Cold to Hot)
sourceColor: '#3b82f6', targetColor: '#ef4444'

// Rainbow
colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
```

## Performance Settings

### High Performance
```jsx
data: {
  animated: false,
  particleCount: 1,
  glowIntensity: 0.5,
}
```

### Balanced
```jsx
data: {
  animated: true,
  particleCount: 3,
  glowIntensity: 1,
}
```

### High Quality
```jsx
data: {
  animated: true,
  particleCount: 8,
  glowIntensity: 2,
}
```

## Integration with React Flow

```jsx
import ReactFlow from 'reactflow';
import { edgeTypes } from './components/curriculum/enhanced/edges';

function MyComponent() {
  return (
    <ReactFlow
      edges={edges}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{
        animated: true,
        type: 'smart',
      }}
    />
  );
}
```

## Utility Functions

```jsx
import {
  createEdge,
  createEdges,
  applyEdgePreset,
} from './edges';

// Create single edge
const edge = createEdge('node1', 'node2', 'smart', { label: 'Connection' });

// Create multiple edges
const edges = createEdges([
  { source: 'a', target: 'b', type: 'animated' },
  { source: 'b', target: 'c', type: 'gradient' },
]);

// Apply preset
const styledEdge = applyEdgePreset(edge, 'dataFlow');
```

## Common Patterns

### Parent-Child Relationships
```jsx
type: 'strongConnection',
data: { label: 'Parent', strength: 1 }
```

### Sibling Relationships
```jsx
type: 'gradient',
data: {
  sourceColor: '#6b7280',
  targetColor: '#9ca3af',
}
```

### Dependencies
```jsx
type: 'dependency',
data: { label: 'Depends on', type: 'depends' }
```

### Data Flow
```jsx
type: 'dataStream',
data: {
  particleCount: 5,
  flowSpeed: 1.2,
}
```

### Active/Inactive States
```jsx
// Active
type: 'activeDataFlow',
data: { pulse: true, flowIntensity: 1 }

// Inactive
type: 'animated',
data: { color: '#6b7280', animated: false }
```

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Edges not visible | Add `edgeTypes={edgeTypes}` to ReactFlow |
| Poor performance | Reduce `particleCount` and `glowIntensity` |
| Gradients not working | Ensure unique edge IDs |
| Labels not showing | Set `showLabel: true` in data |
| Wrong colors | Use hex format: `#3b82f6` |

## Best Practices

1. **Start simple** - Use `smart` or `animated` as default
2. **Add visual feedback** - Use glow/gradient for important edges
3. **Show data flow** - Use `flowing` for active connections
4. **Indicate state** - Use `errorGlow`, `successGlow` for status
5. **Performance first** - Disable unnecessary animations
6. **Consistent styling** - Use presets for uniform appearance
7. **Meaningful labels** - Provide clear relationship descriptions
8. **Accessibility** - Ensure sufficient color contrast

## Version

Enhanced Edges v1.0.0 - Task 3.2 Complete
