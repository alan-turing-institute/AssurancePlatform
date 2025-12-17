/**
 * Curriculum Components Index
 *
 * LIGHTWEIGHT exports only. Heavy components must be imported directly.
 *
 * For EnhancedInteractiveCaseViewer (imports 730+ modules from enhanced/):
 *   import EnhancedInteractiveCaseViewer from '@/components/docs/curriculum/enhanced-interactive-case-viewer';
 *
 * @module curriculum
 */

// Lightweight wrapper - lazy loads the enhanced viewer
export { default as CaseViewerWrapper } from "./case-viewer-wrapper";

// NOTE: EnhancedInteractiveCaseViewer removed from exports - it imports 730+ modules
// Import it directly when needed to avoid module explosion
