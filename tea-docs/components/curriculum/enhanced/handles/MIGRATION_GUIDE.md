# Migration Guide: Basic Handles → Enhanced Handles

Guide for upgrading from basic React Flow handles to enhanced handle components.

---

## Overview

This guide helps you migrate existing nodes from basic React Flow handles to the new enhanced handle components with minimal code changes.

**Benefits of Migration:**
- Connection state visualization
- Validation feedback
- Animations and visual effects
- Smart compatibility checking
- Multiple connection support
- Conditional rendering

---

## Quick Migration (5 Minutes)

### Step 1: Import the Enhanced Handle

**Before:**
```javascript
import { Handle, Position } from 'reactflow';
```

**After:**
```javascript
import { Handle, Position } from 'reactflow';
import { CustomHandle } from '@/components/curriculum/enhanced/handles';
```

### Step 2: Replace Handle with CustomHandle

**Before:**
```jsx
<Handle
  type="source"
  position={Position.Bottom}
  id="source-1"
/>
```

**After:**
```jsx
<CustomHandle
  type="source"
  position={Position.Bottom}
  nodeId={id} // Add this
  id="source-1"
/>
```

**That's it!** Your handles now have:
- Pulse animations
- Hover effects
- Tooltips
- Better styling

---

## Gradual Migration (Recommended)

### Phase 1: Basic Replacement

Replace basic Handle with CustomHandle but keep all existing functionality.

```jsx
// OLD CODE
const GoalNode = ({ data, id }) => (
  <div className="goal-node">
    <h3>{data.name}</h3>
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={data.isConnectable}
    />
  </div>
);

// NEW CODE
import { CustomHandle } from '@/components/curriculum/enhanced/handles';

const GoalNode = ({ data, id }) => (
  <div className="goal-node">
    <h3>{data.name}</h3>
    <CustomHandle
      type="source"
      position={Position.Bottom}
      nodeId={id} // NEW: Required for enhanced features
      isConnectable={data.isConnectable}
    />
  </div>
);
```

### Phase 2: Add Basic Enhancements

Add simple features like badges and pulse effects.

```jsx
const GoalNode = ({ data, id }) => {
  const edges = useStore((s) => s.edges);
  const connectionCount = edges.filter(e => e.source === id).length;

  return (
    <div className="goal-node">
      <h3>{data.name}</h3>
      <CustomHandle
        type="source"
        position={Position.Bottom}
        nodeId={id}
        isConnectable={data.isConnectable}
        // NEW: Show connection count
        connectionCount={connectionCount}
        showBadge={connectionCount > 0}
        showPulse={true}
      />
    </div>
  );
};
```

### Phase 3: Add Smart Features

Upgrade to SmartHandle for compatibility checking.

```jsx
import { SmartHandle } from '@/components/curriculum/enhanced/handles';

const GoalNode = ({ data, id }) => (
  <div className="goal-node">
    <h3>{data.name}</h3>
    <SmartHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
      nodeType="goal" // NEW: For compatibility checking
      compatibleTypes={['strategy', 'context']} // NEW: Define compatible types
      showCompatibilityIndicator={true} // NEW: Visual feedback
    />
  </div>
);
```

### Phase 4: Full Feature Set

Use all available features for maximum functionality.

```jsx
import { SmartHandle, MultiHandle } from '@/components/curriculum/enhanced/handles';
import { useReactFlow } from 'reactflow';

const StrategyNode = ({ data, id }) => {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const connectionCount = edges.filter(e => e.source === id).length;

  return (
    <div className="strategy-node">
      <h3>{data.name}</h3>

      {/* Target handle with smart features */}
      <SmartHandle
        type="target"
        position={Position.Top}
        nodeId={id}
        nodeType="strategy"
        showOnNodeHover={true}
        connectionType="single"
      />

      {/* Source handle with multi-connection support */}
      <MultiHandle
        type="source"
        position={Position.Bottom}
        nodeId={id}
        maxConnections={5}
        fanOutLayout={true}
        showConnectionStack={true}
        connectionCount={connectionCount}
      />
    </div>
  );
};
```

---

## Node Type Migration Examples

### Goal Node Migration

**Before:**
```jsx
const GoalNode = ({ data, id, isConnectable }) => (
  <div className="goal-node">
    <div className="header">
      <Target className="icon" />
      <h3>{data.name}</h3>
    </div>
    <p>{data.description}</p>
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={isConnectable}
    />
  </div>
);
```

