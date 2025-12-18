"use client";
/**
 * Attribute Badges Component
 *
 * Badge components for displaying node attributes (context, assumptions, justifications)
 */

import type { LucideIcon } from "lucide-react";
import { AlertCircle, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ========================================================================
// Type Definitions
// ========================================================================

type BaseBadgeProps = {
	icon?: LucideIcon;
	label: string;
	color: string;
	className?: string;
	onClick?: () => void;
};

type CountBadgeProps = {
	count: number;
	onClick?: () => void;
	className?: string;
};

type ValueBadgeProps = {
	className?: string;
};

type StrengthBadgeProps = ValueBadgeProps & {
	strength: string | number;
};

type StatusBadgeProps = ValueBadgeProps & {
	status: string;
};

type PriorityBadgeProps = ValueBadgeProps & {
	priority: string;
};

type AttributesData = {
	context?: unknown[];
	assumptions?: unknown[];
	justifications?: unknown[];
};

type AttributeType = "context" | "assumptions" | "justifications";

type AttributesSectionProps = {
	attributes?: AttributesData;
	onAttributeClick?: (type: AttributeType, items: unknown[]) => void;
	className?: string;
};

type MetadataData = {
	strength?: string | number;
	status?: string;
	priority?: string;
	confidence?: number;
};

type MetadataSectionProps = {
	metadata?: MetadataData;
	className?: string;
};

// ========================================================================
// Regex Patterns (module top-level)
// ========================================================================

const STATUS_NORMALIZE_REGEX = /\s+/g;

// ========================================================================
// Base Badge Component
// ========================================================================

const BaseBadge = ({
	icon: Icon,
	label,
	color,
	className,
	onClick,
}: BaseBadgeProps) => {
	// Use button for clickable, span for non-clickable
	if (onClick) {
		return (
			<button
				className={cn(
					"inline-flex items-center gap-1.5",
					"px-2 py-1",
					"rounded-md",
					"font-medium text-xs",
					"transition-colors duration-200",
					"cursor-pointer hover:opacity-80",
					color,
					className
				)}
				onClick={onClick}
				type="button"
			>
				{Icon && <Icon className="h-3 w-3" />}
				<span>{label}</span>
			</button>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5",
				"px-2 py-1",
				"rounded-md",
				"font-medium text-xs",
				"transition-colors duration-200",
				color,
				className
			)}
		>
			{Icon && <Icon className="h-3 w-3" />}
			<span>{label}</span>
		</span>
	);
};

// ========================================================================
// Specific Badge Components
// ========================================================================

/**
 * Context Badge
 */
export const ContextBadge = ({
	count,
	onClick,
	className,
}: CountBadgeProps) => {
	const label = count > 1 ? `Context (${count})` : "Context";
	return (
		<BaseBadge
			className={className}
			color="bg-blue-500/20 text-blue-300 border border-blue-400/30"
			icon={Info}
			label={label}
			onClick={onClick}
		/>
	);
};

/**
 * Assumption Badge
 */
export const AssumptionBadge = ({
	count,
	onClick,
	className,
}: CountBadgeProps) => {
	const label = count > 1 ? `Assumption (${count})` : "Assumption";
	return (
		<BaseBadge
			className={className}
			color="bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
			icon={AlertCircle}
			label={label}
			onClick={onClick}
		/>
	);
};

/**
 * Justification Badge
 */
export const JustificationBadge = ({
	count,
	onClick,
	className,
}: CountBadgeProps) => {
	const label = count > 1 ? `Justification (${count})` : "Justification";
	return (
		<BaseBadge
			className={className}
			color="bg-purple-500/20 text-purple-300 border border-purple-400/30"
			icon={FileText}
			label={label}
			onClick={onClick}
		/>
	);
};

// ========================================================================
// Color Mappings
// ========================================================================

const strengthColors: Record<string, string> = {
	weak: "bg-red-500/20 text-red-300 border border-red-400/30",
	moderate: "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30",
	strong: "bg-green-500/20 text-green-300 border border-green-400/30",
};

