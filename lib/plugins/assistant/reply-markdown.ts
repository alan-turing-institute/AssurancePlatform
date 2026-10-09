import { BlockPolicy, harden } from "rehype-harden";
import { defaultRehypePlugins, type StreamdownProps } from "streamdown";

const sanitiser = defaultRehypePlugins.sanitize;
if (!sanitiser) {
	throw new Error("Streamdown no longer provides its default HTML sanitiser");
}

/**
 * What text written by the model may render, applied to replies and to
 * thinking. Raw HTML is never parsed, so it appears as text. Images are never
 * fetched: an image shows as its alt text. Links must be http, https or mailto.
 *
 * Module-level, so each use passes the same objects: `MessageResponse` only
 * re-renders when its text changes, and it would ignore a new settings object.
 */
export const REPLY_MARKDOWN_PROPS: Pick<StreamdownProps, "rehypePlugins"> = {
	rehypePlugins: [
		sanitiser,
		[
			harden,
			{
				allowedLinkPrefixes: ["*"],
				allowedImagePrefixes: [],
				allowedProtocols: ["http:", "https:", "mailto:"],
				allowDataImages: false,
				imageBlockPolicy: BlockPolicy.textOnly,
			},
		],
	],
};
