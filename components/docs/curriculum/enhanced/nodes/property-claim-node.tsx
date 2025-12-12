"use client";

/**
 * PropertyClaimNode Component
 *
 * Specialized node type for property claims in assurance cases.
 * Features orange glassmorphism theme, claim strength indicators,
 * verification status badges, and metadata display.
 *
 * Features:
 * - FileText icon from Lucide React
 * - Orange glassmorphism (amber colour scheme)
 * - Claim strength indicator
 * - Verification status badge
 * - Metadata display (author, date)
 * - Both source and target handles
 * - Linked evidence count
 * - Confidence level display
 *
 * @component
 * @example
 * <PropertyClaimNode
 *   data={{
 *     id: 'claim-1',
 *     name: 'Component X is safe',
 *     description: 'Component X operates within safe parameters',
 *     strength: 'strong',
 *     verificationStatus: 'verified',
 *     linkedEvidenceCount: 3,
 *     author: 'John Doe',
 *     date: '2025-11-10'
 *   }}
 *   selected={false}
 * />
 */

import { motion } from "framer-motion";
import {
	AlertTriangle,
	Calendar,
	CheckCircle,
	Clock,
	Link2,
	User,
} from "lucide-react";
import type React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CollapsibleNode from "./collapsible-node";

// ========================================================================
// Type Definitions
// ========================================================================

type VerificationStatus = "verified" | "in-review" | "pending" | "challenged";
type ClaimStrength = "strong" | "moderate" | "weak";

type StatusConfig = {
	label: string;
	className: string;
	icon: React.ComponentType<{ className?: string }>;
};

type StrengthConfig = {
	label: string;
	bars: number;
	color: string;
};

type MetadataItem = {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string;
};

type ClaimItem = {
	name?: string;
	[key: string]: unknown;
};

type PropertyClaimNodeData = {
	id?: string;
	name?: string;
	description?: string;
	strength?: ClaimStrength;
	verificationStatus?: VerificationStatus;
	linkedEvidenceCount?: number;
	author?: string;
	date?: string;
	reviewer?: string;
	lastUpdated?: string;
	assumptions?: (ClaimItem | string)[];
	relatedClaims?: (ClaimItem | string)[];
	metadata?: Record<string, unknown>;
	[key: string]: unknown;
};

type VerificationStatusBadgeProps = {
	status?: VerificationStatus;
};

type ClaimStrengthIndicatorProps = {
	strength?: ClaimStrength;
};

type LinkedEvidenceCounterProps = {
	count?: number;
};

type MetadataDisplayProps = {
	author?: string;
	date?: string;
	reviewer?: string;
	lastUpdated?: string;
};

type PropertyClaimNodeProps = {
	id?: string;
	data?: PropertyClaimNodeData;
	selected?: boolean;
	isConnectable?: boolean;
	className?: string;
	[key: string]: unknown;
};

// ========================================================================
// Sub-Components
// ========================================================================

/**
 * Verification status badge with appropriate styling
 */
const VerificationStatusBadge = ({
	status = "pending",
}: VerificationStatusBadgeProps): React.JSX.Element => {
	const statusConfig: Record<VerificationStatus, StatusConfig> = {
		verified: {
			label: "Verified",
			className: "bg-green-500/20 text-green-300 border-green-400/30",
			icon: CheckCircle,
		},
		"in-review": {
			label: "In Review",
			className: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
			icon: Clock,
		},
		pending: {
			label: "Pending",
			className: "bg-orange-500/20 text-orange-300 border-orange-400/30",
			icon: Clock,
		},
		challenged: {
			label: "Challenged",
			className: "bg-red-500/20 text-red-300 border-red-400/30",
			icon: AlertTriangle,
		},
	};

	const config = statusConfig[status] || statusConfig.pending;
	const Icon = config.icon;

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
			<Icon className="mr-1 h-3 w-3" />
			{config.label}
		</Badge>
	);
};

/**
 * Claim strength indicator
 */
