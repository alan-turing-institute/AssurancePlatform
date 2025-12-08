/**
 * Identifier Utilities
 *
 * Functions for formatting and handling node identifiers
 */

/**
 * Format node identifier to display format
 * @param {string} id - Raw identifier (e.g., "goal-1", "strategy-2")
 * @param {string} nodeType - Type of node
 * @returns {string} Formatted identifier (e.g., "G1", "S2")
 */
export const formatIdentifier = (id, nodeType) => {
  if (!id) return '';

  // Extract number from id
  const match = id.match(/(\d+)$/);
  const number = match ? match[1] : '';

  // Map node types to prefixes
  const prefixMap = {
    goal: 'G',
    strategy: 'S',
    propertyClaim: 'PC',
    evidence: 'E',
    context: 'C',
  };

  const prefix = prefixMap[nodeType] || nodeType.charAt(0).toUpperCase();

  return `${prefix}${number}`;
};

/**
 * Get display name for node (name or formatted identifier)
 * @param {object} data - Node data
 * @param {string} nodeType - Type of node
 * @returns {string} Display name
 */
export const getDisplayName = (data, nodeType) => {
  if (data.name && data.name.trim()) {
    return data.name;
  }

  // Default to formatted identifier
  return formatIdentifier(data.id, nodeType);
};

/**
 * Truncate text to specified number of lines
 * @param {string} text - Text to truncate
 * @param {number} lines - Maximum number of lines (default: 2)
 * @returns {string} Truncated text with ellipsis if needed
 */
export const truncateText = (text, lines = 2) => {
  if (!text) return '';

  // Approximate characters per line (adjust based on font size)
  const charsPerLine = 40;
  const maxChars = charsPerLine * lines;

  if (text.length <= maxChars) {
    return text;
  }

  return text.substring(0, maxChars).trim() + '...';
};

/**
 * Extract attributes from node data
 * @param {object} data - Node data
 * @returns {object} Attributes object with context, assumptions, justifications
 */
export const extractAttributes = (data) => {
  const attributes = {
    context: [],
    assumptions: [],
    justifications: [],
  };

  // Extract context
  if (data.context && Array.isArray(data.context)) {
    attributes.context = data.context;
  }

  // Extract assumptions (can be part of context or separate)
  if (data.assumptions && Array.isArray(data.assumptions)) {
    attributes.assumptions = data.assumptions;
  } else if (data.context) {
    // Check if context items have assumption flag
    attributes.assumptions = data.context.filter(
      item => item.type === 'Assumption' || item.isAssumption
    );
  }

  // Extract justifications
  if (data.justifications && Array.isArray(data.justifications)) {
    attributes.justifications = data.justifications;
  }

  return attributes;
};

/**
 * Extract metadata from node data
 * @param {object} data - Node data
 * @returns {object} Metadata object
 */
export const extractMetadata = (data) => {
  const metadata = {};

  // Strength
  if (data.strength) {
    metadata.strength = data.strength;
  }

  // Status
  if (data.status) {
    metadata.status = data.status;
  }

  // Priority
  if (data.priority) {
    metadata.priority = data.priority;
  }

  // Confidence
  if (data.confidence) {
    metadata.confidence = data.confidence;
  }

  return metadata;
};
