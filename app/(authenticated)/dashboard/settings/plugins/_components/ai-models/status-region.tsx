import type { ReactNode } from "react";

export interface StatusRegionProps {
	children?: ReactNode;
	className?: string;
}

/**
 * A live region that is on the page from the start, so a result that appears
 * in it is announced. It is a div rather than an output element because these
 * regions hold paragraphs and lists, which an output element may not.
 */
export function StatusRegion({ children, className }: StatusRegionProps) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: an output element may hold only phrasing content, and these regions hold paragraphs and lists
		<div className={className} role="status">
			{children}
		</div>
	);
}
