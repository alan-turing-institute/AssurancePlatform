/**
 * Feature Configuration
 *
 * Centralised configuration for EnhancedInteractiveCaseViewer features.
 * Allows gradual adoption and easy toggling of enhanced features.
 *
 * @module featureConfig
 */

/**
 * Default feature flags
 */
export type FeatureConfig = {
	// Core features
	enableCollapsible: boolean;
	enableContextMenus: boolean;
	enableNodeCreation: boolean;
	enableAnimations: boolean;
	enableEnhancedEdges: boolean;

	// Node features
	enableNodeDragging: boolean;
	enableNodeSelection: boolean;
	enableMultiSelection: boolean;
	enableNodeDeletion: boolean;
	enableNodeDuplication: boolean;

	// Edge features
	enableEdgeSelection: boolean;
	enableEdgeAnimation: boolean;
	enableEdgeStyling: boolean;
	enableEdgeDeletion: boolean;

	// Interaction features
	enableDoubleClickCreate: boolean;
	enableRightClickMenu: boolean;
	enableKeyboardShortcuts: boolean;
	enablePanZoom: boolean;
	enableMinimap: boolean;
	enableControls: boolean;

	// Progressive disclosure
	enableExploration: boolean;
	enableAutoReveal: boolean;
	enablePathHighlighting: boolean;

	// Visual features
	enableGlassmorphism: boolean;
	enableHandleDecorators: boolean;
	enableEdgeLabels: boolean;
	enableNodeTooltips: boolean;

	// Performance features
	enableVirtualization: boolean;
	enableLazyLoading: boolean;
	enableDebounce: boolean;

	// Persistence features
	enableStatePersistence: boolean;
	enableLayoutPersistence: boolean;
	enablePreferences: boolean;
};

export const DEFAULT_FEATURES: FeatureConfig = {
	// Core features
	enableCollapsible: true,
	enableContextMenus: true,
	enableNodeCreation: true,
	enableAnimations: true,
	enableEnhancedEdges: true,

	// Node features
	enableNodeDragging: true,
	enableNodeSelection: true,
	enableMultiSelection: true,
	enableNodeDeletion: true,
	enableNodeDuplication: true,

	// Edge features
	enableEdgeSelection: true,
	enableEdgeAnimation: true,
	enableEdgeStyling: true,
	enableEdgeDeletion: true,

	// Interaction features
	enableDoubleClickCreate: true,
	enableRightClickMenu: true,
	enableKeyboardShortcuts: true,
	enablePanZoom: true,
	enableMinimap: true,
	enableControls: true,

	// Progressive disclosure
	enableExploration: true,
	enableAutoReveal: false,
	enablePathHighlighting: true,

	// Visual features
	enableGlassmorphism: true,
	enableHandleDecorators: true,
	enableEdgeLabels: false,
	enableNodeTooltips: false,

	// Performance features
	enableVirtualization: false,
	enableLazyLoading: false,
	enableDebounce: true,

	// Persistence features
	enableStatePersistence: true,
	enableLayoutPersistence: true,
	enablePreferences: true,
};

/**
 * Feature presets for common use cases
 */
