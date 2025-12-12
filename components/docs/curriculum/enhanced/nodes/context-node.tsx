"use client";

/**
 * ContextNode Component
 *
 * Specialized node type for contextual information and assumptions in assurance cases.
 * Features subtle gray glassmorphism theme, importance levels, info tooltips,
 * and special positioning support.
 *
 * Features:
 * - AlertCircle icon from Lucide React
 * - Subtle gray glassmorphism theme
 * - Smaller default size (more compact)
 * - Info tooltip on hover
 * - Can be attached to any node type
 * - Special positioning (often to the side)
 * - Importance level indicator
 * - Related nodes indicator
 * - Assumption/constraint type badges
 *
 * @component
 * @example
 * <ContextNode
 *   data={{
 *     id: 'context-1',
 *     name: 'Operating Environment',
 *     description: 'System operates in controlled environment',
 *     contextType: 'assumption',
 *     importance: 'high',
 *     relatedNodesCount: 2
 *   }}
 *   selected={false}
 * />
 */

import { AnimatePresence, motion } from "framer-motion";
import {
	AlertTriangle,
	CheckCircle2,
	Info,
	Link2,
	MessageSquare,
	Shield,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CollapsibleNode from "./collapsible-node";

// ========================================================================
// Type Definitions
// ========================================================================

type ContextType = "assumption" | "constraint" | "justification" | "definition";
type ImportanceLevel = "critical" | "high" | "medium" | "low";

type ContextTypeConfig = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	className: string;
	description: string;
};

type ImportanceConfig = {
	label: string;
	color: string;
	bgColor: string;
	borderColor: string;
	icon: string;
};

