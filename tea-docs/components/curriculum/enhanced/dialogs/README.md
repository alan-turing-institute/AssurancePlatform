# Add Block Dialog System

A sophisticated node creation dialog system for React Flow enhanced components, inspired by FloraFauna.ai's modern interface design.

## Overview

The Add Block Dialog provides a comprehensive solution for creating nodes in assurance case diagrams with:
- Full-screen modal with glassmorphism design
- Two-panel layout (selection + preview)
- Template library for common patterns
- Dynamic forms based on node type
- Live preview with connection hints
- Keyboard shortcuts
- Auto-save drafts

## Components

### 1. AddBlockDialog

Main dialog component with all features.

**Features:**
- Two-panel layout: selection on left, preview on right
- Search/filter functionality for node types
- Category tabs (Goals, Strategies, Claims, Evidence, Context)
- Template library
- Recent blocks section
- Keyboard navigation and shortcuts
- Smooth animations (fade in/out)
- Quick mode toggle
- Bulk creation mode (optional)

**Props:**
```typescript
interface AddBlockDialogProps {
  open: boolean;                          // Dialog open state
  onClose: () => void;                    // Close handler
  onAdd: (nodeData) => void;              // Add single node handler
  onBulkAdd?: (nodes[]) => void;          // Bulk add handler (optional)
  position?: { x: number, y: number };    // Creation position
  currentNodes?: Node[];                  // Existing nodes for hints
  suggestedConnections?: Connection[];    // Suggested connections
  defaultNodeType?: string;               // Default selected type
  enableTemplates?: boolean;              // Enable templates (default: true)
  enableQuickMode?: boolean;              // Enable quick mode (default: true)
  enableBulkMode?: boolean;               // Enable bulk creation (default: false)
  showConnectionHints?: boolean;          // Show connection hints (default: true)
  className?: string;                     // Additional CSS classes
}
```

**Usage:**
```jsx
import { AddBlockDialog } from '@/components/curriculum/enhanced/dialogs';

function MyComponent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clickPosition, setClickPosition] = useState(null);

  const handleAddBlock = (blockData) => {
    if (blockData.type === 'template') {
      // Handle template creation
      const newNodes = createNodesFromTemplate(blockData.template, blockData.position);
      addNodes(newNodes);
    } else {
      // Handle single node creation
      addNode(blockData);
    }
  };

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        Add Block
      </Button>

      <AddBlockDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAddBlock}
        position={clickPosition}
        currentNodes={nodes}
        enableTemplates={true}
        showConnectionHints={true}
      />
    </>
  );
}
```

### 2. CompactAddBlockDialog

Minimal version for quick node creation.

**Features:**
- Smaller size (60vh vs 85vh)
- Quick mode enabled by default
- No templates
- Fast workflow

**Props:**
```typescript
interface CompactAddBlockDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (nodeData) => void;
  position?: { x: number, y: number };
}
```

**Usage:**
```jsx
<CompactAddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddBlock}
  position={clickPosition}
/>
```

### 3. BlockForm

Dynamic form component that adapts based on node type.

**Features:**
- Common fields: Name, Description
- Type-specific fields for each node type
- Form validation with error display
- Character counters
- Auto-save draft support
- Quick mode (minimal fields)

**Node Type Fields:**

**Goal:**
- Name* (text, max 100)
- Description* (textarea, max 500)
- Priority (select: critical/high/medium/low)
- Target Date (date picker)
- Success Criteria (textarea, max 300)

**Strategy:**
- Name* (text, max 100)
- Description* (textarea, max 500)
- Strategy Type (select: AND/OR)
- Approach (text)
- Rationale (textarea, max 300)

**Property Claim:**
- Name* (text, max 100)
- Description* (textarea, max 500)
- Claim Text (textarea, max 400)
- Strength (slider, 0-100)
- Verification Method (select: testing/analysis/inspection/demonstration/review)

**Evidence:**
- Name* (text, max 100)
- Description* (textarea, max 500)
- Evidence Source (text)
- Confidence Level (slider, 0-100)
- Link/URL (url input)
- Tags (tag input)

**Context:**
- Name* (text, max 100)
- Description* (textarea, max 500)
- Context Type (select: assumption/justification/constraint/definition/scope)
- Importance (select: critical/high/medium/low)
- Validity Period (text)

**Usage:**
```jsx
import { BlockForm } from '@/components/curriculum/enhanced/dialogs';

const [formData, setFormData] = useState({});

<BlockForm
  nodeType="goal"
  formData={formData}
  onChange={setFormData}
  quickMode={false}
  validationErrors={{}}
/>
```

### 4. BlockPreview

Live preview component showing the node as it will appear.

**Features:**
- Live preview of node component
- Connection point indicators
- Zoom controls (in/out/reset)
- Style variations preview
- Template preview (multiple nodes)
- Connection hints display
- Info panel with metadata

**Usage:**
```jsx
import { BlockPreview } from '@/components/curriculum/enhanced/dialogs';

<BlockPreview
  nodeType="goal"
  formData={formData}
  connectionHints={hints}
  showConnectionHints={true}
  showZoomControls={true}
/>
```

### 5. BlockTemplates

Pre-configured node templates for common patterns.

**Features:**
- Template categories: Basic, Advanced, Custom
- Visual preview of each template
- Template metadata (name, description, usage stats)
- Favorite templates
- Import/export templates
- Usage statistics
- Category filtering

**Built-in Templates:**

**Basic:**
- Simple Goal (Goal + Strategy)
- Evidence Chain (Claim + Evidence)
- Context Pattern (Goal + Context)

