# React Flow Enhancement Specification: FloraFauna.ai-Inspired UI

**Document Version:** 1.0
**Date:** 2025-11-08
**Target Component:** `tea_frontend/tea-docs/components/curriculum/CaseViewerWrapper.js`
**Status:** Specification for Implementation

---

## Executive Summary

This specification documents the findings from analysing [florafauna.ai](https://app.florafauna.ai)'s React Flow implementation and provides a detailed guide for enhancing the TEA Docusaurus curriculum viewer to match their modern, interactive interface.

**Key Goals:**
1. Implement collapsible/expandable node states for better information density
2. Adopt a dark theme with glassmorphism aesthetic
3. Add styled connection handles as decorative + buttons
4. Implement interactive features (context menus, node creation)
5. Migrate to shadcn/ui component primitives
6. Maintain backward compatibility with existing assurance case data

---

## 1. Current State Analysis

### 1.1 Current Implementation

**File Structure:**
- `CaseViewerWrapper.js` - Wrapper that loads JSON data
- `InteractiveCaseViewer.js` - Main React Flow component

**Current Features:**
- ✅ Progressive disclosure (reveal connected nodes on click)
- ✅ Multiple node types (Goal, Strategy, PropertyClaim, Evidence, Context)
- ✅ Framer Motion animations
- ✅ Lucide React icons
- ✅ Dark mode support
- ✅ Interactive tooltip modal
- ✅ Minimap, Controls, Background grid

**Current Limitations:**
- ❌ Nodes always fully expanded (poor information density)
- ❌ Light theme aesthetic (not modern)
- ❌ Standard React Flow handles (not styled)
- ❌ Read-only (no node creation/editing)
- ❌ No context menus
- ❌ No glassmorphism effects
- ❌ No shadcn/ui components
- ❌ Limited interaction model

### 1.2 Technologies Used

**Current Stack:**
- React Flow v11+
- Framer Motion
- Lucide React icons
- Tailwind CSS
- Custom node components

---

## 2. FloraFauna.ai Feature Analysis

### 2.1 Confirmed Technology Stack

Based on DOM analysis and interaction testing:

**Core Libraries:**
- **React Flow** - Graph visualization (CONFIRMED)
  - Classes: `react-flow`, `react-flow__renderer`, `react-flow__pane`, `react-flow__viewport`
  - Standard handles: `react-flow__handle-left`, `react-flow__handle-right`
  - Custom handle class: `newFancyHandle`

- **shadcn/ui (Radix UI-based)** - UI Components (HIGHLY LIKELY)
  - Menu: `data-radix-menu-content`, `role="menu"`
  - Dialog/Modal: Modal pattern for "Add Block"
  - Separator: `role="separator"`
  - Radix primitives evident throughout

- **Tailwind CSS** - Styling
  - Utility classes: `relative`, `h-full`, `w-full`, `cursor-pointer`
  - Custom design tokens

- **Lucide React** - Icons
  - Confirmed SVG structure matches Lucide
  - Circle icons for + decorators

**Custom Design System:**
```css
/* Custom CSS Classes Found */
.border-3d                              /* 3D border effect */
.f-effect-backdrop-blur-lg             /* Backdrop blur effect */
.f-effect-shadow-md                    /* Custom shadow */
.bg-background-transparent-black       /* Semi-transparent background */
.bg-background-opaque-white           /* Opaque white background */
.text-text-light                       /* Light text color */
.text-icon-light-secondary            /* Secondary icon color */
.spring-medium                         /* Spring animation */
```

### 2.2 Key UI Features

#### 2.2.1 Node Behavior

**Expandable/Collapsible States:**

*Collapsed State:*
```
┌─────────────────────────┐
│ Text          GPT-5     │ ← Header with type and model
│                         │
│ This is my parent node  │ ← Content preview
└─────────────────────────┘
```

*Expanded State:*
```
┌─────────────────────────────────┐
│ Text                    GPT-5   │ ← Header
│                                 │
│ [Learn about Text Blocks]       │ ← Help button
│                                 │
│ Try to...                       │ ← Suggested actions
│ • Write or paste text           │
│ • Combine ideas                 │
│ • Elaborate                     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Type anything...            │ │ ← Text input
│ └─────────────────────────────┘ │
│                                 │
│                          [1×]   │ ← Counter
└─────────────────────────────────┘
```

**State Transitions:**
- Click node → Expand with suggested actions
- Click elsewhere → Collapse to preview
- Focus text input → Remain expanded
- Submit content → Collapse and show content

#### 2.2.2 Connection Handles (+ Decorators)

**Visual Structure:**
```
    [Parent Node]
         ⊕  ← Right handle (+ decorator)
```

**Implementation Details:**
- **Position**: Left and right sides of node, vertically centered
- **Appearance**: Circular button with + icon inside
- **Styling**:
  - Semi-transparent background
  - White/light border
  - Hover effect: slight scale/brightness increase
  - Visual decorator has `pointer-events-none`
  - Clickable area underneath
- **React Flow Handle Classes**:
  ```html
  <div class="react-flow__handle react-flow__handle-right
              nodrag nopan newFancyHandle absolute z-0
              flex h-24 -translate-y-1/2 transform items-center
              bg-transparent group/handle duration-300
              group-hover:opacity-100 -right-[32px]
              left-auto translate-x-8 opacity-100
              source connectable connectablestart
              connectableend connectionindicator"
       data-nodeid="..."
       data-handlepos="right">
    <div class="pointer-events-none rounded-full p-5
                will-change-transform spring-medium visible">
      <svg><!-- Lucide circle-plus icon --></svg>
    </div>
  </div>
  ```

**Behavior:**
- Clicking handle enters "connection mode"
- Click canvas creates new node and edge
- OR drag to existing node to create edge

#### 2.2.3 Node Creation Workflow

**Method 1: Double-Click Canvas**
1. User double-clicks empty canvas area
2. Modal dialog appears with block type options
3. Dialog shows: Text, Image, Video, Upload
4. Each option has icon, title, description, keyboard shortcut
5. User selects type → New node created at click position

**Method 2: Sidebar + Button**
1. User clicks + button in left sidebar
2. Same modal dialog appears
3. New node created at default/center position

**Modal Dialog Structure:**
```
┌─────────────────────────────────────┐
│ Add Block                           │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ 📝 Text               [T]   │   │ ← Selected
│ │ Generate and edit text      │   │
│ └─────────────────────────────┘   │
│                                     │
│ ┌─────────────────────────────┐   │
│ │ 🖼️  Image              [I]   │   │
│ │ Generate, edit, upload...   │   │
│ └─────────────────────────────┘   │
│                                     │
│ ─────────────────────────────────  │
│                                     │
│ [?] Learn about Blocks             │
└─────────────────────────────────────┘
```

#### 2.2.4 Context Menu

**Trigger:** Right-click on node or canvas

**Menu Structure (Limited):**
```
┌─────────────────────┐
│ New Block    Space  │ ← Create new node
├─────────────────────┤
│ Paste        ⌘V     │ ← Disabled if no clipboard
└─────────────────────┘
```

**Observations:**
- NO delete option (interesting design choice)
- Minimal options (focused UX)
- Shows keyboard shortcuts
- Glassmorphism styling
- Uses Radix UI Menu primitive

**Note:** Delete functionality likely via:
- Keyboard shortcut (Delete/Backspace when node selected)
- Toolbar button
- Other mechanism (not discovered in testing)

#### 2.2.5 Design System & Aesthetics

**Color Scheme (Dark Theme):**
- Background: `#0a0a0a` to `#1a1a1a` (very dark grey/black)
- Node background: Semi-transparent black with backdrop blur
- Text: Light grey to white
- Accents: Subtle colors for different node types

**Glassmorphism Effects:**
- Backdrop blur: `backdrop-filter: blur(40px)`
- Semi-transparent backgrounds: `rgba(0, 0, 0, 0.6)` to `rgba(0, 0, 0, 0.8)`
- Border: Subtle 1px with slight glow
- Shadow: Multi-layered soft shadows

**Node Styling:**
```css
.node-container {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.08);
}
```

**Typography:**
- Font family: Custom (appears to be Inter or similar)
- Font weights: 400 (normal), 500 (medium), 600 (semibold)
- Font sizes: 12px (xs), 14px (sm), 16px (base), 18px (lg)

**Animations:**
- Transition duration: 300ms (standard)
- Spring animations for decorators (`spring-medium` class)
- Fade in/out for modals and tooltips
- Scale transitions on hover

---

## 3. Recommended Implementation Approach

### 3.1 Phase 1: Foundation (Week 1)

**Goal:** Set up the infrastructure and dependencies

**Tasks:**
1. Install shadcn/ui and Radix UI dependencies
2. Set up custom design tokens for dark theme
3. Configure Tailwind with glassmorphism utilities
4. Update React Flow configuration

**Deliverables:**
- `components/ui/` folder with shadcn components
- Updated `tailwind.config.js` with custom tokens
- Dark theme enabled by default

### 3.2 Phase 2: Node Enhancement (Week 2)

**Goal:** Implement collapsible nodes with new styling

**Tasks:**
1. Create collapsible node component
2. Implement expand/collapse state management
3. Add glassmorphism styling
4. Update all node types (Goal, Strategy, etc.)

**Deliverables:**
- New `CollapsibleNode.js` base component
- Updated node type components
- Collapsed preview state for all nodes

### 3.3 Phase 3: Handles & Connections (Week 3)

**Goal:** Style connection handles as + decorators

**Tasks:**
1. Create custom handle component
2. Add decorator styling (circular + button)
3. Implement hover effects
4. Test connection behavior

**Deliverables:**
- `CustomHandle.js` component
- Updated CSS for handle styling
- Working connections with new handles

### 3.4 Phase 4: Interactions (Week 4)

**Goal:** Add interactive features

**Tasks:**
1. Implement double-click to create node
2. Add context menu with shadcn/ui
3. Create "Add Block" modal dialog
4. Add keyboard shortcuts

**Deliverables:**
- Node creation modal
- Right-click context menu
- Keyboard shortcut handler

### 3.5 Phase 5: Polish & Testing (Week 5)

**Goal:** Refinement and quality assurance

**Tasks:**
1. Animation polish
2. Accessibility improvements
3. Performance optimization
4. Cross-browser testing

**Deliverables:**
- Production-ready component
- Documentation
- Test coverage

---

## 4. Technical Specifications

### 4.1 Dependencies

**New Dependencies to Install:**

```bash
# Core UI components
npm install @radix-ui/react-dialog
npm install @radix-ui/react-dropdown-menu
npm install @radix-ui/react-context-menu
npm install @radix-ui/react-select
npm install @radix-ui/react-separator

# OR use shadcn/ui CLI (recommended)
npx shadcn-ui@latest init
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add context-menu
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add button
```

**Existing Dependencies (Keep):**
- `reactflow` ✅
- `framer-motion` ✅
- `lucide-react` ✅
- `tailwindcss` ✅

### 4.2 File Structure

**Recommended Structure:**

```
tea_frontend/tea-docs/
├── components/
│   ├── curriculum/
│   │   ├── CaseViewerWrapper.js          (keep, minor updates)
│   │   ├── InteractiveCaseViewer.js      (major updates)
│   │   ├── nodes/
│   │   │   ├── BaseNode.js               (new - collapsible base)
│   │   │   ├── GoalNode.js               (update)
│   │   │   ├── StrategyNode.js           (update)
│   │   │   ├── PropertyClaimNode.js      (update)
│   │   │   ├── EvidenceNode.js           (update)
│   │   │   └── ContextNode.js            (update)
│   │   ├── handles/
│   │   │   └── CustomHandle.js           (new)
│   │   ├── modals/
│   │   │   └── AddBlockDialog.js         (new)
│   │   └── menus/
│   │       └── NodeContextMenu.js        (new)
│   └── ui/                                (new - shadcn components)
│       ├── dialog.jsx
│       ├── dropdown-menu.jsx
│       ├── context-menu.jsx
│       ├── button.jsx
│       └── separator.jsx
├── lib/
│   └── utils.js                           (new - utility functions)
└── styles/
    └── react-flow-custom.css              (new - custom styles)
```

### 4.3 Custom Design Tokens

**Add to `tailwind.config.js`:**

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        background: {
          'transparent-black': 'rgba(0, 0, 0, 0.6)',
          'transparent-black-secondary': 'rgba(0, 0, 0, 0.75)',
          'transparent-black-secondaryAlt': 'rgba(0, 0, 0, 0.85)',
          'transparent-white-hover': 'rgba(255, 255, 255, 0.05)',
          'transparent-white-secondaryHover': 'rgba(255, 255, 255, 0.1)',
          'opaque-white': 'rgba(255, 255, 255, 1)',
          'disabled-light': 'rgba(100, 100, 100, 0.3)',
        },
        text: {
          light: 'rgba(255, 255, 255, 0.95)',
          dark: 'rgba(0, 0, 0, 0.87)',
        },
        icon: {
          'light-secondary': 'rgba(255, 255, 255, 0.6)',
        },
        border: {
          transparent: 'rgba(255, 255, 255, 0.1)',
        },
      },
      backdropBlur: {
        'lg': '40px',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'glassmorphic': '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        '3d': '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'spring': 'spring 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [
    // Custom plugin for glassmorphism utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.f-effect-backdrop-blur-lg': {
          backdropFilter: 'blur(40px)',
          '-webkit-backdrop-filter': 'blur(40px)',
        },
        '.f-effect-shadow-md': {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        },
        '.border-3d': {
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
        },
      }
      addUtilities(newUtilities)
    },
  ],
}
```

---

## 5. Implementation Examples

### 5.1 Collapsible Base Node Component

**File: `components/curriculum/nodes/BaseNode.js`**

```javascript
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CustomHandle from '../handles/CustomHandle';

