import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { BlockPolicy, harden } from "rehype-harden";
import { defaultRehypePlugins, type StreamdownProps } from "streamdown";
import { LINK_SAFETY } from "@/lib/plugins/assistant/link-confirmation";

type RehypePlugin = NonNullable<StreamdownProps["rehypePlugins"]>[number];

/** The link protocols the sanitiser lets through; the hardening step below allows the same three. */
const LINK_PROTOCOLS = ["http", "https", "mailto"];

/** How many levels of nesting a reply may draw. Real text stays far below this. */
const MAX_NESTING = 50;

interface TextTreeNode {
	children?: TextTreeNode[];
	type: string;
	value?: string;
}

/** The text of a node and everything under it, in reading order. It keeps its own stack, so a very deep tree cannot overflow the call stack. */
function textOf(root: TextTreeNode): string {
	let text = "";
	const pending = [root];
	for (let node = pending.pop(); node; node = pending.pop()) {
		if (node.type === "text") {
			text += node.value ?? "";
		}
		for (const child of [...(node.children ?? [])].reverse()) {
			pending.push(child);
		}
	}
	return text;
}

/**
 * Flattens anything nested deeper than `MAX_NESTING` into its text. React draws
 * a tree by recursion, and a tree about a thousand levels deep (such as a
 * thousand nested quotations) overflows the call stack as it is put on the
 * page. An error boundary cannot catch that, so the depth is capped before the
 * tree reaches React.
 */
function limitNesting() {
	return (tree: TextTreeNode) => {
		const pending = [{ depth: 0, node: tree }];
		for (let item = pending.pop(); item; item = pending.pop()) {
			const { depth, node } = item;
			if (!node.children) {
				continue;
			}
			if (depth >= MAX_NESTING) {
				node.children = [{ type: "text", value: textOf(node) }];
				continue;
			}
			for (const child of node.children) {
				pending.push({ depth: depth + 1, node: child });
			}
		}
	};
}

/** Streamdown's own sanitiser with its link protocols narrowed to `LINK_PROTOCOLS`. Its default also lets irc, ircs, xmpp, tel and Streamdown's placeholder for a link still arriving through. */
function narrowedSanitiser(): RehypePlugin {
	const sanitiser = defaultRehypePlugins.sanitize;
	if (!(Array.isArray(sanitiser) && sanitiser.length === 2)) {
		throw new Error("Streamdown no longer provides its default HTML sanitiser");
	}
	const [plugin, schema] = sanitiser;
	return [
		plugin,
		{ ...schema, protocols: { ...schema.protocols, href: LINK_PROTOCOLS } },
	];
}

/**
 * What text written by the model may render, applied to replies and to
 * thinking. Raw HTML is never parsed, so it appears as text. Images are never
 * fetched: an image shows as its alt text. Links must be http, https or
 * mailto; any other link, and one still arriving, shows as plain text, and an
 * allowed link opens only after the reader confirms it. Diagram code is shown
 * as code, because a drawn diagram can fetch from other sites.
 *
 * Module-level, so each use passes the same objects: `MessageResponse` only
 * re-renders when its text changes, and it would ignore a new settings object.
 */
export const REPLY_MARKDOWN_PROPS: Pick<
	StreamdownProps,
	"linkSafety" | "plugins" | "rehypePlugins"
> = {
	linkSafety: LINK_SAFETY,
	plugins: { cjk, code, math },
	rehypePlugins: [
		limitNesting,
		narrowedSanitiser(),
		[
			harden,
			{
				allowedLinkPrefixes: ["*"],
				allowedImagePrefixes: [],
				allowedProtocols: ["http:", "https:", "mailto:"],
				allowDataImages: false,
				imageBlockPolicy: BlockPolicy.textOnly,
				linkBlockPolicy: BlockPolicy.textOnly,
			},
		],
	],
};
