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
 * removes it explicitly while it takes the picture. An SVG image is markup,
 * so the attributes the canvas puts on the elements it keeps (their tone and
 * fade), and the class it puts on a drawn card's content, are taken out of
 * the finished file as well.
 */

/** The attribute on every element that exists only to show a plugin's display. */
const PLUGIN_DISPLAY_ATTRIBUTE = "data-plugin-display";

/** Every attribute the canvas sets to record that a plugin has drawn an element. */
const PLUGIN_DISPLAY_MARKERS = [
	"data-appearance",
	"data-faded",
	PLUGIN_DISPLAY_ATTRIBUTE,
] as const;

/**
 * The class on the content wrappers of a card a plugin has drawn. It sets the
 * card's secondary text to the full text colour, which a card with no
 * appearance does not have.
 */
export const DRAWN_CONTENT_CLASS = "[--muted-foreground:var(--foreground)]";

/** The start of the data URL the capture library returns for an SVG image; the markup follows, percent-encoded. */
const SVG_DATA_URL_HEAD = "data:image/svg+xml;charset=utf-8,";

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
 * back, to call once the picture is taken. A property that has been given a
 * value since it was removed (the canvas redrew the edge while the picture was
 * being taken) is left as that newer value, not overwritten with the old one.
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
			if (path.style.getPropertyValue(property) === "") {
				path.style.setProperty(property, value, priority);
			}
		}
	};
}

/**
 * Takes the plugin display markers out of an SVG image of the canvas, given as
 * the data URL the capture library returns. The picture already leaves out
 * what a plugin drew, but the markup it is built from still carries, on the
 * elements it kept, the attributes the canvas uses to find them, and anyone
 * reading the file's source could read each element's tone and fade from
 * them, and which cards were drawn from the class on their content. The
 * markers come off the serialised copy, so the live canvas is left alone. A
 * data URL in any other form is refused rather than passed on with the
 * markers in it.
 */
export function removePluginDisplayMarkers(svgDataUrl: string): string {
	if (!svgDataUrl.startsWith(SVG_DATA_URL_HEAD)) {
		throw new Error("The SVG image is not in a form the export can clean.");
	}
	const markup = decodeURIComponent(svgDataUrl.slice(SVG_DATA_URL_HEAD.length));
	const image = new DOMParser().parseFromString(markup, "image/svg+xml");
	if (image.getElementsByTagName("parsererror").length > 0) {
		throw new Error("The SVG image could not be read to clean it.");
	}
	const marked = image.querySelectorAll(
		[
			...PLUGIN_DISPLAY_MARKERS.map((name) => `[${name}]`),
			`[class~="${DRAWN_CONTENT_CLASS}"]`,
		].join(",")
	);
	for (const element of marked) {
		for (const name of PLUGIN_DISPLAY_MARKERS) {
			element.removeAttribute(name);
		}
		element.classList.remove(DRAWN_CONTENT_CLASS);
	}
	return `${SVG_DATA_URL_HEAD}${encodeURIComponent(
		new XMLSerializer().serializeToString(image.documentElement)
	)}`;
}
