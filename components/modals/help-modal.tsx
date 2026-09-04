"use client";

import Link from "next/link";
import { useNextStep } from "nextstepjs";
import { useMemo, useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { useHelpModal } from "@/hooks/modal-hooks";
import {
	CANVAS_OPTION_GUIDE,
	ELEMENT_GUIDE,
	type HelpGuideEntry,
} from "@/lib/help/help-guide";
import useStore from "@/store/store";

/** Case-insensitive match against an entry's title and body text. */
function matchesQuery(entry: HelpGuideEntry, query: string): boolean {
	if (!query) {
		return true;
	}
	const haystack =
		`${entry.title} ${entry.summary} ${entry.guidance}`.toLowerCase();
	return haystack.includes(query);
}

interface HelpGuideSectionProps {
	entries: HelpGuideEntry[];
	title: string;
}

function HelpGuideSection({ entries, title }: HelpGuideSectionProps) {
	if (entries.length === 0) {
		return null;
	}

	return (
		<div>
			<h3 className="mb-2 font-semibold text-foreground text-sm uppercase tracking-wide">
				{title}
			</h3>
			<Accordion collapsible type="single">
				{entries.map((entry) => (
					<AccordionItem key={entry.id} value={entry.id}>
						<AccordionTrigger>{entry.title}</AccordionTrigger>
						<AccordionContent className="flex flex-col gap-2 text-sm">
							<p>{entry.summary}</p>
							<p>{entry.guidance}</p>
							{entry.naming && (
								<p className="text-muted-foreground">
									How it is named: {entry.naming}
								</p>
							)}
							{entry.docsHref && (
								<a
									className="text-primary underline"
									href={entry.docsHref}
									rel="noopener noreferrer"
									target="_blank"
								>
									Read more in the docs
									<span className="sr-only"> (opens in new tab)</span>
								</a>
							)}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
}

/**
 * Help sheet — a searchable guide to the canvas's element types and toolbar
 * options, opened by the toolbar's "?" button (`components/cases/
 * action-buttons.tsx`, `data-testid="toolbar-help"`) via the same
 * `useHelpModal` hook as before. Replaces the centred dialog that carried
 * the same content under the name "Element Legend".
 */
export const HelpModal = () => {
	const helpModal = useHelpModal();
	const { assuranceCase } = useStore();
	const { startNextStep } = useNextStep();
	const [query, setQuery] = useState("");

	const normalisedQuery = query.trim().toLowerCase();

	const filteredElements = useMemo(
		() => ELEMENT_GUIDE.filter((entry) => matchesQuery(entry, normalisedQuery)),
		[normalisedQuery]
	);
	const filteredCanvasOptions = useMemo(
		() =>
			CANVAS_OPTION_GUIDE.filter((entry) =>
				matchesQuery(entry, normalisedQuery)
			),
		[normalisedQuery]
	);
	const hasResults =
		filteredElements.length > 0 || filteredCanvasOptions.length > 0;

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			helpModal.onClose();
		}
	};

	const handleRestartTour = () => {
		helpModal.onClose();
		startNextStep(assuranceCase?.isDemo ? "demo-case" : "case-canvas");
	};

	return (
		<Sheet onOpenChange={handleOpenChange} open={helpModal.isOpen}>
			<SheetContent
				className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl"
				data-testid="help-sheet"
			>
				<SheetHeader>
					<SheetTitle>Help</SheetTitle>
					<SheetDescription>
						A guide to the canvas's elements and toolbar options.
					</SheetDescription>
				</SheetHeader>

				<div>
					<label className="sr-only" htmlFor="help-search">
						Search help
					</label>
					<Input
						id="help-search"
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search elements and options"
						type="search"
						value={query}
					/>
				</div>

				<div className="flex-1 space-y-6 overflow-y-auto">
					{hasResults ? (
						<>
							<HelpGuideSection entries={filteredElements} title="Elements" />
							<HelpGuideSection
								entries={filteredCanvasOptions}
								title="Canvas options"
							/>
						</>
					) : (
						<p className="text-muted-foreground text-sm">No matches.</p>
					)}
				</div>

				<SheetFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
					<Button onClick={handleRestartTour} type="button" variant="outline">
						Restart the tour
					</Button>
					<Button asChild variant="ghost">
						<Link href="/docs">Full documentation</Link>
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
};
