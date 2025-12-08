# Enhanced Edges Documentation

Comprehensive guide for using the enhanced edge components in React Flow. These custom edges provide rich visual feedback, animations, and interactions for modern graph visualizations.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Edge Types](#edge-types)
5. [Usage Examples](#usage-examples)
6. [API Reference](#api-reference)
7. [Customization](#customization)
8. [Performance Tips](#performance-tips)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This module provides five main edge component families, each with multiple variants:

- **AnimatedEdge** - Smooth animations with hover effects and ripples
- **GradientEdge** - Dynamic gradients with color interpolation
- **GlowingEdge** - Neon effects with blur filters and pulse animations
- **FlowingEdge** - Particle animations showing data flow
- **SmartEdge** - Intelligent path calculation with metadata display

### Key Features

- 40+ edge variants ready to use
- Smooth Framer Motion animations
- State-based styling (active, error, success, warning)
- Interactive hover and click effects
- Customizable appearance and behavior
- Performance optimized
- TypeScript-ready

---

## Installation

The enhanced edges are already included in the enhanced components module. No additional installation required.

```bash
# Already available in the project
```

### Dependencies

Required dependencies (already installed):
- `reactflow` - React Flow library
- `framer-motion` - Animation library
- `lucide-react` - Icons

---

## Quick Start

### Basic Usage

```jsx
import React from 'react';
import ReactFlow from 'reactflow';
import { edgeTypes } from './components/curriculum/enhanced/edges';
import 'reactflow/dist/style.css';

function MyFlow() {
  const nodes = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: '2', position: { x: 300, y: 0 }, data: { label: 'Node 2' } },
  ];

  const edges = [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      type: 'animated', // Use custom edge type
      data: {
        label: 'Connection',
        animated: true,
      },
    },
  ];

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      edgeTypes={edgeTypes}
      fitView
    />
  );
}
```

### Using Presets

```jsx
import { edgeStylePresets, applyEdgePreset } from './components/curriculum/enhanced/edges';

// Create edge with preset
const edge = {
  id: 'e1-2',
  source: '1',
  target: '2',
  data: { label: 'Data Flow' },
};

const styledEdge = applyEdgePreset(edge, 'dataFlow');
```

---

## Edge Types

### 1. AnimatedEdge Family

Smooth animated edges with various effects.

#### Variants

- `animated` - Basic animated edge with dash array
- `fastAnimated` - Rapid animation
- `slowAnimated` - Gentle animation
- `pulseAnimated` - Pulsing thickness
- `glowAnimated` - Animated glow effect
- `thicknessAnimated` - Thickness pulse

#### Example

```jsx
{
  id: 'e1',
  source: 'node1',
  target: 'node2',
  type: 'animated',
  data: {
    label: 'Animated Connection',
    animated: true,
    animationSpeed: 1,
    strokeWidth: 2,
    color: '#3b82f6',
  }
}
```

### 2. GradientEdge Family

Dynamic gradient edges with color interpolation.

#### Variants

- `gradient` - Standard gradient
- `rainbowGradient` - Multi-color gradient
- `pulsingGradient` - Pulsing opacity
- `radialGradient` - Radial gradient effect
- `shimmerGradient` - Shimmer animation
- `temperatureGradient` - Cold to hot colors

#### Example

```jsx
{
  id: 'e2',
  source: 'node1',
  target: 'node2',
  type: 'gradient',
  data: {
    label: 'Data Transfer',
    sourceColor: '#3b82f6',
    targetColor: '#8b5cf6',
    gradientStops: 3,
    animateGradient: true,
    opacity: 0.8,
  }
}
```

### 3. GlowingEdge Family

Neon-style edges with glow effects.

#### Variants

- `glowing` - Standard glow
- `neon` - Bright neon effect
- `softGlow` - Subtle glow
- `intenseGlow` - Strong glow
- `activeDataFlow` - Active with particles
- `errorGlow` - Red error state
- `successGlow` - Green success state
- `warningGlow` - Amber warning state
- `breathingGlow` - Breathing animation

#### Example

```jsx
{
  id: 'e3',
  source: 'node1',
  target: 'node2',
  type: 'neon',
  data: {
    label: 'Active Connection',
    color: '#10b981',
    glowIntensity: 1.5,
    pulse: true,
    neon: true,
  }
}
```

### 4. FlowingEdge Family

Particle animations showing directional flow.

#### Variants

- `flowing` - Standard flow
- `fastFlow` - Rapid particles
- `slowFlow` - Gentle flow
- `heavyTraffic` - Many particles
- `lightTraffic` - Few particles
- `bidirectionalFlow` - Both directions
- `dataStream` - Continuous stream
- `pulseFlow` - Pulsing particles
- `trailFlow` - Trailing effect

#### Example

```jsx
{
  id: 'e4',
  source: 'node1',
  target: 'node2',
  type: 'flowing',
  data: {
    label: 'Data Stream',
    particleCount: 4,
    particleSize: 4,
    flowSpeed: 1,
    bidirectional: false,
    showDirectionIndicators: true,
    indicatorCount: 2,
    trafficIntensity: 0.7,
  }
}
```

### 5. SmartEdge Family

Intelligent edges with adaptive paths and metadata.

#### Variants

- `smart` - Standard smart edge
- `strongConnection` - Strong relationship
- `weakConnection` - Weak relationship
- `typedSmart` - With type indicator
- `dependency` - Dependency relationship
- `inheritance` - Inheritance relationship
- `association` - Association relationship
- `adaptivePath` - Auto-adaptive path
- `info` - Informational
- `activity` - Active connection

#### Example

```jsx
{
  id: 'e5',
  source: 'node1',
  target: 'node2',
  type: 'smart',
  data: {
    label: 'Dependency',
    strength: 0.8,
    showStrengthIndicator: true,
    showTypeIndicator: true,
    type: 'depends',
    pathType: 'auto', // 'auto', 'bezier', 'smoothstep', 'straight'
    curvature: 0.25,
    metadata: 'Additional info on hover',
  }
}
```

---

## Usage Examples

### Example 1: State-Based Styling

```jsx
const edges = [
  {
    id: 'success',
    source: '1',
    target: '2',
    type: 'successGlow',
    data: {
      label: 'Completed',
      state: 'success',
    },
  },
  {
    id: 'error',
    source: '2',
    target: '3',
    type: 'errorGlow',
    data: {
      label: 'Failed',
      state: 'error',
    },
  },
  {
    id: 'warning',
    source: '3',
    target: '4',
    type: 'warningGlow',
    data: {
      label: 'Pending',
      state: 'warning',
    },
  },
];
```

### Example 2: Data Flow Visualization

```jsx
const dataFlowEdge = {
  id: 'data-flow',
  source: 'database',
  target: 'api',
  type: 'dataStream',
  data: {
    label: 'Real-time Data',
    particleCount: 8,
    flowSpeed: 1.5,
    trafficIntensity: 0.9,
    showDirectionIndicators: true,
  },
};
```

### Example 3: Relationship Strength

```jsx
const edges = [
  {
    id: 'strong',
    source: 'parent',
    target: 'child',
    type: 'strongConnection',
    data: {
      label: 'Direct Parent',
      strength: 1.0,
    },
  },
  {
    id: 'weak',
    source: 'distant',
    target: 'relative',
    type: 'weakConnection',
    data: {
      label: 'Distant Relation',
      strength: 0.2,
    },
  },
];
```

### Example 4: Interactive Edges

```jsx
const interactiveEdge = {
  id: 'interactive',
  source: '1',
  target: '2',
  type: 'smart',
  data: {
    label: 'Click Me',
    onClick: (event, edge) => {
      console.log('Edge clicked:', edge);
    },
    onDoubleClick: (event, edge) => {
      console.log('Edge double-clicked:', edge);
    },
    onContextMenu: (event, edge) => {
      console.log('Edge right-clicked:', edge);
    },
  },
};
```

### Example 5: Gradient Customization

```jsx
const customGradient = {
  id: 'custom-gradient',
  source: '1',
  target: '2',
  type: 'gradient',
  data: {
    sourceColor: '#ff0000', // Red
    targetColor: '#0000ff', // Blue
    gradientStops: 5,
    animateGradient: true,
    opacityVariation: 0.3,
  },
};
```

---

## API Reference

### Common Edge Data Properties

All edge types support these common properties:

```typescript
interface EdgeData {
  // Display
  label?: string;
  showLabel?: boolean;

  // Styling
  color?: string;
  strokeWidth?: number;
  state?: 'default' | 'active' | 'error' | 'success' | 'warning';

  // Interaction
  onClick?: (event: Event, edge: Edge) => void;
  onDoubleClick?: (event: Event, edge: Edge) => void;
  onContextMenu?: (event: Event, edge: Edge) => void;

  // Metadata
  metadata?: string;
}
```

### AnimatedEdge Specific

```typescript
interface AnimatedEdgeData extends EdgeData {
  animated?: boolean;
  animationSpeed?: number;
  enterDuration?: number;
}
```

### GradientEdge Specific

```typescript
interface GradientEdgeData extends EdgeData {
  sourceColor?: string;
  targetColor?: string;
  gradientStops?: number;
  animateGradient?: boolean;
  opacity?: number;
  opacityVariation?: number;
}
```

### GlowingEdge Specific

```typescript
interface GlowingEdgeData extends EdgeData {
  glowIntensity?: number; // 0-2
  pulse?: boolean;
  neon?: boolean;
  flowIntensity?: number; // 0-1
}
```

### FlowingEdge Specific

```typescript
interface FlowingEdgeData extends EdgeData {
  particleCount?: number;
  particleSize?: number;
  flowSpeed?: number;
  bidirectional?: boolean;
  showDirectionIndicators?: boolean;
  indicatorCount?: number;
  trafficIntensity?: number; // 0-1
}
```

### SmartEdge Specific

```typescript
interface SmartEdgeData extends EdgeData {
  strength?: number; // 0-1
  showStrengthIndicator?: boolean;
  showTypeIndicator?: boolean;
  type?: string;
  pathType?: 'auto' | 'bezier' | 'smoothstep' | 'straight';
  curvature?: number;
  cornerRadius?: number;
  labelIcon?: React.ComponentType;
}
```

---

## Customization

### Custom Colors

```jsx
// Using hex colors
data: {
  color: '#ff6b6b',
}

// Using state colors
data: {
  state: 'error', // Uses predefined error color
}

// Gradient colors
data: {
  sourceColor: '#ff6b6b',
  targetColor: '#4ecdc4',
}
```

### Custom Animations

```jsx
// Adjust speed
data: {
  animationSpeed: 2, // 2x faster
  flowSpeed: 0.5, // Half speed
}

// Control intensity
data: {
  glowIntensity: 1.5, // 1.5x glow
  trafficIntensity: 0.8, // 80% traffic
}
```

### Custom Path Behavior

```jsx
// Smart edge path selection
data: {
  pathType: 'auto', // Automatically select best path
  curvature: 0.25, // Adjust curve strength
  cornerRadius: 10, // Smooth step corner radius
}
```

### Custom Labels

```jsx
data: {
  label: 'My Label',
  showLabel: true,
  labelIcon: Activity, // Lucide icon component
}
```

---

## Performance Tips

### 1. Limit Particle Count

For flowing edges with many connections:

```jsx
// Good for many edges
data: {
  particleCount: 2,
  flowSpeed: 1.5,
}

// Better for few edges
data: {
  particleCount: 5,
  flowSpeed: 1,
}
```

### 2. Disable Animations When Not Needed

```jsx
// Disable when performance is critical
data: {
  animated: false,
  pulse: false,
  animateGradient: false,
}
```

### 3. Use Appropriate Edge Types

```jsx
// For simple connections
type: 'animated'

// For data visualization
type: 'smart'

// For visual impact only
type: 'gradient' or 'glowing'
```

### 4. Batch Edge Updates

```jsx
// Good - single state update
setEdges(prevEdges =>
  prevEdges.map(edge => ({
    ...edge,
    data: { ...edge.data, animated: true }
  }))
);

// Avoid - multiple updates
edges.forEach(edge => updateEdge(edge));
```

---

## Troubleshooting

### Edges Not Showing

**Problem:** Edges are invisible or not rendering.

**Solutions:**
1. Ensure `edgeTypes` is passed to ReactFlow
2. Check that edge `type` matches a registered type
3. Verify source and target node IDs exist

```jsx
// Correct setup
import { edgeTypes } from './edges';

<ReactFlow
  edges={edges}
  edgeTypes={edgeTypes} // Must include this
/>
```

### Poor Performance

**Problem:** Animations are laggy or stuttering.

**Solutions:**
1. Reduce particle count in flowing edges
2. Decrease glow intensity
3. Disable animations for off-screen edges
4. Use `onlyRenderVisibleElements` in ReactFlow

```jsx
<ReactFlow
  onlyRenderVisibleElements={true}
/>
```

### Gradients Not Working

**Problem:** Gradient edges show solid colors.

**Solutions:**
1. Ensure unique edge IDs (gradients use ID in SVG defs)
2. Check browser SVG support
3. Verify color format (use hex: `#3b82f6`)

```jsx
// Correct gradient configuration
data: {
  sourceColor: '#3b82f6', // Use hex
  targetColor: '#8b5cf6',
  gradientStops: 3,
}
```

### Label Positioning Issues

**Problem:** Labels appear in wrong position or overlap.

**Solutions:**
1. Use EdgeLabelRenderer (already implemented)
2. Adjust label positioning with custom CSS
3. Ensure unique edge IDs

### TypeScript Errors

**Problem:** Type errors when using edge data.

**Solutions:**
1. Add proper type definitions
2. Use the provided interfaces
3. Cast data if necessary

```typescript
import type { Edge } from 'reactflow';

const edge: Edge = {
  id: 'e1',
  source: '1',
  target: '2',
  type: 'smart',
  data: {
    label: 'Connection',
    strength: 0.8,
  } as SmartEdgeData,
};
```

---

## Best Practices

### 1. Choose the Right Edge Type

- **Simple connections:** `animated` or `smart`
- **Data flow:** `flowing` or `dataStream`
- **Visual hierarchy:** `gradient` with different colors
- **State indication:** `errorGlow`, `successGlow`, `warningGlow`
- **Relationship strength:** `strongConnection`, `weakConnection`

### 2. Consistent Styling

```jsx
// Define edge styles in a config
const edgeConfig = {
  primary: {
    type: 'smart',
    data: { color: '#3b82f6' },
  },
  secondary: {
    type: 'gradient',
    data: { sourceColor: '#6b7280', targetColor: '#9ca3af' },
  },
};

// Apply consistently
const edge = {
  ...edgeConfig.primary,
  id: 'e1',
  source: '1',
  target: '2',
};
```

### 3. Accessibility

```jsx
// Provide meaningful labels
data: {
  label: 'Depends on', // Clear relationship
  metadata: 'Module A depends on Module B',
}

// Use sufficient contrast
data: {
  color: '#3b82f6', // Good contrast on dark background
}
```

### 4. Progressive Enhancement

```jsx
// Start with simple edges
const baseEdge = {
  type: 'animated',
  data: { label: 'Connection' },
};

// Add enhancements as needed
const enhancedEdge = {
  ...baseEdge,
  type: 'smart',
  data: {
    ...baseEdge.data,
    showStrengthIndicator: true,
    strength: 0.8,
  },
};
```

---

## Examples Repository

Check the `EdgeDemo.jsx` file for a complete interactive demonstration of all edge types.

```bash
# Run the demo
npm start
# Navigate to the edges demo page
```

---

## Support

For issues or questions:
1. Check this documentation
2. Review the component source code
3. Check REACT_FLOW.md specification
4. Refer to React Flow documentation

---

## License

Part of the TEA Curriculum project.
