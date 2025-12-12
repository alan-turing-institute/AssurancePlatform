/**
 * Edges Index
 *
 * Central export point for all edge components.
 *
 * @module edges
 */

import type { Edge } from "reactflow";

// AnimatedEdge and variants
export {
	default as AnimatedEdge,
	FastAnimatedEdge,
	GlowAnimatedEdge,
	PulseAnimatedEdge,
	SlowAnimatedEdge,
	ThicknessAnimatedEdge,
} from "./animated-edge";
// Edge Demo
export { default as EdgeDemo, SimpleEdgeShowcase } from "./edge-demo";
// Edge utilities (TypeScript)
export * from "./edge-utils";
// FlowingEdge and variants
export {
	BidirectionalFlowEdge,
	DataStreamEdge,
	default as FlowingEdge,
	FastFlowEdge,
	HeavyTrafficEdge,
	LightTrafficEdge,
	PulseFlowEdge,
	SlowFlowEdge,
	TrailFlowEdge,
} from "./flowing-edge";
// GlowingEdge and variants
export {
	ActiveDataFlowEdge,
	BreathingGlowEdge,
	default as GlowingEdge,
	ErrorGlowEdge,
	IntenseGlowEdge,
	NeonEdge,
	SoftGlowEdge,
	SuccessGlowEdge,
	WarningGlowEdge,
} from "./glowing-edge";
// GradientEdge and variants
export {
	default as GradientEdge,
	PulsingGradientEdge,
	RadialGradientEdge,
	RainbowGradientEdge,
	ShimmerGradientEdge,
	TemperatureGradientEdge,
} from "./gradient-edge";
// SmartEdge and variants
export {
	ActivityEdge,
	AdaptivePathEdge,
	AssociationEdge,
	DependencyEdge,
	default as SmartEdge,
	InfoEdge,
	InheritanceEdge,
	StrongConnectionEdge,
	TypedSmartEdge,
	WeakConnectionEdge,
} from "./smart-edge";

// Import for dynamic edge types
import AnimatedEdge, {
	FastAnimatedEdge,
	GlowAnimatedEdge,
	PulseAnimatedEdge,
	SlowAnimatedEdge,
	ThicknessAnimatedEdge,
} from "./animated-edge";
import FlowingEdge, {
	BidirectionalFlowEdge,
	DataStreamEdge,
	FastFlowEdge,
	HeavyTrafficEdge,
	LightTrafficEdge,
	PulseFlowEdge,
	SlowFlowEdge,
	TrailFlowEdge,
} from "./flowing-edge";
import GlowingEdge, {
	ActiveDataFlowEdge,
	BreathingGlowEdge,
	ErrorGlowEdge,
	IntenseGlowEdge,
	NeonEdge,
	SoftGlowEdge,
	SuccessGlowEdge,
	WarningGlowEdge,
} from "./glowing-edge";
import GradientEdge, {
	PulsingGradientEdge,
	RadialGradientEdge,
	RainbowGradientEdge,
	ShimmerGradientEdge,
	TemperatureGradientEdge,
} from "./gradient-edge";
import SmartEdge, {
	ActivityEdge,
	AdaptivePathEdge,
	AssociationEdge,
	DependencyEdge,
	InfoEdge,
	InheritanceEdge,
	StrongConnectionEdge,
	TypedSmartEdge,
	WeakConnectionEdge,
} from "./smart-edge";

/**
 * Edge type definitions for React Flow
 * Use this object to register edge types with React Flow
 */
