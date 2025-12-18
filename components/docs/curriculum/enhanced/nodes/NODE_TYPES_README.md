# Enhanced Node Types Documentation

## Overview

This directory contains five specialized node type components for React Flow-based assurance case visualization, each with unique styling, features, and behavior following the FloraFauna.ai-inspired design system.

## Node Types

### 1. GoalNode (Green Theme)

**Purpose**: Top-level system properties to be assured

**Visual Features**:
- Emerald/green glassmorphism theme
- Target icon from Lucide React
- Larger default size (expanded: 400px)
- Special "root node" styling with glow effect
- No source handle (top-level nodes only have target handles)

**Special Features**:
- **Importance Badge**: Critical, High, Medium, Low with color coding
- **Progress Indicator**: Circular progress ring (0-100%)
- **Sub-goals Counter**: Shows number of child goals
- **Root Node Indicator**: Special badge for root-level goals
- **Context Display**: Lists related context items
- **Pulse Animation**: Critical goals have pulse effect

**Data Properties**:
```javascript
{
  name: 'System Safety',
  description: 'System is acceptably safe to operate',
  importance: 'critical', // critical | high | medium | low
  progress: 75,           // 0-100
  subGoalsCount: 5,
  isRoot: true,
  context: [
    { name: 'Operating Environment' },
    { name: 'Maximum Speed' }
  ],
  metadata: {
    owner: 'Safety Team',
    lastReview: '2025-11-01'
  }
}
```

**Variants**:
- `CompactGoalNode`: Smaller version (200-300px)
- `LargeGoalNode`: Larger version (350-500px) with auto root styling

---

### 2. StrategyNode (Purple Theme)

**Purpose**: Argument strategies for decomposing goals

**Visual Features**:
- Violet/purple glassmorphism theme
- GitBranch icon from Lucide React
- Skewed/tilted design (`transform: skewY(-1deg)`)
- Both source and target handles
- Animated gradient border when selected

**Special Features**:
- **Strategy Type Badge**: AND/OR decomposition indicator
- **Approach Indicator**: Decomposition, Substitution, Evidence, Assumption
- **Connection Paths**: Visual count of outgoing paths
- **Rationale Display**: Shows reasoning behind strategy
- **Supporting Evidence**: Lists evidence supporting the strategy
- **Visual Path Indicators**: Different visuals for AND (parallel lines) vs OR (curved lines)

**Data Properties**:
```javascript
{
  name: 'Decomposition by Components',
  description: 'Break down by major components',
  strategyType: 'AND',        // AND | OR
  approach: 'decomposition',  // decomposition | substitution | evidence | assumption
  pathCount: 3,
  rationale: 'Each component must be safe',
  supportingEvidence: [
    { name: 'Architecture Document' }
  ],
  metadata: {
    author: 'John Doe',
    date: '2025-10-15'
  }
}
```

**Variants**:
- `CompactStrategyNode`: Smaller version
- `DecompositionStrategyNode`: Pre-configured for AND decomposition
- `AlternativeStrategyNode`: Pre-configured for OR alternatives

---

### 3. PropertyClaimNode (Orange Theme)

**Purpose**: Specific property claims requiring verification

**Visual Features**:
- Amber/orange glassmorphism theme
- FileText icon from Lucide React
- Both source and target handles
- Animated verification status indicators

**Special Features**:
- **Verification Status Badge**: Verified, In Review, Pending, Challenged
- **Claim Strength Indicator**: Visual bar chart (Weak, Moderate, Strong)
- **Linked Evidence Counter**: Shows number of supporting evidence items
- **Metadata Display**: Author, date, reviewer, last updated
- **Assumptions List**: Shows underlying assumptions
- **Related Claims**: Links to other related claims
- **Status Animations**: Pulse for challenged, checkmark for verified

**Data Properties**:
```javascript
{
  name: 'Component X is safe',
  description: 'Component operates within safe parameters',
  strength: 'strong',              // strong | moderate | weak
  verificationStatus: 'verified',   // verified | in-review | pending | challenged
  linkedEvidenceCount: 3,
  author: 'Jane Smith',
  date: '2025-10-20',
  reviewer: 'Bob Johnson',
  lastUpdated: '2025-11-05',
  assumptions: [
    { name: 'Sensors calibrated' }
  ],
  relatedClaims: [
    { name: 'Related Claim A' }
  ],
  metadata: {
    testCoverage: '95%'
  }
}
```

