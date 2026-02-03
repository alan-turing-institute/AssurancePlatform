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
import { getNodeColours, type NodeType } from "./node-config";

type AttributeItemProps = {
	icon: ReactNode;
	label: string;
	value: string | string[];
};

function AttributeItem({ icon, label, value }: AttributeItemProps) {
	const displayValue = Array.isArray(value) ? value.join(", ") : value;

	if (!displayValue) {
		return null;
	}

	return (
		<div className="space-y-1">
			<div className="flex items-center gap-1.5">
				{icon}
				<span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
					{label}
				</span>
			</div>
			<p className="pl-5 text-foreground text-xs leading-relaxed">
				{displayValue}
			</p>
		</div>
	);
}

type AttributeSectionProps = {
	nodeType: NodeType;
	context?: string[];
	assumption?: string;
	justification?: string;
	className?: string;
};

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
