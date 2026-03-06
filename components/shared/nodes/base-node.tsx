"use client";

/**
 * Base Node Component
 *
 * Shared base component for all assurance case diagram nodes.
 * Matches the curriculum design system with:
 * - Light tinted backgrounds
 * - Colored borders
 * - Compact header with icon + ID
 * - Description preview in collapsed state
 * - Full content with attributes in expanded state
 * - Expand/collapse chevron in bottom-right
 */

import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import useStore from "@/store/store";
import { contentCollapseVariants, withReducedMotion } from "./animations";
import AttributeSection from "./attribute-section";
import { type DiagramNodeType, getNodeConfig } from "./node-config";
import {
	buildDescriptionClasses,
	buildFooterIdClasses,
	buildFooterLabelClasses,
	buildNodeContainerClasses,
	buildNodeContentClasses,
	buildNodeHeaderClasses,
	buildNodeIconClasses,
	buildNodeTitleClasses,
	buildPreviewTextClasses,
	buildSeparatorClasses,
} from "./node-styles";

export type BaseNodeProps = {
	/** The type of node (goal, strategy, property, evidence) */
	nodeType: DiagramNodeType;
	/** The display name/ID of the node (e.g., "G1", "S1", "P1") */
	name: string;
	/** Short description of the node */
	description?: string;
	/** Whether the node is currently selected */
	selected?: boolean;
	/** Context strings array */
	context?: string[];
	/** Assumption text */
	assumption?: string;
	/** Justification text */
	justification?: string;
	/** Whether to start in expanded state */
	initialExpanded?: boolean;
	/** Actions to display in the top-right (e.g., comment indicators) */
	topRightActions?: ReactNode;
	/** Actions to display in the bottom-left (e.g., toggle children button) */
	bottomLeftActions?: ReactNode;
	/** Additional content to render in expanded state */
	children?: ReactNode;
	/** Additional class names */
	className?: string;
	/** Optional data-tour attribute for onboarding tours */
	dataTour?: string;
	/** Optional data-tour attribute for the expand/collapse chevron button */
	expandTour?: string;
};

/**
 * Truncate text to a maximum number of lines worth of characters
 */