**After:**
```jsx
import { SmartHandle } from '@/components/curriculum/enhanced/handles';
import { Target } from 'lucide-react';
import { Position } from 'reactflow';

const GoalNode = ({ data, id, isConnectable }) => (
  <div className="goal-node">
    <div className="header">
      <Target className="icon" />
      <h3>{data.name}</h3>
    </div>
    <p>{data.description}</p>
    <SmartHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
      nodeType="goal"
      compatibleTypes={['strategy', 'context']}
      connectionType="OR"
      isConnectable={isConnectable}
    />
  </div>
);
```

### Strategy Node Migration

**Before:**
```jsx
const StrategyNode = ({ data, id, isConnectable }) => (
  <div className="strategy-node">
    <h3>{data.name}</h3>
    <Handle
      type="target"
      position={Position.Top}
      isConnectable={isConnectable}
    />
    <Handle
      type="source"
      position={Position.Bottom}
      isConnectable={isConnectable}
    />
  </div>
);
```

**After:**
```jsx
import { CustomHandle, MultiHandle } from '@/components/curriculum/enhanced/handles';
import { Position } from 'reactflow';

const StrategyNode = ({ data, id, isConnectable }) => (
  <div className="strategy-node">
    <h3>{data.name}</h3>
    <CustomHandle
      type="target"
      position={Position.Top}
      nodeId={id}
      isConnectable={isConnectable}
    />
    <MultiHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
      maxConnections={5}
      fanOutLayout={true}
      isConnectable={isConnectable}
    />
  </div>
);
```

### Evidence Node Migration

**Before:**
```jsx
const EvidenceNode = ({ data, id, isConnectable }) => (
  <div className="evidence-node">
    <h3>{data.name}</h3>
    <Handle
      type="target"
      position={Position.Top}
      isConnectable={isConnectable && data.verified}
    />
  </div>
);
```

**After:**
```jsx
import { ConditionalHandle } from '@/components/curriculum/enhanced/handles';
import { Position } from 'reactflow';

const EvidenceNode = ({ data, id, isConnectable }) => (
  <div className="evidence-node">
    <h3>{data.name}</h3>
    <ConditionalHandle
      type="target"
      position={Position.Top}
      nodeId={id}
      condition={(nodeData) => nodeData.verified}
      state={data.verified ? 'active' : 'locked'}
      requiresApproval={true}
      isConnectable={isConnectable}
    />
  </div>
);
```

---

## Feature Addition Guide

### Adding Connection Count Badges

```jsx
import { useReactFlow } from 'reactflow';

const MyNode = ({ id }) => {
  const { getEdges } = useReactFlow();
  const edges = getEdges();
  const connectionCount = edges.filter(e => e.source === id).length;

  return (
    <CustomHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
      connectionCount={connectionCount}
      showBadge={connectionCount > 0}
    />
  );
};
```

### Adding Validation

```jsx
const MyNode = ({ data, id }) => {
  const isValid = data.isComplete && data.hasRequiredFields;

  return (
    <CustomHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
      validation={{
        valid: isValid,
        message: isValid ? 'Ready to connect' : 'Complete required fields'
      }}
    />
  );
};
```

### Adding Connection Limits

```jsx
<MultiHandle
  type="source"
  position={Position.Bottom}
  nodeId={id}
  maxConnections={5}
  fanOutLayout={true}
  showConnectionStack={true}
/>
```

### Adding Animations

```jsx
// Simple pulse
<PulseHandle
  type="source"
  position={Position.Bottom}
  nodeId={id}
  colorTheme="blue"
/>

// Or full animated handle
<AnimatedHandle
  type="source"
  position={Position.Bottom}
  nodeId={id}
  animationType="glow"
  glowIntensity="high"
  colorTheme="purple"
/>
```

---

## Common Migration Issues

### Issue 1: Missing nodeId

**Problem:**
```jsx
<CustomHandle type="source" position={Position.Bottom} />
// Error: nodeId is required for enhanced features
```

**Solution:**
```jsx
const MyNode = ({ id }) => (
  <CustomHandle
    type="source"
    position={Position.Bottom}
    nodeId={id} // Add this
  />
);
```

### Issue 2: React Flow Instance Not Available

**Problem:**
```jsx
// Trying to use getEdges() outside React Flow context
const connectionCount = getEdges().length;
```

**Solution:**
```jsx
import { useReactFlow } from 'reactflow';

const MyNode = ({ id }) => {
  const { getEdges } = useReactFlow(); // Get from context
  const edges = getEdges();
  const connectionCount = edges.filter(e => e.source === id).length;

  return <CustomHandle nodeId={id} connectionCount={connectionCount} />;
};
```

### Issue 3: Props Not Working

**Problem:**
```jsx
<CustomHandle
  type="source"
  position="bottom" // Wrong! Should be Position.Bottom
  nodeId={id}
/>
```