/**
 * Base collapsible node component for all node types
 * Implements FloraFauna.ai-style expand/collapse behavior
 */
const BaseNode = ({
  data,
  isSelected,
  children,
  icon: Icon,
  colorScheme = 'blue',
  showSourceHandle = true,
  showTargetHandle = true,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isSelected);

  // Auto-expand when selected
  React.useEffect(() => {
    if (isSelected) {
      setIsExpanded(true);
    }
  }, [isSelected]);

  // Color schemes for different node types
  const colorSchemes = {
    goal: {
      bg: 'bg-green-500/10',
      border: 'border-green-400/30',
      icon: 'text-green-400',
    },
    strategy: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-400/30',
      icon: 'text-purple-400',
    },
    claim: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-400/30',
      icon: 'text-orange-400',
    },
    evidence: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-400/30',
      icon: 'text-cyan-400',
    },
    context: {
      bg: 'bg-gray-500/10',
      border: 'border-gray-400/30',
      icon: 'text-gray-400',
    },
  };

  const colors = colorSchemes[colorScheme] || colorSchemes.goal;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
      className={`
        relative min-w-[200px] max-w-[300px]
        bg-background-transparent-black
        border border-transparent
        f-effect-backdrop-blur-lg
        rounded-xl
        shadow-glassmorphic
        cursor-pointer
        transition-all duration-300
        hover:shadow-3d
        ${isSelected ? 'ring-2 ring-blue-500/50' : ''}
        ${colors.border}
      `}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Target Handle */}
      {showTargetHandle && (
        <CustomHandle
          type="target"
          position={Position.Top}
          nodeId={data.id}
        />
      )}

      {/* Header - Always Visible */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className={`w-5 h-5 flex-shrink-0 ${colors.icon}`} />}
          <div className="font-semibold text-text-light text-sm truncate">
            {data.name}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-icon-light-secondary flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-icon-light-secondary flex-shrink-0" />
        )}
      </div>

      {/* Collapsed State - Preview */}
      {!isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="px-4 pb-3"
        >
          <p className="text-xs text-text-light/70 line-clamp-2">
            {data.description || data.short_description}
          </p>
        </motion.div>
      )}

      {/* Expanded State - Full Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Separator */}
              <div className="h-px bg-border-transparent" />

              {/* Full Description */}
              <p className="text-sm text-text-light/80">
                {data.long_description || data.description || data.short_description}
              </p>

              {/* Custom Content */}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source Handle */}
      {showSourceHandle && (
        <CustomHandle
          type="source"
          position={Position.Bottom}
          nodeId={data.id}
        />
      )}
    </motion.div>
  );
};