function truncateText(text: string, maxLength = 180): string {
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength).trim()}...`;
}

function ExpandedContent({
	descriptionText,
	hasAttributes,
	assumption,
	context,
	justification,
	nodeType,
	children,
	name,
	config,
}: {
	descriptionText: string;
	hasAttributes: boolean;
	assumption?: string;
	context?: string[];
	justification?: string;
	nodeType: DiagramNodeType;
	children?: ReactNode;
	name: string;
	config: ReturnType<typeof getNodeConfig>;
}) {
	return (
		<div className={buildNodeContentClasses(true)}>
			<p className={buildDescriptionClasses()}>{descriptionText}</p>

			{hasAttributes && (
				<>
					<div className={buildSeparatorClasses()} />
					<AttributeSection
						assumption={assumption}
						context={context}
						justification={justification}
						nodeType={nodeType}
					/>
				</>
			)}

			{children && (
				<>
					<div className={buildSeparatorClasses()} />
					<div className="space-y-2">{children}</div>
				</>
			)}

			<div className={buildSeparatorClasses()} />
			<div className="flex items-center justify-between">
				<span className={buildFooterLabelClasses()}>{config.label}</span>
				<span className={buildFooterIdClasses()}>{name}</span>
			</div>
		</div>
	);
}

export default function BaseNode({
	nodeType,
	name,
	description,
	selected = false,
	context,
	assumption,
	justification,
	initialExpanded = false,
	topRightActions,
	bottomLeftActions,
	children,
	className,
	dataTour,
	expandTour,
}: BaseNodeProps) {
	const [isExpanded, setIsExpanded] = useState(initialExpanded);
	const { layoutNodes, layoutDirection } = useStore();
	const { fitView, getNodes, getEdges } = useReactFlow();

	const targetPosition =
		layoutDirection === "LR" ? Position.Left : Position.Top;
	const sourcePosition =
		layoutDirection === "LR" ? Position.Right : Position.Bottom;

	const config = getNodeConfig(nodeType);
	const Icon = config.icon;
	const collapseVariants = withReducedMotion(contentCollapseVariants);

	const hasAttributes = !!(
		(context && context.length > 0) ||
		(assumption && assumption.trim() !== "") ||
		(justification && justification.trim() !== "")
	);

	const descriptionText = description || "No description available";
	const isTruncated = descriptionText.length > 180;

	const handleExpandToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(!isExpanded);
	};

	// Trigger layout after animation completes
	const handleAnimationComplete = () => {
		// Use requestAnimationFrame to ensure DOM has updated after animation
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				const currentNodes = getNodes();
				const currentEdges = getEdges();
				layoutNodes(currentNodes, currentEdges).then(() => {
					fitView();
				});
			});
		});
	};

	const containerClasses = buildNodeContainerClasses({
		nodeType,
		isSelected: selected,
		className,
	});

	return (
		<div className={containerClasses} data-tour={dataTour}>
			{/* Target Handle (top) */}
			{config.showTargetHandle && (
				<Handle id="target" position={targetPosition} type="target" />
			)}

			<LazyMotion features={domAnimation} strict>
				{/* Header: Icon + Name + Top-right Actions */}
				<div className={buildNodeHeaderClasses()}>
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Icon
							aria-hidden="true"
							className={buildNodeIconClasses(nodeType)}
						/>
						<span className={buildNodeTitleClasses()}>{name}</span>
					</div>
					{topRightActions && (
						<div className="flex items-center">{topRightActions}</div>
					)}
				</div>

				{/* Collapsed state: Show description preview */}
				{!isExpanded && (
					<m.div
						animate={{ opacity: 1 }}
						className="px-4 pb-3"
						exit={{ opacity: 0 }}
						initial={{ opacity: 0 }}
						onAnimationComplete={handleAnimationComplete}
						transition={{ duration: 0.2 }}
					>
						{isTruncated ? (
							<TooltipProvider>
								<Tooltip delayDuration={400}>
									<TooltipTrigger asChild>
										<p className={buildPreviewTextClasses()}>
											{truncateText(descriptionText)}
										</p>
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p>{descriptionText}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : (
							<p className={buildPreviewTextClasses()}>{descriptionText}</p>
						)}
					</m.div>
				)}

				{/* Expanded state: Full content */}
				<AnimatePresence>
					{isExpanded && (
						<m.div
							animate="expanded"
							className="overflow-hidden"
							exit="collapsed"
							initial="collapsed"
							onAnimationComplete={handleAnimationComplete}
							variants={collapseVariants as import("framer-motion").Variants}
						>
							<ExpandedContent
								assumption={assumption}
								config={config}
								context={context}
								descriptionText={descriptionText}
								hasAttributes={hasAttributes}
								justification={justification}
								name={name}
								nodeType={nodeType}
							>
								{children}
							</ExpandedContent>
						</m.div>
					)}
				</AnimatePresence>

				{/* Bottom row: Actions left, Expand/Collapse right */}
				<div className="flex items-center justify-between px-2 pb-2">
					{/* Bottom-left actions (e.g., toggle children) */}
					<div className="flex items-center">{bottomLeftActions}</div>
					<m.button
						aria-label={isExpanded ? "Collapse node" : "Expand node"}
						className="cursor-pointer rounded p-0.5 transition-colors hover:bg-foreground/5"
						data-tour={expandTour}
						onClick={handleExpandToggle}
						onMouseDown={(e) => e.stopPropagation()}
						type="button"
					>
						<m.div
							animate={{ rotate: isExpanded ? 180 : 0 }}
							transition={{ duration: 0.2 }}
						>
							<ChevronDown
								aria-hidden="true"
								className="h-4 w-4 shrink-0 text-muted-foreground"
							/>
						</m.div>
					</m.button>
				</div>
			</LazyMotion>

			{/* Source Handle (bottom) */}
			{config.showSourceHandle && (
				<Handle id="c" position={sourcePosition} type="source" />
			)}
		</div>
	);
}
