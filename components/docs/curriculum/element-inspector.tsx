"use client";

import type React from "react";
import {
	type DiagramNodeType,
	nodeTypeConfigs,
} from "@/components/shared/nodes/node-config";
import { Badge } from "@/components/ui/badge";
import {
	type AttributeKind,
	type ElementRef,
	getAttributeGuide,
	getElementGuide,
	type SelectedElementSummary,
} from "@/lib/docs/selected-element";
import { cn } from "@/lib/utils";

interface ElementInspectorProps {
	element: SelectedElementSummary | null;
}

const EMPTY_TEXT =
	"Select an element on the canvas to read what it is and how it connects to the elements around it.";

const lowerLabel = (type: DiagramNodeType): string =>
	nodeTypeConfigs[type].label.toLowerCase();

const pluralLabel = (type: DiagramNodeType): string => {
	const label = lowerLabel(type);
	return label.endsWith("y") ? `${label.slice(0, -1)}ies` : `${label}s`;
};

const joinNames = (names: string[]): string => {
	if (names.length <= 1) {
		return names.join("");
	}
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const parentSentence = (element: SelectedElementSummary): string | null => {
	if (element.parent) {
		return `${element.name} supports ${element.parent.name}, a ${lowerLabel(element.parent.type)}.`;
	}
	if (element.type === "goal") {
		return `${element.name} is the top of the argument. Nothing sits above it.`;
	}
	return null;
};

const childrenSentence = (element: SelectedElementSummary): string => {
	if (element.children.length > 0) {
		const names = element.children.map((c: ElementRef) => c.name);
		return `${element.name} is supported by ${joinNames(names)}.`;
	}
	if (element.type === "evidence") {
		return "Evidence is where a chain of argument ends. It has no children.";
	}
	return `No element supports ${element.name} in this view.`;
};

const presentAttributes = (
	element: SelectedElementSummary
): AttributeKind[] => {
	const kinds: AttributeKind[] = [];
	if (element.attributes.context > 0) {
		kinds.push("context");
	}
	if (element.attributes.assumption) {
		kinds.push("assumption");
	}
	if (element.attributes.justification) {
		kinds.push("justification");
	}
	return kinds;
};

const ElementInspector = ({
	element,
}: ElementInspectorProps): React.ReactNode => {
	const body = element ? <Details element={element} /> : null;

	return (
		<section
			aria-label="Selected element"
			aria-live="polite"
			className="min-h-32 border-t bg-muted/30 p-4 text-sm"
		>
			{body ?? <p className="text-muted-foreground">{EMPTY_TEXT}</p>}
		</section>
	);
};

const Details = ({
	element,
}: {
	element: SelectedElementSummary;
}): React.ReactNode => {
	const config = nodeTypeConfigs[element.type];
	const guide = getElementGuide(element.type);
	const attributes = presentAttributes(element);
	const lead = parentSentence(element);

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<config.icon className={cn("h-5 w-5", config.colours.icon)} />
				<h4 className="font-semibold text-base">
					{config.label} {element.name}
				</h4>
				{element.isDefeater && (
					<Badge
						className="rounded-full border-none bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-micro ring-1 ring-destructive/20 ring-inset"
						variant="outline"
					>
						Defeater
					</Badge>
				)}
			</div>

			<div>
				<h5 className="font-medium">What it is</h5>
				<p className="text-muted-foreground">
					{guide.summary} {guide.guidance}
				</p>
			</div>

			<div>
				<h5 className="font-medium">In this case</h5>
				<p className="text-muted-foreground">
					{lead ? `${lead} ` : ""}
					{childrenSentence(element)}
				</p>
			</div>

			<div>
				<h5 className="font-medium">On this card</h5>
				{attributes.length > 0 ? (
					<ul className="space-y-1 text-muted-foreground">
						{attributes.map((kind) => {
							const attribute = getAttributeGuide(kind);
							return (
								<li key={kind}>
									{attribute.title}: {attribute.summary} Use the chevron in the
									card&apos;s bottom-right corner to read it.
								</li>
							);
						})}
					</ul>
				) : (
					<p className="text-muted-foreground">
						This card carries no context, assumption or justification.
					</p>
				)}
			</div>

			{guide.docsHref && (
				<a
					className="font-medium text-primary underline underline-offset-4"
					href={guide.docsHref}
				>
					Read more about {pluralLabel(element.type)}
				</a>
			)}
		</div>
	);
};

export default ElementInspector;
