"use client";

/**
 * Base Node Component
 *
 * Collapsible/expandable node component with glassmorphism styling.
 * Serves as the foundation for all node types.
 *
 * @module base-node
 */

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import CustomHandle from "../handles/custom-handle";
import {
	contentCollapseVariants,
	nodeEntranceVariants,
	withReducedMotion,
} from "../utils/animations";
import {
	extractAttributes,
	extractMetadata,
	getDisplayName,
	getIdentifier,
	truncateText,
} from "../utils/identifier-utils";
import {
	buildDescriptionClasses,
	buildNodeContainerClasses,
	buildNodeContentClasses,
	buildNodeHeaderClasses,
	buildNodeIconClasses,
	buildNodeTitleClasses,
	buildPreviewTextClasses,
	buildSeparatorClasses,
} from "../utils/node-styles";
import { getNodeIcon, getNodeTypeConfig } from "../utils/theme-config";
import { AttributeContentSection, MetadataSection } from "./attribute-badges";

// ========================================================================
// Type Definitions
// ========================================================================

type NodeData = {
	id?: string;
	name?: string;
	description?: string;
	long_description?: string;
	short_description?: string;
	[key: string]: unknown;
};

type BaseNodeProps = {
	data?: NodeData;
	selected?: boolean;
	isConnectable?: boolean;
	children?: ReactNode;
	nodeType?: string;
	defaultExpanded?: boolean;
	onExpandChange?: (expanded: boolean) => void;
	className?: string;
};

type ActionItem = {
	label: string;
	onClick: () => void;
};

type BaseNodeWithActionsProps = BaseNodeProps & {
	actions?: ActionItem[];
};

type BaseNodeWithMetadataProps = BaseNodeProps & {
	metadata?: Record<string, string | number>;
};

// ========================================================================
// BaseNode Component
// ========================================================================

