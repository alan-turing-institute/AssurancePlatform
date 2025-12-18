# Quick Start Guide - Enhanced Node Types

## 5-Minute Integration Guide

### 1. Import the Node Types

```javascript
import { nodeTypes } from '@/components/curriculum/enhanced/nodes/nodeTypes';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
```

### 2. Create Your Nodes

```javascript
const nodes = [
  {
    id: 'goal-1',
    type: 'goal',
    position: { x: 250, y: 50 },
    data: {
      name: 'System Safety',
      importance: 'critical',
      progress: 75
    }
  },
  {
    id: 'strategy-1',
    type: 'strategy',
    position: { x: 250, y: 200 },
    data: {
      name: 'Decompose by Component',
      strategyType: 'AND'
    }
  },
  {
    id: 'claim-1',
    type: 'propertyClaim',
    position: { x: 250, y: 350 },
    data: {
      name: 'Component is Safe',
      verificationStatus: 'verified',
      strength: 'strong'
    }
  },
  {
    id: 'evidence-1',
    type: 'evidence',
    position: { x: 250, y: 500 },
    data: {
      name: 'Test Results',
      evidenceType: 'test',
      confidence: 95
    }
  }
];
```

### 3. Create Edges

```javascript
const edges = [
  { id: 'e1', source: 'goal-1', target: 'strategy-1' },
  { id: 'e2', source: 'strategy-1', target: 'claim-1' },
  { id: 'e3', source: 'claim-1', target: 'evidence-1' }
];
```

### 4. Render with React Flow

```javascript
function MyAssuranceCase() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
      />
    </div>
  );
}
```

---

## Node Type Cheat Sheet

### GoalNode (Green)
```javascript
{
  type: 'goal',
  data: {
    name: 'Goal Name',
    importance: 'critical',  // critical | high | medium | low
    progress: 75,            // 0-100
    isRoot: true
  }
}
```

### StrategyNode (Purple)
```javascript
{
  type: 'strategy',
  data: {
    name: 'Strategy Name',
    strategyType: 'AND',     // AND | OR
    approach: 'decomposition'
  }
}
```

### PropertyClaimNode (Orange)
```javascript
{
  type: 'propertyClaim',
  data: {
    name: 'Claim Name',
    verificationStatus: 'verified',  // verified | in-review | pending | challenged
    strength: 'strong'               // strong | moderate | weak
  }
}
```

### EvidenceNode (Cyan)
```javascript
{
  type: 'evidence',
  data: {
    name: 'Evidence Name',
    evidenceType: 'test',    // document | test | review | inspection | analysis
    confidence: 95,          // 0-100
    sourceLink: 'url'
  }
}
```

### ContextNode (Gray)
```javascript
{
  type: 'context',
  data: {
    name: 'Context Name',
    contextType: 'assumption',  // assumption | constraint | justification | definition
    importance: 'high'
  }
}
```

---

## Helper Functions

### Create Node with Defaults
```javascript
import { createNode } from '@/components/curriculum/enhanced/nodes/nodeTypes';

const node = createNode('goal-1', 'goal', { x: 100, y: 100 }, {
  name: 'My Goal',
  importance: 'high'
});
```

### Validate Node Type
```javascript
import { isValidNodeType } from '@/components/curriculum/enhanced/nodes/nodeTypes';

if (isValidNodeType('goal')) {
  // Valid type
}
```

### Get Available Types
```javascript
import { getAvailableNodeTypes } from '@/components/curriculum/enhanced/nodes/nodeTypes';

const types = getAvailableNodeTypes();
// ['goal', 'strategy', 'propertyClaim', 'evidence', 'context']
```

---

## Styling Tips

### Dark Theme (Recommended)
```jsx
<div className="bg-gray-950">
  <ReactFlow
    nodes={nodes}
    edges={edges}
    nodeTypes={nodeTypes}
  >
    <Background color="rgba(255, 255, 255, 0.05)" />
  </ReactFlow>
</div>
```

### Custom Edge Colors
```javascript
const edges = [
  {
    id: 'e1',
    source: 'goal-1',
    target: 'strategy-1',
    style: { stroke: '#a855f7', strokeWidth: 2 },
    animated: true
  }
];
```

---

## Common Patterns

### Complete Assurance Argument
```
Goal (Root)
  └─ Strategy (AND)
      ├─ PropertyClaim 1 (Verified)
      │   ├─ Evidence 1 (Test)
      │   └─ Evidence 2 (Document)
      ├─ PropertyClaim 2 (Pending)
      │   └─ Evidence 3 (Analysis)
      └─ Context (Assumption)
```

### Using Variants
```javascript
import {
  LargeGoalNode,
  CompactStrategyNode,
  VerifiedPropertyClaimNode
} from '@/components/curriculum/enhanced/nodes';
```

---

## Troubleshooting

### Nodes Not Rendering?
- Check that `nodeTypes` is passed to ReactFlow
- Verify node `type` matches available types
- Ensure node has valid `position` and `data`

### Styling Issues?
- Import React Flow CSS: `import 'reactflow/dist/style.css'`
- Use dark background for glassmorphism effect
- Check Tailwind CSS is configured

### State Not Syncing?
- Wrap in `NodeStateManager` for coordinated behavior
- Use `useNodesState` and `useEdgesState` hooks

---

## Next Steps

1. See `AllNodeTypesDemo.jsx` for full example
2. Read `NODE_TYPES_README.md` for complete documentation
3. Review `REACT_FLOW.md` for design specifications
4. Check `themeConfig.js` for customization options

---

## Links

- [Full Demo](./demos/AllNodeTypesDemo.jsx)
- [Complete Documentation](./NODE_TYPES_README.md)
- [React Flow Docs](https://reactflow.dev)
- [Theme Config](../utils/themeConfig.js)
