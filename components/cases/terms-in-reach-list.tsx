"use client";

import { useId } from "react";
import { type DefinedTerm, variableNote } from "@/lib/case/defined-terms";

interface TermsInReachListProps {
	terms: readonly DefinedTerm[];
}

/**
 * Every definition the element's text can refer to: the name, what it means,
 * its value and the element it is defined on. A variable shows its current
 * value beside its name, or that it is not set. It is also how a keyboard or
 * screen-reader user reads the meanings, since the diagram shows them only on
 * hover.
 */
export default function TermsInReachList({ terms }: TermsInReachListProps) {
	const headingId = useId();
	return (
		<section aria-labelledby={headingId} className="space-y-1">
			<h3 className="font-medium text-sm" id={headingId}>
				Terms you can use here
			</h3>
			{terms.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					None yet. Name a context entry on this element or one above it, then
					type &#123; in the description to refer to it.
				</p>
			) : (
				<ul className="space-y-1.5 text-xs">
					{terms.map((term) => (
						<li
							className="wrap-anywhere"
							key={`${term.definedOn.elementId}:${term.id}`}
						>
							<span className="font-medium">{term.name}</span>
							{term.variable && (
								<span className="text-muted-foreground">
									{" "}
									({variableNote(term.value)})
								</span>
							)}
							<span className="text-muted-foreground">
								{" "}
								defined on {term.definedOn.elementName ?? "an element above"}
							</span>
							{term.text.trim() && (
								<span className="block text-muted-foreground">{term.text}</span>
							)}
							{!term.variable && term.value?.trim() && (
								<span className="block text-muted-foreground">
									Value: {term.value}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