export const FEATURE_PRESETS: Record<string, FeatureConfig> = {
	/**
	 * Full feature set (default)
	 */
	full: {
		...DEFAULT_FEATURES,
	},

	/**
	 * Read-only viewer (no editing)
	 */
	readonly: {
		...DEFAULT_FEATURES,
		enableNodeCreation: false,
		enableNodeDeletion: false,
		enableNodeDuplication: false,
		enableEdgeDeletion: false,
		enableContextMenus: false,
		enableDoubleClickCreate: false,
		enableRightClickMenu: false,
	},

	/**
	 * Minimal viewer (basic features only)
	 */
	minimal: {
		enableCollapsible: false,
		enableContextMenus: false,
		enableNodeCreation: false,
		enableAnimations: false,
		enableEnhancedEdges: false,
		enableNodeDragging: false,
		enableNodeSelection: true,
		enableMultiSelection: false,
		enableNodeDeletion: false,
		enableNodeDuplication: false,
		enableEdgeSelection: false,
		enableEdgeAnimation: false,
		enableEdgeStyling: false,
		enableEdgeDeletion: false,
		enableDoubleClickCreate: false,
		enableRightClickMenu: false,
		enableKeyboardShortcuts: false,
		enablePanZoom: true,
		enableMinimap: false,
		enableControls: true,
		enableExploration: true,
		enableAutoReveal: false,
		enablePathHighlighting: false,
		enableGlassmorphism: false,
		enableHandleDecorators: false,
		enableEdgeLabels: false,
		enableNodeTooltips: false,
		enableVirtualization: false,
		enableLazyLoading: false,
		enableDebounce: false,
		enableStatePersistence: false,
		enableLayoutPersistence: false,
		enablePreferences: false,
	},

	/**
	 * Interactive viewer (read-only but with exploration)
	 */
	interactive: {
		...DEFAULT_FEATURES,
		enableNodeCreation: false,
		enableNodeDeletion: false,
		enableNodeDuplication: false,
		enableEdgeDeletion: false,
		enableNodeDragging: false,
		enableContextMenus: false,
		enableDoubleClickCreate: false,
		enableRightClickMenu: false,
	},

	/**
	 * Editor mode (full editing capabilities)
	 */
	editor: {
		...DEFAULT_FEATURES,
		enableNodeCreation: true,
		enableNodeDeletion: true,
		enableNodeDuplication: true,
		enableEdgeDeletion: true,
		enableContextMenus: true,
		enableDoubleClickCreate: true,
		enableRightClickMenu: true,
		enableKeyboardShortcuts: true,
	},

	/**
	 * Presentation mode (optimised for display)
	 */
	presentation: {
		...DEFAULT_FEATURES,
		enableNodeCreation: false,
		enableNodeDeletion: false,
		enableNodeDuplication: false,
		enableEdgeDeletion: false,
		enableContextMenus: false,
		enableDoubleClickCreate: false,
		enableRightClickMenu: false,
		enableKeyboardShortcuts: false,
		enableMinimap: false,
		enableControls: false,
		enableNodeDragging: false,
		enablePathHighlighting: true,
		enableAnimations: true,
	},

	/**
	 * Performance mode (optimised for large graphs)
	 */
	performance: {
		...DEFAULT_FEATURES,
		enableAnimations: false,
		enableGlassmorphism: false,
		enableEdgeAnimation: false,
		enableVirtualization: true,
		enableLazyLoading: true,
		enableDebounce: true,
		enableMinimap: false,
	},

	/**
	 * Accessibility mode (optimised for screen readers)
	 */
	accessibility: {
		...DEFAULT_FEATURES,
		enableAnimations: false,
		enableGlassmorphism: false,
		enableEdgeAnimation: false,
		enableNodeTooltips: true,
		enableEdgeLabels: true,
		enableKeyboardShortcuts: true,
	},
};

/**
 * Get feature configuration
 *
 * @param preset - Preset name or custom config
 * @param overrides - Additional overrides
 * @returns Feature configuration
 */
export const getFeatureConfig = (
	preset: string | Partial<FeatureConfig> = "full",
	overrides: Partial<FeatureConfig> = {}
): FeatureConfig => {
	let config: FeatureConfig;

	if (typeof preset === "string") {
		config = FEATURE_PRESETS[preset] || FEATURE_PRESETS.full;
	} else if (typeof preset === "object") {
		config = { ...DEFAULT_FEATURES, ...preset };
	} else {
		config = FEATURE_PRESETS.full;
	}

	return {
		...config,
		...overrides,
	};
};

type ValidationResult = {
	isValid: boolean;
	errors: string[];
	warnings: string[];
};

/**
 * Validate feature configuration
 *
 * @param config - Feature configuration
 * @returns Validation result
 */
