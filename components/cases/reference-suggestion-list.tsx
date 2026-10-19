"use client";

import { useEffect, useRef } from "react";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/components/ui/popover";
import type { ReferenceListState } from "@/hooks/use-reference-suggestion";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { cn } from "@/lib/utils";

export function referenceOptionId(listId: string, index: number): string {
	return `${listId}-option-${index}`;
}

interface ReferenceSuggestionListProps {
	activeIndex: number;
	/** Whether there are any terms at all, as opposed to none matching what was typed. */
	hasTerms: boolean;
	list: ReferenceListState;
	listId: string;
	/** Called when the list asks to close: Escape, or a click or focus move outside it. */
	onClose: () => void;
	onHover: (index: number) => void;
}

function TermOption({
	active,
	id,
	onHover,
	onSelect,
	term,
}: {
	active: boolean;
	id: string;
	onHover: () => void;
	onSelect: () => void;
	term: DefinedTerm;
}) {
	const origin = term.definedOn.elementName ?? "an element above";
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the caret stays in the text, so the keyboard reaches the options through the editor (arrow keys and Enter)
		<div
			aria-selected={active}
			className={cn(
				"cursor-pointer rounded-sm px-2 py-1.5 text-sm",
				active && "bg-accent text-accent-foreground"
			)}
			id={id}
			onClick={onSelect}
			onMouseMove={onHover}
			role="option"
			tabIndex={-1}
		>
			<div className="flex items-baseline justify-between gap-2">
				<span className="font-medium">{term.name}</span>
				<span className="shrink-0 text-muted-foreground text-xs">{origin}</span>
			</div>
			{term.text.trim() && (
				<div className="truncate text-muted-foreground text-xs">
					{term.text}
				</div>
			)}
			{term.value?.trim() && (
				<div className="truncate text-muted-foreground text-xs">
					Value: {term.value}
				</div>
			)}
		</div>
	);
}

/**
 * The pick-list that opens when `{` is typed. It is a popover anchored at the
 * caret, so it can be clicked while the edit dialog is open and is not cut off
 * by the dialog's scrolling. It never takes focus: the caret stays in the
 * text, and the arrow keys and Enter reach the list through the editor.
 */
export default function ReferenceSuggestionList({
	activeIndex,
	hasTerms,
	list,
	listId,
	onClose,
	onHover,
}: ReferenceSuggestionListProps) {
	const anchor = useRef({
		getBoundingClientRect: () => list.position?.() ?? new DOMRect(),
	});
	anchor.current.getBoundingClientRect = () =>
		list.position?.() ?? new DOMRect();

	useEffect(() => {
		document
			.getElementById(referenceOptionId(listId, activeIndex))
			?.scrollIntoView({ block: "nearest" });
	}, [activeIndex, listId]);

	return (
		<Popover
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open
		>
			<PopoverAnchor virtualRef={anchor} />
			<PopoverContent
				align="start"
				className="max-h-60 w-72 overflow-y-auto p-1"
				onCloseAutoFocus={(event) => event.preventDefault()}
				onMouseDown={(event) => event.preventDefault()}
				onOpenAutoFocus={(event) => event.preventDefault()}
				onWheel={(event) => event.stopPropagation()}
				side="bottom"
				updatePositionStrategy="always"
			>
				{list.items.length > 0 ? (
					<div aria-label="Terms you can insert" id={listId} role="listbox">
						{list.items.map((term, index) => (
							<TermOption
								active={index === activeIndex}
								id={referenceOptionId(listId, index)}
								key={term.id}
								onHover={() => onHover(index)}
								onSelect={() => list.select(term)}
								term={term}
							/>
						))}
					</div>
				) : (
					!hasTerms && (
						<p className="px-2 py-1.5 text-muted-foreground text-sm">
							No terms to insert yet. Name a context entry on this element or
							one above it to define one.
						</p>
					)
				)}
			</PopoverContent>
		</Popover>
	);
}