const statusColors: Record<string, string> = {
	pending: "bg-orange-500/20 text-orange-300 border border-orange-400/30",
	"in-progress": "bg-blue-500/20 text-blue-300 border border-blue-400/30",
	complete: "bg-green-500/20 text-green-300 border border-green-400/30",
	approved: "bg-teal-500/20 text-teal-300 border border-teal-400/30",
	rejected: "bg-red-500/20 text-red-300 border border-red-400/30",
};

const priorityEmojis: Record<string, string> = {
	low: "🔵",
	medium: "🟡",
	high: "🔴",
	critical: "🚨",
};

// ========================================================================
// Value Badge Components
// ========================================================================

/**
 * Strength Badge
 */
export const StrengthBadge = ({ strength, className }: StrengthBadgeProps) => {
	const strengthStr = String(strength || "moderate");
	const normalizedStrength = strengthStr.toLowerCase();
	const color = strengthColors[normalizedStrength] ?? strengthColors.moderate;

	return (
		<BaseBadge
			className={className}
			color={color}
			label={`Strength: ${strengthStr}`}
		/>
	);
};

/**
 * Status Badge
 */
export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
	const normalizedStatus = (status || "pending")
		.toLowerCase()
		.replace(STATUS_NORMALIZE_REGEX, "-");
	const color = statusColors[normalizedStatus] ?? statusColors.pending;

	return <BaseBadge className={className} color={color} label={status} />;
};

/**
 * Priority Badge
 */
export const PriorityBadge = ({ priority, className }: PriorityBadgeProps) => {
	const normalizedPriority = (priority || "medium").toLowerCase();
	const emoji = priorityEmojis[normalizedPriority] ?? priorityEmojis.medium;

	return (
		<span className={cn("inline-flex items-center gap-1.5", className)}>
			<span className="text-sm">{emoji}</span>
			<span className="text-text-light/70 text-xs capitalize">{priority}</span>
		</span>
	);
};

// ========================================================================
// Section Components
// ========================================================================

/**
 * Attributes Section Component
 * Displays all attributes (context, assumptions, justifications) in a group
 */
export const AttributesSection = ({
	attributes,
	onAttributeClick,
	className,
}: AttributesSectionProps) => {
	if (!attributes) {
		return null;
	}

	const { context = [], assumptions = [], justifications = [] } = attributes;
	const hasAttributes =
		context.length > 0 || assumptions.length > 0 || justifications.length > 0;

	if (!hasAttributes) {
		return null;
	}

	const handleContextClick = onAttributeClick
		? () => onAttributeClick("context", context)
		: undefined;

	const handleAssumptionsClick = onAttributeClick
		? () => onAttributeClick("assumptions", assumptions)
		: undefined;

	const handleJustificationsClick = onAttributeClick
		? () => onAttributeClick("justifications", justifications)
		: undefined;

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{context.length > 0 && (
				<ContextBadge count={context.length} onClick={handleContextClick} />
			)}
			{assumptions.length > 0 && (
				<AssumptionBadge
					count={assumptions.length}
					onClick={handleAssumptionsClick}
				/>
			)}
			{justifications.length > 0 && (
				<JustificationBadge
					count={justifications.length}
					onClick={handleJustificationsClick}
				/>
			)}
		</div>
	);
};

/**
 * Metadata Section Component
 * Displays metadata (strength, status, priority) in a group
 */
export const MetadataSection = ({
	metadata,
	className,
}: MetadataSectionProps) => {
	if (!metadata) {
		return null;
	}

	const { strength, status, priority, confidence } = metadata;
	const hasMetadata = strength || status || priority || confidence;

	if (!hasMetadata) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			{priority && <PriorityBadge priority={priority} />}
			{strength && <StrengthBadge strength={strength} />}
			{status && <StatusBadge status={status} />}
			{confidence && (
				<span className="text-text-light/60 text-xs">
					Confidence: {confidence}%
				</span>
			)}
		</div>
	);
};