**Solution:**
```jsx
import { Position } from 'reactflow';

<CustomHandle
  type="source"
  position={Position.Bottom} // Correct
  nodeId={id}
/>
```

### Issue 4: Styles Not Applying

**Problem:**
Handle doesn't look styled.

**Solution:**
Ensure Tailwind CSS is configured and includes the handle components:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './components/**/*.{js,jsx}',
    './components/curriculum/enhanced/handles/**/*.{js,jsx}', // Add this
  ],
};
```

---

## Performance Optimization

### Before Migration
```jsx
// Re-renders on every state change
const MyNode = ({ data, id }) => (
  <div>
    <Handle type="source" position={Position.Bottom} />
  </div>
);
```

### After Migration with Optimization
```jsx
import React, { memo } from 'react';
import { CustomHandle } from '@/components/curriculum/enhanced/handles';

const MyNode = memo(({ data, id }) => (
  <div>
    <CustomHandle
      type="source"
      position={Position.Bottom}
      nodeId={id}
    />
  </div>
), (prev, next) => {
  // Custom comparison
  return prev.data === next.data && prev.id === next.id;
});
```

---

## Testing After Migration

### Checklist

- [ ] Handles appear in correct positions
- [ ] Connections can be created
- [ ] Tooltips display on hover
- [ ] Animations run smoothly
- [ ] Connection counts are accurate
- [ ] Validation works correctly
- [ ] Multiple connections work (if using MultiHandle)
- [ ] Conditional visibility works (if using ConditionalHandle)
- [ ] Performance is acceptable
- [ ] No console errors

### Manual Testing

1. **Visual Test**: Check handle appearance
2. **Interaction Test**: Try creating connections
3. **Animation Test**: Verify smooth animations
4. **State Test**: Change node data, verify handle updates
5. **Edge Cases**: Test maximum connections, invalid connections

---

## Rollback Plan

If you need to rollback:

### Quick Rollback
```jsx
// Simply change import back
import { Handle } from 'reactflow'; // Instead of CustomHandle

<Handle
  type="source"
  position={Position.Bottom}
  // Remove enhanced props
/>
```

### Gradual Rollback
Keep both implementations temporarily:

```jsx
import { Handle } from 'reactflow';
import { CustomHandle } from '@/components/curriculum/enhanced/handles';

const MyNode = ({ data, id, useEnhanced = false }) => (
  <div>
    {useEnhanced ? (
      <CustomHandle type="source" position={Position.Bottom} nodeId={id} />
    ) : (
      <Handle type="source" position={Position.Bottom} />
    )}
  </div>
);
```

---

## Migration Timeline

### Week 1: Testing Phase
- Migrate 1-2 node types
- Test thoroughly
- Gather feedback
- Fix any issues

### Week 2: Gradual Rollout
- Migrate 50% of nodes
- Monitor performance
- Address issues
- Update documentation

### Week 3: Complete Migration
- Migrate remaining nodes
- Remove old code
- Final testing
- Documentation update

### Week 4: Optimization
- Performance tuning
- Code cleanup
- Feature enhancements
- Team training

---

## Support and Resources

### Documentation
- [Full Documentation](./README.md)
- [Quick Reference](./QUICK_REFERENCE.md)
- [Task Summary](../TASK_3_1_SUMMARY.md)

### Demo
- [Handle Showcase](../demos/HandleShowcase.jsx)

### Help
- Check troubleshooting section in README
- Review examples in demo component
- Consult REACT_FLOW.md Section 3.4 and 5.3

---

## FAQ

**Q: Do I need to migrate all handles at once?**
A: No, you can migrate gradually. New and old handles can coexist.

**Q: Will this break existing connections?**
A: No, enhanced handles are fully compatible with React Flow's connection system.

**Q: What if I don't need all features?**
A: Use basic CustomHandle. You get visual improvements without complexity.

**Q: Is there a performance impact?**
A: Minimal. Enhanced handles use optimized animations and conditional rendering.

**Q: Can I customize the appearance?**
A: Yes, all handles accept className prop and support Tailwind classes.

**Q: What about accessibility?**
A: Enhanced handles include tooltips, ARIA labels, and keyboard navigation.

---

## Migration Checklist

- [ ] Read this guide completely
- [ ] Review examples in HandleShowcase
- [ ] Test enhanced handles in development
- [ ] Create migration plan
- [ ] Update one node type as pilot
- [ ] Test thoroughly
- [ ] Migrate remaining nodes
- [ ] Update documentation
- [ ] Train team members
- [ ] Monitor production performance

---

**Migration Guide v1.0** | Tea Curriculum Platform
**Last Updated:** 2025-11-10
