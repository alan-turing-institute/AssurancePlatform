/**
 * What an image of the canvas leaves out. A plugin's display on the canvas
 * (the tint on a node, the colour on an edge, a badge, a status dot) shows
 * live state, and an image of the case carries no date to say when it was
 * live. Images, report diagrams and the dashboard thumbnail show the authored
 * case only.
 *
 * Elements that are a plugin's display carry `data-plugin-display`, and the
 * capture's filter drops them. An edge's colour is an inline style on its
 * path, which survives the capture's own stroke override, so the capture
 * removes it explicitly while it takes the picture.
 */

/** The attribute on every element that exists only to show a plugin's display. */
const PLUGIN_DISPLAY_ATTRIBUTE = "data-plugin-display";

/**
 * The value of `data-appearance` for an element or edge a plugin has drawn:
 * the tone, or "plain" for an appearance with no tone, so the attribute is
 * present for every appearance and the capture's `[data-appearance]` selector
 * finds them all. Absent for an element no plugin has drawn.
 */
export function appearanceAttribute(
	appearance: { tone: string | null } | null | undefined
): string | undefined {
	return appearance ? (appearance.tone ?? "plain") : undefined;
}

/** The properties a plugin's edge colour sets inline. */
const EDGE_APPEARANCE_PROPERTIES = [
	"stroke",
	"stroke-width",
	"stroke-opacity",
] as const;

/** A capture filter: false for an element that only shows a plugin's display. */
export function isAuthoredContent(domNode: HTMLElement): boolean {
	return !(
		domNode instanceof Element && domNode.hasAttribute(PLUGIN_DISPLAY_ATTRIBUTE)
	);
}

interface SavedStyle {
	path: SVGElement;
	priority: string;
	property: string;
	value: string;
}

/**
 * Removes the plugin's colour from every edge under `root` so the picture
 * shows the edges as authored. Returns the function that puts the colours
 * back, to call once the picture is taken.
 */
export function stripPluginAppearance(root: ParentNode): () => void {
	const saved: SavedStyle[] = [];
	for (const path of root.querySelectorAll<SVGElement>(
		".react-flow__edge-path[data-appearance]"
	)) {
		for (const property of EDGE_APPEARANCE_PROPERTIES) {
			const value = path.style.getPropertyValue(property);
			if (value !== "") {
				saved.push({
					path,
					property,
					value,
					priority: path.style.getPropertyPriority(property),
				});
				path.style.removeProperty(property);
			}
		}
	}
	return () => {
		for (const { path, property, value, priority } of saved) {
			path.style.setProperty(property, value, priority);
		}
	};
}
