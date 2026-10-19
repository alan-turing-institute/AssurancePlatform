"use client";

/**
 * Element text on a card, with each reference to a defined term drawn as a
 * highlighted word. On an expanded card hovering the word shows the term's
 * meaning, its value and the element it is defined on; a reference whose
 * definition is out of reach is marked as not found. On a collapsed card the
 * words are highlighted without a tooltip of their own, because the card
 * already has one for the whole text.
 *
 * The words are not focusable, so a card adds no control for keyboard users;
 * the meanings are read in the expanded card's context section and in the
 * edit dialog's list of terms.
 */

import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Fragment } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { buildReferenceClasses } from "./node-styles";
import { type PreviewPart, previewParts } from "./reference-text-utils";

type ReferencePart = Extract<PreviewPart, { type: "reference" }>;

/** The tooltip body, one line each for the name, meaning, value and origin. */
function TermTooltipBody({ part }: { part: ReferencePart }) {
	const { term } = part;
	if (!term) {
		return (
			<span className="block">{`No definition of '${part.name}' above this element`}</span>
		);
	}
	return (
		<span className="block space-y-1">
			<span className="block font-medium">{term.name}</span>
			{term.text.trim() && <span className="block">{term.text}</span>}
			{term.value?.trim() && <span className="block">Value: {term.value}</span>}
			<span className="block text-muted-foreground text-xs">
				Defined on {term.definedOn.elementName ?? "an element above"}
			</span>
		</span>
	);
}

function ReferenceWord({
	part,
	withTooltip,
}: {
	part: ReferencePart;
	withTooltip: boolean;
}) {
	const found = part.term !== undefined;
	const word = (
		<span
			className={buildReferenceClasses(found)}
			data-reference-id={part.id}
			data-reference-state={found ? "found" : "not-found"}
		>
			{part.name}
			{!found && <span className="sr-only"> (definition not found)</span>}
		</span>
	);
	if (!withTooltip) {
		return word;
	}
	return (
		<Tooltip delayDuration={200}>
			<TooltipTrigger asChild>{word}</TooltipTrigger>
			{/* Drawn outside the card, so the card's paragraph holds only text and its clipping cannot cut the tooltip. */}
			<TooltipPortal>
				<TooltipContent className="max-w-xs">
					<TermTooltipBody part={part} />
				</TooltipContent>
			</TooltipPortal>
		</Tooltip>
	);
}

interface ReferenceTextProps {
	/** Cuts the text to this many visible characters and ends it with an ellipsis. */
	maxLength?: number;
	terms?: readonly DefinedTerm[];
	text: string;
	/** Gives each reference a tooltip; leave off where an enclosing tooltip already covers the text. */
	withTooltips?: boolean;
}

export default function ReferenceText({
	maxLength = Number.POSITIVE_INFINITY,
	terms = [],
	text,
	withTooltips = false,
}: ReferenceTextProps) {
	const { parts, truncated } = previewParts(text, terms, maxLength);
	const content = (
		<>
			{parts.map((part, index) =>
				part.type === "text" ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: parts are rebuilt from the text on every render and never reordered
					<Fragment key={`text-${index}`}>{part.text}</Fragment>
				) : (
					<ReferenceWord
						// biome-ignore lint/suspicious/noArrayIndexKey: the same term can be referred to more than once in one text
						key={`reference-${index}`}
						part={part}
						withTooltip={withTooltips}
					/>
				)
			)}
			{truncated && "..."}
		</>
	);
	return withTooltips ? <TooltipProvider>{content}</TooltipProvider> : content;
}
