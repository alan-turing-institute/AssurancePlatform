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
 * so the attributes the canvas puts on the elements it keeps (their tone, fade
 * and drawn content), and the attribute a capture puts on its root, are taken
 * out of the finished file as well.
 *
 * A drawn card's secondary text is in the full text colour on screen, set by a
 * stylesheet rule on `data-drawn-content`. The capture library copies each
 * element's computed style into its copy of the page, so the rule is switched
 * off for the length of a capture, by `data-capturing` on the capture's root.
 */

/** The attribute on every element that exists only to show a plugin's display. */
const PLUGIN_DISPLAY_ATTRIBUTE = "data-plugin-display";

/** The attribute on each content wrapper of a card a plugin has drawn. */
const DRAWN_CONTENT_ATTRIBUTE = "data-drawn-content";

/** The attribute on the root of a capture while the picture is taken. */
const CAPTURING_ATTRIBUTE = "data-capturing";

/** Every attribute that records a plugin's display or a capture in progress, and so stays out of an SVG image. */
const PLUGIN_DISPLAY_MARKERS = [
	"data-appearance",
	"data-faded",
	PLUGIN_DISPLAY_ATTRIBUTE,
	DRAWN_CONTENT_ATTRIBUTE,
	CAPTURING_ATTRIBUTE,
] as const;

/** The message when an SVG image cannot be cleaned, for the person exporting it. */
const SVG_NOT_PREPARED_MESSAGE =
	"The SVG image could not be prepared. Try again, or export a PNG.";

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

/**
 * The value of `data-drawn-content` for each content wrapper of a card a plugin
 * has drawn, which the stylesheet reads to draw the card's secondary text in
 * the full text colour. Absent for a card no plugin has drawn.
 */
export function drawnContentAttribute(
	appearance: { tone: string | null } | null | undefined
): "" | undefined {
	return appearance ? "" : undefined;
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

/** How many captures are under way on each root, so the first to finish does not clear the attribute from the others. */
const capturesUnderWay = new WeakMap<Element, number>();

/**
 * Takes the plugin's display off the canvas under `root` so the picture shows
 * the authored case: it removes the plugin's colour from every edge, and marks
 * `root` as being captured so a drawn card's secondary text returns to the
 * colour of a plain card. Returns the function that undoes both, to call once
 * the picture is taken, whether or not it succeeded. Called again, it does
 * nothing, so it cannot end another capture's mark. A property that has been
 * given a value since it was removed (the canvas redrew the edge while the
 * picture was being taken) is left as that newer value, not overwritten with
 * the old one.
 */
export function stripPluginAppearance(root: Element): () => void {
	capturesUnderWay.set(root, (capturesUnderWay.get(root) ?? 0) + 1);
	root.setAttribute(CAPTURING_ATTRIBUTE, "");
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
	let restored = false;
	return () => {
		if (restored) {
			return;
		}
		restored = true;
		for (const { path, property, value, priority } of saved) {
			if (path.style.getPropertyValue(property) === "") {
				path.style.setProperty(property, value, priority);
			}
		}
		const remaining = (capturesUnderWay.get(root) ?? 1) - 1;
		if (remaining > 0) {
			capturesUnderWay.set(root, remaining);
		} else {
			capturesUnderWay.delete(root);
			root.removeAttribute(CAPTURING_ATTRIBUTE);
		}
	};
}

/**
 * Takes the plugin display markers out of an SVG image of the canvas, given as
 * the data URL the capture library returns. The picture already leaves out
 * what a plugin drew, but the markup it is built from still carries, on the
 * elements it kept, the attributes the canvas uses to find them, and anyone
 * reading the file's source could read each element's tone and fade from
 * them, and which cards were drawn from the attribute on their content. The
 * markers come off the serialised copy, so the live canvas is left alone. A
 * data URL in any other form is refused rather than passed on with the
 * markers in it.
 */
export function removePluginDisplayMarkers(svgDataUrl: string): string {
	if (!svgDataUrl.startsWith(SVG_DATA_URL_HEAD)) {
		throw new Error(SVG_NOT_PREPARED_MESSAGE);
	}
	const markup = decodeURIComponent(svgDataUrl.slice(SVG_DATA_URL_HEAD.length));
	const image = new DOMParser().parseFromString(markup, "image/svg+xml");
	if (image.getElementsByTagName("parsererror").length > 0) {
		throw new Error(SVG_NOT_PREPARED_MESSAGE);
	}
	const marked = image.querySelectorAll(
		PLUGIN_DISPLAY_MARKERS.map((name) => `[${name}]`).join(",")
	);
	for (const element of marked) {
		for (const name of PLUGIN_DISPLAY_MARKERS) {
			element.removeAttribute(name);
		}
	}
	return `${SVG_DATA_URL_HEAD}${encodeURIComponent(
		new XMLSerializer().serializeToString(image.documentElement)
	)}`;
}
