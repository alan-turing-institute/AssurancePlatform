# Handle Components Quick Reference

Quick lookup guide for all enhanced handle components and their usage.

---

## Import Statement

```javascript
import {
  // Base handles
  CustomHandle,
  AnimatedHandle,
  SmartHandle,
  MultiHandle,
  ConditionalHandle,

  // Quick presets
  PulseHandle,
  GlowHandle,
  AndGateHandle,
  FanOutHandle,
  LockedHandle,

  // Utilities
  getPositionClasses,
  validateConnection,
} from '@/components/curriculum/enhanced/handles';
```

---

## Component Quick Picker

### Need connection state indicators?
→ **CustomHandle** with `showBadge={true}`

### Need animations?
→ **AnimatedHandle** or **PulseHandle** / **GlowHandle**

### Need smart compatibility checking?
→ **SmartHandle** or **AndGateHandle** / **OrGateHandle**

### Need multiple connections?
→ **MultiHandle** or **FanOutHandle** / **StackedHandle**

### Need conditional visibility?
→ **ConditionalHandle** or **LockedHandle** / **PendingHandle**

---

## One-Liners

```jsx
// Basic enhanced handle
<CustomHandle type="source" position={Position.Bottom} nodeId="node-1" />

// Pulse animation
<PulseHandle type="source" position={Position.Bottom} nodeId="node-1" />

// Smart compatibility
<SmartHandle type="source" position={Position.Bottom} nodeId="node-1" nodeType="goal" />

// Multiple connections
<FanOutHandle type="source" position={Position.Bottom} nodeId="node-1" />

// Locked state
<LockedHandle type="source" position={Position.Bottom} nodeId="node-1" />
```

---

## Props Cheat Sheet

### Common Props (All Handles)
```typescript
type: 'source' | 'target'
position: Position.Top | Position.Bottom | Position.Left | Position.Right
nodeId: string
id?: string
isConnectable?: boolean
className?: string
```

### CustomHandle Specific
```typescript
isConnected?: boolean
connectionCount?: number
maxConnections?: number
validation?: { valid: boolean; message: string }
showBadge?: boolean
showPulse?: boolean
showTooltip?: boolean
size?: 'small' | 'medium' | 'large'
shape?: 'circle' | 'square' | 'diamond'
```

### AnimatedHandle Specific
```typescript
animationType?: 'pulse' | 'glow' | 'ripple' | 'spring' | 'breathe'
glowIntensity?: 'low' | 'medium' | 'high'
colorTheme?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan'
showParticles?: boolean
continuousAnimation?: boolean
```

### SmartHandle Specific
```typescript
autoHide?: boolean
showOnNodeHover?: boolean
connectionType?: 'AND' | 'OR' | 'single'
compatibleTypes?: string[]
nodeType?: string
showCompatibilityIndicator?: boolean
smartPositioning?: boolean
```

### MultiHandle Specific
```typescript
maxConnections?: number
fanOutLayout?: boolean
showConnectionStack?: boolean
showConnectionList?: boolean
groupConnections?: boolean
stackDirection?: 'horizontal' | 'vertical' | 'radial'
```

### ConditionalHandle Specific
```typescript
condition?: (nodeData: any) => boolean
state?: 'active' | 'inactive' | 'error' | 'locked' | 'pending' | 'warning'
stateStyles?: object
dynamicPosition?: boolean
customValidation?: (data: any) => { valid: boolean; message?: string }
requiresApproval?: boolean
dependencies?: string[]
```

---

## Common Patterns

### Pattern 1: Goal Node
```jsx
<SmartHandle
  type="source"
  position={Position.Bottom}
  nodeId="goal-1"
  nodeType="goal"
  compatibleTypes={['strategy', 'context']}
  connectionType="OR"
/>
```

### Pattern 2: Strategy Node
```jsx
<>
  <CustomHandle type="target" position={Position.Top} nodeId="strategy-1" />
  <FanOutHandle type="source" position={Position.Bottom} nodeId="strategy-1" maxConnections={5} />
</>
```

### Pattern 3: Evidence Node
```jsx
<ConditionalHandle
  type="target"
  position={Position.Top}
  nodeId="evidence-1"
  condition={(data) => data.verified}
  state={verified ? 'active' : 'locked'}
/>
```

### Pattern 4: Context Node
```jsx
<SmartHandle
  type="target"
  position={Position.Top}
  nodeId="context-1"
  showOnNodeHover={true}
  nodeType="context"
/>
```

---

## Utility Functions Quick Reference

