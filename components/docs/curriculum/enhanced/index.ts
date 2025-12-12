"use client";

/**
 * Enhanced React Flow Components
 *
 * Main export point for all enhanced React Flow components including nodes,
 * handles, and utilities. Inspired by FloraFauna.ai interface design.
 *
 * @module enhanced
 */

// Animation System
export * from "./animations";

// Demo Components
export * from "./demos";
// Dialog Components - explicitly avoid utility re-exports to prevent collisions with utils/truncateText
export {
	AddBlockDialog,
	AddBlockDialogDemo,
	addRecentTemplate,
	BlockForm,
	BlockPreview,
	BlockTemplates,
	CreateNodeDialog,
	CreateNodePopover,
	calculateDialogPosition,
	// Export dialog utils (except truncateText which is in utils/identifier-utils)
	clearDraft,
	generateSessionId,
	getCharacterCountInfo,
	getDialogAnalytics,
	getDialogMode,
	getRecentTemplates,
	hasDraft,
	isPositionInViewport,
	loadDialogPreferences,
	loadDraft,
	sanitizeInput,
	saveDialogPreferences,
	saveDraft,
	setDialogMode,
	trackDialogEvent,
	validateBlockForm,
} from "./dialogs";
// Edge Components - explicitly avoid utility re-exports to prevent collisions
export {
	ActiveDataFlowEdge,
	ActivityEdge,
	AdaptivePathEdge,
	AnimatedEdge,
	AssociationEdge,
	applyEdgePreset,
	BidirectionalFlowEdge,
	BreathingGlowEdge,
	createEdge,
	createEdges,
	DataStreamEdge,
	DependencyEdge,
	defaultEdgeOptions,
	EdgeDemo,
	ErrorGlowEdge,
	edgeStylePresets,
	edgeTypes,
	FastAnimatedEdge,
	FastFlowEdge,
	FlowingEdge,
	GlowAnimatedEdge,
	GlowingEdge,
	GradientEdge,
	HeavyTrafficEdge,
	InfoEdge,
	InheritanceEdge,
	IntenseGlowEdge,
	LightTrafficEdge,
	NeonEdge,
	PulseAnimatedEdge,
	PulseFlowEdge,
	PulsingGradientEdge,
	RadialGradientEdge,
	RainbowGradientEdge,
	ShimmerGradientEdge,
	SimpleEdgeShowcase,
	SlowAnimatedEdge,
	SlowFlowEdge,
	SmartEdge,
	SoftGlowEdge,
	StrongConnectionEdge,
	SuccessGlowEdge,
	TemperatureGradientEdge,
	ThicknessAnimatedEdge,
	TrailFlowEdge,
	TypedSmartEdge,
	WarningGlowEdge,
	WeakConnectionEdge,
} from "./edges";
// Re-export the debounce utility from edges (canonical source)
export { debounce } from "./edges/edge-utils";
// Handle Components - explicitly avoid utility re-exports to prevent collisions
export {
	AnimatedHandle,
	CustomHandle,
	MultiHandle,
	SmartHandle,
} from "./handles";
// Interaction Components - explicitly avoid utility re-exports to prevent collisions
export {
	DoubleClickHandler,
	NodePositioner,
	useDoubleClickHandler,
	useNodePositioner,
	withDoubleClickHandler,
} from "./interactions";
// Menu Components (Context Menus)
export * from "./menus";
// Node Components
export * from "./nodes";
// Utility Functions
export * from "./utils";
