/**
 * Dialog Utilities
 *
 * Helper functions for dialog state management, validation,
 * draft persistence, and common dialog operations.
 *
 * @module dialogUtils
 */

/**
 * Storage keys for persistence
 */
const STORAGE_KEYS = {
  DRAFT: 'tea_block_dialog_draft',
  MODE: 'tea_block_dialog_mode',
  RECENT_TEMPLATES: 'tea_recent_templates',
  DIALOG_PREFERENCES: 'tea_dialog_preferences',
};

// ========================================================================
// Draft Management
// ========================================================================

/**
 * Save dialog draft to localStorage
 * @param {Object} draft - Draft data {nodeType, formData}
 */
export const saveDraft = (draft) => {
  try {
    const draftWithTimestamp = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draftWithTimestamp));
  } catch (error) {
    console.warn('Failed to save draft:', error);
  }
};

/**
 * Load dialog draft from localStorage
 * @returns {Object|null} Draft data or null if not found/expired
 */
export const loadDraft = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (!stored) return null;

    const draft = JSON.parse(stored);

    // Check if draft is expired (older than 24 hours)
    if (draft.savedAt) {
      const savedTime = new Date(draft.savedAt);
      const now = new Date();
      const hoursDiff = (now - savedTime) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        clearDraft();
        return null;
      }
    }

    return draft;
  } catch (error) {
    console.warn('Failed to load draft:', error);
    return null;
  }
};

/**
 * Clear dialog draft from localStorage
 */
export const clearDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
};

/**
 * Check if draft exists
 * @returns {boolean} True if draft exists and is valid
 */
export const hasDraft = () => {
  const draft = loadDraft();
  return draft !== null && Object.keys(draft.formData || {}).length > 0;
};

// ========================================================================
// Dialog Mode Management
// ========================================================================

/**
 * Save dialog mode preference
 * @param {string} mode - Dialog mode (standard, quick, bulk)
 */
export const setDialogMode = (mode) => {
  try {
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
  } catch (error) {
    console.warn('Failed to save dialog mode:', error);
  }
};

/**
 * Get saved dialog mode
 * @returns {string} Dialog mode or 'standard' as default
 */
export const getDialogMode = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.MODE) || 'standard';
  } catch (error) {
    console.warn('Failed to get dialog mode:', error);
    return 'standard';
  }
};

// ========================================================================
// Recent Templates Management
// ========================================================================

/**
 * Save recently used template
 * @param {string} templateId - Template ID
 * @param {number} maxRecent - Maximum number of recent templates to keep
 */
export const addRecentTemplate = (templateId, maxRecent = 5) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TEMPLATES);
    const recent = stored ? JSON.parse(stored) : [];

    // Remove if already exists and add to front
    const updated = [
      templateId,
      ...recent.filter((id) => id !== templateId),
    ].slice(0, maxRecent);

    localStorage.setItem(STORAGE_KEYS.RECENT_TEMPLATES, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save recent template:', error);
  }
};

/**
 * Get recently used templates
 * @returns {string[]} Array of template IDs
 */
export const getRecentTemplates = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TEMPLATES);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to get recent templates:', error);
    return [];
  }
};

// ========================================================================
// Dialog Preferences
// ========================================================================

/**
 * Save dialog preferences
 * @param {Object} preferences - User preferences
 */
export const saveDialogPreferences = (preferences) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.DIALOG_PREFERENCES,
      JSON.stringify(preferences)
    );
  } catch (error) {
    console.warn('Failed to save dialog preferences:', error);
  }
};

/**
 * Load dialog preferences
 * @returns {Object} User preferences with defaults
 */
export const loadDialogPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DIALOG_PREFERENCES);
    const defaults = {
      showConnectionHints: true,
      autoSaveDrafts: true,
      defaultQuickMode: false,
      rememberLastNodeType: true,
      showTemplatePreview: true,
      enableKeyboardShortcuts: true,
    };

    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch (error) {
    console.warn('Failed to load dialog preferences:', error);
    return {
      showConnectionHints: true,
      autoSaveDrafts: true,
      defaultQuickMode: false,
      rememberLastNodeType: true,
      showTemplatePreview: true,
      enableKeyboardShortcuts: true,
    };
  }
};

// ========================================================================
// Form Validation
// ========================================================================

/**
 * Validate node creation form data
 * @param {string} nodeType - Node type
 * @param {Object} formData - Form data to validate
 * @param {boolean} quickMode - Whether in quick mode
 * @returns {Object} Validation result {isValid, errors}
 */