// ========================================================================
// Attribute Content Section (Full Text Display)
// ========================================================================

type AttributeContentItem = { text?: string } | string;

type AttributeContentSectionProps = {
	attributes?: {
		context?: AttributeContentItem[];
		assumptions?: AttributeContentItem[];
		justifications?: AttributeContentItem[];
	};
	isDarkMode?: boolean;
	className?: string;
};

/**
 * Extracts text from an attribute item (handles both {text: string} and plain string)
 */
const getAttributeText = (item: unknown): string => {
	if (typeof item === "string") {
		return item;
	}
	if (item && typeof item === "object" && "text" in item) {
		return String((item as { text: unknown }).text);
	}
	return "";
};

/**
 * Single Attribute Display Component
 * Shows label + text content with consistent readable text colour
 */
const AttributeItem = ({
	icon: Icon,
	label,
	text,
	iconColorClass,
	isDarkMode = false,
}: {
	icon: LucideIcon;
	label: string;
	text: string;
	iconColorClass: string;
	isDarkMode?: boolean;
}) => {
	const labelClass = isDarkMode
		? "font-medium text-gray-400 text-xs uppercase tracking-wider"
		: "font-medium text-gray-500 text-xs uppercase tracking-wider";
	const textClass = isDarkMode
		? "pl-4 text-gray-300 text-xs leading-relaxed"
		: "pl-4 text-gray-700 text-xs leading-relaxed";

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-1.5">
				<Icon className={cn("h-3 w-3", iconColorClass)} />
				<span className={labelClass}>{label}</span>
			</div>
			<p className={textClass}>{text}</p>
		</div>
	);
};

/**
 * Renders a list of attribute items with proper keys based on text content
 */
const renderAttributeItems = (
	items: AttributeContentItem[],
	type: "context" | "assumption" | "justification",
	icon: LucideIcon,
	iconColorClass: string,
	isDarkMode = false
) => {
	// Filter to items with valid text and create stable keys
	const validItems = items
		.map((item, index) => ({
			text: getAttributeText(item),
			index,
		}))
		.filter((item) => item.text.length > 0);

	if (validItems.length === 0) {
		return null;
	}

	const labelMap = {
		context: "Context",
		assumption: "Assumption",
		justification: "Justification",
	};

	return validItems.map((item) => {
		const label =
			validItems.length > 1
				? `${labelMap[type]} ${item.index + 1}`
				: labelMap[type];

		return (
			<AttributeItem
				icon={icon}
				iconColorClass={iconColorClass}
				isDarkMode={isDarkMode}
				key={`${type}-${item.text.slice(0, 20)}-${item.index}`}
				label={label}
				text={item.text}
			/>
		);
	});
};

/**
 * Attribute Content Section Component
 * Displays full text content of attributes (context, assumptions, justifications)
 * Used in expanded node view to show actual attribute text, not just badge counts
 */
export const AttributeContentSection = ({
	attributes,
	isDarkMode = false,
	className,
}: AttributeContentSectionProps) => {
	if (!attributes) {
		return null;
	}

	const { context = [], assumptions = [], justifications = [] } = attributes;
	const hasAttributes =
		context.length > 0 || assumptions.length > 0 || justifications.length > 0;

	if (!hasAttributes) {
		return null;
	}

	return (
		<div className={cn("space-y-3", className)}>
			{renderAttributeItems(
				context,
				"context",
				Info,
				"text-blue-300",
				isDarkMode
			)}
			{renderAttributeItems(
				assumptions,
				"assumption",
				AlertCircle,
				"text-yellow-300",
				isDarkMode
			)}
			{renderAttributeItems(
				justifications,
				"justification",
				FileText,
				"text-purple-300",
				isDarkMode
			)}
		</div>
	);
};

export default {
	ContextBadge,
	AssumptionBadge,
	JustificationBadge,
	StrengthBadge,
	StatusBadge,
	PriorityBadge,
	AttributesSection,
	AttributeContentSection,
	MetadataSection,
};
