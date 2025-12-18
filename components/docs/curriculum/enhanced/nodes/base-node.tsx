"use client";

/**
 * Base Node Component
 *
 * Collapsible/expandable node component with theme-aware styling.
 * Serves as the foundation for all node types.
 *
 * @module base-node
 */

import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { Position } from "reactflow";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NodeActionToolbar } from "../dialogs/node-action-toolbar";
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
import type { NodeDataUpdate } from "../utils/theme-config";
import {
	getNodeIcon,
	getNodeTypeConfig,
	useThemeContext,
} from "../utils/theme-config";
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
	context?: string[];
	assumption?: string;
	justification?: string;
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
// Custom Hooks (extracted to reduce complexity)
// ========================================================================

const useHoverState = () => {
	const [isHovered, setIsHovered] = useState(false);
	const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearHoverTimeout = useCallback(() => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current);
			hoverTimeoutRef.current = null;
		}
	}, []);

	const handleMouseEnter = useCallback(() => {
		clearHoverTimeout();
		setIsHovered(true);
	}, [clearHoverTimeout]);

	const handleMouseLeave = useCallback(() => {
		hoverTimeoutRef.current = setTimeout(() => {
			setIsHovered(false);
		}, 200);
	}, []);

	const handleHoverChange = useCallback(
		(hovered: boolean) => {
			if (hovered) {
				clearHoverTimeout();
				setIsHovered(true);
			} else {
				hoverTimeoutRef.current = setTimeout(() => {
					setIsHovered(false);
				}, 200);
			}
		},
		[clearHoverTimeout]
	);

	return { isHovered, handleMouseEnter, handleMouseLeave, handleHoverChange };
};

// ========================================================================
// Helper Functions
// ========================================================================

const getNodeDescription = (data: NodeData): string =>
	data.description ||
	data.long_description ||
	data.short_description ||
	"No description available";

const computeHasAttributes = (
	attributes: ReturnType<typeof extractAttributes>
): boolean =>
	attributes.context.length > 0 ||
	attributes.assumptions.length > 0 ||
	attributes.justifications.length > 0;

const computeHasMetadata = (
	metadata: ReturnType<typeof extractMetadata>
): boolean =>
	!!(
		metadata.strength ||
		metadata.status ||
		metadata.priority ||
		metadata.confidence
	);

// ========================================================================
// Sub-Components (extracted to reduce complexity)
// ========================================================================

type NodeHeaderProps = {
	nodeType: string;
	displayName: string;
	isExpanded: boolean;
	isHovered: boolean;
	isDarkMode: boolean;
	Icon: LucideIcon | null;
	onToggle: (e: React.MouseEvent) => void;
};

const NodeHeader = ({
	nodeType,
	displayName,
	isExpanded,
	isHovered,
	isDarkMode,
	Icon,
	onToggle,
}: NodeHeaderProps) => {
	const chevronClass = isDarkMode
		? "h-4 w-4 shrink-0 text-gray-400"
		: "h-4 w-4 shrink-0 text-gray-500";

	return (
		<div className={buildNodeHeaderClasses(nodeType)}>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{Icon && (
					<Icon
						aria-hidden="true"
						className={buildNodeIconClasses(nodeType, isHovered)}
					/>
				)}
				<div className={buildNodeTitleClasses(nodeType, isDarkMode)}>
					{displayName}
				</div>
			</div>
			<motion.button
				aria-label={isExpanded ? "Collapse node" : "Expand node"}
				className="m-0 cursor-pointer border-none bg-transparent p-0 outline-hidden transition-opacity hover:opacity-70"
				onClick={onToggle}
				onMouseDown={(e) => e.stopPropagation()}
			>
				<motion.div
					animate={{ rotate: isExpanded ? 180 : 0 }}
					transition={{ duration: 0.2 }}
				>
					<ChevronDown aria-hidden="true" className={chevronClass} />
				</motion.div>
			</motion.button>
		</div>
	);
};

type NodeFooterProps = {
	configName: string;
	identifier: string | null;
	isDarkMode: boolean;
};

const NodeFooter = ({
	configName,
	identifier,
	isDarkMode,
}: NodeFooterProps) => {
	const footerLabelClass = isDarkMode
		? "font-medium text-gray-400 text-xs uppercase tracking-wider"
		: "font-medium text-gray-500 text-xs uppercase tracking-wider";
	const footerIdClass = isDarkMode
		? "font-mono text-gray-500 text-xs"
		: "font-mono text-gray-400 text-xs";

	return (
		<div className="flex items-center justify-between">
			<span className={footerLabelClass}>{configName}</span>
			{identifier && <span className={footerIdClass}>{identifier}</span>}
		</div>
	);
};

