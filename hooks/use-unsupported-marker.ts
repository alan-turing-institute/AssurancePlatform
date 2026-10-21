"use client";

import { isUnsupported } from "@/lib/case/unsupported";
import useStore from "@/store/store";

/**
 * Whether the canvas node with this id carries the unsupported marker for
 * the person viewing it.
 *
 * No node carries it on the read-only documentation canvas, where the
 * trainee curriculum asks readers to find the gaps themselves, nor while the
 * viewer's setting has not loaded yet, so a viewer who has switched the
 * markers off never sees them flash on as the page opens. The selector
 * returns a boolean, never a new set or array, so it compares equal between
 * store updates and does not re-render the card for changes elsewhere on the
 * diagram.
 */
export function useUnsupportedMarker(nodeId: string): boolean {
	return useStore(
		(state) =>
			!state.readOnlyCanvas &&
			state.showUnsupportedMarkers === true &&
			isUnsupported(state.nodes, nodeId)
	);
}
