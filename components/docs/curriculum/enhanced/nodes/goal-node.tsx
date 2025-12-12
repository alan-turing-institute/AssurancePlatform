"use client";

/**
 * GoalNode Component
 *
 * Specialized node type for top-level goals in assurance cases.
 * Features green glassmorphism theme, importance badges, progress tracking,
 * and special root node styling.
 *
 * Features:
 * - Target icon from Lucide React
 * - Green glassmorphism (emerald colour scheme)
 * - Importance/priority badge
 * - Larger default size (expanded: 400px)
 * - Special "root node" styling option
 * - Progress indicator (optional)
 * - No source handle (top-level nodes)
 * - Achievement percentage display
 * - Sub-goals count display
 *
 * @component
 * @example
 * <GoalNode
 *   data={{
 *     id: 'goal-1',
 *     name: 'System Safety',
 *     description: 'System is acceptably safe to operate',
 *     importance: 'critical',
 *     progress: 75,
 *     subGoalsCount: 5,
 *     isRoot: true
 *   }}
 *   selected={false}
 * />
 */

import { motion } from "framer-motion";
import { Layers, Target, TrendingUp } from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CollapsibleNode from "./collapsible-node";

// ========================================================================
// Type Definitions
// ========================================================================

type ImportanceLevel = "critical" | "high" | "medium" | "low";

type ImportanceConfig = {
	label: string;
	className: string;
	icon: string;
};

type ContextItem = {
	name?: string;
	[key: string]: unknown;
};

