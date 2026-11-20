import type { KeyboardEvent } from "react";

/**
 * Keeps Space from scrolling the page when it is pressed on a focused diagram
 * node or edge. The canvas library selects the item on Space but leaves the
 * browser's default scroll in place; selection is unaffected. Controls inside
 * a node (buttons, links) are left alone so Space still presses them.
 */
export function stopSpaceScrollOnDiagramItem(event: KeyboardEvent): void {
	if (event.key !== " " && event.code !== "Space") {
		return;
	}
	if (
		event.target instanceof Element &&
		event.target.matches(".react-flow__node, .react-flow__edge")
	) {
		event.preventDefault();
	}
}