**Advanced:**
- Hierarchical Decomposition (3-level goal breakdown)
- Claim-Evidence Set (Claim + multiple Evidence)
- Contextualized Argument (Complete argument chain)

**Usage:**
```jsx
import { BlockTemplates } from '@/components/curriculum/enhanced/dialogs';

<BlockTemplates
  selectedTemplate={selectedTemplate}
  onSelectTemplate={handleSelectTemplate}
  enableImportExport={true}
/>
```

## Utilities

### dialogUtils.js

Helper functions for dialog functionality.

**Draft Management:**
```javascript
import { saveDraft, loadDraft, clearDraft, hasDraft } from '@/components/curriculum/enhanced/dialogs';

// Auto-save draft
saveDraft({ nodeType: 'goal', formData: { name: 'My Goal', ... } });

// Load draft on dialog open
const draft = loadDraft();
if (draft) {
  setFormData(draft.formData);
}

// Clear draft on successful creation
clearDraft();

// Check if draft exists
if (hasDraft()) {
  // Offer to restore draft
}
```

**Mode Management:**
```javascript
import { setDialogMode, getDialogMode } from '@/components/curriculum/enhanced/dialogs';

// Save user's preferred mode
setDialogMode('quick');

// Load saved mode
const mode = getDialogMode(); // 'standard' or 'quick'
```

**Validation:**
```javascript
import { validateBlockForm } from '@/components/curriculum/enhanced/dialogs';

const { isValid, errors } = validateBlockForm(nodeType, formData, quickMode);

if (!isValid) {
  setValidationErrors(errors);
}
```

**Preferences:**
```javascript
import { saveDialogPreferences, loadDialogPreferences } from '@/components/curriculum/enhanced/dialogs';

// Load preferences
const prefs = loadDialogPreferences();
// Returns: { showConnectionHints, autoSaveDrafts, defaultQuickMode, ... }

// Save preferences
saveDialogPreferences({
  showConnectionHints: true,
  autoSaveDrafts: true,
  defaultQuickMode: false,
});
```

## Integration Patterns

### 1. Double-Click Creation

FloraFauna.ai style - double-click canvas to create node:

```jsx
import { AddBlockDialog } from '@/components/curriculum/enhanced/dialogs';

const [dialogOpen, setDialogOpen] = useState(false);
const [clickPosition, setClickPosition] = useState(null);

const handlePaneDoubleClick = useCallback((event) => {
  const rect = event.target.getBoundingClientRect();
  const position = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  setClickPosition(position);
  setDialogOpen(true);
}, []);

<ReactFlow
  onPaneDoubleClick={handlePaneDoubleClick}
  // ... other props
>
  {/* ... */}
</ReactFlow>

<AddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddNode}
  position={clickPosition}
  currentNodes={nodes}
/>
```

### 2. Button Trigger

Traditional approach with toolbar button:

```jsx
<Button onClick={() => setDialogOpen(true)}>
  <Plus className="w-4 h-4 mr-2" />
  Add Block
</Button>

<AddBlockDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  onAdd={handleAddNode}
  position={{ x: 100, y: 100 }} // Default position
/>
```

### 3. Context Menu Integration

Right-click to create node:

```jsx
const handleContextMenu = useCallback((event) => {
  event.preventDefault();
  const rect = event.target.getBoundingClientRect();
  const position = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  setClickPosition(position);
  setDialogOpen(true);
}, []);

<ReactFlow
  onPaneContextMenu={handleContextMenu}
  // ... other props
/>
```

### 4. Keyboard Shortcut

Global shortcut to open dialog:

```jsx
useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === 'n' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      setDialogOpen(true);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Keyboard Shortcuts

When dialog is open:

| Shortcut | Action |
|----------|--------|
| `G` | Select Goal type |
| `S` | Select Strategy type |
| `C` | Select Property Claim type |
| `E` | Select Evidence type |
| `X` | Select Context type |
| `Ctrl/Cmd + T` | Switch to Templates tab |
| `Enter` | Add block (when not in input) |
| `Escape` | Close dialog |
| `↑/↓` | Navigate node types |

## Styling & Theming

The dialog uses glassmorphism design with dark theme:

**Colors:**
- Background: `bg-background-transparent-black-secondaryAlt`
- Border: `border-transparent`
- Text: `text-text-light`
- Backdrop: `f-effect-backdrop-blur-lg`

**Customization:**
```jsx
<AddBlockDialog
  className="custom-dialog-styles"
  // ... other props
/>
```

## Performance Considerations

**Optimizations:**
- Lazy load templates
- Debounce search input
- Virtual scroll for large lists
- Memoize preview renders
- Optimize form re-renders

**Bundle Size:**
- Dialog components: ~15-20kb (gzipped)
- Dependencies (shadcn/ui): ~50-80kb (gzipped)
- Total estimated: ~70-100kb

## Browser Compatibility

**Minimum versions:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features:**
- Backdrop filter support
- CSS Grid/Flexbox
- ES6+ JavaScript
- LocalStorage API

## Examples

See `AddBlockDialogDemo.jsx` for comprehensive examples including:
- Standard dialog usage
- Compact dialog usage
- Double-click integration
- Keyboard shortcuts
- Template selection
- Connection hints
- Draft restoration

## API Reference

Full TypeScript definitions available in component files.

## Contributing

When adding new features:
1. Update this README
2. Add examples to demo component
3. Write tests for new functionality
4. Update TypeScript definitions

## License

MIT
