"use client";

/**
 * EvidenceNode Component
 *
 * Specialized node type for evidence in assurance cases.
 * Features cyan glassmorphism theme, evidence type indicators,
 * confidence level display, and source links.
 *
 * Features:
 * - CheckCircle icon from Lucide React
 * - Cyan glassmorphism theme
 * - Evidence type badges (document, test, review, inspection, analysis)
 * - Confidence level indicator
 * - Link to source (if available)
 * - Only target handle (leaf nodes)
 * - Last updated timestamp
 * - Quality rating display
 *
 * @component
 * @example
 * <EvidenceNode
 *   data={{
 *     id: 'evidence-1',
 *     name: 'Test Results Document',
 *     description: 'Comprehensive test results for component X',
 *     evidenceType: 'test',
 *     confidence: 85,
 *     sourceLink: 'https://example.com/test-results.pdf',
 *     lastUpdated: '2025-11-10',
 *     quality: 'high'
 *   }}
 *   selected={false}
 * />
 */

import { motion } from "framer-motion";
import {
	BarChart3,
	CheckCircle,
	Clock,
	ExternalLink,
	Eye,
	FileText,
	FlaskConical,
	Search,
	Star,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CollapsibleNode from "./collapsible-node";

// ========================================================================
// Type Definitions
// ========================================================================

type EvidenceType = "document" | "test" | "review" | "inspection" | "analysis";
type QualityLevel = "high" | "good" | "medium" | "low";

type EvidenceTypeConfig = {
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	className: string;
	description: string;
};

type QualityConfig = {
	stars: number;
	color: string;
};

type EvidenceNodeData = {
	id?: string;
	name?: string;
	description?: string;
	evidenceType?: EvidenceType;
	confidence?: number;
	sourceLink?: string;
	sourceName?: string;
	lastUpdated?: string;
	quality?: QualityLevel;
	author?: string;
	verifiedBy?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

type EvidenceTypeBadgeProps = {
	evidenceType?: EvidenceType;
};

type ConfidenceLevelIndicatorProps = {
	confidence?: number;
};

type QualityRatingProps = {
	quality?: QualityLevel;
};

type SourceLinkProps = {
	sourceLink?: string;
	sourceName?: string;
};

type LastUpdatedDisplayProps = {
	lastUpdated?: string;
};

type EvidenceNodeProps = {
	id?: string;
	data?: EvidenceNodeData;
	selected?: boolean;
	isConnectable?: boolean;
	className?: string;
	[key: string]: unknown;
};

// ========================================================================
// Configuration
// ========================================================================

const evidenceTypeConfig: Record<EvidenceType, EvidenceTypeConfig> = {
	document: {
		label: "Document",
		icon: FileText,
		className: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
		description: "Documentary evidence",
	},
	test: {
		label: "Test",
		icon: FlaskConical,
		className: "bg-blue-500/20 text-blue-300 border-blue-400/30",
		description: "Test results",
	},
	review: {
		label: "Review",
		icon: Eye,
		className: "bg-teal-500/20 text-teal-300 border-teal-400/30",
		description: "Review report",
	},
	inspection: {
		label: "Inspection",
		icon: Search,
		className: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
		description: "Inspection findings",
	},
	analysis: {
		label: "Analysis",
		icon: BarChart3,
		className: "bg-purple-500/20 text-purple-300 border-purple-400/30",
		description: "Analysis results",
	},
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * Evidence type badge
 */
const EvidenceTypeBadge = ({
	evidenceType = "document",
}: EvidenceTypeBadgeProps): React.JSX.Element => {
	const config =
		evidenceTypeConfig[evidenceType] || evidenceTypeConfig.document;
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
 * Confidence level indicator
 */
const ConfidenceLevelIndicator = ({
	confidence = 0,
}: ConfidenceLevelIndicatorProps): React.JSX.Element => {
	const percentage = Math.min(100, Math.max(0, confidence));

	// Determine colour based on confidence level
	let color = "text-red-400";
	let bgColor = "bg-red-500";
	let label = "Low";

	if (percentage >= 80) {
		color = "text-green-400";
		bgColor = "bg-green-500";
		label = "High";
	} else if (percentage >= 60) {
		color = "text-cyan-400";
		bgColor = "bg-cyan-500";
		label = "Good";
	} else if (percentage >= 40) {
		color = "text-yellow-400";
		bgColor = "bg-yellow-500";
		label = "Medium";
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-xs">
				<span className="text-text-light/50">Confidence:</span>
				<span className={cn("font-semibold", color)}>
					{percentage}% ({label})
				</span>
			</div>
			<div className="relative h-2 overflow-hidden rounded-full bg-background-transparent-white-hover">
				<motion.div
					animate={{ width: `${percentage}%` }}
					className={cn("h-full rounded-full", bgColor)}
					initial={{ width: 0 }}
					transition={{ duration: 0.8, ease: "easeOut" }}
				/>
			</div>
		</div>
	);
};

/**
 * Quality rating display
 */
const QualityRating = ({
	quality = "medium",
}: QualityRatingProps): React.JSX.Element => {
	const qualityConfig: Record<QualityLevel, QualityConfig> = {
		high: { stars: 5, color: "text-yellow-400" },
		good: { stars: 4, color: "text-yellow-400" },
		medium: { stars: 3, color: "text-cyan-400" },
		low: { stars: 2, color: "text-gray-400" },
	};

	const config = qualityConfig[quality] || qualityConfig.medium;

	return (
		<div className="flex items-center gap-2">
			<span className="text-text-light/50 text-xs">Quality:</span>
			<div className="flex gap-0.5">
				{[...new Array(5)].map((_, i) => (
					<Star
						className={cn(
							"h-3 w-3",
							i < config.stars ? config.color : "text-gray-600",
							i < config.stars && "fill-current"
						)}
						key={`star-${i + 1}`}
					/>
				))}
			</div>
		</div>
	);
};

/**
 * Source link component
 */
const SourceLink = ({
	sourceLink,
	sourceName,
}: SourceLinkProps): React.JSX.Element | null => {
	if (!sourceLink) {
		return null;
	}

	const displayName = sourceName || "View Source";

	return (
		<a
			className={cn(
				"flex items-center gap-2 px-3 py-2",
				"rounded-lg",
				"border border-cyan-400/20 bg-cyan-500/10",
				"hover:bg-cyan-500/20",
				"transition-colors duration-200",
				"text-cyan-300 hover:text-cyan-200",
				"group"
			)}
			href={sourceLink}
			onClick={(e) => e.stopPropagation()}
			rel="noopener noreferrer"
			target="_blank"
		>
			<ExternalLink className="h-4 w-4 transition-transform group-hover:scale-110" />
			<span className="font-medium text-xs">{displayName}</span>
		</a>
	);
};

/**
 * Last updated display
 */
const LastUpdatedDisplay = ({
	lastUpdated,
}: LastUpdatedDisplayProps): React.JSX.Element | null => {
	if (!lastUpdated) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 text-text-light/50 text-xs">
			<Clock className="h-3.5 w-3.5" />
			<span>Updated: {lastUpdated}</span>
		</div>
	);
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * EvidenceNode Component
 */
const EvidenceNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	...restProps
}: EvidenceNodeProps): React.JSX.Element => {
	// Extract evidence-specific data
	const {
		evidenceType = "document",
		confidence = 75,
		sourceLink,
		sourceName,
		lastUpdated,
		quality = "medium",
		author,
		verifiedBy,
		tags = [],
		metadata = {},
	} = data;

	const hasHighConfidence = confidence >= 80;

	return (
		<CollapsibleNode
			className={cn(
				"min-w-[250px] max-w-[380px]",
				"evidence-node",
				// Cyan glow for selected state
				selected && "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
				// Extra glow for high confidence evidence
				hasHighConfidence && "shadow-[0_0_15px_rgba(34,211,238,0.2)]"
			)}
			data={data}
			id={id}
			isConnectable={isConnectable}
			nodeType="evidence"
			selected={selected}
			{...restProps}
		>
			{/* Evidence-specific expanded content */}
			<div className="space-y-3">
				{/* Evidence Type and Quality Row */}
				<div className="flex items-center justify-between gap-2">
					<EvidenceTypeBadge evidenceType={evidenceType} />
					<QualityRating quality={quality} />
				</div>

				{/* Confidence Level */}
				<ConfidenceLevelIndicator confidence={confidence} />

				{/* Source Link */}
				<SourceLink sourceLink={sourceLink} sourceName={sourceName} />

				{/* Author and Verifier */}
				{(author || verifiedBy) && (
					<div className="space-y-1 text-xs">
						{author && (
							<div className="flex items-center gap-2">
								<FileText className="h-3.5 w-3.5 text-cyan-400/70" />
								<span className="text-text-light/50">Author:</span>
								<span className="font-medium text-text-light/70">{author}</span>
							</div>
						)}
						{verifiedBy && (
							<div className="flex items-center gap-2">
								<CheckCircle className="h-3.5 w-3.5 text-green-400/70" />
								<span className="text-text-light/50">Verified by:</span>
								<span className="font-medium text-text-light/70">
									{verifiedBy}
								</span>
							</div>
						)}
					</div>
				)}

				{/* Last Updated */}
				<LastUpdatedDisplay lastUpdated={lastUpdated} />

				{/* Tags */}
				{tags && tags.length > 0 && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Tags
						</div>
						<div className="flex flex-wrap gap-1">
							{tags.map((tag) => (
								<Badge
									className="border-cyan-400/20 bg-cyan-500/10 px-2 py-0 text-cyan-300 text-xs"
									key={`tag-${tag}`}
									variant="outline"
								>
									{tag}
								</Badge>
							))}
						</div>
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

				{/* High confidence indicator */}
				{hasHighConfidence && (
					<motion.div
						animate={{ scale: 1, opacity: 1 }}
						className="flex items-center justify-center gap-2 rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2"
						initial={{ scale: 0.95, opacity: 0 }}
					>
						<CheckCircle className="h-4 w-4 text-green-400" />
						<span className="font-medium text-green-300 text-xs">
							High Confidence Evidence
						</span>
					</motion.div>
				)}

				{/* Shimmer effect for verified evidence */}
				{hasHighConfidence && (
					<motion.div
						animate={{ x: "100%" }}
						className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
						initial={{ x: "-100%" }}
						transition={{
							duration: 3,
							repeat: Number.POSITIVE_INFINITY,
							repeatDelay: 2,
							ease: "easeInOut",
						}}
					>
						<div
							className="h-full w-1/3"
							style={{
								background:
									"linear-gradient(90deg, transparent, rgba(34,211,238,0.1), transparent)",
							}}
						/>
					</motion.div>
				)}
			</div>
		</CollapsibleNode>
	);
};

// ========================================================================
// Variants
// ========================================================================

/**
 * Compact EvidenceNode variant
 */
export const CompactEvidenceNode = (
	props: EvidenceNodeProps
): React.JSX.Element => (
	<EvidenceNode
		{...props}
		className={cn("min-w-[200px] max-w-[300px]", props.className)}
	/>
);

/**
 * EvidenceNode with high confidence
 */
export const HighConfidenceEvidenceNode = (
	props: EvidenceNodeProps
): React.JSX.Element => (
	<EvidenceNode
		{...props}
		data={{
			...props.data,
			confidence: 95,
			quality: "high",
		}}
	/>
);

/**
 * Test evidence node variant
 */
export const TestEvidenceNode = (
	props: EvidenceNodeProps
): React.JSX.Element => (
	<EvidenceNode
		{...props}
		data={{
			...props.data,
			evidenceType: "test",
		}}
	/>
);

/**
 * Document evidence node variant
 */
export const DocumentEvidenceNode = (
	props: EvidenceNodeProps
): React.JSX.Element => (
	<EvidenceNode
		{...props}
		data={{
			...props.data,
			evidenceType: "document",
		}}
	/>
);

export default EvidenceNode;