type ContextNodeData = {
	id?: string;
	name?: string;
	description?: string;
	contextType?: ContextType;
	importance?: ImportanceLevel;
	relatedNodesCount?: number;
	tooltipContent?: string;
	validity?: string;
	scope?: string;
	implications?: string[];
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

type ContextTypeBadgeProps = {
	contextType?: ContextType;
};

type ImportanceLevelIndicatorProps = {
	importance?: ImportanceLevel;
};

type RelatedNodesIndicatorProps = {
	count?: number;
};

type InfoTooltipProps = {
	content?: string;
	children: React.ReactNode;
};

type ContextNodeProps = {
	id?: string;
	data?: ContextNodeData;
	selected?: boolean;
	isConnectable?: boolean;
	className?: string;
	[key: string]: unknown;
};

// ========================================================================
// Configuration
// ========================================================================

const contextTypeConfig: Record<ContextType, ContextTypeConfig> = {
	assumption: {
		label: "Assumption",
		icon: AlertTriangle,
		className: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
		description: "Assumed condition",
	},
	constraint: {
		label: "Constraint",
		icon: Shield,
		className: "bg-red-500/20 text-red-300 border-red-400/30",
		description: "System constraint",
	},
	justification: {
		label: "Justification",
		icon: MessageSquare,
		className: "bg-blue-500/20 text-blue-300 border-blue-400/30",
		description: "Justification note",
	},
	definition: {
		label: "Definition",
		icon: Info,
		className: "bg-gray-500/20 text-gray-300 border-gray-400/30",
		description: "Term definition",
	},
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * Context type badge
 */
const ContextTypeBadge = ({
	contextType = "assumption",
}: ContextTypeBadgeProps): React.JSX.Element => {
	const config = contextTypeConfig[contextType] || contextTypeConfig.assumption;
	const Icon = config.icon;

	return (
		<Badge
			className={cn(
				"px-2 py-0.5 text-xs",
				"border",
				"backdrop-blur-xs",
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
 * Importance level indicator
 */
const ImportanceLevelIndicator = ({
	importance = "medium",
}: ImportanceLevelIndicatorProps): React.JSX.Element => {
	const importanceConfig: Record<ImportanceLevel, ImportanceConfig> = {
		critical: {
			label: "Critical",
			color: "text-red-400",
			bgColor: "bg-red-500/20",
			borderColor: "border-red-400/30",
			icon: "🔴",
		},
		high: {
			label: "High",
			color: "text-orange-400",
			bgColor: "bg-orange-500/20",
			borderColor: "border-orange-400/30",
			icon: "🟠",
		},
		medium: {
			label: "Medium",
			color: "text-yellow-400",
			bgColor: "bg-yellow-500/20",
			borderColor: "border-yellow-400/30",
			icon: "🟡",
		},
		low: {
			label: "Low",
			color: "text-gray-400",
			bgColor: "bg-gray-500/20",
			borderColor: "border-gray-400/30",
			icon: "⚪",
		},
	};

	const config = importanceConfig[importance] || importanceConfig.medium;

	return (
		<div
			className={cn(
				"inline-flex items-center gap-2 rounded px-2 py-1 text-xs",
				config.bgColor,
				"border",
				config.borderColor
			)}
		>
			<span>{config.icon}</span>
			<span className={config.color}>{config.label}</span>
		</div>
	);
};

/**
 * Related nodes indicator
 */
const RelatedNodesIndicator = ({
	count = 0,
}: RelatedNodesIndicatorProps): React.JSX.Element | null => {
	if (count === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 rounded-lg border border-gray-400/20 bg-gray-500/10 px-3 py-2">
			<Link2 className="h-4 w-4 text-gray-400" />
			<div className="flex flex-col">
				<span className="text-text-light/50 text-xs">Applies to</span>
				<span className="font-semibold text-gray-300 text-sm">
					{count} {count === 1 ? "node" : "nodes"}
				</span>
			</div>
		</div>
	);
};

/**
 * Info tooltip component
 */
const InfoTooltip = ({
	content,
	children,
}: InfoTooltipProps): React.JSX.Element => {
	const [isVisible, setIsVisible] = useState(false);

	return (
		// biome-ignore lint/a11y/noNoninteractiveElementInteractions: Tooltip wrapper requires mouse events for hover behaviour
		// biome-ignore lint/a11y/noStaticElementInteractions: Tooltip wrapper needs hover interaction
		<div
			className="relative inline-flex"
			onMouseEnter={() => setIsVisible(true)}
			onMouseLeave={() => setIsVisible(false)}
		>
			{children}
			<AnimatePresence>
				{isVisible && content && (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className={cn(
							"-translate-x-1/2 absolute bottom-full left-1/2 mb-2",
							"rounded-lg px-3 py-2",
							"bg-background-transparent-black-secondaryAlt",
							"border border-gray-400/30",
							"backdrop-blur-lg",
							"text-text-light text-xs",
							"max-w-xs",
							"z-50",
							"pointer-events-none",
							"whitespace-normal"
						)}
						exit={{ opacity: 0, y: 5 }}
						initial={{ opacity: 0, y: 5 }}
						transition={{ duration: 0.2 }}
					>
						{content}
						<div
							className="-translate-x-1/2 -mt-1 absolute top-full left-1/2"
							style={{
								width: 0,
								height: 0,
								borderLeft: "6px solid transparent",
								borderRight: "6px solid transparent",
								borderTop: "6px solid rgba(0, 0, 0, 0.85)",
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * ContextNode Component
 */
const ContextNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	...restProps
}: ContextNodeProps): React.JSX.Element => {
	// Extract context-specific data
	const {
		contextType = "assumption",
		importance = "medium",
		relatedNodesCount = 0,
		tooltipContent,
		validity,
		scope,
		implications = [],
		metadata = {},
	} = data;

	const isCritical = importance === "critical";

	return (
		<CollapsibleNode
			className={cn(
				"min-w-[200px] max-w-[320px]",
				"context-node",
				// Subtle glow for selected state
				selected && "shadow-[0_0_15px_rgba(156,163,175,0.2)]",
				// Warning glow for critical context
				isCritical && "shadow-[0_0_15px_rgba(239,68,68,0.2)]"
			)}
			data={data}
			id={id}
			isConnectable={isConnectable}
			nodeType="context"
			selected={selected}
			{...restProps}
		>
			{/* Context-specific expanded content */}
			<div className="space-y-3">
				{/* Context Type and Importance Row */}
				<div className="flex flex-wrap items-center justify-between gap-2">
					<ContextTypeBadge contextType={contextType} />
					<ImportanceLevelIndicator importance={importance} />
				</div>

				{/* Info tooltip trigger */}
				{tooltipContent && (
					<InfoTooltip content={tooltipContent}>
						<div
							className={cn(
								"flex items-center gap-2 px-3 py-2",
								"cursor-help rounded-lg",
								"border border-blue-400/20 bg-blue-500/10",
								"transition-colors hover:bg-blue-500/20"
							)}
						>
							<Info className="h-4 w-4 text-blue-400" />
							<span className="text-blue-300 text-xs">Hover for details</span>
						</div>
					</InfoTooltip>
				)}

				{/* Related Nodes */}
				<RelatedNodesIndicator count={relatedNodesCount} />

				{/* Validity */}
				{validity && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Validity
						</div>
						<div className="flex items-start gap-2 text-xs">
							<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
							<span className="text-text-light/70">{validity}</span>
						</div>
					</div>
				)}

				{/* Scope */}
				{scope && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Scope
						</div>
						<p className="text-text-light/70 text-xs">{scope}</p>
					</div>
				)}

				{/* Implications */}
				{implications && implications.length > 0 && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Implications
						</div>
						<ul className="space-y-1">
							{implications.slice(0, 3).map((implication) => (
								<li
									className="flex items-start gap-2 text-text-light/70 text-xs"
									key={`implication-${implication}`}
								>
									<span className="mt-0.5 text-gray-400">→</span>
									<span>{implication}</span>
								</li>
							))}
							{implications.length > 3 && (
								<li className="text-text-light/50 text-xs italic">
									+ {implications.length - 3} more...
								</li>
							)}
						</ul>
					</div>
				)}

				{/* Additional Metadata */}
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

				{/* Critical context warning */}
				{isCritical && (
					<motion.div
						animate={{
							opacity: [0.7, 1, 0.7],
						}}
						className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2"
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							repeatType: "reverse",
						}}
					>
						<AlertTriangle className="h-4 w-4 text-red-400" />
						<span className="font-medium text-red-300 text-xs">
							Critical Context
						</span>
					</motion.div>
				)}

				{/* Context type specific visual indicator */}
				{contextType === "assumption" && (
					<div className="flex items-center justify-center gap-2 text-text-light/40 text-xs">
						<div className="h-px w-8 bg-yellow-400/30" />
						<span className="text-yellow-400/50">Assumed</span>
						<div className="h-px w-8 bg-yellow-400/30" />
					</div>
				)}

				{contextType === "constraint" && (
					<div className="flex items-center justify-center gap-2 text-text-light/40 text-xs">
						<div className="h-px w-8 bg-red-400/30" />
						<span className="text-red-400/50">Limited</span>
						<div className="h-px w-8 bg-red-400/30" />
					</div>
				)}
			</div>
		</CollapsibleNode>
	);
};

// ========================================================================
// Variants
// ========================================================================

/**
 * Compact ContextNode variant (even smaller)
 */
export const CompactContextNode = (
	props: ContextNodeProps
): React.JSX.Element => (
	<ContextNode
		{...props}
		className={cn("min-w-[150px] max-w-[250px]", props.className)}
	/>
);

/**
 * ContextNode for assumptions
 */
export const AssumptionContextNode = (
	props: ContextNodeProps
): React.JSX.Element => (
	<ContextNode
		{...props}
		data={{
			...props.data,
			contextType: "assumption",
		}}
	/>
);

/**
 * ContextNode for constraints
 */
export const ConstraintContextNode = (
	props: ContextNodeProps
): React.JSX.Element => (
	<ContextNode
		{...props}
		data={{
			...props.data,
			contextType: "constraint",
		}}
	/>
);

/**
 * ContextNode for justifications
 */
export const JustificationContextNode = (
	props: ContextNodeProps
): React.JSX.Element => (
	<ContextNode
		{...props}
		data={{
			...props.data,
			contextType: "justification",
		}}
	/>
);

/**
 * Critical ContextNode with emphasis
 */
export const CriticalContextNode = (
	props: ContextNodeProps
): React.JSX.Element => (
	<ContextNode
		{...props}
		data={{
			...props.data,
			importance: "critical",
		}}
	/>
);

export default ContextNode;
