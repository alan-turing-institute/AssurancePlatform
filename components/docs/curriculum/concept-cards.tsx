"use client";

import {
	BookmarkCheck,
	ChevronDown,
	Info,
	Layers,
	TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { nodeTypeConfigs } from "@/components/shared/nodes/node-config";
import { resolveReactFlowNodeType } from "@/lib/case/node-type-resolver";
import { cn } from "@/lib/utils";
import type {
	Concept,
	ConceptCardsProps,
	ConceptType,
} from "@/types/curriculum";
import { useOptionalModuleProgress } from "./module-progress-context";

type IconComponent = React.ComponentType<{ className?: string }>;

interface CardStyle {
	border: string;
	icon: IconComponent;
	iconClass: string;
	label: string;
}

const attributeStyles: Partial<Record<ConceptType, CardStyle>> = {
	context: {
		icon: Layers,
		iconClass: "text-muted-foreground",
		border: "border-border",
		label: "Context",
	},
	assumption: {
		icon: TriangleAlert,
		iconClass: "text-muted-foreground",
		border: "border-border",
		label: "Assumption",
	},
	justification: {
		icon: BookmarkCheck,
		iconClass: "text-muted-foreground",
		border: "border-border",
		label: "Justification",
	},
};

const getCardStyle = (type: ConceptType): CardStyle => {
	const attribute = attributeStyles[type];
	if (attribute) {
		return attribute;
	}
	if (type === "general") {
		return {
			icon: Info,
			iconClass: "text-muted-foreground",
			border: "border-border",
			label: "Concept",
		};
	}
	const config = nodeTypeConfigs[resolveReactFlowNodeType(type)];
	return {
		icon: config.icon,
		iconClass: config.colours.icon,
		border: config.colours.border,
		label: config.label,
	};
};

interface ConceptCardProps {
	concept: Concept;
	expanded: boolean;
	onToggle: () => void;
}

const ConceptCard = ({ concept, expanded, onToggle }: ConceptCardProps) => {
	const style = getCardStyle(concept.type);
	const Icon = style.icon;
	const panelId = `concept-card-${concept.id}-details`;

	return (
		<div
			className={cn("rounded-xl border-2 bg-card shadow-sm", style.border)}
			data-testid={`concept-card-${concept.id}`}
		>
			<div className="flex items-start gap-3 p-4">
				<Icon
					aria-hidden="true"
					className={cn("mt-0.5 h-5 w-5 shrink-0", style.iconClass)}
					data-testid="concept-card-icon"
				/>
				<div className="min-w-0 flex-1">
					<h3 className="font-semibold text-foreground text-lg leading-tight">
						{concept.name}
					</h3>
					{concept.definition && (
						<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
							{concept.definition}
						</p>
					)}
				</div>
				<button
					aria-controls={panelId}
					aria-expanded={expanded}
					aria-label={`${expanded ? "Collapse" : "Expand"} ${concept.name}`}
					className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
					onClick={onToggle}
					type="button"
				>
					<ChevronDown
						aria-hidden="true"
						className={cn(
							"h-5 w-5 transition-transform",
							expanded && "rotate-180"
						)}
					/>
				</button>
			</div>

			{expanded && (
				<div className="space-y-3 px-4 pb-4 pl-12" id={panelId}>
					{concept.details && concept.details.length > 0 && (
						<ul className="list-disc space-y-1.5 pl-5 text-foreground text-sm leading-relaxed">
							{concept.details.map((detail) => (
								<li key={`${concept.id}-${detail}`}>{detail}</li>
							))}
						</ul>
					)}
					{concept.example && (
						<blockquote className="rounded-md border-border border-l-4 bg-muted/40 px-3 py-2 text-foreground text-sm italic leading-relaxed">
							{concept.example}
						</blockquote>
					)}
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
						{style.label}
					</p>
				</div>
			)}
		</div>
	);
};

/**
 * ConceptCards - a stack of expandable concept cards.
 *
 * Each card shows a concept's name and definition; expanding it reveals the
 * details and example. Once every card has been expanded at least once, the
 * optional task is marked complete in the surrounding module progress.
 */
const ConceptCards = ({
	concepts = [],
	taskId,
}: ConceptCardsProps): React.ReactNode => {
	const progress = useOptionalModuleProgress();
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [viewed, setViewed] = useState<Set<string>>(new Set());
	const completedRef = useRef(false);
	const completeTask = progress?.completeTask;

	const toggle = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
		setViewed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
	};

	const allViewed =
		concepts.length > 0 && concepts.every((c) => viewed.has(c.id));

	useEffect(() => {
		if (allViewed && taskId && completeTask && !completedRef.current) {
			completedRef.current = true;
			completeTask(taskId);
		}
	}, [allViewed, taskId, completeTask]);

	if (concepts.length === 0) {
		return null;
	}

	const reviewed = concepts.filter((c) => viewed.has(c.id)).length;

	return (
		<div className="space-y-3">
			{concepts.map((concept) => (
				<ConceptCard
					concept={concept}
					expanded={expanded.has(concept.id)}
					key={concept.id}
					onToggle={() => toggle(concept.id)}
				/>
			))}
			<p aria-live="polite" className="text-muted-foreground text-sm">
				{reviewed} of {concepts.length} reviewed
			</p>
		</div>
	);
};

export default ConceptCards;
