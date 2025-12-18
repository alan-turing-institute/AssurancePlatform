# Add Block Dialog - Implementation Guide

This guide provides step-by-step instructions for implementing the Add Block Dialog system in your React Flow application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Component Architecture](#component-architecture)
3. [Implementation Steps](#implementation-steps)
4. [Advanced Features](#advanced-features)
5. [Customization](#customization)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Minimal Setup (5 minutes)

```jsx
import React, { useState, useCallback } from 'react';
import { ReactFlow, useNodesState, useEdgesState } from 'reactflow';
import { AddBlockDialog } from '@/components/curriculum/enhanced/dialogs';
import { nodeTypes } from '@/components/curriculum/enhanced/nodes';
import 'reactflow/dist/style.css';

function MyAssuranceCase() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddNode = useCallback((nodeData) => {
    setNodes((nds) => [...nds, nodeData]);
  }, [setNodes]);

  return (
    <>
      <button onClick={() => setDialogOpen(true)}>
        Add Block
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
      />

      <AddBlockDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddNode}
      />
    </>
  );
}
```

---

## Component Architecture

### File Structure

```
dialogs/
├── AddBlockDialog.jsx       # Main dialog component
├── BlockForm.jsx            # Dynamic form component
├── BlockPreview.jsx         # Live preview component
├── BlockTemplates.jsx       # Template library component
├── dialogUtils.js           # Helper functions
├── index.js                 # Module exports
├── AddBlockDialogDemo.jsx   # Demo/examples
└── README.md                # Documentation
```

### Component Relationships

```
AddBlockDialog
├── Left Panel
│   ├── Tabs
│   │   ├── Node Types Tab
│   │   │   ├── Search Bar
│   │   │   ├── Recent Types
│   │   │   └── Categorized Types
│   │   └── Templates Tab
│   │       └── BlockTemplates
│   └── ScrollArea
└── Right Panel
    ├── BlockForm (when node type selected)
    └── BlockPreview (always visible)
```

### Data Flow

```
User Action → Dialog Opens → Select Type/Template → Fill Form → Preview Updates → Add Node → Update Flow
```

---

## Implementation Steps

### Step 1: Install Dependencies

All required dependencies should already be installed if you're using the enhanced components:

```bash
# Already included in enhanced components:
# - @radix-ui/react-dialog
# - @radix-ui/react-tabs
# - @radix-ui/react-scroll-area
# - framer-motion
# - reactflow
# - lucide-react
```

### Step 2: Import Required Components

```jsx
import { AddBlockDialog } from '@/components/curriculum/enhanced/dialogs';
import { nodeTypes } from '@/components/curriculum/enhanced/nodes';
```

### Step 3: Set Up State

```jsx
// Dialog state
const [dialogOpen, setDialogOpen] = useState(false);
const [clickPosition, setClickPosition] = useState(null);

// React Flow state
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);
```

### Step 4: Implement Add Handler

```jsx
const handleAddNode = useCallback((nodeData) => {
  if (nodeData.type === 'template') {
    // Handle template (multiple nodes)
    const template = nodeData.template;
    const newNodes = template.nodes.map((nodeConfig, index) => {
      const position = calculatePosition(nodeData.position, nodeConfig, index);
      return createNodeFromConfig(nodeConfig, position);
    });
    setNodes((nds) => [...nds, ...newNodes]);
  } else {
    // Handle single node
    setNodes((nds) => [...nds, nodeData]);
  }
}, [setNodes]);
```

### Step 5: Add Dialog to JSX

```jsx
<AddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddNode}
  position={clickPosition}
  currentNodes={nodes}
  enableTemplates={true}
  showConnectionHints={true}
/>
```

### Step 6: Add Trigger

Choose one or more trigger methods:

**Button:**
```jsx
<Button onClick={() => setDialogOpen(true)}>
  Add Block
</Button>
```

**Double-Click:**
```jsx
const handlePaneDoubleClick = useCallback((event) => {
  const rect = event.target.getBoundingClientRect();
  setClickPosition({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
  setDialogOpen(true);
}, []);

<ReactFlow onPaneDoubleClick={handlePaneDoubleClick} />
```

**Keyboard Shortcut:**
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setDialogOpen(true);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

---

## Advanced Features

### 1. Connection Hints

Show nearby nodes that could connect to the new node:

```jsx
import { calculateConnectionHints } from '@/components/curriculum/enhanced/interactions/creationUtils';

const connectionHints = useMemo(() => {
  if (!clickPosition) return [];
  return calculateConnectionHints(clickPosition, nodes, 300);
}, [clickPosition, nodes]);

<AddBlockDialog
  connectionHints={connectionHints}
  showConnectionHints={true}
  // ... other props
/>
```

### 2. Draft Auto-Save

Automatically save user's work:

```jsx
import { hasDraft, loadDraft } from '@/components/curriculum/enhanced/dialogs';

useEffect(() => {
  if (dialogOpen && hasDraft()) {
    const draft = loadDraft();
    // Optionally prompt user to restore draft
    if (window.confirm('Restore previous draft?')) {
      // Draft is automatically loaded by the dialog
    }
  }
}, [dialogOpen]);
```

### 3. Quick Mode

Enable quick mode for faster node creation:

```jsx
<AddBlockDialog
  enableQuickMode={true}
  // Quick mode can be toggled by user in dialog
  // ... other props
/>
```

### 4. Bulk Creation

Create multiple nodes at once:

```jsx
const handleBulkAdd = useCallback((nodesList) => {
  setNodes((nds) => [...nds, ...nodesList]);
}, [setNodes]);

<AddBlockDialog
  enableBulkMode={true}
  onBulkAdd={handleBulkAdd}
  // ... other props
/>
```

### 5. Custom Templates

Add your own templates:

```jsx
// In your component or config file
const customTemplates = [
  {
    id: 'my-template',
    name: 'My Custom Template',
    description: 'A custom assurance pattern',
    category: 'Custom',
    nodes: [
      { type: 'goal', name: 'Custom Goal', offsetY: 0 },
      { type: 'strategy', name: 'Custom Strategy', offsetY: 150 },
    ],
    icon: Layers,
    usageCount: 0,
  },
];

// Templates are managed by BlockTemplates component
// You can export/import via the template library UI
```

### 6. Smart Positioning

Position nodes intelligently based on existing graph:

```jsx
import { calculateSmartPosition } from '@/components/curriculum/enhanced/interactions/creationUtils';

const handleNodeFromHandle = useCallback((sourceNode) => {
  const smartPosition = calculateSmartPosition(
    [sourceNode],
    nodes,
    'bottom' // direction
  );
  setClickPosition(smartPosition);
  setDialogOpen(true);
}, [nodes]);
```

---

## Customization

### Visual Customization

**Change Dialog Size:**
```jsx
<AddBlockDialog
  className="max-w-4xl h-[70vh]"
  // ... other props
/>
```

**Custom Color Scheme:**
```css
/* In your CSS file */
.custom-dialog-styles {
  --dialog-bg: rgba(10, 10, 10, 0.95);
  --dialog-border: rgba(255, 255, 255, 0.1);
}
```

### Functional Customization

**Disable Features:**
```jsx
<AddBlockDialog
  enableTemplates={false}      // No templates
  enableQuickMode={false}       // No quick mode
  showConnectionHints={false}   // No connection hints
  // ... other props
/>
```

**Default Node Type:**
```jsx
<AddBlockDialog
  defaultNodeType="strategy"  // Start with strategy selected
  // ... other props
/>
```

**Custom Validation:**
```jsx
import { validateBlockForm } from '@/components/curriculum/enhanced/dialogs';

// Extend validation in your handler
const handleAddNode = useCallback((nodeData) => {
  // Additional validation
  if (nodeData.data.name.includes('test')) {
    alert('Node names cannot contain "test"');
    return;
  }

  // Proceed with addition
  setNodes((nds) => [...nds, nodeData]);
}, [setNodes]);
```

---

## Troubleshooting

### Common Issues

**1. Dialog doesn't open:**
```jsx
// Check that open state is properly managed
console.log('Dialog open:', dialogOpen);

// Ensure onClose is properly handled
onClose={() => {
  console.log('Dialog closing');
  setDialogOpen(false);
}}
```

**2. Nodes not appearing after creation:**
```jsx
// Verify handleAddNode is called
const handleAddNode = useCallback((nodeData) => {
  console.log('Adding node:', nodeData);
  setNodes((nds) => {
    const newNodes = [...nds, nodeData];
    console.log('New nodes:', newNodes);
    return newNodes;
  });
}, [setNodes]);
```

**3. Position is incorrect:**
```jsx
// Ensure position is in React Flow coordinates
import { screenToFlowPosition } from '@/components/curriculum/enhanced/interactions/creationUtils';

const handlePaneDoubleClick = useCallback((event) => {
  const rect = event.target.getBoundingClientRect();
  const screenPos = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  // If using React Flow instance
  const flowPos = reactFlowInstance.screenToFlowPosition(screenPos);
  setClickPosition(flowPos);
}, [reactFlowInstance]);
```

**4. Templates not working:**
```jsx
// Ensure template handler is implemented
const handleAddNode = useCallback((nodeData) => {
  if (nodeData.type === 'template') {
    console.log('Template selected:', nodeData.template);
    // Implement template creation logic
    const newNodes = createNodesFromTemplate(nodeData.template);
    setNodes((nds) => [...nds, ...newNodes]);
  } else {
    setNodes((nds) => [...nds, nodeData]);
  }
}, [setNodes]);
```

**5. Styles not loading:**
```jsx
// Ensure React Flow CSS is imported
import 'reactflow/dist/style.css';

// Check Tailwind config includes custom tokens from REACT_FLOW.md
```

### Performance Issues

**Large node count:**
```jsx
// Use React Flow's onlyRenderVisibleElements
<ReactFlow
  onlyRenderVisibleElements={true}
  // ... other props
/>
```

**Slow preview:**
```jsx
// Use CompactAddBlockDialog for better performance
import { CompactAddBlockDialog } from '@/components/curriculum/enhanced/dialogs';
```

### Browser Compatibility

**Backdrop filter not working:**
```jsx
// Check browser support
const supportsBackdrop = CSS.supports('backdrop-filter', 'blur(40px)');
if (!supportsBackdrop) {
  // Add fallback class
  className="no-backdrop-support"
}
```

```css
/* Fallback CSS */
.no-backdrop-support {
  background: rgba(0, 0, 0, 0.95) !important;
}
```

---

## Best Practices

### 1. Always Handle Templates

Even if templates are disabled, implement the handler:

```jsx
const handleAddNode = useCallback((nodeData) => {
  if (nodeData.type === 'template') {
    handleTemplateCreation(nodeData.template, nodeData.position);
  } else {
    handleSingleNodeCreation(nodeData);
  }
}, []);
```

### 2. Provide Visual Feedback

```jsx
const [isAdding, setIsAdding] = useState(false);

const handleAddNode = useCallback(async (nodeData) => {
  setIsAdding(true);
  try {
    await addNodeToDatabase(nodeData);
    setNodes((nds) => [...nds, nodeData]);
  } finally {
    setIsAdding(false);
  }
}, [setNodes]);
```

### 3. Preserve User Data

```jsx
// Auto-save drafts
import { saveDraft } from '@/components/curriculum/enhanced/dialogs';

// Draft is automatically saved by the dialog component
// Ensure user is aware of this feature
```

### 4. Keyboard Accessibility

```jsx
// Dialog handles keyboard shortcuts internally
// Ensure no conflicts with your app shortcuts
```

### 5. Error Handling

```jsx
const handleAddNode = useCallback((nodeData) => {
  try {
    validateNodeData(nodeData);
    setNodes((nds) => [...nds, nodeData]);
  } catch (error) {
    console.error('Failed to add node:', error);
    showErrorToast('Failed to create node. Please try again.');
  }
}, [setNodes]);
```

---

## Testing

### Unit Tests

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import AddBlockDialog from './AddBlockDialog';

test('opens and closes dialog', () => {
  const onClose = jest.fn();
  const { rerender } = render(
    <AddBlockDialog open={false} onClose={onClose} onAdd={jest.fn()} />
  );

  expect(screen.queryByText('Add Block')).not.toBeInTheDocument();

  rerender(<AddBlockDialog open={true} onClose={onClose} onAdd={jest.fn()} />);

  expect(screen.getByText('Add Block')).toBeInTheDocument();
});

test('calls onAdd when node is created', async () => {
  const onAdd = jest.fn();
  render(<AddBlockDialog open={true} onClose={jest.fn()} onAdd={onAdd} />);

  // Select node type
  fireEvent.click(screen.getByText('Goal'));

  // Fill form
  fireEvent.change(screen.getByPlaceholderText('Enter node name...'), {
    target: { value: 'Test Goal' },
  });

  // Submit
  fireEvent.click(screen.getByText('Add Block'));

  expect(onAdd).toHaveBeenCalled();
});
```

### Integration Tests

```jsx
test('full workflow: open, create, close', async () => {
  const { result } = renderHook(() => useNodesState([]));
  const [nodes, setNodes] = result.current;

  const { container } = render(
    <AddBlockDialog
      open={true}
      onClose={jest.fn()}
      onAdd={(nodeData) => setNodes((nds) => [...nds, nodeData])}
    />
  );

  // ... interact with dialog

  await waitFor(() => {
    expect(nodes).toHaveLength(1);
  });
});
```

---

## Next Steps

1. **Review the Demo:** Check `AddBlockDialogDemo.jsx` for complete examples
2. **Read the API Docs:** See `README.md` for full API reference
3. **Customize:** Adapt the dialog to your specific needs
4. **Test:** Ensure proper integration with your application
5. **Deploy:** Roll out to users with proper documentation

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the demo component for examples
3. Consult the main REACT_FLOW.md specification
4. Check existing React Flow documentation

---

## Changelog

**v1.0.0** (2025-11-10)
- Initial release
- Full-featured Add Block Dialog
- Template system
- Dynamic forms
- Live preview
- Connection hints
- Auto-save drafts
- Keyboard shortcuts