export default BaseNode;
```

### 5.2 Custom Handle Component

**File: `components/curriculum/handles/CustomHandle.js`**

```javascript
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Custom handle component styled as a + decorator
 * Matches FloraFauna.ai aesthetic
 */
const CustomHandle = ({ type, position, nodeId, ...props }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determine positioning classes based on position
  const positionClasses = {
    [Position.Top]: '-top-4 left-1/2 -translate-x-1/2',
    [Position.Bottom]: '-bottom-4 left-1/2 -translate-x-1/2',
    [Position.Left]: 'left-0 -translate-x-1/2 top-1/2 -translate-y-1/2',
    [Position.Right]: 'right-0 translate-x-1/2 top-1/2 -translate-y-1/2',
  };

  return (
    <Handle
      type={type}
      position={position}
      {...props}
      className={`
        !bg-transparent
        !border-0
        !w-12 !h-12
        flex items-center justify-center
        ${positionClasses[position]}
        group
        cursor-pointer
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visual Decorator (pointer-events-none) */}
      <motion.div
        className="pointer-events-none"
        initial={{ scale: 0 }}
        animate={{ scale: isHovered ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div
          className={`
            w-8 h-8 rounded-full
            bg-background-opaque-white
            border border-gray-300
            flex items-center justify-center
            shadow-md
            transition-all duration-300
            ${isHovered ? 'shadow-lg' : ''}
          `}
        >
          <Plus className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
        </div>
      </motion.div>
    </Handle>
  );
};

export default CustomHandle;
```

### 5.3 Add Block Dialog Modal

**File: `components/curriculum/modals/AddBlockDialog.js`**

```javascript
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Target,
  GitBranch,
  FileText,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

/**
 * Modal dialog for creating new nodes
 * Matches FloraFauna.ai "Add Block" interface
 */
const AddBlockDialog = ({ isOpen, onClose, onSelectType, position }) => {
  const blockTypes = [
    {
      id: 'goal',
      name: 'Goal',
      description: 'Top-level system property to be assured',
      icon: Target,
      shortcut: 'G',
      color: 'green',
    },
    {
      id: 'strategy',
      name: 'Strategy',
      description: 'Approach for decomposing a goal',
      icon: GitBranch,
      shortcut: 'S',
      color: 'purple',
    },
    {
      id: 'claim',
      name: 'Property Claim',
      description: 'Specific property or sub-claim',
      icon: FileText,
      shortcut: 'C',
      color: 'orange',
    },
    {
      id: 'evidence',
      name: 'Evidence',
      description: 'Supporting evidence or artifact',
      icon: CheckCircle,
      shortcut: 'E',
      color: 'cyan',
    },
  ];

  const handleSelectType = (type) => {
    onSelectType(type, position);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="
        sm:max-w-md
        bg-background-transparent-black-secondaryAlt
        border border-transparent
        f-effect-backdrop-blur-lg
        text-text-light
        shadow-3d
      ">
        <DialogHeader>
          <DialogTitle className="text-text-light">Add Block</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {blockTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.id}
                variant="ghost"
                className={`
                  w-full justify-start h-auto py-3 px-4
                  hover:bg-background-transparent-white-hover
                  transition-all duration-300
                  group
                `}
                onClick={() => handleSelectType(type.id)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Icon className={`w-5 h-5 text-${type.color}-400 flex-shrink-0`} />
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-sm text-text-light">
                      {type.name}
                    </div>
                    <div className="text-xs text-text-light/60">
                      {type.description}
                    </div>
                  </div>
                  <div className="text-xs text-text-light/40 font-mono">
                    {type.shortcut}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        <Separator className="bg-border-transparent" />

        <Button
          variant="ghost"
          className="w-full justify-start text-text-light/70 hover:text-text-light"
          onClick={() => window.open('/documentation/learn', '_blank')}
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          Learn about Blocks
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default AddBlockDialog;
```

### 5.4 Updated InteractiveCaseViewer with New Features

**Key Changes to `InteractiveCaseViewer.js`:**

```javascript
// Add state for dialog and context menu
const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
const [addPosition, setAddPosition] = useState(null);

// Double-click handler for canvas
const handlePaneDoubleClick = useCallback((event) => {
  // Get click position in flow coordinates
  const rect = event.target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  setAddPosition({ x, y });
  setIsAddDialogOpen(true);
}, []);

// Handle new node creation
const handleCreateNode = useCallback((type, position) => {
  const newNode = {
    id: `${type}-${Date.now()}`,
    type: type,
    position: position || { x: 100, y: 100 },
    data: {
      name: `New ${type}`,
      description: 'Click to edit',
      element: {}
    },
  };

  setNodes((nds) => [...nds, newNode]);
}, [setNodes]);

// In the ReactFlow component:
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onNodeClick={handleNodeClick}
  onPaneDoubleClick={handlePaneDoubleClick}  // NEW
  nodeTypes={nodeTypes}
  fitView
  // Add dark theme class
  className="bg-gray-950"
>
  {/* ... Background, Controls, MiniMap ... */}
</ReactFlow>

// Add the modal
<AddBlockDialog
  isOpen={isAddDialogOpen}
  onClose={() => setIsAddDialogOpen(false)}
  onSelectType={handleCreateNode}
  position={addPosition}
/>
```

---

## 6. Migration Guide

### 6.1 Step-by-Step Migration

**Step 1: Install Dependencies**

```bash
cd tea_frontend/tea-docs

# Install shadcn/ui (if not already installed)
npx shadcn-ui@latest init

# Install specific components
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add context-menu
npx shadcn-ui@latest add button
npx shadcn-ui@latest add separator
```

**Step 2: Update Tailwind Config**

Add the custom design tokens from Section 4.3 to `tailwind.config.js`.

**Step 3: Create New Components**

Create the directory structure from Section 4.2 and implement:
1. `BaseNode.js` (Section 5.1)
2. `CustomHandle.js` (Section 5.2)
3. `AddBlockDialog.js` (Section 5.3)

**Step 4: Update Node Components**

Update each node type (Goal, Strategy, etc.) to use `BaseNode`:

```javascript
// Example: GoalNode.js
import React from 'react';
import { Target } from 'lucide-react';
import BaseNode from './BaseNode';

const GoalNode = ({ data, isSelected }) => {
  return (
    <BaseNode
      data={data}
      isSelected={isSelected}
      icon={Target}
      colorScheme="goal"
      showTargetHandle={false}  // Goals typically don't have target handles
      showSourceHandle={true}
      defaultExpanded={false}
    >
      {/* Optional: Add goal-specific expanded content */}
      {data.context && (
        <div className="mt-2">
          <div className="text-xs text-text-light/50 uppercase">Context</div>
          <ul className="text-xs text-text-light/70 list-disc list-inside">
            {data.context.map((ctx, i) => (
              <li key={i}>{ctx.name}</li>
            ))}
          </ul>
        </div>
      )}
    </BaseNode>
  );
};

export default GoalNode;
```

**Step 5: Update InteractiveCaseViewer**

Add the new features from Section 5.4.

**Step 6: Update Styles**

Create `styles/react-flow-custom.css`:

```css
/* Custom React Flow Styles for Dark Theme */

.react-flow {
  background-color: #0a0a0a;
}

.react-flow__background {
  background-color: #0a0a0a;
}

.react-flow__background-pattern {
  stroke: rgba(255, 255, 255, 0.05);
}

.react-flow__edge-path {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 2;
}

.react-flow__edge.selected .react-flow__edge-path {
  stroke: rgba(59, 130, 246, 0.8);
  stroke-width: 3;
}

.react-flow__edge.animated .react-flow__edge-path {
  stroke: rgba(139, 92, 246, 0.6);
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

@keyframes dashdraw {
  to {
    stroke-dashoffset: -10;
  }
}

.react-flow__controls {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
}

.react-flow__controls-button {
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.react-flow__controls-button:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.95);
}

.react-flow__minimap {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
}
```

Import in `InteractiveCaseViewer.js`:

```javascript
import 'reactflow/dist/style.css';
import '../../../styles/react-flow-custom.css';
```

**Step 7: Test**

1. Test node expansion/collapse
2. Test double-click node creation
3. Test connection handles
4. Test context menu
5. Test progressive disclosure
6. Test dark mode rendering
7. Test accessibility

### 6.2 Backward Compatibility

**Maintaining Compatibility:**

1. **Keep existing props interface** in `CaseViewerWrapper.js`
2. **Add feature flags** for gradual rollout:

```javascript
const InteractiveCaseViewer = ({
  caseData,
  // Existing props
  onNodeClick,
  guidedPath = [],
  showAllNodes = false,
  highlightedNodes = [],
  enableExploration = true,

  // New feature flags
  enableNodeCreation = true,      // NEW
  enableContextMenu = true,        // NEW
  useGlassmorphism = true,        // NEW
  enableCollapsibleNodes = true,  // NEW
}) => {
  // ...
}
```

3. **Provide migration path:**
   - Phase 1: Add new components alongside old
   - Phase 2: Switch with feature flag
   - Phase 3: Remove old components

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Test Coverage:**

```javascript
// BaseNode.test.js
describe('BaseNode', () => {
  test('renders collapsed by default', () => {
    // ...
  });

  test('expands when clicked', () => {
    // ...
  });

  test('auto-expands when selected', () => {
    // ...
  });

  test('renders custom content when expanded', () => {
    // ...
  });
});

// CustomHandle.test.js
describe('CustomHandle', () => {
  test('renders + icon', () => {
    // ...
  });

  test('shows hover effect', () => {
    // ...
  });

  test('positions correctly based on position prop', () => {
    // ...
  });
});

// AddBlockDialog.test.js
describe('AddBlockDialog', () => {
  test('opens and closes correctly', () => {
    // ...
  });

  test('calls onSelectType with correct type', () => {
    // ...
  });

  test('displays all block types', () => {
    // ...
  });
});
```

### 7.2 Integration Tests

```javascript
describe('InteractiveCaseViewer Integration', () => {
  test('double-click creates node', () => {
    // ...
  });

  test('right-click shows context menu', () => {
    // ...
  });

  test('connecting nodes creates edge', () => {
    // ...
  });

  test('progressive disclosure reveals nodes', () => {
    // ...
  });
});
```

### 7.3 Visual Regression Tests

Use tools like Chromatic or Percy for visual testing:

```javascript
// storybook/CaseViewer.stories.js
export const Default = {
  args: {
    caseData: mockCaseData,
  },
};

export const DarkMode = {
  args: {
    caseData: mockCaseData,
    useGlassmorphism: true,
  },
};

export const WithExpandedNodes = {
  args: {
    caseData: mockCaseData,
    showAllNodes: true,
  },
};
```

### 7.4 Accessibility Testing

**Checklist:**
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Screen reader compatibility (ARIA labels)
- ✅ Focus indicators
- ✅ Color contrast (WCAG AA minimum)
- ✅ Reduced motion support

```javascript
// Example accessibility improvements
const BaseNode = ({ ... }) => {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`${data.name} node`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsExpanded(!isExpanded);
        }
      }}
      // ... rest of props
    >
      {/* ... */}
    </motion.div>
  );
};
```

---

## 8. Performance Considerations

### 8.1 Optimization Strategies

**1. React Flow Performance:**

```javascript
// Use React Flow's built-in optimization
<ReactFlow
  nodes={nodes}
  edges={edges}
  // Performance optimizations
  deleteKeyCode={null}  // Disable if not using delete
  selectNodesOnDrag={false}  // Improve drag performance
  panOnDrag={[1, 2]}  // Only pan with middle/right mouse
  minZoom={0.2}
  maxZoom={4}
  // Rendering optimizations
  nodesDraggable={true}
  nodesConnectable={enableNodeCreation}
  elementsSelectable={true}
  // Only render visible elements
  onlyRenderVisibleElements={true}
>
```

**2. Lazy Loading:**

```javascript
// Lazy load dialog components
const AddBlockDialog = React.lazy(() =>
  import('./modals/AddBlockDialog')
);

// Use Suspense
<Suspense fallback={<div>Loading...</div>}>
  {isAddDialogOpen && (
    <AddBlockDialog ... />
  )}
</Suspense>
```

**3. Memoization:**

```javascript
// Memoize node components
const GoalNode = React.memo(({ data, isSelected }) => {
  // ...
}, (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.isSelected === nextProps.isSelected
  );
});
```

**4. Backdrop Filter Performance:**

```css
/* Use will-change for animated elements */
.f-effect-backdrop-blur-lg {
  backdrop-filter: blur(40px);
  -webkit-backdrop-filter: blur(40px);
  will-change: backdrop-filter;  /* Hint to browser */
}

/* For Safari, sometimes need fallback */
@supports not (backdrop-filter: blur(40px)) {
  .f-effect-backdrop-blur-lg {
    background: rgba(0, 0, 0, 0.8);  /* Fallback */
  }
}
```

### 8.2 Bundle Size

**Monitor bundle impact:**

```bash
# Analyze bundle
npm run build
npx webpack-bundle-analyzer build/stats.json
```

**Expected additions:**
- Radix UI primitives: ~50-80kb (gzipped)
- shadcn/ui components: ~10-20kb per component
- Total estimated increase: ~100-150kb

---

## 9. Browser Compatibility

### 9.1 Supported Browsers

**Minimum Versions:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Key Features & Fallbacks:**

| Feature | Support | Fallback |
|---------|---------|----------|
| `backdrop-filter` | Chrome 76+, Safari 9+ | Opaque background |
| CSS Grid | All modern | N/A |
| CSS Custom Properties | All modern | N/A |
| Flexbox | All modern | N/A |
| IntersectionObserver | All modern | Polyfill available |

### 9.2 Polyfills & Fallbacks

```javascript
// Detect backdrop-filter support
const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(40px)');

// Apply fallback class
<div className={`
  bg-background-transparent-black
  ${supportsBackdropFilter ? 'f-effect-backdrop-blur-lg' : 'bg-background-opaque-dark'}
`}>
```

---

## 10. Future Enhancements

### 10.1 Short-term (Next 3 months)

1. **Rich Text Editing**
   - Integrate TipTap or similar for node content editing
   - Support markdown rendering

2. **Node Templates**
   - Pre-configured node patterns for common assurance patterns
   - Template library

3. **Collaborative Features**
   - Real-time cursor positions
   - Collaborative editing indicators

4. **Export/Import**
   - Export to PNG/SVG
   - Export to PDF
   - Import from various formats

### 10.2 Long-term (6-12 months)

1. **AI-Assisted Creation**
   - Suggest connections based on content
   - Auto-generate evidence nodes
   - NLP analysis of assurance case completeness

2. **Advanced Layouts**
   - Auto-layout algorithms (Dagre, ELK)
   - Hierarchical vs. force-directed layouts
   - Custom layout plugins

3. **Animation & Transitions**
   - Smooth node insertion/deletion
   - Path highlighting
   - Guided tours

4. **Mobile Support**
   - Touch-optimized interactions
   - Responsive layouts
   - PWA capabilities

---

## 11. Appendix

### 11.1 Key Differences: Current vs. FloraFauna.ai

| Aspect | Current TEA | FloraFauna.ai | Recommendation |
|--------|-------------|---------------|----------------|
| Node State | Always expanded | Collapsible | Implement collapsible |
| Theme | Light with solid colors | Dark with glassmorphism | Adopt dark theme |
| Handles | Standard React Flow | Styled + decorators | Custom styled handles |
| Node Creation | Not supported | Double-click + modal | Add creation feature |
| Context Menu | Not present | Limited (New Block, Paste) | Implement basic menu |
| UI Components | Custom + Tailwind | shadcn/ui + Radix | Migrate to shadcn/ui |
| Delete Function | N/A | Not in context menu | Add via keyboard/toolbar |
| Animations | Basic | Spring transitions | Enhanced animations |

### 11.2 Useful Resources

**Official Documentation:**
- [React Flow Docs](https://reactflow.dev/)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)

**Design References:**
- [FloraFauna.ai](https://app.florafauna.ai) (live reference)
- [Glassmorphism Generator](https://hype4.academy/tools/glassmorphism-generator)
- [Tailwind Play](https://play.tailwindcss.com/) (for testing styles)

**Code Examples:**
- [React Flow Examples](https://reactflow.dev/examples)
- [shadcn/ui Examples](https://ui.shadcn.com/examples)

### 11.3 Glossary

- **Glassmorphism**: Design trend using frosted glass effect (semi-transparent background + backdrop blur)
- **Progressive Disclosure**: UX pattern revealing information gradually to reduce cognitive load
- **Handle**: React Flow term for connection points on nodes
- **Decorator**: Visual element that enhances appearance without affecting functionality
- **Radix UI**: Low-level UI primitive library focused on accessibility
- **shadcn/ui**: Collection of re-usable components built on Radix UI

### 11.4 Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-08 | Initial specification based on FloraFauna.ai analysis | Claude |

---

## 12. Implementation Checklist

**Phase 1: Foundation**
- [ ] Install shadcn/ui and dependencies
- [ ] Update Tailwind config with custom tokens
- [ ] Set up new file structure
- [ ] Create base components folder

**Phase 2: Components**
- [ ] Implement `BaseNode.js`
- [ ] Implement `CustomHandle.js`
- [ ] Update all node types (Goal, Strategy, etc.)
- [ ] Test node expansion/collapse

**Phase 3: Interactions**
- [ ] Implement `AddBlockDialog.js`
- [ ] Add double-click handler
- [ ] Add context menu
- [ ] Add keyboard shortcuts

**Phase 4: Styling**
- [ ] Apply glassmorphism effects
- [ ] Update color scheme to dark theme
- [ ] Add custom React Flow CSS
- [ ] Test cross-browser compatibility

**Phase 5: Testing & Polish**
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Accessibility audit
- [ ] Performance profiling
- [ ] Documentation updates

**Phase 6: Deployment**
- [ ] Feature flag rollout
- [ ] User acceptance testing
- [ ] Production deployment
- [ ] Monitor analytics and feedback

---

## Contact & Support

For questions or clarifications about this specification:

1. Review the [React Flow documentation](https://reactflow.dev/)
2. Check the FloraFauna.ai live reference
3. Consult the TEA platform documentation
4. Reach out to the development team

---

**End of Specification**
