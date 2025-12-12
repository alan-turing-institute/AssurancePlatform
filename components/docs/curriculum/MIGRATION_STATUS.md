# Curriculum Components Migration Status

## Overview
Migration of curriculum components from tea-docs to main app, converting from JavaScript to TypeScript and upgrading to modern patterns.

**Source:** `/Users/cburr/Repositories/AssurancePlatform/tea-docs/components/curriculum/`
**Target:** `/Users/cburr/Repositories/AssurancePlatform/components/docs/curriculum/`

## Completed Files

### ✅ Core Utility Files
1. **progress-storage.ts** - localStorage utilities for module progress tracking
   - Converted to TypeScript with proper types
   - All functions properly typed
   - Kebab-case filename as per linter requirements

2. **task-registry.ts** - System for registering and managing module tasks
   - Converted to TypeScript with `const` enums
   - Proper type definitions for Task, TaskType, TaskStatus
   - All utility functions typed

3. **module-progress-context.tsx** - React Context for module progress
   - Converted to TypeScript with proper React types
   - Added "use client" directive for Next.js 15
   - Zustand patterns updated (context-based, not using Zustand store)
   - All hooks and functions properly typed

4. **first-sip-checklist-items.ts** - Checklist data for First Sip module
   - Simple data file with type definitions
   - Properly typed ChecklistItem array

## Remaining Files to Migrate

### 🔄 Configuration & Utils
- **config/feature-config.ts** (copied, needs type fixes)
- **utils/data-mapping.ts** (copied, needs type fixes)

### 🔄 Component Files (Need Manual Migration)

#### High Priority Components
1. **ModuleProgressTracker.tsx** - Global progress tracker UI
   - Uses framer-motion, lucide-react
   - Needs lucide-react imports updated to use @/ alias
   - Complex state management with multiple UI modes

2. **TaskCheckpoint.tsx** - Wrapper for content sections
   - Simple component, should be straightforward
   - Uses lucide-react icons

3. **LearningObjectives.tsx** - Display module learning objectives
   - Multiple variants (card, list, compact)
   - Uses framer-motion animations
   - Icon prop handling needs attention

#### Interactive Components
4. **QuizComponents.tsx** - Multiple choice, true/false, confidence rating
   - Complex component with multiple exports
   - State management for quiz progression
   - Integration with ModuleProgressContext

5. **ConceptCarousel.tsx** - Carousel-based concept learning
   - Animation-heavy with framer-motion
   - Keyboard navigation
   - Needs proper TypeScript event types

6. **ConceptReveal.tsx** - Interactive concept discovery
   - Grid-based reveal system
   - Multiple display modes
   - Auto-play functionality

7. **ReflectionPrompts.tsx** - Sequential reflection prompts
   - Form validation
   - localStorage auto-save
   - Export functionality

8. **ExplorationChecklist.tsx** - Interactive checklist
   - Floating and embedded modes
   - LocalStorage persistence
   - Complex UI states

#### Layout Components
9. **TwoColumnLayout.tsx** - Responsive two-column layout
   - CSS modules import needs updating
   - Simple prop-based component

10. **CaseViewerWrapper.tsx** - Wrapper for case viewer
    - Needs Next.js specific updates
    - Remove Docusaurus dependencies (@docusaurus/BrowserOnly)
    - Fetch logic may need adjustment for Next.js

## Migration Guidelines Applied

### TypeScript Conversion
- ✅ Use `type` instead of `interface` for type definitions
- ✅ Add proper return types to all functions
- ✅ No `any` types (use proper generics or unknown)
- ✅ Proper React.FC types or explicit return types for components

### Import Updates
- ✅ Use `@/components/ui/` for UI component imports
- ✅ Relative imports within curriculum directory
- ✅ Proper lucide-react imports

### Naming Conventions
- ✅ Kebab-case for file names (e.g., `progress-storage.ts`)
- ✅ PascalCase for component files (e.g., `ModuleProgressTracker.tsx`)

### Code Style
- ✅ British English in comments ("optimise", "recognise", etc.)
- ✅ Block statements for all conditionals (linter requirement)
- ✅ Optional chaining where appropriate

### Zustand v5 Patterns
- ℹ️  Note: The current implementation uses React Context, not Zustand stores
- If Zustand is needed: Use `create` without set callback wrapper
- Modern store patterns with selectors

## Next Steps

1. **Fix Config/Utils Files** - Add proper TypeScript types to copied files
2. **Migrate Components in Batches** - Use established patterns from completed files
3. **Create index.ts** - Export all components from main index file
4. **Test Integration** - Ensure all components work in Next.js 15 context
5. **Update Imports** - Replace any tea-docs specific dependencies

## Commands for Completion

```bash
# Check linting
pnpm exec ultracite check components/docs/curriculum/

# Fix auto-fixable issues
pnpm exec ultracite fix components/docs/curriculum/

# Type check
npx tsc --noEmit
```

## Notes

- All files use "use client" directive where needed for Next.js 15
- Framer Motion components require client-side rendering
- LocalStorage access properly guarded with `typeof window` checks
- British English maintained throughout codebase