export const validateFeatureConfig = (
	config: Partial<FeatureConfig>
): ValidationResult => {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check if all keys are valid
	const validKeys = Object.keys(DEFAULT_FEATURES);
	for (const key of Object.keys(config)) {
		if (!validKeys.includes(key)) {
			warnings.push(`Unknown feature flag: ${key}`);
		}
	}

	// Check for conflicting settings
	if (
		config.enableNodeCreation &&
		!config.enableContextMenus &&
		!config.enableDoubleClickCreate
	) {
		warnings.push("Node creation enabled but no creation UI is enabled");
	}

	if (config.enableEdgeDeletion && !config.enableEdgeSelection) {
		warnings.push("Edge deletion enabled but edge selection is disabled");
	}

	if (config.enableVirtualization && config.enableAnimations) {
		warnings.push("Virtualisation and animations may conflict");
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
};

/**
 * Merge feature configurations
 *
 * @param configs - Configurations to merge
 * @returns Merged configuration
 */
export const mergeFeatureConfigs = (
	...configs: Partial<FeatureConfig>[]
): FeatureConfig => {
	const result = { ...DEFAULT_FEATURES };
	for (const config of configs) {
		Object.assign(result, config);
	}
	return result as FeatureConfig;
};

type ReactFlowProps = {
	nodesDraggable: boolean;
	nodesConnectable: boolean;
	elementsSelectable: boolean;
	selectNodesOnDrag: boolean;
	panOnDrag: [number, number] | false;
	zoomOnScroll: boolean;
	zoomOnPinch: boolean;
	zoomOnDoubleClick: boolean;
	deleteKeyCode: string | null;
	multiSelectionKeyCode: string | null;
	snapToGrid: boolean;
	snapGrid: [number, number];
	fitView: boolean;
	fitViewOptions: { padding: number };
	minZoom: number;
	maxZoom: number;
	defaultViewport: { x: number; y: number; zoom: number };
	attributionPosition: string;
};

/**
 * Get feature flags as React Flow props
 *
 * @param config - Feature configuration
 * @returns React Flow props
 */
export const getReactFlowProps = (config: FeatureConfig): ReactFlowProps => ({
	nodesDraggable: config.enableNodeDragging,
	nodesConnectable: config.enableNodeCreation,
	elementsSelectable: config.enableNodeSelection || config.enableEdgeSelection,
	selectNodesOnDrag: config.enableMultiSelection,
	panOnDrag: config.enablePanZoom ? [1, 2] : false,
	zoomOnScroll: config.enablePanZoom,
	zoomOnPinch: config.enablePanZoom,
	zoomOnDoubleClick: !config.enableDoubleClickCreate && config.enablePanZoom,
	deleteKeyCode: config.enableNodeDeletion ? "Delete" : null,
	multiSelectionKeyCode: config.enableMultiSelection ? "Shift" : null,
	snapToGrid: false,
	snapGrid: [15, 15],
	fitView: true,
	fitViewOptions: { padding: 0.2 },
	minZoom: 0.2,
	maxZoom: 4,
	defaultViewport: { x: 0, y: 0, zoom: 1 },
	attributionPosition: "bottom-left",
});

/**
 * Feature capability matrix
 * Documents which features require which other features
 */
export const FEATURE_DEPENDENCIES: Record<string, string[]> = {
	enableNodeCreation: ["enableContextMenus", "enableDoubleClickCreate"],
	enableNodeDeletion: ["enableNodeSelection", "enableContextMenus"],
	enableNodeDuplication: ["enableNodeSelection", "enableContextMenus"],
	enableEdgeDeletion: ["enableEdgeSelection", "enableContextMenus"],
	enableMultiSelection: ["enableNodeSelection"],
	enableKeyboardShortcuts: ["enableNodeSelection"],
	enableCollapsible: ["enableAnimations"],
	enableHandleDecorators: ["enableEnhancedEdges"],
};

type DependencyCheck = {
	isMet: boolean;
	missing: string[];
};

/**
 * Check if a feature's dependencies are met
 *
 * @param feature - Feature name
 * @param config - Feature configuration
 * @returns Dependency check result
 */
export const checkFeatureDependencies = (
	feature: string,
	config: Partial<FeatureConfig>
): DependencyCheck => {
	const dependencies = FEATURE_DEPENDENCIES[feature] || [];
	const missing = dependencies.filter(
		(dep) => !config[dep as keyof FeatureConfig]
	);

	return {
		isMet: missing.length === 0,
		missing,
	};
};

/**
 * Auto-fix feature configuration dependencies
 *
 * @param config - Feature configuration
 * @returns Fixed configuration
 */
export const autoFixDependencies = (config: FeatureConfig): FeatureConfig => {
	const fixed = { ...config };

	for (const feature of Object.keys(FEATURE_DEPENDENCIES)) {
		if (fixed[feature as keyof FeatureConfig]) {
			const deps = FEATURE_DEPENDENCIES[feature];
			// Check if ANY dependency is met (not all required)
			const hasAnyDep = deps.some((dep) => fixed[dep as keyof FeatureConfig]);
			if (!hasAnyDep && deps.length > 0) {
				// Enable first dependency
				fixed[deps[0] as keyof FeatureConfig] = true as never;
			}
		}
	}

	return fixed;
};

/**
 * Get feature description
 *
 * @param feature - Feature name
 * @returns Description
 */
export const getFeatureDescription = (feature: string): string => {
	const descriptions: Record<string, string> = {
		enableCollapsible:
			"Allow nodes to collapse/expand showing different levels of detail",
		enableContextMenus:
			"Enable right-click context menus for nodes, edges, and canvas",
		enableNodeCreation:
			"Allow creating new nodes via double-click or context menu",
		enableAnimations: "Enable smooth animations and transitions",
		enableEnhancedEdges: "Use enhanced edge types with advanced styling",
		enableNodeDragging: "Allow dragging nodes to reposition them",
		enableNodeSelection: "Allow selecting nodes by clicking",
		enableMultiSelection: "Allow selecting multiple nodes with Shift key",
		enableNodeDeletion: "Allow deleting nodes via keyboard or context menu",
		enableNodeDuplication: "Allow duplicating nodes via context menu",
		enableEdgeSelection: "Allow selecting edges by clicking",
		enableEdgeAnimation: "Enable animated edges",
		enableEdgeStyling: "Allow changing edge styles via context menu",
		enableEdgeDeletion: "Allow deleting edges via context menu",
		enableDoubleClickCreate: "Create nodes by double-clicking canvas",
		enableRightClickMenu: "Show context menu on right-click",
		enableKeyboardShortcuts: "Enable keyboard shortcuts for common actions",
		enablePanZoom: "Allow panning and zooming the canvas",
		enableMinimap: "Show minimap for navigation",
		enableControls: "Show zoom and fit controls",
		enableExploration: "Enable progressive disclosure exploration mode",
		enableAutoReveal: "Automatically reveal connected nodes",
		enablePathHighlighting: "Highlight guided path edges",
		enableGlassmorphism: "Use glassmorphism effects on nodes",
		enableHandleDecorators: "Show + decorators on node handles",
		enableEdgeLabels: "Show labels on edges",
		enableNodeTooltips: "Show tooltips on node hover",
		enableVirtualization: "Only render visible elements for performance",
		enableLazyLoading: "Lazy load node content for performance",
		enableDebounce: "Debounce expensive operations",
		enableStatePersistence: "Persist node expand/collapse state",
		enableLayoutPersistence: "Persist node positions",
		enablePreferences: "Save user preferences",
	};

	return descriptions[feature] || "No description available";
};

type ExportData = {
	version: string;
	metadata: {
		exportDate: string;
		[key: string]: unknown;
	};
	features: Partial<FeatureConfig>;
};

/**
 * Export configuration to JSON
 *
 * @param config - Feature configuration
 * @param metadata - Additional metadata
 * @returns JSON string
 */
export const exportConfig = (
	config: Partial<FeatureConfig>,
	metadata: Record<string, unknown> = {}
): string =>
	JSON.stringify(
		{
			version: "1.0",
			metadata: {
				exportDate: new Date().toISOString(),
				...metadata,
			},
			features: config,
		} as ExportData,
		null,
		2
	);

/**
 * Import configuration from JSON
 *
 * @param jsonString - JSON string
 * @returns Feature configuration
 */
export const importConfig = (jsonString: string): FeatureConfig => {
	try {
		const data = JSON.parse(jsonString) as ExportData;
		return { ...DEFAULT_FEATURES, ...data.features };
	} catch (error) {
		console.error("Error importing config:", error);
		return DEFAULT_FEATURES;
	}
};

// Default export
export default {
	DEFAULT_FEATURES,
	FEATURE_PRESETS,
	getFeatureConfig,
	validateFeatureConfig,
	mergeFeatureConfigs,
	getReactFlowProps,
	FEATURE_DEPENDENCIES,
	checkFeatureDependencies,
	autoFixDependencies,
	getFeatureDescription,
	exportConfig,
	importConfig,
};
