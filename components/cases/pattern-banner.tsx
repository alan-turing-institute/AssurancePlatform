"use client";

import { Shapes } from "lucide-react";
import useStore from "@/store/store";

/**
 * A notice at the top left of the editor, under the header, that says the case
 * on screen is a pattern. It takes only the width of its text, so it leaves
 * the root of the argument, which sits at the top centre, uncovered. Renders
 * nothing for an ordinary case.
 */
export function PatternBanner() {
	const kind = useStore((state) => state.assuranceCase?.kind);

	if (kind !== "PATTERN") {
		return null;
	}

	return (
		<div
			className="pointer-events-auto mx-4 mt-2 flex w-fit max-w-xl items-center gap-2 rounded-md border bg-card px-3 py-2 text-foreground text-sm shadow-sm"
			data-testid="pattern-banner"
		>
			<Shapes aria-hidden="true" className="h-4 w-4" />
			<p>This is a pattern.</p>
		</div>
	);
}