const ClaimStrengthIndicator = ({
	strength = "moderate",
}: ClaimStrengthIndicatorProps): React.JSX.Element => {
	const strengthConfig: Record<ClaimStrength, StrengthConfig> = {
		strong: {
			label: "Strong",
			bars: 5,
			color: "bg-green-500",
		},
		moderate: {
			label: "Moderate",
			bars: 3,
			color: "bg-orange-400",
		},
		weak: {
			label: "Weak",
			bars: 1,
			color: "bg-red-400",
		},
	};

	const config = strengthConfig[strength] || strengthConfig.moderate;

	return (
		<div className="space-y-1">
			<div className="text-text-light/50 text-xs">
				Strength:{" "}
				<span className="font-medium text-text-light/70">{config.label}</span>
			</div>
			<div className="flex gap-1">
				{[...new Array(5)].map((_, i) => (
					<div
						className={cn(
							"h-1.5 w-4 rounded-full transition-all duration-300",
							i < config.bars
								? config.color
								: "bg-background-transparent-white-hover"
						)}
						key={`bar-${i + 1}`}
					/>
				))}
			</div>
		</div>
	);
};

/**
 * Linked evidence counter
 */
const LinkedEvidenceCounter = ({
	count = 0,
}: LinkedEvidenceCounterProps): React.JSX.Element | null => {
	if (count === 0) {
		return null;
	}

	return (
		<div className="flex items-center gap-2 rounded-lg border border-orange-400/20 bg-orange-500/10 px-3 py-2">
			<Link2 className="h-4 w-4 text-orange-400" />
			<div className="flex flex-col">
				<span className="text-text-light/50 text-xs">Evidence</span>
				<span className="font-semibold text-orange-300 text-sm">
					{count} {count === 1 ? "item" : "items"}
				</span>
			</div>
		</div>
	);
};

/**
 * Metadata display component
 */
const MetadataDisplay = ({
	author,
	date,
	reviewer,
	lastUpdated,
}: MetadataDisplayProps): React.JSX.Element | null => {
	const items: MetadataItem[] = [];

	if (author) {
		items.push({
			icon: User,
			label: "Author",
			value: author,
		});
	}

	if (date) {
		items.push({
			icon: Calendar,
			label: "Created",
			value: date,
		});
	}

	if (reviewer) {
		items.push({
			icon: User,
			label: "Reviewer",
			value: reviewer,
		});
	}

	if (lastUpdated) {
		items.push({
			icon: Clock,
			label: "Updated",
			value: lastUpdated,
		});
	}

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2">
			{items.map((item) => {
				const Icon = item.icon;
				return (
					<div
						className="flex items-center gap-2 text-xs"
						key={`meta-${item.label}`}
					>
						<Icon className="h-3.5 w-3.5 text-orange-400/70" />
						<span className="text-text-light/50">{item.label}:</span>
						<span className="font-medium text-text-light/70">{item.value}</span>
					</div>
				);
			})}
		</div>
	);
};

// ========================================================================
// Main Component
// ========================================================================

/**
 * PropertyClaimNode Component
 */