const BaseNode = ({
	data = {},
	selected = false,
	isConnectable = true,
	children,
	nodeType = "goal",
	defaultExpanded = false,
	onExpandChange,
	className = "",
}: BaseNodeProps) => {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const [isHovered, setIsHovered] = useState(false);

	// Note: onHandleClick would be passed from parent component if needed
	const onHandleClick = undefined;

	// Get node type configuration
	const config = getNodeTypeConfig(nodeType);
	const Icon = getNodeIcon(nodeType);

	// Auto-expand when selected
	useEffect(() => {
		if (selected) {
			setIsExpanded(true);
		}
	}, [selected]);

	// Handle expand/collapse toggle
	const handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		const newExpandedState = !isExpanded;
		setIsExpanded(newExpandedState);
		onExpandChange?.(newExpandedState);
	};

	// Get consolidated description
	const getDescription = (): string =>
		data.description ||
		data.long_description ||
		data.short_description ||
		"No description available";

	// Get display name (name or formatted identifier)
	const displayName = getDisplayName(data, nodeType);

	// Get identifier for footer (uses stored name if it's an identifier pattern, else formats from ID)
	const identifier = getIdentifier(data, nodeType);

	// Extract attributes and metadata
	const attributes = extractAttributes(data);
	const metadata = extractMetadata(data);

	// Apply reduced motion if user prefers
	const entranceVariants = withReducedMotion(nodeEntranceVariants);
	const collapseVariants = withReducedMotion(contentCollapseVariants);

	// Check if attributes section should show
	const hasAttributes =
		attributes.context.length > 0 ||
		attributes.assumptions.length > 0 ||
		attributes.justifications.length > 0;

	// Check if metadata section should show
	const hasMetadata =
		metadata.strength ||
		metadata.status ||
		metadata.priority ||
		metadata.confidence;

	return (
		<>
			{/* Target Handle (if configured for this node type) */}
			{config.showTargetHandle && (
				<CustomHandle
					id={`${data.id}-target`}
					isConnectable={isConnectable}
					nodeData={data}
					nodeId={data.id || ""}
					onHandleClick={onHandleClick}
					position={Position.Top}
					type="target"
				/>
			)}

			{/* Node Container */}
			<motion.div
				animate="visible"
				aria-expanded={isExpanded}
				aria-label={`${config.name} node: ${data.name}`}
				className={cn(
					buildNodeContainerClasses({
						nodeType,
						isSelected: selected,
						isHovered,
						isCollapsed: !isExpanded,
					}),
					className
				)}
				exit="exit"
				initial="hidden"
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				variants={entranceVariants as import("framer-motion").Variants}
				whileHover={{ scale: 1.02 }}
			>
				<Card
					className={cn(
						"bg-transparent",
						"border-0",
						"shadow-none",
						"p-0",
						"overflow-hidden"
					)}
				>
					{/* Header - Always Visible */}
					<div className={buildNodeHeaderClasses(nodeType)}>
						<div className="flex min-w-0 flex-1 items-center gap-2">
							{/* Icon */}
							{Icon && (
								<Icon
									aria-hidden="true"
									className={buildNodeIconClasses(nodeType, isHovered)}
								/>
							)}

							{/* Title (Name or Identifier) */}
							<div className={buildNodeTitleClasses(nodeType)}>
								{displayName}
							</div>
						</div>

						{/* Expand/Collapse Indicator */}
						<motion.button
							aria-label={isExpanded ? "Collapse node" : "Expand node"}
							className="m-0 cursor-pointer border-none bg-transparent p-0 outline-hidden transition-opacity hover:opacity-70"
							onClick={handleToggle}
							onMouseDown={(e) => e.stopPropagation()}
						>
							<motion.div
								animate={{ rotate: isExpanded ? 180 : 0 }}
								transition={{ duration: 0.2 }}
							>
								<ChevronDown
									aria-hidden="true"
									className="h-4 w-4 shrink-0 text-icon-light-secondary"
								/>
							</motion.div>
						</motion.button>
					</div>

					{/* Collapsed State - Truncated Description */}
					{!isExpanded && (
						<motion.div
							animate={{ opacity: 1 }}
							className="px-4 pb-3"
							exit={{ opacity: 0 }}
							initial={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<p className={buildPreviewTextClasses()}>
								{truncateText(getDescription(), 2)}
							</p>
						</motion.div>
					)}

					{/* Expanded State - Full Content */}
					<AnimatePresence>
						{isExpanded && (
							<motion.div
								animate="expanded"
								className="overflow-hidden"
								exit="collapsed"
								initial="collapsed"
								variants={collapseVariants as import("framer-motion").Variants}
							>
								<div className={buildNodeContentClasses(true)}>
									{/* Full Description */}
									<div>
										<p className={buildDescriptionClasses()}>
											{getDescription()}
										</p>
									</div>

									{/* Attributes Section */}
									{hasAttributes && (
										<>
											<div className={buildSeparatorClasses()} />
											<AttributeContentSection attributes={attributes} />
										</>
									)}

									{/* Metadata Section */}
									{hasMetadata && (
										<>
											<div className={buildSeparatorClasses()} />
											<MetadataSection metadata={metadata} />
										</>
									)}

									{/* Custom Content */}
									{children && (
										<>
											<div className={buildSeparatorClasses()} />
											<div className="space-y-2">{children}</div>
										</>
									)}

									{/* Footer: Node Type and Identifier */}
									<div className={buildSeparatorClasses()} />
									<div className="flex items-center justify-between">
										<span className="font-medium text-text-light/50 text-xs uppercase tracking-wider">
											{config.name}
										</span>
										{identifier && (
											<span className="font-mono text-text-light/40 text-xs">
												{identifier}
											</span>
										)}
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</Card>
			</motion.div>

			{/* Source Handle (if configured for this node type) */}
			{config.showSourceHandle && (
				<CustomHandle
					id={`${data.id}-source`}
					isConnectable={isConnectable}
					nodeData={data}
					nodeId={data.id || ""}
					onHandleClick={onHandleClick}
					position={Position.Bottom}
					type="source"
				/>
			)}
		</>
	);
};

// ========================================================================
// BaseNode Variants
// ========================================================================

/**
 * BaseNode with custom action buttons
 */
export const BaseNodeWithActions = ({
	actions = [],
	children,
	...props
}: BaseNodeWithActionsProps) => (
	<BaseNode {...props}>
		{children}
		{actions.length > 0 && (
			<div className="mt-3 flex gap-2">
				{actions.map((action, index) => (
					<button
						className={cn(
							"px-3 py-1.5",
							"text-xs",
							"rounded-md",
							"bg-background-transparent-white-hover",
							"hover:bg-background-transparent-white-secondaryHover",
							"text-text-light",
							"transition-colors",
							"duration-200",
							"border",
							"border-transparent"
						)}
						key={`action-${action.label}-${index}`}
						onClick={(e) => {
							e.stopPropagation();
							action.onClick();
						}}
						type="button"
					>
						{action.label}
					</button>
				))}
			</div>
		)}
	</BaseNode>
);

/**
 * BaseNode with metadata display
 */
export const BaseNodeWithMetadata = ({
	metadata = {},
	children,
	...props
}: BaseNodeWithMetadataProps) => (
	<BaseNode {...props}>
		{children}
		{Object.keys(metadata).length > 0 && (
			<div className="mt-3 space-y-1">
				{Object.entries(metadata).map(([key, value]) => (
					<div className="flex justify-between text-xs" key={key}>
						<span className="text-text-light/50">{key}:</span>
						<span className="font-medium text-text-light/70">{value}</span>
					</div>
				))}
			</div>
		)}
	</BaseNode>
);

/**
 * Compact BaseNode variant (smaller size)
 */
export const CompactBaseNode = (props: BaseNodeProps) => (
	<BaseNode
		{...props}
		className={cn("min-w-[150px]", "max-w-[250px]", props.className)}
	/>
);

/**
 * Large BaseNode variant (larger size)
 */
export const LargeBaseNode = (props: BaseNodeProps) => (
	<BaseNode
		{...props}
		className={cn("min-w-[250px]", "max-w-[500px]", props.className)}
	/>
);

export default BaseNode;
