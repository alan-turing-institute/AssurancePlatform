"use client";

/**
 * Attribute Section Component
 *
 * Displays node attributes (context, assumption, justification) in a compact format.
 * Uses dark text on light backgrounds to match the curriculum design.
 */

import { BookmarkCheck, Layers, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type DiagramNodeType, getNodeColours } from "./node-config";

interface AttributeItemProps {
	icon: ReactNode;
	label: string;
	value: string | string[];
}

function AttributeItem({ icon, label, value }: AttributeItemProps) {
	const displayValue = Array.isArray(value) ? value.join(", ") : value;

	if (!displayValue) {
		return null;
	}

	const isMultiItem = Array.isArray(value) && value.length > 1;

	return (
		<div className="space-y-1">
			<div className="flex items-center gap-1.5">
				{icon}
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					{label}
				</span>
			</div>
			{isMultiItem ? (
				<ul className="list-disc space-y-1.5 pl-5">
					{(value as string[]).map((item) => (
						<li
							className="text-foreground text-xs leading-relaxed"
							key={`${label}-${item}`}
						>
							{item}
						</li>
					))}
				</ul>
			) : (
				<p className="pl-5 text-foreground text-xs leading-relaxed">
					{displayValue}
				</p>
			)}
		</div>
	);
}

interface AttributeSectionProps {
	assumption?: string;
	className?: string;
	context?: string[];
	justification?: string;
	nodeType: DiagramNodeType;
}

export default function AttributeSection({
	nodeType,
	context,
	assumption,
	justification,
	className,
}: AttributeSectionProps) {
	const hasContext = context && context.length > 0;
	const hasAssumption = assumption && assumption.trim() !== "";
	const hasJustification = justification && justification.trim() !== "";

	if (!(hasContext || hasAssumption || hasJustification)) {
		return null;
	}

	const iconColour = getNodeColours(nodeType).icon;

	return (
		<div className={cn("space-y-3", className)}>
			{hasContext && (
				<AttributeItem
					icon={<Layers className={cn("h-3.5 w-3.5", iconColour)} />}
					label={context.length > 1 ? `Context (${context.length})` : "Context"}
					value={context}
				/>
			)}
			{hasAssumption && (
				<AttributeItem
					icon={<TriangleAlert className={cn("h-3.5 w-3.5", iconColour)} />}
					label="Assumption"
					value={assumption}
				/>
			)}
			{hasJustification && (
				<AttributeItem
					icon={<BookmarkCheck className={cn("h-3.5 w-3.5", iconColour)} />}
					label="Justification"
					value={justification}
				/>
			)}
		</div>
	);
}
