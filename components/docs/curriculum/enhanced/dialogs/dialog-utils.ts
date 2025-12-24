/**
 * Dialog Utilities
 *
 * Helper functions for dialog state management, validation,
 * draft persistence, and common dialog operations.
 *
 * @module dialogUtils
 */

// Regex at module top level
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Storage keys for persistence
 */
const STORAGE_KEYS = {
	DRAFT: "tea_block_dialog_draft",
	MODE: "tea_block_dialog_mode",
	RECENT_TEMPLATES: "tea_recent_templates",
	DIALOG_PREFERENCES: "tea_dialog_preferences",
} as const;

// ========================================================================
// Type Definitions
// ========================================================================

type DraftData = {
	nodeType: string;
	formData: Record<string, unknown>;
	savedAt?: string;
};

type ValidationErrors = Record<string, string>;

type ValidationResult = {
	isValid: boolean;
	errors: ValidationErrors;
};

type DialogPreferences = {
	showConnectionHints: boolean;
	autoSaveDrafts: boolean;
	defaultQuickMode: boolean;
	rememberLastNodeType: boolean;
	showTemplatePreview: boolean;
	enableKeyboardShortcuts: boolean;
};

type CharacterCountInfo = {
	current: number;
	max: number;
	percentage: number;
	isNearLimit: boolean;
	isOverLimit: boolean;
};

type DialogPosition = {
	centered: boolean;
	offset: {
		x: number;
		y: number;
	};
};

type Position = {
	x: number;
	y: number;
};

type DialogEvent = {
	event: string;
	data: Record<string, unknown>;
	timestamp: string;
};

// ========================================================================
// Draft Management
// ========================================================================

/**
 * Save dialog draft to localStorage
 */
export const saveDraft = (draft: DraftData): void => {
	try {
		const draftWithTimestamp: DraftData = {
			...draft,
			savedAt: new Date().toISOString(),
		};
		localStorage.setItem(
			STORAGE_KEYS.DRAFT,
			JSON.stringify(draftWithTimestamp)
		);
	} catch (error) {
		console.warn("Failed to save draft:", error);
	}
};

/**
 * Load dialog draft from localStorage
 * Returns draft data or null if not found/expired
 */
export const loadDraft = (): DraftData | null => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.DRAFT);
		if (!stored) {
			return null;
		}

		const draft = JSON.parse(stored) as DraftData;

		// Check if draft is expired (older than 24 hours)
		if (draft.savedAt) {
			const savedTime = new Date(draft.savedAt);
			const now = new Date();
			const hoursDiff =
				(now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);

			if (hoursDiff > 24) {
				clearDraft();
				return null;
			}
		}

		return draft;
	} catch (error) {
		console.warn("Failed to load draft:", error);
		return null;
	}
};

/**
 * Clear dialog draft from localStorage
 */
export const clearDraft = (): void => {
	try {
		localStorage.removeItem(STORAGE_KEYS.DRAFT);
	} catch (error) {
		console.warn("Failed to clear draft:", error);
	}
};

/**
 * Check if draft exists
 */
export const hasDraft = (): boolean => {
	const draft = loadDraft();
	return draft !== null && Object.keys(draft.formData || {}).length > 0;
};

// ========================================================================
// Dialog Mode Management
// ========================================================================

/**
 * Save dialog mode preference
 */
export const setDialogMode = (mode: string): void => {
	try {
		localStorage.setItem(STORAGE_KEYS.MODE, mode);
	} catch (error) {
		console.warn("Failed to save dialog mode:", error);
	}
};

/**
 * Get saved dialog mode
 * Returns dialog mode or 'standard' as default
 */
export const getDialogMode = (): string => {
	try {
		return localStorage.getItem(STORAGE_KEYS.MODE) || "standard";
	} catch (error) {
		console.warn("Failed to get dialog mode:", error);
		return "standard";
	}
};

// ========================================================================
// Recent Templates Management
// ========================================================================

/**
 * Save recently used template
 */
export const addRecentTemplate = (templateId: string, maxRecent = 5): void => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TEMPLATES);
		const recent: string[] = stored ? JSON.parse(stored) : [];

		// Remove if already exists and add to front
		const updated = [
			templateId,
			...recent.filter((id) => id !== templateId),
		].slice(0, maxRecent);

		localStorage.setItem(
			STORAGE_KEYS.RECENT_TEMPLATES,
			JSON.stringify(updated)
		);
	} catch (error) {
		console.warn("Failed to save recent template:", error);
	}
};

/**
 * Get recently used templates
 */
export const getRecentTemplates = (): string[] => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.RECENT_TEMPLATES);
		return stored ? JSON.parse(stored) : [];
	} catch (error) {
		console.warn("Failed to get recent templates:", error);
		return [];
	}
};

// ========================================================================
// Dialog Preferences
// ========================================================================

const DEFAULT_PREFERENCES: DialogPreferences = {
	showConnectionHints: true,
	autoSaveDrafts: true,
	defaultQuickMode: false,
	rememberLastNodeType: true,
	showTemplatePreview: true,
	enableKeyboardShortcuts: true,
};

/**
 * Save dialog preferences
 */
export const saveDialogPreferences = (
	preferences: Partial<DialogPreferences>
): void => {
	try {
		localStorage.setItem(
			STORAGE_KEYS.DIALOG_PREFERENCES,
			JSON.stringify(preferences)
		);
	} catch (error) {
		console.warn("Failed to save dialog preferences:", error);
	}
};

