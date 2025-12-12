/**
 * Identifier Utilities
 *
 * Functions for formatting and handling node identifiers
 */

// Top-level regex for extracting numbers from IDs
const ID_NUMBER_REGEX = /(\d+)$/;

type NodeType =
	| "goal"
	| "strategy"
	| "propertyClaim"
	| "evidence"
	| "context"
	| string;

type ContextItem = {
	type?: string;
	isAssumption?: boolean;
	[key: string]: unknown;
};

type NodeData = {
	id?: string;
	name?: string;
	context?: ContextItem[];
	assumptions?: unknown[];
	justifications?: unknown[];
	strength?: number | string;
	status?: string;
	priority?: string;
	confidence?: number;
	[key: string]: unknown;
};

type ExtractedAttributes = {
	context: ContextItem[];
	assumptions: ContextItem[];
	justifications: unknown[];
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
 * Get display name for node (name or formatted identifier)
 */
export const getDisplayName = (data: NodeData, nodeType: NodeType): string => {
	if (data.name?.trim()) {
		return data.name;
	}

	// Default to formatted identifier
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
 * Extract attributes from node data
 */
export const extractAttributes = (data: NodeData): ExtractedAttributes => {
	const attributes: ExtractedAttributes = {
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
		attributes.assumptions = data.assumptions as ContextItem[];
	} else if (data.context) {
		// Check if context items have assumption flag
		attributes.assumptions = data.context.filter(
			(item) => item.type === "Assumption" || item.isAssumption
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