**Variants**:
- `CompactPropertyClaimNode`: Smaller version
- `VerifiedPropertyClaimNode`: Pre-configured as verified with strong strength
- `PendingPropertyClaimNode`: Pre-configured as in-review

---

### 4. EvidenceNode (Cyan Theme)

**Purpose**: Supporting evidence and artifacts

**Visual Features**:
- Cyan/turquoise glassmorphism theme
- CheckCircle icon from Lucide React
- Only target handle (leaf nodes)
- Shimmer animation for high-confidence evidence
- Extra glow effect for high confidence (≥80%)

**Special Features**:
- **Evidence Type Badge**: Document, Test, Review, Inspection, Analysis
- **Confidence Level**: Visual progress bar with percentage (0-100%)
- **Quality Rating**: 5-star rating system
- **Source Link**: Clickable link to evidence source
- **Author & Verifier**: Shows who created and verified
- **Last Updated**: Timestamp display
- **Tags**: Categorization badges
- **High Confidence Badge**: Special indicator for ≥80% confidence

**Data Properties**:
```javascript
{
  name: 'Test Results Document',
  description: 'Comprehensive test results',
  evidenceType: 'test',     // document | test | review | inspection | analysis
  confidence: 95,           // 0-100
  sourceLink: 'https://example.com/report.pdf',
  sourceName: 'Test Report v2.3',
  lastUpdated: '2025-11-05',
  quality: 'high',          // high | good | medium | low
  author: 'Test Team',
  verifiedBy: 'QA Team',
  tags: ['safety', 'validation'],
  metadata: {
    testCases: 1247,
    passRate: '99.2%'
  }
}
```

**Variants**:
- `CompactEvidenceNode`: Smaller version
- `HighConfidenceEvidenceNode`: Pre-configured with 95% confidence
- `TestEvidenceNode`: Pre-configured as test evidence
- `DocumentEvidenceNode`: Pre-configured as document evidence

---

### 5. ContextNode (Gray Theme)

**Purpose**: Contextual information, assumptions, and constraints

**Visual Features**:
- Subtle gray glassmorphism theme
- AlertCircle icon from Lucide React
- Smaller default size (200-320px)
- Hover tooltip for extended information
- Both target handle and optional source handle

**Special Features**:
- **Context Type Badge**: Assumption, Constraint, Justification, Definition
- **Importance Level**: Critical, High, Medium, Low with color coding
- **Info Tooltip**: Hover for detailed information
- **Related Nodes Counter**: Shows how many nodes this applies to
- **Validity Display**: Shows validity conditions
- **Scope Information**: Describes applicable scope
- **Implications List**: Shows consequences or impacts
- **Critical Warning**: Pulsing indicator for critical context

**Data Properties**:
```javascript
{
  name: 'Operating Environment',
  description: 'System operates in controlled environment',
  contextType: 'assumption',    // assumption | constraint | justification | definition
  importance: 'high',           // critical | high | medium | low
  relatedNodesCount: 2,
  tooltipContent: 'Extended details about this assumption...',
  validity: 'Valid for current deployment',
  scope: 'Urban areas only',
  implications: [
    'Highway operation requires validation',
    'Rural roads have different requirements'
  ],
  metadata: {
    validFrom: '2025-01-01',
    reviewDate: '2025-12-31'
  }
}
```

**Variants**:
- `CompactContextNode`: Even smaller version (150-250px)
- `AssumptionContextNode`: Pre-configured as assumption
- `ConstraintContextNode`: Pre-configured as constraint
- `JustificationContextNode`: Pre-configured as justification
- `CriticalContextNode`: Pre-configured with critical importance

---

## Usage

### Basic Usage

```jsx
import { nodeTypes } from '@/components/curriculum/enhanced/nodes/nodeTypes';
import ReactFlow from 'reactflow';

const MyComponent = () => {
  const nodes = [
    {
      id: 'goal-1',
      type: 'goal',
      position: { x: 100, y: 100 },
      data: {
        name: 'System Safety',
        importance: 'critical',
        progress: 75
      }
    }
  ];

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
    />
  );
};
```

### Direct Component Usage

```jsx
import { GoalNode } from '@/components/curriculum/enhanced/nodes';

const MyGoal = () => {
  return (
    <GoalNode
      id="goal-1"
      data={{
        name: 'System Safety',
        importance: 'critical',
        progress: 75
      }}
      selected={false}
    />
  );
};
```

