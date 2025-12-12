"use client";

/**
 * StrategyNode Component
 *
 * Specialized node type for strategies in assurance cases.
 * Features purple glassmorphism theme, skewed/tilted design, strategy type badges,
 * and connection path visualisation.
 *
 * Features:
 * - GitBranch icon from Lucide React
 * - Purple glassmorphism (violet colour scheme)
 * - Skewed/tilted design (transform: skewY(-1deg))
 * - Strategy type badge (AND/OR decomposition)
 * - Connection paths visualisation
 * - Both source and target handles
 * - Approach type indicator
 * - Path highlighting support
 *
 * @component
 * @example
 * <StrategyNode
 *   data={{
 *     id: 'strategy-1',
 *     name: 'Decomposition by Components',
 *     description: 'Break down system by major components',
 *     strategyType: 'AND',
 *     approach: 'decomposition',
 *     pathCount: 3
 *   }}
 *   selected={false}
 * />
 */

import { motion } from "framer-motion";
import { Network, Split, Workflow } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CollapsibleNode from "./collapsible-node";

// ========================================================================
// Type Definitions
// ========================================================================

type StrategyType = "AND" | "OR";
type ApproachType =
	| "decomposition"
	| "substitution"
	| "evidence"
	| "assumption";

type StrategyTypeConfig = {
	label: string;
	description: string;
	className: string;
	icon: typeof Split | typeof Network;
};

type ApproachConfig = {
	label: string;
	icon: string;
	description: string;
};

type EvidenceItem = {
	name?: string;
	[key: string]: unknown;
};

