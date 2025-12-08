# Node Creation System Architecture

## Component Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Flow Canvas                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 DoubleClickHandler                       │   │
│  │  - Detects double-click events                          │   │
│  │  - Shows ripple feedback                                │   │
│  │  - Converts screen → flow coordinates                   │   │
│  └────────────┬────────────────────────────────────────────┘   │
│               │ onDoubleClick(position)                         │
│               ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 NodeTypeSelector                         │   │
│  │  - Modal dialog with type options                       │   │
│  │  - Search & filter                                       │   │
│  │  - Keyboard navigation                                   │   │
│  │  - Quick shortcuts (G, S, C, E, X)                      │   │
│  │  - Recent types & templates                             │   │
│  └────────────┬────────────────────────────────────────────┘   │
│               │ onSelectType(nodeType, position)                │
│               ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   NodeCreator                            │   │
│  │  - Generates unique node ID                             │   │
│  │  - Creates node data object                             │   │
│  │  - Manages undo/redo stack                              │   │
│  │  - Tracks creation history                              │   │
│  │  - Saves recent types                                    │   │
│  └────────────┬────────────────────────────────────────────┘   │
│               │ calls creationUtils                             │
│               ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  NodePositioner                          │   │
│  │  - Validates position                                    │   │
│  │  - Snaps to grid                                         │   │
│  │  - Avoids overlaps                                       │   │
│  │  - Magnetic alignment                                    │   │
│  │  - Shows visual guides                                   │   │
│  └────────────┬────────────────────────────────────────────┘   │
│               │ returns optimized position                      │
│               ▼                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              React Flow Instance                         │   │
│  │  setNodes([...nodes, newNode])                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
User Action → Event Handler → Validation → Creation → Visual Update
    ↓              ↓              ↓            ↓            ↓
Double-Click   Position      Validate     Generate    Add to React
  Canvas      Calculation    & Verify     Node Data   Flow State
                                              ↓
                                          Update History
                                          Save Preferences
                                          Update UI
```

## Component Dependencies

```
NodeCreationDemo (Top Level)
├── ReactFlowProvider
│   └── ReactFlow
│       ├── nodes (from useNodesState)
│       ├── edges (from useEdgesState)
│       └── nodeTypes (from enhanced/nodes)
│
├── useNodeCreator (Hook)
│   ├── createNode()
│   ├── createFromTemplate()
│   ├── undo() / redo()
│   └── creationHistory
│
├── NodeTypeSelector (Modal)
│   ├── NodeTypeOption (Component)
│   ├── TemplateOption (Component)
│   └── CompactNodeTypeSelector (Variant)
│
└── useDoubleClickHandler (Hook)
    └── handleDoubleClick()
```

## State Management

### Local Component State
```javascript
// NodeCreationDemo
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
const [creationPosition, setCreationPosition] = useState(null);

// useNodeCreator hook
const [creationHistory, setCreationHistory] = useState([]);
const [undoStack, setUndoStack] = useState([]);
const [redoStack, setRedoStack] = useState([]);
const [recentTypes, setRecentTypes] = useState([]);

// useNodePositioner hook
const [alignmentGuides, setAlignmentGuides] = useState({ h: null, v: null });
const [isSnapping, setIsSnapping] = useState(false);
```

### Persistent State (Local Storage)
```javascript
localStorage.setItem('tea_node_creation_recent_types', JSON.stringify([...]));
localStorage.setItem('tea_node_creation_preferences', JSON.stringify({
  gridSnap: true,
  autoConnect: false,
  quickCreateEnabled: true,
  defaultNodeType: 'goal'
}));
```

## Event Flow

### Double-Click Event Sequence

```
1. User double-clicks canvas
   └─> DoubleClickHandler detects click
       └─> Calculates screen coordinates
           └─> Shows ripple animation
               └─> Converts to flow coordinates
                   └─> Triggers onDoubleClick callback
                       └─> Opens NodeTypeSelector

2. User selects node type
   └─> NodeTypeSelector captures selection
       └─> Calls onSelectType callback
           └─> NodeCreator.createNode() invoked
               └─> Generates unique ID
                   └─> Creates node data
                       └─> NodePositioner optimizes position
                           └─> Validates creation
                               └─> Adds to React Flow state
                                   └─> Updates history & recent types
                                       └─> Closes selector
```

### Keyboard Shortcut Sequence

```
1. User presses 'G' key
   └─> NodeTypeSelector keyboard handler detects
       └─> Matches 'G' to Goal node type
           └─> Immediately selects Goal
               └─> [Same flow as above from step 2]
```

### Undo Sequence

```
1. User presses Ctrl+Z or clicks Undo
   └─> NodeCreator.undo() called
       └─> Pops node ID from undoStack
           └─> Finds node in React Flow state
               └─> Removes node from nodes array
                   └─> Pushes node to redoStack
                       └─> Updates React Flow state
```

## Utility Function Call Graph

```
createNode(type, position, customData)
├── validateNodeCreation(type, position, nodes)
├── snapToGrid(position, gridSize) [if enabled]
├── findNonOverlappingPosition(position, nodes)
│   ├── checkPositionOverlap(position, nodes)
│   └── calculateDistance(point1, point2) [spiral algorithm]
├── generateNodeId(type)
├── createNodeData(type, customData)
└── saveRecentTypes(recentTypes)

createFromTemplate(template, basePosition)
├── createNode() [for each template node]
└── reactFlowInstance.setEdges() [connect template nodes]