### Position
```javascript
getPositionClasses(Position.Bottom) // Returns CSS classes
calculateHandlePosition(Position.Bottom, bounds, offset) // Returns {x, y}
```

### Validation
```javascript
validateConnection(source, target, rules) // Returns {valid, reason}
areNodeTypesCompatible('goal', 'strategy') // Returns boolean
```

### State
```javascript
getConnectionCount(nodeId, edges, 'source') // Returns number
isHandleConnected(nodeId, handleId, edges, 'source') // Returns boolean
```

### Style
```javascript
getHandleColors(isConnected, isValid, isHovered) // Returns color object
getHandleSizeClasses('medium') // Returns size classes
```

---

## Visual States Quick Guide

### Connection States
- **Disconnected**: White background, Plus icon
- **Connected**: Blue background, Minus icon
- **Valid**: Green ring, CheckCircle icon
- **Invalid**: Red ring, X icon

### Animation States
- **Pulse**: Scale 1-1.15-1 loop
- **Glow**: Shadow intensity cycling
- **Spring**: Bounce on hover
- **Breathe**: Gentle scaling

### Smart States
- **Compatible**: Green glow, CheckCircle
- **Incompatible**: Red glow, AlertCircle
- **Hidden**: Not visible
- **Visible**: Fade in animation

### Multi States
- **Empty**: White, Plus icon
- **Partial**: Blue, badge with count
- **Full**: Red indicator, disabled
- **Grouped**: Layers2 icon

### Conditional States
- **Active**: Green, Check icon
- **Locked**: Yellow, Lock icon
- **Error**: Red, X icon
- **Pending**: Blue, Clock icon, spinning
- **Warning**: Orange, AlertTriangle, pulsing

---

## Color Themes

| Theme | Primary | Use Case |
|-------|---------|----------|
| blue | #3b82f6 | Default, general purpose |
| green | #10b981 | Success, valid states |
| purple | #a855f7 | Special, featured |
| orange | #f97316 | Warning, attention |
| cyan | #06b6d4 | Info, alternative |

---

## Size Reference

| Size | Outer | Inner | Icon | Offset |
|------|-------|-------|------|--------|
| small | 8×8 | 6×6 | 3×3 | 4 |
| medium | 12×12 | 8×8 | 4×4 | 6 |
| large | 16×16 | 12×12 | 6×6 | 8 |

---

## Shape Reference

| Shape | Class | Visual |
|-------|-------|--------|
| circle | rounded-full | ○ |
| square | rounded-md | ▢ |
| diamond | rounded-sm rotate-45 | ◇ |

---

## Animation Timings

| Animation | Duration | Easing |
|-----------|----------|--------|
| Pulse | 1.5s | easeInOut |
| Glow | 2s | easeInOut |
| Breathe | 3s | easeInOut |
| Spring | 0.4s | cubic-bezier |
| Ripple | 1s | easeOut |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Handle not showing | Check `isConnectable={true}` |
| Tooltip not appearing | Check `showTooltip={true}` and z-index |
| Animation laggy | Reduce simultaneous animations |
| Validation not working | Ensure React Flow instance available |
| Colors not showing | Check Tailwind config |

---

## Performance Tips

1. Use CSS animations (built-in)
2. Enable `continuousAnimation={false}` for static handles
3. Limit simultaneous animations to 5-10
4. Use `React.memo` for handle-containing nodes
5. Debounce rapid state changes

---

## Accessibility Checklist

- [ ] Tooltip text provided
- [ ] Colors have sufficient contrast
- [ ] Keyboard navigation possible
- [ ] Focus indicators visible
- [ ] Screen reader compatible
- [ ] Motion can be reduced

---

## Common Mistakes

❌ **Don't:**
```jsx
// Missing nodeId
<CustomHandle type="source" position={Position.Bottom} />

// Using string position
<CustomHandle type="source" position="bottom" nodeId="1" />

// Forgetting to import Position
<CustomHandle type="source" nodeId="1" />
```

✅ **Do:**
```jsx
import { Position } from 'reactflow';

<CustomHandle
  type="source"
  position={Position.Bottom}
  nodeId="node-1"
/>
```

---

## Version Info

- **Version**: 1.0
- **Last Updated**: 2025-11-10
- **React Flow**: 11+
- **Framer Motion**: 10+
- **Lucide React**: 0.263+

---

## Related Links

- [Full Documentation](./README.md)
- [Task Summary](../TASK_3_1_SUMMARY.md)
- [React Flow Spec](../../REACT_FLOW.md)
- [Demo Component](../demos/HandleShowcase.jsx)

---

**Quick Reference v1.0** | Tea Curriculum Platform
