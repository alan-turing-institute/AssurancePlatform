/**
 * Remark plugin: strips links from heading content, keeping the link text.
 *
 * Fumadocs renders each heading's own content twice: once wrapped in its
 * default "copy anchor" link, and again in the sidebar table of contents,
 * which clones the heading's rendered content so inline formatting (bold,
 * code) shows up there too. A heading whose own text is already a link —
 * e.g. this project's changelog, where semantic-release writes headings
 * shaped like `## [0.6.1](https://.../compare/...) (2026-09-08)` — ends up
 * with a link nested inside a link in both places. Nesting an `<a>` inside
 * an `<a>` is invalid HTML: the browser closes the outer tag early,
 * producing a DOM the server didn't render — a React hydration mismatch,
 * not a cosmetic one.
 *
 * Fixing it here, in the heading's own AST before either consumer sees it,
 * is the single place that reaches both today's renderers and any future
 * one, rather than patching each rendering surface individually. (An
 * earlier version of this fix also shipped a custom heading component,
 * `components/docs/safe-heading.tsx`, to neutralise the "copy anchor" link
 * specifically — removed once this plugin alone was confirmed sufficient:
 * with the fix here running before Fumadocs' default heading renders, no
 * heading ever reaches JSX with a nested link left to guard against.)
 *
 * A minimal structural type stands in for `mdast`'s `Root`/`Heading`, so
 * this doesn't need `@types/mdast` as a direct dependency.
 */

interface MdastNode {
	children?: MdastNode[];
	type: string;
	[key: string]: unknown;
}

interface MdastRoot {
	children: MdastNode[];
	type: "root";
}

function unwrapLinks(nodes: MdastNode[]): MdastNode[] {
	const out: MdastNode[] = [];
	for (const node of nodes) {
		if (node.type === "link" && Array.isArray(node.children)) {
			out.push(...unwrapLinks(node.children));
		} else if (Array.isArray(node.children)) {
			out.push({ ...node, children: unwrapLinks(node.children) });
		} else {
			out.push(node);
		}
	}
	return out;
}

export function remarkUnwrapHeadingLinks() {
	return (tree: MdastRoot) => {
		for (const node of tree.children) {
			if (node.type === "heading" && Array.isArray(node.children)) {
				node.children = unwrapLinks(node.children);
			}
		}
	};
}
