/**
 * Dialogs Module Exports
 *
 * Central export file for all dialog-related components and utilities.
 * Provides a clean API for consuming dialog functionality.
 *
 * @module dialogs
 */

// Main components
export { default as AddBlockDialog, CompactAddBlockDialog } from './AddBlockDialog';
export { default as BlockForm } from './BlockForm';
export { default as BlockPreview, CompactBlockPreview } from './BlockPreview';
export { default as BlockTemplates, TemplateStats } from './BlockTemplates';

// Utilities
export * from './dialogUtils';
export { default as dialogUtils } from './dialogUtils';

/**
 * Re-export commonly used utilities at top level for convenience
 */
export {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  setDialogMode,
  getDialogMode,
  validateBlockForm,
  saveDialogPreferences,
  loadDialogPreferences,
} from './dialogUtils';