calculateSmartPosition(sourceNodes, allNodes, direction)
├── calculateDistance() [find nearest nodes]
└── findNonOverlappingPosition()
```

## Visual Feedback System

```
User Interaction → Visual Feedback Component → Animation
        ↓                    ↓                       ↓
   Double-Click        Ripple Effect          scale: 0→2
                                              opacity: 1→0
        ↓                    ↓                       ↓
   Hover Node         Highlight Effect        scale: 1→1.05
                                              color transition
        ↓                    ↓                       ↓
   Near Alignment     Alignment Guide         fade in/out
                                              line rendered
        ↓                    ↓                       ↓
   Snap to Grid      Magnetic Indicator      pulse animation
                                              magnet icon
```

## Integration Points

### With React Flow
```javascript
// React Flow provides:
- useReactFlow() → instance for coordinate conversion
- useNodes() → current nodes for overlap detection
- setNodes() → add created nodes to state
- onPaneDoubleClick → hook for double-click detection

// We provide:
- nodeTypes → custom node components
- node objects → { id, type, position, data }
```

### With Enhanced Nodes System
```javascript
// Uses from nodes module:
- nodeTypeMetadata → type information, icons, colors
- createNodeData() → default data for each type
- getNodeTypeConfig() → configuration for handles

// Provides to nodes:
- Created node instances with proper structure
- Populated data fields
- Valid positions
```

### With Theme System
```javascript
// Uses from utils/themeConfig:
- Color schemes for each node type
- Animation timings
- Glassmorphism presets

// Applies to:
- Type selector styling
- Visual feedback colors
- Hover effects
```

## Performance Characteristics

### Time Complexity
```
generateNodeId()              → O(1)
snapToGrid()                  → O(1)
checkPositionOverlap()        → O(n) where n = number of nodes
findNonOverlappingPosition()  → O(n * m) where m = max attempts (20)
calculateSmartPosition()      → O(n)
validateNodeCreation()        → O(1)
```

### Space Complexity
```
creationHistory              → O(h) where h = history size (max 50)
undoStack / redoStack       → O(h)
recentTypes                 → O(5) fixed size
alignmentGuides             → O(1)
```

### Optimizations Applied
1. **Debouncing**: Click events debounced to 300ms
2. **Memoization**: Position calculations cached
3. **Early Exit**: Overlap check stops at first found
4. **Spiral Algorithm**: Efficient space search pattern
5. **Lazy Rendering**: Type selector only mounts when open
6. **Local Storage**: Persistent data cached client-side

## Error Handling

```
User Action → Validation → Error Handling → User Feedback
     ↓            ↓              ↓                ↓
  Invalid     Validate       Catch Error     Show Message
   Input      & Check        → Return         Toast/Alert
                                 ↓
                            Log Error
                            Fallback State
                            Prevent Creation
```

### Error Types Handled
```javascript
1. Invalid Node Type
   → validateNodeCreation() returns { valid: false, error: 'message' }

2. Invalid Position
   → Out of bounds check, return error

3. Maximum History Reached
   → Shift oldest item, continue

4. Local Storage Full
   → Catch exception, continue without persistence

5. React Flow Instance Unavailable
   → Fall back to screen coordinates
```

## Testing Strategy

### Unit Tests
```
✓ Component rendering
✓ Event handlers
✓ Utility functions
✓ State management
✓ Local storage operations
```

### Integration Tests
```
✓ Complete creation workflow
✓ Undo/redo functionality
✓ Keyboard shortcuts
✓ Position calculations
✓ Visual feedback
```

### E2E Tests
```
✓ Double-click → create workflow
✓ Template creation
✓ Batch operations
✓ Browser compatibility
```

## Monitoring & Debugging

### Debug Points
```javascript
// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Node created:', node);
  console.log('Position calculated:', position);
  console.log('History updated:', creationHistory);
}
```

### Performance Monitoring
```javascript
// Track creation time
const startTime = performance.now();
createNode(...);
const endTime = performance.now();
console.log(`Creation took ${endTime - startTime}ms`);
```

## Security Considerations

1. **Input Validation**: All inputs validated before processing
2. **XSS Prevention**: React escapes all user input
3. **Local Storage**: Only non-sensitive data stored
4. **Type Safety**: TypeScript interfaces enforce structure
5. **Boundary Checks**: Position bounds validated

## Browser Support

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

**Required Features:**
- ES6+ (arrow functions, destructuring, etc.)
- Local Storage API
- CSS backdrop-filter (with fallbacks)
- Framer Motion animations

## Deployment Checklist

- [ ] All components exported from index.js
- [ ] Dependencies listed in package.json
- [ ] Documentation complete
- [ ] Tests passing
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Browser compatibility verified
- [ ] Error handling tested
- [ ] Local storage migration handled
- [ ] Demo components functional

## Maintenance Guide

### Adding New Node Types
1. Add to `nodeTypeMetadata` in nodes/nodeTypes.js
2. Create node component extending BaseNode
3. Update type selector shortcuts if needed
4. Add to color scheme in themeConfig.js

### Modifying Positioning Algorithm
1. Update functions in creationUtils.js
2. Adjust `findNonOverlappingPosition` parameters
3. Test with various node counts
4. Update performance benchmarks

### Extending Templates
1. Add to `getNodeTemplates()` in creationUtils.js
2. Define node configurations with offsets
3. Test template creation
4. Update documentation

## Version History

- v1.0.0 (2025-11-10) - Initial implementation
  - Double-click detection
  - Type selector with search
  - Smart positioning
  - Undo/redo support
  - Template system

---

*Architecture Documentation*
*Last Updated: 2025-11-10*