export const edgeTypes = {
	// Animated edges
	animated: AnimatedEdge,
	fastAnimated: FastAnimatedEdge,
	slowAnimated: SlowAnimatedEdge,
	pulseAnimated: PulseAnimatedEdge,
	glowAnimated: GlowAnimatedEdge,
	thicknessAnimated: ThicknessAnimatedEdge,

	// Gradient edges
	gradient: GradientEdge,
	rainbowGradient: RainbowGradientEdge,
	pulsingGradient: PulsingGradientEdge,
	radialGradient: RadialGradientEdge,
	shimmerGradient: ShimmerGradientEdge,
	temperatureGradient: TemperatureGradientEdge,

	// Glowing edges
	glowing: GlowingEdge,
	neon: NeonEdge,
	softGlow: SoftGlowEdge,
	intenseGlow: IntenseGlowEdge,
	activeDataFlow: ActiveDataFlowEdge,
	errorGlow: ErrorGlowEdge,
	successGlow: SuccessGlowEdge,
	warningGlow: WarningGlowEdge,
	breathingGlow: BreathingGlowEdge,

	// Flowing edges
	flowing: FlowingEdge,
	fastFlow: FastFlowEdge,
	slowFlow: SlowFlowEdge,
	heavyTraffic: HeavyTrafficEdge,
	lightTraffic: LightTrafficEdge,
	bidirectionalFlow: BidirectionalFlowEdge,
	dataStream: DataStreamEdge,
	pulseFlow: PulseFlowEdge,
	trailFlow: TrailFlowEdge,

	// Smart edges
	smart: SmartEdge,
	strongConnection: StrongConnectionEdge,
	weakConnection: WeakConnectionEdge,
	typedSmart: TypedSmartEdge,
	dependency: DependencyEdge,
	inheritance: InheritanceEdge,
	association: AssociationEdge,
	adaptivePath: AdaptivePathEdge,
	info: InfoEdge,
	activity: ActivityEdge,
};

/**
 * Default edge options for React Flow
 * Provides sensible defaults for all edge types
 */
export const defaultEdgeOptions = {
	animated: true,
	type: "smart",
	style: {
		strokeWidth: 2,
	},
	data: {
		showLabel: true,
		strength: 0.7,
	},
};

type EdgeStylePreset = {
	type: string;
	animated?: boolean;
	data: Record<string, unknown>;
};

/**
 * Edge style presets
 * Common configurations for different use cases
 */
export const edgeStylePresets: Record<string, EdgeStylePreset> = {
	// Default modern style
	modern: {
		type: "smart",
		animated: true,
		data: {
			showStrengthIndicator: true,
			pathType: "auto",
		},
	},

	// High-traffic data flow
	dataFlow: {
		type: "flowing",
		data: {
			particleCount: 5,
			flowSpeed: 1.2,
			showDirectionIndicators: true,
		},
	},

	// Elegant gradient
	elegant: {
		type: "gradient",
		data: {
			gradientStops: 3,
			animateGradient: true,
			strokeWidth: 3,
		},
	},

	// Neon cyberpunk style
	neon: {
		type: "neon",
		data: {
			glowIntensity: 1.5,
			pulse: true,
			strokeWidth: 2,
		},
	},

	// Minimal clean style
	minimal: {
		type: "animated",
		data: {
			animated: false,
			strokeWidth: 1.5,
			showLabel: false,
		},
	},

	// Active connection
	active: {
		type: "activeDataFlow",
		data: {
			glowIntensity: 1.5,
			pulse: true,
			flowIntensity: 1,
		},
	},

	// Error state
	error: {
		type: "errorGlow",
		data: {
			state: "error",
			pulse: true,
		},
	},

	// Success state
	success: {
		type: "successGlow",
		data: {
			state: "success",
			pulse: false,
		},
	},

	// Strong relationship
	strong: {
		type: "strongConnection",
		data: {
			strength: 1,
			strokeWidth: 3,
			showStrengthIndicator: true,
		},
	},

	// Weak relationship
	weak: {
		type: "weakConnection",
		data: {
			strength: 0.3,
			strokeWidth: 1.5,
			showStrengthIndicator: true,
		},
	},
};

/**
 * Helper function to apply edge preset
 */
export function applyEdgePreset(edge: Edge, presetName: string): Edge {
	const preset = edgeStylePresets[presetName];
	if (!preset) {
		console.warn(`Edge preset "${presetName}" not found`);
		return edge;
	}

	return {
		...edge,
		type: preset.type,
		animated: preset.animated,
		data: {
			...edge.data,
			...preset.data,
		},
	};
}

/**
 * Helper function to create edge with type
 */
export function createEdge(
	source: string,
	target: string,
	type = "smart",
	data: Record<string, unknown> = {}
): Edge {
	return {
		id: `${source}-${target}`,
		source,
		target,
		type,
		data,
	};
}

type EdgeConnection = {
	source: string;
	target: string;
	type?: string;
	data?: Record<string, unknown>;
};

/**
 * Helper function to create edges from node connections
 */
export function createEdges(connections: EdgeConnection[]): Edge[] {
	return connections.map(({ source, target, type = "smart", data = {} }) =>
		createEdge(source, target, type, data)
	);
}