### Using Helper Functions

```jsx
import { createNode, createNodeData } from '@/components/curriculum/enhanced/nodes/nodeTypes';

// Create node with defaults
const node = createNode('goal-1', 'goal', { x: 100, y: 100 }, {
  name: 'Custom Goal',
  importance: 'high'
});

// Create just the data
const data = createNodeData('evidence', {
  evidenceType: 'test',
  confidence: 90
});
```

---

## Styling and Theming

All node types use the centralized theme configuration from `utils/themeConfig.js`:

### Color Schemes

Each node type has a dedicated color scheme:

- **Goal**: Green/Emerald (`#10b981`)
- **Strategy**: Purple/Violet (`#a855f7`)
- **PropertyClaim**: Orange/Amber (`#f97316`)
- **Evidence**: Cyan/Turquoise (`#06b6d4`)
- **Context**: Gray (`#6b7280`)

### Glassmorphism Effects

All nodes feature:
- Semi-transparent backgrounds (`rgba(0, 0, 0, 0.6)`)
- Backdrop blur (`blur(40px)`)
- Subtle borders with opacity
- Multi-layered shadows
- Smooth transitions

### Animations

- **Entrance**: Scale and fade-in animation
- **Hover**: Subtle scale increase (1.02)
- **Selected**: Scale increase with ring glow
- **Expand/Collapse**: Smooth height transition
- **Special**: Type-specific animations (pulse, shimmer, etc.)

---

## Accessibility

All node types include:

- **ARIA labels**: Descriptive labels for screen readers
- **Keyboard navigation**: Tab, Enter, Space key support
- **Focus indicators**: Visible focus states
- **Color contrast**: WCAG AA compliant
- **Reduced motion**: Respects `prefers-reduced-motion`

---

## Performance Considerations

- **Memoization**: Components use React.memo for optimal re-rendering
- **Lazy content**: Extended content only rendered when expanded
- **Efficient animations**: GPU-accelerated transforms
- **Conditional rendering**: Features only shown when data available

---

## Best Practices

1. **Data Completeness**: Provide as much data as possible for rich displays
2. **Consistent IDs**: Use meaningful, unique IDs
3. **Type Matching**: Ensure node `type` matches data structure
4. **State Management**: Use NodeStateManager for coordinated behavior
5. **Edge Configuration**: Use appropriate edge styles per type
6. **Testing**: Test with various data combinations

---

## Examples

See `demos/AllNodeTypesDemo.jsx` for a comprehensive example showing all node types together with realistic data and interactions.

---

## API Reference

### Common Props

All node types accept these props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | string | required | Unique node identifier |
| `data` | object | required | Node data object |
| `selected` | boolean | false | Whether node is selected |
| `isConnectable` | boolean | true | Whether node can form connections |
| `className` | string | '' | Additional CSS classes |

### Node Type Mapping

The `nodeTypes` object maps type strings to components:

```javascript
{
  goal: GoalNode,
  strategy: StrategyNode,
  propertyClaim: PropertyClaimNode,
  evidence: EvidenceNode,
  context: ContextNode
}
```

### Helper Functions

- `getNodeComponent(nodeType)`: Get component for a type
- `getAvailableNodeTypes()`: Get all valid type strings
- `isValidNodeType(nodeType)`: Check if type is valid
- `createNodeData(nodeType, customData)`: Create data with defaults
- `createNode(id, nodeType, position, customData)`: Create complete node
- `getNodeTypeMetadata(nodeType)`: Get metadata for a type
- `getNodeTypesByCategory()`: Get types grouped by category

---

## Contributing

When adding new features to node types:

1. Update the component file
2. Update this README
3. Add examples to the demo
4. Update TypeScript types (if applicable)
5. Test accessibility
6. Test performance with large graphs

---

## Related Documentation

- [REACT_FLOW.md](../../REACT_FLOW.md) - Overall React Flow implementation guide
- [themeConfig.js](../utils/themeConfig.js) - Theme configuration
- [BaseNode.jsx](./BaseNode.jsx) - Base node component
- [CollapsibleNode.jsx](./CollapsibleNode.jsx) - Collapsible behavior
- [NodeStateManager.jsx](./NodeStateManager.jsx) - State management

---

## License

Part of the TEA (Trustworthy and Ethical Assurance) platform.
