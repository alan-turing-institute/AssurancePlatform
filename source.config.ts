import { pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";
import { remarkUnwrapHeadingLinks } from "./lib/docs/remark-unwrap-heading-links";

export const docs = defineDocs({
	dir: "content",
	docs: {
		// Underscore-prefixed files (e.g. _TEMPLATE.md) are drafts/templates,
		// not pages — Nextra excluded them by the same convention.
		files: ["**/*.mdx", "**/*.md", "!**/_*"],
		schema: pageSchema.extend({
			level: z.string().optional(),
			sidebar_label: z.string().optional(),
			sidebar_position: z.number().optional(),
			tags: z.array(z.string()).optional(),
			assurance_goal: z.string().optional(),
			domain: z.string().optional(),
		}),
	},
});

export default defineConfig({
	mdxOptions: {
		// Content references images as absolute `/public`-relative URLs
		// (`![...](/images/foo.png)`), resolved at request time — not as
		// files sitting next to the MDX source. Fumadocs' default behaviour
		// turns image references into bundler imports, which doesn't fit
		// that convention; keep them as plain `src` strings instead.
		remarkImageOptions: { useImport: false },
		remarkPlugins: [remarkUnwrapHeadingLinks],
	},
});