type ExpandedContentProps = {
	description: string;
	isDarkMode: boolean;
	hasAttributes: boolean;
	hasMetadata: boolean;
	attributes: ReturnType<typeof extractAttributes>;
	metadata: ReturnType<typeof extractMetadata>;
	configName: string;
	identifier: string | null;
	children?: ReactNode;
};

const ExpandedContent = ({
	description,
	isDarkMode,
	hasAttributes,
	hasMetadata,
	attributes,
	metadata,
	configName,
	identifier,
	children,
}: ExpandedContentProps) => (
	<div className={buildNodeContentClasses(true)}>
		<div>
			<p className={buildDescriptionClasses(isDarkMode)}>{description}</p>
		</div>

		{hasAttributes && (
			<>
				<div className={buildSeparatorClasses(isDarkMode)} />
				<AttributeContentSection
					attributes={attributes}
					isDarkMode={isDarkMode}
				/>
			</>
		)}

		{hasMetadata && (
			<>
				<div className={buildSeparatorClasses(isDarkMode)} />
				<MetadataSection metadata={metadata} />
			</>
		)}

		{children && (
			<>
				<div className={buildSeparatorClasses(isDarkMode)} />
				<div className="space-y-2">{children}</div>
			</>
		)}

		<div className={buildSeparatorClasses(isDarkMode)} />
		<NodeFooter
			configName={configName}
			identifier={identifier}
			isDarkMode={isDarkMode}
		/>
	</div>
);

type CollapsedPreviewProps = {
	description: string;
	isDarkMode: boolean;
};

const CollapsedPreview = ({
	description,
	isDarkMode,
}: CollapsedPreviewProps) => (
	<motion.div
		animate={{ opacity: 1 }}
		className="px-4 pb-3"
		exit={{ opacity: 0 }}
		initial={{ opacity: 0 }}
		transition={{ duration: 0.2 }}
	>
		<p className={buildPreviewTextClasses(isDarkMode)}>
			{truncateText(description, 2)}
		</p>
	</motion.div>
);

type NodeCardContentProps = {
	data: NodeData;
	nodeType: string;
	isExpanded: boolean;
	isHovered: boolean;
	isDarkMode: boolean;
	toolbarVisible: boolean;
	nodeHasChildren: boolean;
	nodeHasHiddenChildren: boolean;
	nodeIsRoot: boolean;
	onToggle: (e: React.MouseEvent) => void;
	onDescriptionChange: (description: string) => void;
	onDataChange: (data: NodeDataUpdate) => void;
	onDelete: () => void;
	onToggleChildren: () => void;
	children?: ReactNode;
};