type StrategyNodeData = {
	id?: string;
	name?: string;
	description?: string;
	strategyType?: StrategyType;
	approach?: ApproachType;
	pathCount?: number;
	supportingEvidence?: (EvidenceItem | string)[];
	rationale?: string;
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

type StrategyTypeBadgeProps = {
	strategyType?: StrategyType;
};

type ApproachIndicatorProps = {
	approach?: ApproachType;
};

type ConnectionPathsProps = {
	pathCount?: number;
};

type StrategyNodeProps = {
	id?: string;
	data?: StrategyNodeData;
	selected?: boolean;
	isConnectable?: boolean;
	className?: string;
	[key: string]: unknown;
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * Strategy type badge with appropriate styling
 */
const StrategyTypeBadge = ({
	strategyType = "AND",
}: StrategyTypeBadgeProps): React.JSX.Element => {
	const typeConfig: Record<StrategyType, StrategyTypeConfig> = {
		AND: {
			label: "AND",
			description: "All paths must be satisfied",
			className: "bg-purple-500/20 text-purple-300 border-purple-400/30",
			icon: Split,
		},
		OR: {
			label: "OR",
			description: "Any path can satisfy",
			className: "bg-violet-500/20 text-violet-300 border-violet-400/30",
			icon: Network,
		},
	};

	const config = typeConfig[strategyType] || typeConfig.AND;
	const Icon = config.icon;

	return (
		<Badge
			className={cn(
				"px-2 py-0.5 text-xs",
				"border",
				"backdrop-blur-sm",
				config.className
			)}
			title={config.description}
			variant="outline"
		>
			<Icon className="mr-1 h-3 w-3" />
			{config.label}
		</Badge>
	);
};

/**
 * Approach type indicator
 */
const ApproachIndicator = ({
	approach = "decomposition",
}: ApproachIndicatorProps): React.JSX.Element => {
	const approachConfig: Record<ApproachType, ApproachConfig> = {
		decomposition: {
			label: "Decomposition",
			icon: "🔷",
			description: "Break down into smaller parts",
		},
		substitution: {
			label: "Substitution",
			icon: "🔄",
			description: "Replace with equivalent claims",
		},
		evidence: {
			label: "Evidence",
			icon: "📊",
			description: "Direct evidence approach",
		},
		assumption: {
			label: "Assumption",
			icon: "💭",
			description: "Based on assumptions",
		},
	};

	const config = approachConfig[approach] || approachConfig.decomposition;

	return (
		<div className="flex items-center gap-2 text-xs">
			<span>{config.icon}</span>
			<span className="text-text-light/70">{config.label}</span>
		</div>
	);
};

/**
 * Connection paths visualisation
 */
const ConnectionPaths = ({
	pathCount = 0,
}: ConnectionPathsProps): React.JSX.Element | null => {
	if (pathCount === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 rounded-lg border border-purple-400/20 bg-purple-500/10 px-3 py-2">
			<Workflow className="h-4 w-4 text-purple-400" />
			<div className="flex flex-col">
				<span className="text-text-light/50 text-xs">Paths</span>
				<span className="font-semibold text-purple-300 text-sm">
					{pathCount}
				</span>
			</div>
		</div>
	);
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * StrategyNode Component
 */
const StrategyNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	...restProps
}: StrategyNodeProps): React.JSX.Element => {
	// Extract strategy-specific data
	const {
		strategyType = "AND",
		approach = "decomposition",
		pathCount = 0,
		supportingEvidence = [],
		rationale,
		metadata = {},
	} = data;

	return (
		<div className="strategy-node-wrapper">
			{/* Outer skewed container for visual effect */}
			<motion.div
				className="relative"
				style={{
					transform: "skewY(-1deg)",
				}}
				transition={{ duration: 0.2 }}
				whileHover={{
					transform: "skewY(-1.5deg)",
				}}
			>
				{/* Inner container with reverse skew to keep content straight */}
				<div
					style={{
						transform: "skewY(1deg)",
					}}
				>
					<CollapsibleNode
						className={cn(
							"min-w-[250px] max-w-[380px]",
							"strategy-node",
							"relative",
							// Purple glow for selected state
							selected && "shadow-[0_0_20px_rgba(168,85,247,0.3)]"
						)}
						data={data}
						id={id}
						isConnectable={isConnectable}
						nodeType="strategy"
						selected={selected}
						{...restProps}
					>
						{/* Strategy-specific expanded content */}
						<div className="space-y-3">
							{/* Strategy Type and Approach Row */}
							<div className="flex items-center justify-between gap-2">
								<StrategyTypeBadge strategyType={strategyType} />
								<ApproachIndicator approach={approach} />
							</div>

							{/* Connection Paths */}
							{pathCount > 0 && <ConnectionPaths pathCount={pathCount} />}

							{/* Rationale */}
							{rationale && (
								<div className="space-y-1">
									<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
										Rationale
									</div>
									<p className="text-text-light/70 text-xs italic">
										{rationale}
									</p>
								</div>
							)}

							{/* Supporting Evidence */}
							{supportingEvidence && supportingEvidence.length > 0 && (
								<div className="space-y-1">
									<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
										Supporting Evidence
									</div>
									<ul className="space-y-1">
										{supportingEvidence.slice(0, 3).map((evidence) => {
											const evidenceKey =
												typeof evidence === "string"
													? evidence
													: evidence.name || String(evidence);
											return (
												<li
													className="flex items-start gap-2 text-text-light/70 text-xs"
													key={`evidence-${evidenceKey}`}
												>
													<span className="mt-0.5 text-purple-400">→</span>
													<span>{evidenceKey}</span>
												</li>
											);
										})}
										{supportingEvidence.length > 3 && (
											<li className="text-text-light/50 text-xs italic">
												+ {supportingEvidence.length - 3} more...
											</li>
										)}
									</ul>
								</div>
							)}

							{/* Metadata */}
							{Object.keys(metadata).length > 0 && (
								<div className="space-y-1 border-border-transparent/50 border-t pt-2">
									{Object.entries(metadata)
										.slice(0, 3)
										.map(([key, value]) => (
											<div className="flex justify-between text-xs" key={key}>
												<span className="text-text-light/50 capitalize">
													{key.replace(/([A-Z])/g, " $1").trim()}:
												</span>
												<span className="font-medium text-text-light/70">
													{String(value)}
												</span>
											</div>
										))}
								</div>
							)}

							{/* Visual indicator for AND strategy */}
							{strategyType === "AND" && (
								<div className="flex items-center justify-center gap-1 opacity-40">
									<div className="h-px w-8 bg-purple-400" />
									<div className="h-1.5 w-1.5 rounded-full bg-purple-400" />
									<div className="h-px w-8 bg-purple-400" />
								</div>
							)}

							{/* Visual indicator for OR strategy */}
							{strategyType === "OR" && (
								<div className="relative h-8 opacity-40">
									<svg
										aria-label="OR strategy visual indicator showing branching paths"
										className="h-full w-full"
										fill="none"
										role="img"
										viewBox="0 0 100 30"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											d="M 0 15 Q 25 5, 50 15 T 100 15"
											fill="none"
											stroke="rgba(167, 139, 250, 0.6)"
											strokeWidth="2"
										/>
										<path
											d="M 0 15 Q 25 25, 50 15 T 100 15"
											fill="none"
											stroke="rgba(167, 139, 250, 0.6)"
											strokeWidth="2"
										/>
									</svg>
								</div>
							)}
						</div>
					</CollapsibleNode>
				</div>
			</motion.div>

			{/* Decorative gradient border overlay */}
			<motion.div
				animate={{
					opacity: selected ? [0.3, 0.5, 0.3] : 0,
				}}
				className="pointer-events-none absolute inset-0 rounded-xl opacity-0"
				style={{
					background:
						"linear-gradient(45deg, rgba(168,85,247,0.2), rgba(139,92,246,0.2))",
					transform: "skewY(-1deg)",
				}}
				transition={{
					duration: 2,
					repeat: Number.POSITIVE_INFINITY,
					repeatType: "reverse",
				}}
			/>
		</div>
	);
};

// ========================================================================
// Variants
// ========================================================================

/**
 * Compact StrategyNode variant
 */
export const CompactStrategyNode = (
	props: StrategyNodeProps
): React.JSX.Element => (
	<StrategyNode
		{...props}
		className={cn("min-w-[200px] max-w-[300px]", props.className)}
	/>
);

/**
 * StrategyNode with emphasis on decomposition paths
 */
export const DecompositionStrategyNode = (
	props: StrategyNodeProps
): React.JSX.Element => (
	<StrategyNode
		{...props}
		data={{ ...props.data, strategyType: "AND", approach: "decomposition" }}
	/>
);

/**
 * StrategyNode with emphasis on alternative paths
 */
export const AlternativeStrategyNode = (
	props: StrategyNodeProps
): React.JSX.Element => (
	<StrategyNode
		{...props}
		data={{ ...props.data, strategyType: "OR", approach: "substitution" }}
	/>
);

export default StrategyNode;