/**
 * Load dialog preferences
 * Returns user preferences with defaults
 */
export const loadDialogPreferences = (): DialogPreferences => {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.DIALOG_PREFERENCES);
		return stored
			? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
			: DEFAULT_PREFERENCES;
	} catch (error) {
		console.warn("Failed to load dialog preferences:", error);
		return DEFAULT_PREFERENCES;
	}
};

// ========================================================================
// Form Validation
// ========================================================================

/**
 * Validate date string
 */
const isValidDate = (dateString: string): boolean => {
	const date = new Date(dateString);
	return date instanceof Date && !Number.isNaN(date.getTime());
};

/**
 * Validate URL string
 */
const isValidUrl = (urlString: string): boolean => {
	try {
		new URL(urlString);
		return true;
	} catch {
		return false;
	}
};

/**
 * Validate common fields (name and description)
 */
const validateCommonFields = (
	formData: Record<string, unknown>,
	quickMode: boolean,
	errors: ValidationErrors
): void => {
	if (!formData.name || String(formData.name).trim() === "") {
		errors.name = "Name is required";
	} else if (String(formData.name).length > 100) {
		errors.name = "Name must be 100 characters or less";
	}

	if (!quickMode) {
		if (!formData.description || String(formData.description).trim() === "") {
			errors.description = "Description is required";
		} else if (String(formData.description).length > 500) {
			errors.description = "Description must be 500 characters or less";
		}
	}
};

/**
 * Validate goal-specific fields
 */
const validateGoalFields = (
	formData: Record<string, unknown>,
	errors: ValidationErrors
): void => {
	if (formData.targetDate && !isValidDate(String(formData.targetDate))) {
		errors.targetDate = "Invalid date format";
	}
};

/**
 * Validate evidence-specific fields
 */
const validateEvidenceFields = (
	formData: Record<string, unknown>,
	errors: ValidationErrors
): void => {
	if (formData.link && !isValidUrl(String(formData.link))) {
		errors.link = "Invalid URL format";
	}
	const confidence = Number(formData.confidence);
	if (
		formData.confidence !== undefined &&
		(confidence < 0 || confidence > 100)
	) {
		errors.confidence = "Confidence must be between 0 and 100";
	}
};

/**
 * Validate property claim-specific fields
 */
const validatePropertyClaimFields = (
	formData: Record<string, unknown>,
	errors: ValidationErrors
): void => {
	const strength = Number(formData.strength);
	if (formData.strength !== undefined && (strength < 0 || strength > 100)) {
		errors.strength = "Strength must be between 0 and 100";
	}
};

/**
 * Validate node creation form data
 */
export const validateBlockForm = (
	nodeType: string,
	formData: Record<string, unknown>,
	quickMode = false
): ValidationResult => {
	const errors: ValidationErrors = {};

	// Common validation
	validateCommonFields(formData, quickMode, errors);

	// Type-specific validation
	if (nodeType === "goal") {
		validateGoalFields(formData, errors);
	} else if (nodeType === "evidence") {
		validateEvidenceFields(formData, errors);
	} else if (nodeType === "propertyClaim") {
		validatePropertyClaimFields(formData, errors);
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
	};
};

// ========================================================================
// Form Field Helpers
// ========================================================================

/**
 * Get character count info for text field
 */
export const getCharacterCountInfo = (
	maxLength: number,
	text = ""
): CharacterCountInfo => {
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
 */
export const truncateText = (text: string, maxLength: number): string => {
	if (!text || text.length <= maxLength) {
		return text;
	}
	return text.substring(0, maxLength);
};

/**
 * Sanitize form input
 */
export const sanitizeInput = (input: unknown): unknown => {
	if (typeof input !== "string") {
		return input;
	}

	// Remove leading/trailing whitespace
	let sanitized = input.trim();

	// Replace multiple spaces with single space
	sanitized = sanitized.replace(WHITESPACE_PATTERN, " ");

	return sanitized;
};

// ========================================================================
// Dialog State Helpers
// ========================================================================

/**
 * Generate unique dialog session ID
 */
export const generateSessionId = (): string =>
	`dialog-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

/**
 * Track dialog analytics event
 */
export const trackDialogEvent = (
	eventName: string,
	eventData: Record<string, unknown> = {}
): void => {
	// This could be extended to send to analytics service
	if (process.env.NODE_ENV === "development") {
		console.log(`[Dialog Analytics] ${eventName}:`, eventData);
	}

	// Store in session for debugging
	try {
		const eventsStored = sessionStorage.getItem("dialog_events") || "[]";
		const events: DialogEvent[] = JSON.parse(eventsStored);
		events.push({
			event: eventName,
			data: eventData,
			timestamp: new Date().toISOString(),
		});
		sessionStorage.setItem("dialog_events", JSON.stringify(events.slice(-50))); // Keep last 50
	} catch (error) {
		console.warn("Failed to track dialog event:", error);
	}
};

/**
 * Get dialog analytics data
 */
export const getDialogAnalytics = (): DialogEvent[] => {
	try {
		const stored = sessionStorage.getItem("dialog_events") || "[]";
		return JSON.parse(stored);
	} catch (error) {
		console.warn("Failed to get dialog analytics:", error);
		return [];
	}
};

// ========================================================================
// Position Helpers
// ========================================================================

/**
 * Calculate optimal dialog position based on screen size
 */
export const calculateDialogPosition = (): DialogPosition => {
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
 */
export const isPositionInViewport = (position: Position | null): boolean => {
	if (!position) {
		return false;
	}

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