const NodeCardContent = ({
	data,
	nodeType,
	isExpanded,
	isHovered,
	isDarkMode,
	toolbarVisible,
	nodeHasChildren,
	nodeHasHiddenChildren,
	nodeIsRoot,
	onToggle,
	onDescriptionChange,
	onDataChange,
	onDelete,
	onToggleChildren,
	children,
}: NodeCardContentProps) => {
	const config = getNodeTypeConfig(nodeType);
	const Icon = getNodeIcon(nodeType);
	const displayName = getDisplayName(data, nodeType);
	const identifier = getIdentifier(data, nodeType);
	const attributes = extractAttributes(data);
	const metadata = extractMetadata(data);
	const description = getNodeDescription(data);
	const hasAttributes = computeHasAttributes(attributes);
	const hasMetadata = computeHasMetadata(metadata);
	const collapseVariants = withReducedMotion(contentCollapseVariants);

	return (
		<>
			<NodeActionToolbar
				hasChildren={nodeHasChildren}
				hasHiddenChildren={nodeHasHiddenChildren}
				isDarkMode={isDarkMode}
				isRootNode={nodeIsRoot}
				nodeData={data}
				nodeType={nodeType}
				onDataChange={onDataChange}
				onDelete={onDelete}
				onDescriptionChange={onDescriptionChange}
				onToggleChildren={onToggleChildren}
				visible={toolbarVisible}
			/>

			<Card
				className={cn(
					"bg-transparent",
					"border-0",
					"shadow-none",
					"p-0",
					"overflow-hidden"
				)}
			>
				<NodeHeader
					displayName={displayName}
					Icon={Icon}
					isDarkMode={isDarkMode}
					isExpanded={isExpanded}
					isHovered={isHovered}
					nodeType={nodeType}
					onToggle={onToggle}
				/>

				{!isExpanded && (
					<CollapsedPreview description={description} isDarkMode={isDarkMode} />
				)}

				<AnimatePresence>
					{isExpanded && (
						<motion.div
							animate="expanded"
							className="overflow-hidden"
							exit="collapsed"
							initial="collapsed"
							variants={collapseVariants as import("framer-motion").Variants}
						>
							<ExpandedContent
								attributes={attributes}
								configName={config.name}
								description={description}
								hasAttributes={hasAttributes}
								hasMetadata={hasMetadata}
								identifier={identifier}
								isDarkMode={isDarkMode}
								metadata={metadata}
							>
								{children}
							</ExpandedContent>
						</motion.div>
					)}
				</AnimatePresence>
			</Card>
		</>
	);
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
	const { isHovered, handleMouseEnter, handleMouseLeave, handleHoverChange } =
		useHoverState();
	const {
		isDarkMode,
		editable,
		onHandleClick,
		onNodeDelete,
		onNodeDescriptionChange,
		onNodeDataChange,
		onToggleChildrenVisibility,
		hasChildren,
		hasHiddenChildren,
		isRootNode,
	} = useThemeContext();

	const nodeId = data.id || "";
	const toolbarVisible = editable && (isHovered || selected);
	const handleVisible = editable && (isHovered || selected);
	// Only allow connections when editable is true
	const handleConnectable = editable && isConnectable;
	const nodeHasChildren = hasChildren?.(nodeId) ?? false;
	const nodeHasHiddenChildren = hasHiddenChildren?.(nodeId) ?? false;
	const nodeIsRoot = isRootNode?.(nodeId) ?? false;
	const config = getNodeTypeConfig(nodeType);
	const entranceVariants = withReducedMotion(nodeEntranceVariants);

	const handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		const newExpandedState = !isExpanded;
		setIsExpanded(newExpandedState);
		onExpandChange?.(newExpandedState);
	};

	const handleDescriptionChange = (description: string) => {
		onNodeDescriptionChange?.(nodeId, description);
	};

	const handleDataChange = (updatedData: NodeDataUpdate) => {
		onNodeDataChange?.(nodeId, updatedData);
	};

	const handleDelete = () => {
		onNodeDelete?.(nodeId);
	};

	const handleToggleChildren = () => {
		onToggleChildrenVisibility?.(nodeId);
	};

	return (
		<>
			{config.showTargetHandle && (
				<CustomHandle
					id={`${data.id}-target`}
					isConnectable={handleConnectable}
					nodeData={data}
					nodeId={data.id || ""}
					onHandleClick={onHandleClick}
					position={Position.Top}
					type="target"
					visible={false}
				/>
			)}

			<motion.div
				animate="visible"
				aria-expanded={isExpanded}
				aria-label={`${config.name} node: ${data.name}`}
				className={cn(
					"relative",
					buildNodeContainerClasses({
						nodeType,
						isSelected: selected,
						isHovered,
						isCollapsed: !isExpanded,
						isDarkMode,
					}),
					className
				)}
				exit="exit"
				initial="hidden"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				variants={entranceVariants as import("framer-motion").Variants}
				whileHover={{ scale: 1.02 }}
			>
				<NodeCardContent
					data={data}
					isDarkMode={isDarkMode}
					isExpanded={isExpanded}
					isHovered={isHovered}
					nodeHasChildren={nodeHasChildren}
					nodeHasHiddenChildren={nodeHasHiddenChildren}
					nodeIsRoot={nodeIsRoot}
					nodeType={nodeType}
					onDataChange={handleDataChange}
					onDelete={handleDelete}
					onDescriptionChange={handleDescriptionChange}
					onToggle={handleToggle}
					onToggleChildren={handleToggleChildren}
					toolbarVisible={toolbarVisible}
				>
					{children}
				</NodeCardContent>
			</motion.div>

			{config.showSourceHandle && (
				<CustomHandle
					id={`${data.id}-source`}
					isConnectable={handleConnectable}
					nodeData={data}
					nodeId={data.id || ""}
					onHandleClick={onHandleClick}
					onHoverChange={handleHoverChange}
					position={Position.Bottom}
					type="source"
					visible={handleVisible}
					visualOffset="translate-y-1/2"
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
