import { describe, expect, it } from "vitest";
import { remarkUnwrapHeadingLinks } from "../remark-unwrap-heading-links";

describe("remarkUnwrapHeadingLinks", () => {
	it("removes link nodes from heading content, keeping the link text", () => {
		const tree = {
			type: "root" as const,
			children: [
				{
					type: "heading",
					depth: 2,
					children: [
						{
							type: "link",
							url: "https://example.com/compare/v0.6.0...v0.6.1",
							children: [{ type: "text", value: "0.6.1" }],
						},
						{ type: "text", value: " (2026-09-08)" },
					],
				},
			],
		};

		remarkUnwrapHeadingLinks()(tree);

		const heading = tree.children[0]!;
		const hasLink = heading.children.some((child) => child.type === "link");
		expect(hasLink).toBe(false);
		expect(heading.children.map((child) => child.value)).toEqual([
			"0.6.1",
			" (2026-09-08)",
		]);
	});

	it("leaves links outside headings untouched", () => {
		const tree = {
			type: "root" as const,
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "link",
							url: "https://example.com",
							children: [{ type: "text", value: "example" }],
						},
					],
				},
			],
		};

		remarkUnwrapHeadingLinks()(tree);

		const paragraph = tree.children[0]!;
		expect(paragraph.children[0]?.type).toBe("link");
	});
});
