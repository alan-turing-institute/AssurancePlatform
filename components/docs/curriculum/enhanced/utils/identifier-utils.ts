/**
 * Identifier Utilities
 *
 * Functions for formatting and handling node identifiers.
 * Supports the new export schema where:
 * - `name` field contains the identifier (G1, P1.1, etc.)
 * - `title` field (optional) contains a human-readable display name
 * - `description` contains the detailed text
 */

// Top-level regex for extracting numbers from IDs
const ID_NUMBER_REGEX = /(\d+)$/;

/**
 * Pattern to detect if a string is an identifier (G1, S1, P1.1, E2, C3, etc.)
 * Matches: G1, S2, P1, P1.1, P1.2.3, E1, C2, etc.
 */
const IDENTIFIER_PATTERN = /^[GSPECJ]\d+(\.\d+)*$/i;

/**
 * Pattern to split text into sentences (at sentence-ending punctuation)
 */
const SENTENCE_SPLIT_PATTERN = /[.!?]/;

type NodeType =
	| "goal"
	| "strategy"
	| "propertyClaim"
	| "evidence"
	| "context"
	| string;

type ContextItem = {
	text?: string;
	type?: string;
	isAssumption?: boolean;
	[key: string]: unknown;
};

type NodeData = {
	id?: string;
	name?: string;
	/** Optional display title separate from identifier */
	title?: string;
	description?: string;
	context?: ContextItem[] | string[];
	assumptions?: unknown[];
	justifications?: unknown[];
	/** Single-string assumption from TreeNode export format */
	assumption?: string;
	/** Single-string justification from TreeNode export format */
	justification?: string;
	strength?: number | string;
	status?: string;
	priority?: string;
	confidence?: number;
	[key: string]: unknown;
};

type ExtractedAttributes = {
	context: ContextItem[];
	assumptions: ContextItem[];
	justifications: ContextItem[];
};

type ExtractedMetadata = {
	strength?: number | string;
	status?: string;
	priority?: string;
	confidence?: number;
};

/**
 * Format node identifier to display format
 */
export const formatIdentifier = (
	id: string | undefined | null,
	nodeType: NodeType
): string => {
	if (!id) {
		return "";
	}

	// Extract number from id
	const match = id.match(ID_NUMBER_REGEX);
	const number = match ? match[1] : "";

	// Map node types to prefixes
	const prefixMap: Record<string, string> = {
		goal: "G",
		strategy: "S",
		propertyClaim: "PC",
		evidence: "E",
		context: "C",
	};

	const prefix = prefixMap[nodeType] || nodeType.charAt(0).toUpperCase();

	return `${prefix}${number}`;
};

/**
 * Check if a string is an identifier pattern (G1, S2, P1.1, etc.)
 */
export const isIdentifier = (value: string | undefined | null): boolean => {
	if (!value) {
		return false;
	}
	return IDENTIFIER_PATTERN.test(value.trim());
};

/**
 * Get display name for node header.
 * Priority: title field → name (if not an identifier) → first sentence of description → name/identifier
 */
export const getDisplayName = (data: NodeData, nodeType: NodeType): string => {
	// 1. Use title field if available
	if (data.title?.trim()) {
		return data.title;
	}

	// 2. Use name if it's NOT an identifier pattern (i.e., it's a meaningful title)
	if (data.name?.trim() && !isIdentifier(data.name)) {
		return data.name;
	}

	// 3. Use first sentence of description if available and reasonable length
	if (data.description) {
		const firstSentence = data.description
			.split(SENTENCE_SPLIT_PATTERN)[0]
			.trim();
		if (firstSentence.length > 0 && firstSentence.length < 80) {
			return firstSentence;
		}
	}

	// 4. Fallback to name (identifier) or formatted ID
	return data.name || formatIdentifier(data.id, nodeType) || "Unnamed";
};

/**
 * Get identifier for node footer display.
 * Returns the stored identifier (G1, P1.1) or generates one from the ID.
 */
export const getIdentifier = (data: NodeData, nodeType: NodeType): string => {
	// Use stored name if it matches identifier pattern
	if (data.name && isIdentifier(data.name)) {
		return data.name;
	}

	// Fallback to formatted ID
	return formatIdentifier(data.id, nodeType);
};

/**
 * Truncate text to specified number of lines
 */
export const truncateText = (
	text: string | undefined | null,
	lines = 2
): string => {
	if (!text) {
		return "";
	}

	// Approximate characters per line (adjust based on font size)
	const charsPerLine = 40;
	const maxChars = charsPerLine * lines;

	if (text.length <= maxChars) {
		return text;
	}

	return `${text.substring(0, maxChars).trim()}...`;
};

/**
 * Extract attributes from node data.
 * Handles both array format (assumptions[], justifications[]) and
 * single-string format (assumption, justification) from TreeNode export.
 */
export const extractAttributes = (data: NodeData): ExtractedAttributes => {
	const attributes: ExtractedAttributes = {
		context: [],
		assumptions: [],
		justifications: [],
	};

	// Extract context (handles both string[] and ContextItem[])
	if (data.context && Array.isArray(data.context)) {
		attributes.context = data.context.map((item) =>
			typeof item === "string" ? { text: item } : item
		);
	}

	// Extract assumptions (handle both array and single-string formats)
	if (data.assumptions && Array.isArray(data.assumptions)) {
		attributes.assumptions = data.assumptions as ContextItem[];
	} else if (data.assumption && typeof data.assumption === "string") {
		// Handle single-string assumption from TreeNode export
		attributes.assumptions = [{ text: data.assumption }];
	} else if (data.context && Array.isArray(data.context)) {
		// Fallback: check if context items have assumption flag
		const contextItems = data.context.filter(
			(item): item is ContextItem =>
				typeof item === "object" &&
				(item.type === "Assumption" || item.isAssumption === true)
		);
		if (contextItems.length > 0) {
			attributes.assumptions = contextItems;
		}
	}

	// Extract justifications (handle both array and single-string formats)
	if (data.justifications && Array.isArray(data.justifications)) {
		attributes.justifications = data.justifications as ContextItem[];
	} else if (data.justification && typeof data.justification === "string") {
		// Handle single-string justification from TreeNode export
		attributes.justifications = [{ text: data.justification }];
	}

	return attributes;
};

/**
 * Extract metadata from node data
 */
export const extractMetadata = (data: NodeData): ExtractedMetadata => {
	const metadata: ExtractedMetadata = {};

	// Strength
	if (data.strength !== undefined) {
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
	if (data.confidence !== undefined) {
		metadata.confidence = data.confidence;
	}

	return metadata;
};