export const validateBlockForm = (nodeType, formData, quickMode = false) => {
  const errors = {};

  // Common validation
  if (!formData.name || formData.name.trim() === '') {
    errors.name = 'Name is required';
  } else if (formData.name.length > 100) {
    errors.name = 'Name must be 100 characters or less';
  }

  if (!quickMode) {
    if (!formData.description || formData.description.trim() === '') {
      errors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }
  }

  // Type-specific validation
  switch (nodeType) {
    case 'goal':
      if (formData.targetDate && !isValidDate(formData.targetDate)) {
        errors.targetDate = 'Invalid date format';
      }
      break;

    case 'evidence':
      if (formData.link && !isValidUrl(formData.link)) {
        errors.link = 'Invalid URL format';
      }
      if (formData.confidence !== undefined && (formData.confidence < 0 || formData.confidence > 100)) {
        errors.confidence = 'Confidence must be between 0 and 100';
      }
      break;

    case 'propertyClaim':
      if (formData.strength !== undefined && (formData.strength < 0 || formData.strength > 100)) {
        errors.strength = 'Strength must be between 0 and 100';
      }
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

/**
 * Validate date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date
 */
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Validate URL string
 * @param {string} urlString - URL string to validate
 * @returns {boolean} True if valid URL
 */
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

// ========================================================================
// Form Field Helpers
// ========================================================================

/**
 * Get character count info for text field
 * @param {string} text - Text content
 * @param {number} maxLength - Maximum length
 * @returns {Object} Character count info {current, max, percentage, isNearLimit, isOverLimit}
 */
export const getCharacterCountInfo = (text = '', maxLength) => {
  const current = text.length;
  const percentage = (current / maxLength) * 100;

  return {
    current,
    max: maxLength,
    percentage,
    isNearLimit: percentage > 80,
    isOverLimit: current > maxLength,
  };
};

/**
 * Truncate text to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength);
};

/**
 * Sanitize form input
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;

  // Remove leading/trailing whitespace
  let sanitized = input.trim();

  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
};

// ========================================================================
// Dialog State Helpers
// ========================================================================

/**
 * Generate unique dialog session ID
 * @returns {string} Unique session ID
 */
export const generateSessionId = () => {
  return `dialog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Track dialog analytics event
 * @param {string} eventName - Event name
 * @param {Object} eventData - Event data
 */
export const trackDialogEvent = (eventName, eventData = {}) => {
  // This could be extended to send to analytics service
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Dialog Analytics] ${eventName}:`, eventData);
  }

  // Store in session for debugging
  try {
    const events = JSON.parse(sessionStorage.getItem('dialog_events') || '[]');
    events.push({
      event: eventName,
      data: eventData,
      timestamp: new Date().toISOString(),
    });
    sessionStorage.setItem('dialog_events', JSON.stringify(events.slice(-50))); // Keep last 50
  } catch (error) {
    console.warn('Failed to track dialog event:', error);
  }
};

/**
 * Get dialog analytics data
 * @returns {Array} Array of dialog events
 */
export const getDialogAnalytics = () => {
  try {
    return JSON.parse(sessionStorage.getItem('dialog_events') || '[]');
  } catch (error) {
    console.warn('Failed to get dialog analytics:', error);
    return [];
  }
};

// ========================================================================
// Position Helpers
// ========================================================================

/**
 * Calculate optimal dialog position based on screen size
 * @returns {Object} Dialog position {centered: boolean, offset: {x, y}}
 */
export const calculateDialogPosition = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    centered: width > 1024, // Center on larger screens
    offset: {
      x: 0,
      y: height > 800 ? 40 : 20, // More top offset on taller screens
    },
  };
};

/**
 * Check if position is in viewport
 * @param {Object} position - Position {x, y}
 * @returns {boolean} True if position is in viewport
 */
export const isPositionInViewport = (position) => {
  if (!position) return false;

  const width = window.innerWidth;
  const height = window.innerHeight;

  return (
    position.x >= 0 &&
    position.x <= width &&
    position.y >= 0 &&
    position.y <= height
  );
};

// ========================================================================
// Export All
// ========================================================================

export default {
  // Draft management
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,

  // Mode management
  setDialogMode,
  getDialogMode,

  // Recent templates
  addRecentTemplate,
  getRecentTemplates,

  // Preferences
  saveDialogPreferences,
  loadDialogPreferences,

  // Validation
  validateBlockForm,

  // Field helpers
  getCharacterCountInfo,
  truncateText,
  sanitizeInput,

  // State helpers
  generateSessionId,
  trackDialogEvent,
  getDialogAnalytics,

  // Position helpers
  calculateDialogPosition,
  isPositionInViewport,
};
