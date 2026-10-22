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
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type DefinedTerm, plainReferenceText } from "@/lib/case/defined-terms";
import {
	appearanceAttribute,
	drawnContentAttribute,
} from "@/lib/case/plugin-display-capture";
import type { ElementAppearance } from "@/lib/plugins/slots";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import useStore from "@/store/store";
import { contentCollapseVariants, withReducedMotion } from "./animations";
import AttributeSection from "./attribute-section";
import { type DiagramNodeType, getNodeConfig } from "./node-config";
import {
	buildAppearanceFillClasses,
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
import ReferenceText from "./reference-text";
import { previewParts } from "./reference-text-utils";

/** How many visible characters of the description a collapsed card shows. */
const PREVIEW_LENGTH = 180;

export interface BaseNodeProps {
	/** How a plugin wants the card drawn: a tint under the content, faded or not. Absent draws the card as usual. */
	appearance?: ElementAppearance | null;
	/** Assumption text */
	assumption?: string;
	/** Actions to display in the bottom-left (e.g., toggle children button) */
	bottomLeftActions?: ReactNode;
	/** Additional content to render in expanded state */
	children?: ReactNode;
	/** Additional class names */
	className?: string;
	/** Context entries: plain strings or named entries */
	context?: ContextEntry[];
	/** Optional data-tour attribute for onboarding tours */
	dataTour?: string;
	/** Short description of the node */
	description?: string;
	/** Optional data-tour attribute for the expand/collapse chevron button */
	expandTour?: string;
	/** Whether to start in expanded state */
	initialExpanded?: boolean;
	/** Dialogical reasoning (defeaters, ADR 0005 D2) — shows a "Defeater" chip and a distinct destructive-token border, regardless of node kind. */
	isDefeater?: boolean;
	/** Justification text */
	justification?: string;
	/** The display name/ID of the node (e.g., "G1", "S1", "P1") */
	name: string;
	/** The type of node (goal, strategy, property, evidence) */
	nodeType: DiagramNodeType;
	/** Whether the node is currently selected */
	selected?: boolean;
	/**
	 * The defined terms the card's text can refer to, nearest definition first.
	 * A card given none does not resolve references: any it holds shows as
	 * `{name}` with no highlight.
	 */
	terms?: readonly DefinedTerm[];
	/** Actions to display in the top-right (e.g., comment indicators) */
	topRightActions?: ReactNode;
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
	terms,
}: {
	descriptionText: string;
	hasAttributes: boolean;
	assumption?: string;
	context?: ContextEntry[];
	justification?: string;
	nodeType: DiagramNodeType;
	children?: ReactNode;
	name: string;
	config: ReturnType<typeof getNodeConfig>;
	terms: readonly DefinedTerm[];
}) {
	return (
		<div className={buildNodeContentClasses(true)}>
			<p className={buildDescriptionClasses()}>
				<ReferenceText terms={terms} text={descriptionText} withTooltips />
			</p>

			{hasAttributes && (
				<>
					<div className={buildSeparatorClasses()} />
					<AttributeSection
						assumption={assumption}
						context={context}
						justification={justification}
						nodeType={nodeType}
						terms={terms}
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

const NO_TERMS: readonly DefinedTerm[] = [];

/**
 * The text a card draws and the terms it resolves references with. A card
 * given terms leaves its references for the text component to resolve; one
 * given none writes each as `{name}`, so no word is highlighted.
 */
function cardText(
	description: string | undefined,
	termsInReach: readonly DefinedTerm[] | undefined
) {
	const stored = description || "No description available";
	return termsInReach
		? { descriptionText: stored, terms: termsInReach }
		: { descriptionText: plainReferenceText(stored), terms: NO_TERMS };
}

export default function BaseNode({
	nodeType,
	name,
	description,
	appearance = null,
	selected = false,
	context,
	assumption,
	justification,
	initialExpanded = false,
	isDefeater = false,
	topRightActions,
	bottomLeftActions,
	children,
	className,
	dataTour,
	expandTour,
	terms: termsInReach,
}: BaseNodeProps) {
	const { descriptionText, terms } = cardText(description, termsInReach);
	const [isExpanded, setIsExpanded] = useState(initialExpanded);
	const { layoutNodes, layoutDirection } = useStore();
	const { fitView, getNodes, getEdges } = useReactFlow();

	const targetPosition =
		layoutDirection === "LR" ? Position.Left : Position.Top;
	const sourcePosition =
		layoutDirection === "LR" ? Position.Right : Position.Bottom;

	// Side handles (ADR 0005 D4) for the `challenges` edge: a target handle
	// on the side facing the row the node's cell sits in (right for a
	// top-down tree, since side attachments sit to the right — Chris's
	// ruling; bottom for a left-right tree, mirrored), and a source handle
	// on the opposite side, so the edge between a defeater and the element
	// it attacks is always straight and runs along the row.
	const sideTargetPosition =
		layoutDirection === "LR" ? Position.Bottom : Position.Right;
	const sideSourcePosition =
		layoutDirection === "LR" ? Position.Top : Position.Left;

	const config = getNodeConfig(nodeType);
	const Icon = config.icon;
	const collapseVariants = withReducedMotion(contentCollapseVariants);

	const hasAttributes = !!(
		(context && context.length > 0) ||
		(assumption && assumption.trim() !== "") ||
		(justification && justification.trim() !== "")
	);

	const isTruncated = previewParts(
		descriptionText,
		terms,
		PREVIEW_LENGTH
	).truncated;

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

	const drawnContent = drawnContentAttribute(appearance);

	const containerClasses = buildNodeContainerClasses({
		nodeType,
		isSelected: selected,
		isDefeater,
		appearance,
		className,
	});

	return (
		<div
			className={containerClasses}
			data-appearance={appearanceAttribute(appearance)}
			data-faded={appearance?.faded ? "" : undefined}
			data-tour={dataTour}
		>
			{appearance && (
				<span
					aria-hidden="true"
					className={buildAppearanceFillClasses(appearance)}
					data-plugin-display=""
				/>
			)}
			{/* Target Handle (top) */}
			{config.showTargetHandle && (
				<Handle id="target" position={targetPosition} type="target" />
			)}

			{/* Side handles (ADR 0005 D4): the `challenges` edge always
			connects here, regardless of node kind — any card can be a
			defeater or a defeat target. */}
			<Handle id="side-target" position={sideTargetPosition} type="target" />
			<Handle id="side-source" position={sideSourcePosition} type="source" />

			<LazyMotion features={domAnimation} strict>
				{/* Header: Icon + Name + Top-right Actions */}
				<div
					className={buildNodeHeaderClasses()}
					data-drawn-content={drawnContent}
				>
					<div className="flex flex-1 items-center gap-2">
						<Icon
							aria-hidden="true"
							className={buildNodeIconClasses(nodeType)}
						/>
						<span className={buildNodeTitleClasses()}>{name}</span>
						{isDefeater && (
							<Badge
								aria-label="This element is a defeater"
								className="rounded-full border-none bg-destructive/10 px-2 py-0.5 font-medium text-[10px] text-destructive ring-1 ring-destructive/20 ring-inset"
								variant="outline"
							>
								Defeater
							</Badge>
						)}
					</div>
					{topRightActions && (
						<div
							className="flex min-w-0 items-center"
							data-testid="node-top-right-actions"
						>
							{topRightActions}
						</div>
					)}
				</div>

				{/* Collapsed state: Show description preview */}
				{!isExpanded && (
					<m.div
						animate={{ opacity: 1 }}
						className="px-4 pb-3"
						data-drawn-content={drawnContent}
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
											<ReferenceText
												maxLength={PREVIEW_LENGTH}
												terms={terms}
												text={descriptionText}
											/>
										</p>
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p>{plainReferenceText(descriptionText, terms)}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : (
							<p className={buildPreviewTextClasses()}>
								<ReferenceText terms={terms} text={descriptionText} />
							</p>
						)}
					</m.div>
				)}

				{/* Expanded state: Full content */}
				<AnimatePresence>
					{isExpanded && (
						<m.div
							animate="expanded"
							className="overflow-hidden"
							data-drawn-content={drawnContent}
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
								terms={terms}
							>
								{children}
							</ExpandedContent>
						</m.div>
					)}
				</AnimatePresence>

				{/* Bottom row: Actions left, Expand/Collapse right */}
				<div
					className="flex items-center justify-between px-2 pb-2"
					data-drawn-content={drawnContent}
				>
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