const PropertyClaimNode = ({
	id,
	data = {},
	selected = false,
	isConnectable = true,
	...restProps
}: PropertyClaimNodeProps): React.JSX.Element => {
	// Extract property claim-specific data
	const {
		strength = "moderate",
		verificationStatus = "pending",
		linkedEvidenceCount = 0,
		author,
		date,
		reviewer,
		lastUpdated,
		assumptions = [],
		relatedClaims = [],
		metadata = {},
	} = data;

	return (
		<CollapsibleNode
			className={cn(
				"min-w-[250px] max-w-[380px]",
				"property-claim-node",
				// Orange glow for selected state
				selected && "shadow-[0_0_20px_rgba(251,146,60,0.3)]"
			)}
			data={data}
			id={id}
			isConnectable={isConnectable}
			nodeType="propertyClaim"
			selected={selected}
			{...restProps}
		>
			{/* PropertyClaim-specific expanded content */}
			<div className="space-y-3">
				{/* Status and Strength Row */}
				<div className="flex items-center justify-between gap-2">
					<VerificationStatusBadge status={verificationStatus} />
					<div className="text-text-light/50 text-xs">
						{strength &&
							`${strength.charAt(0).toUpperCase() + strength.slice(1)} claim`}
					</div>
				</div>

				{/* Claim Strength Indicator */}
				<ClaimStrengthIndicator strength={strength} />

				{/* Linked Evidence Counter */}
				<LinkedEvidenceCounter count={linkedEvidenceCount} />

				{/* Metadata */}
				<MetadataDisplay
					author={author}
					date={date}
					lastUpdated={lastUpdated}
					reviewer={reviewer}
				/>

				{/* Assumptions */}
				{assumptions && assumptions.length > 0 && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Assumptions
						</div>
						<ul className="space-y-1">
							{assumptions.slice(0, 2).map((assumption) => {
								const assumptionKey =
									typeof assumption === "string"
										? assumption
										: assumption.name || String(assumption);
								return (
									<li
										className="flex items-start gap-2 text-text-light/70 text-xs"
										key={`assumption-${assumptionKey}`}
									>
										<span className="mt-0.5 text-orange-400">▸</span>
										<span>{assumptionKey}</span>
									</li>
								);
							})}
							{assumptions.length > 2 && (
								<li className="text-text-light/50 text-xs italic">
									+ {assumptions.length - 2} more...
								</li>
							)}
						</ul>
					</div>
				)}

				{/* Related Claims */}
				{relatedClaims && relatedClaims.length > 0 && (
					<div className="space-y-1">
						<div className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
							Related Claims
						</div>
						<ul className="space-y-1">
							{relatedClaims.slice(0, 2).map((claim) => {
								const claimKey =
									typeof claim === "string"
										? claim
										: claim.name || String(claim);
								return (
									<li
										className="flex items-start gap-2 text-text-light/70 text-xs"
										key={`claim-${claimKey}`}
									>
										<Link2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-orange-400" />
										<span>{claimKey}</span>
									</li>
								);
							})}
							{relatedClaims.length > 2 && (
								<li className="text-text-light/50 text-xs italic">
									+ {relatedClaims.length - 2} more...
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

				{/* Verification indicator animation for verified claims */}
				{verificationStatus === "verified" && (
					<motion.div
						animate={{ scale: 1, opacity: 1 }}
						className="flex items-center justify-center gap-2 rounded-lg border border-green-400/20 bg-green-500/10 px-3 py-2"
						initial={{ scale: 0.95, opacity: 0 }}
					>
						<CheckCircle className="h-4 w-4 text-green-400" />
						<span className="font-medium text-green-300 text-xs">
							Verification Complete
						</span>
					</motion.div>
				)}

				{/* Challenge indicator for challenged claims */}
				{verificationStatus === "challenged" && (
					<motion.div
						animate={{
							boxShadow: [
								"0 0 0 0 rgba(239, 68, 68, 0)",
								"0 0 0 6px rgba(239, 68, 68, 0.1)",
								"0 0 0 0 rgba(239, 68, 68, 0)",
							],
						}}
						className="flex items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2"
						transition={{
							duration: 2,
							repeat: Number.POSITIVE_INFINITY,
							repeatType: "loop",
						}}
					>
						<AlertTriangle className="h-4 w-4 text-red-400" />
						<span className="font-medium text-red-300 text-xs">
							Requires Attention
						</span>
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
 * Compact PropertyClaimNode variant
 */
export const CompactPropertyClaimNode = (
	props: PropertyClaimNodeProps
): React.JSX.Element => (
	<PropertyClaimNode
		{...props}
		className={cn("min-w-[200px] max-w-[300px]", props.className)}
	/>
);

/**
 * PropertyClaimNode with verification emphasis
 */
export const VerifiedPropertyClaimNode = (
	props: PropertyClaimNodeProps
): React.JSX.Element => (
	<PropertyClaimNode
		{...props}
		data={{
			...props.data,
			verificationStatus: "verified",
			strength: "strong",
		}}
	/>
);

/**
 * PropertyClaimNode requiring review
 */
export const PendingPropertyClaimNode = (
	props: PropertyClaimNodeProps
): React.JSX.Element => (
	<PropertyClaimNode
		{...props}
		data={{
			...props.data,
			verificationStatus: "in-review",
		}}
	/>
);

export default PropertyClaimNode;