type GoalNodeData = {
	id?: string;
	name?: string;
	description?: string;
	importance?: ImportanceLevel;
	progress?: number;
	subGoalsCount?: number;
	isRoot?: boolean;
	context?: (ContextItem | string)[];
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

type ProgressIndicatorProps = {
	progress?: number;
	showLabel?: boolean;
};

type ImportanceBadgeProps = {
	importance?: ImportanceLevel;
};

type GoalNodeProps = {
	id?: string;
	data?: GoalNodeData;
	selected?: boolean;
	isConnectable?: boolean;
	className?: string;
	[key: string]: unknown;
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * Progress indicator component for goals
 */
const ProgressIndicator = ({
	progress = 0,
	showLabel = true,
}: ProgressIndicatorProps): React.JSX.Element => {
	const percentage = Math.min(100, Math.max(0, progress));
	const radius = 16;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (percentage / 100) * circumference;

	return (
		<div className="flex items-center gap-2">
			<div className="relative h-10 w-10">
				{/* Background circle */}
				<svg
					aria-label={`Progress indicator showing ${Math.round(percentage)}% completion`}
					className="-rotate-90 h-full w-full transform"
					role="img"
					viewBox="0 0 40 40"
				>
					<circle
						cx="20"
						cy="20"
						fill="none"
						r={radius}
						stroke="rgba(16, 185, 129, 0.2)"
						strokeWidth="3"
					/>
					{/* Progress circle */}
					<motion.circle
						animate={{ strokeDashoffset: offset }}
						cx="20"
						cy="20"
						fill="none"
						initial={{ strokeDashoffset: circumference }}
						r={radius}
						stroke="#10b981"
						strokeDasharray={circumference}
						strokeDashoffset={offset}
						strokeLinecap="round"
						strokeWidth="3"
						transition={{ duration: 0.8, ease: "easeOut" }}
					/>
				</svg>
				{/* Percentage text */}
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="font-semibold text-green-400 text-xs">
						{percentage}%
					</span>
				</div>
			</div>
			{showLabel && <div className="text-text-light/70 text-xs">Progress</div>}
		</div>
	);
};

/**
 * Importance badge with appropriate styling
 */
const ImportanceBadge = ({
	importance = "medium",
}: ImportanceBadgeProps): React.JSX.Element => {
	const importanceConfig: Record<ImportanceLevel, ImportanceConfig> = {
		critical: {
			label: "Critical",
			className: "bg-red-500/20 text-red-300 border-red-400/30",
			icon: "🔴",
		},
		high: {
			label: "High",
			className: "bg-orange-500/20 text-orange-300 border-orange-400/30",
			icon: "🟠",
		},
		medium: {
			label: "Medium",
			className: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
			icon: "🟡",
		},
		low: {
			label: "Low",
			className: "bg-green-500/20 text-green-300 border-green-400/30",
			icon: "🟢",
		},
	};

	const config = importanceConfig[importance] || importanceConfig.medium;

	return (
		<Badge
			className={cn(
				"px-2 py-0.5 text-xs",
				"border",
				"backdrop-blur-sm",
				config.className
			)}
			variant="outline"
		>
			<span className="mr-1">{config.icon}</span>
			{config.label}
		</Badge>
	);
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * GoalNode Component
 */
const GoalNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	...restProps
}: GoalNodeProps): React.JSX.Element => {
	// Extract goal-specific data
	const {
		importance = "medium",
		progress,
		subGoalsCount = 0,
		isRoot = false,
		context = [],
		metadata = {},
	} = data;

	// Determine if we should show progress
	const hasProgress = typeof progress === "number";

	// Build custom className for root nodes
	const rootNodeClasses = isRoot
		? cn(
				"ring-2 ring-green-500/30",
				"shadow-[0_0_20px_rgba(16,185,129,0.3)]",
				"min-w-[300px]",
				"max-w-[450px]"
			)
		: "min-w-[250px] max-w-[400px]";

	return (
		<CollapsibleNode
			className={cn(rootNodeClasses, "goal-node")}
			data={data}
			id={id}
			isConnectable={isConnectable}
			nodeType="goal"
			selected={selected}
			{...restProps}
		>
			{/* Goal-specific expanded content */}
			<div className="space-y-3">
				{/* Importance and Status Row */}
				<div className="flex items-center justify-between gap-2">
					<ImportanceBadge importance={importance} />

					{hasProgress && (
						<ProgressIndicator progress={progress} showLabel={false} />
					)}
				</div>

				{/* Statistics Row */}
				{(subGoalsCount > 0 || hasProgress) && (
					<div className="grid grid-cols-2 gap-2">
						{/* Sub-goals count */}
						{subGoalsCount > 0 && (
							<div className="flex items-center gap-2 rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2">
								<Layers className="h-4 w-4 text-green-400" />
								<div className="flex flex-col">
									<span className="text-text-light/50 text-xs">Sub-goals</span>
									<span className="font-semibold text-green-300 text-sm">
										{subGoalsCount}
									</span>
								</div>
							</div>
						)}

						{/* Progress indicator (if available) */}
						{hasProgress && (
							<div className="flex items-center gap-2 rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2">
								<TrendingUp className="h-4 w-4 text-green-400" />
								<div className="flex flex-col">
									<span className="text-text-light/50 text-xs">Complete</span>
									<span className="font-semibold text-green-300 text-sm">
										{progress}%
									</span>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Root node indicator */}
				{isRoot && (
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className={cn(
							"px-3 py-2",
							"rounded-lg",
							"bg-gradient-to-r from-green-500/20 to-emerald-500/20",
							"border border-green-400/30",
							"text-center"
						)}
						initial={{ opacity: 0, y: -10 }}
						transition={{ delay: 0.2 }}
					>
						<div className="flex items-center justify-center gap-2">
							<Target className="h-4 w-4 text-green-300" />
							<span className="font-medium text-green-200 text-xs">
								Root Goal
							</span>
						</div>
					</motion.div>
				)}

				{/* Context items */}
				{context && context.length > 0 && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Context
						</div>
						<ul className="space-y-1">
							{context.slice(0, 3).map((ctx) => {
								const ctxKey =
									typeof ctx === "string" ? ctx : ctx.name || String(ctx);
								return (
									<li
										className="flex items-start gap-2 text-text-light/70 text-xs"
										key={`ctx-${ctxKey}`}
									>
										<span className="mt-0.5 text-green-400">•</span>
										<span>{ctxKey}</span>
									</li>
								);
							})}
							{context.length > 3 && (
								<li className="text-text-light/50 text-xs italic">
									+ {context.length - 3} more...
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

				{/* Pulse effect for important nodes */}
				{importance === "critical" && (
					<motion.div
						animate={{
							boxShadow: [
								"0 0 0 0 rgba(239, 68, 68, 0)",
								"0 0 0 8px rgba(239, 68, 68, 0.1)",
								"0 0 0 0 rgba(239, 68, 68, 0)",
							],
						}}
						className="pointer-events-none absolute inset-0 rounded-xl"
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							repeatType: "loop",
						}}
					/>
				)}
			</div>
		</CollapsibleNode>
	);
};

// ========================================================================
// Variants
// ========================================================================

/**
 * Compact GoalNode variant for smaller displays
 */
export const CompactGoalNode = (props: GoalNodeProps): React.JSX.Element => (
	<GoalNode
		{...props}
		className={cn("min-w-[200px] max-w-[300px]", props.className)}
	/>
);

/**
 * Large GoalNode variant for emphasized display
 */
export const LargeGoalNode = (props: GoalNodeProps): React.JSX.Element => (
	<GoalNode
		{...props}
		className={cn("min-w-[350px] max-w-[500px]", props.className)}
		data={{ ...props.data, isRoot: true }}
	/>
);

export default GoalNode;
