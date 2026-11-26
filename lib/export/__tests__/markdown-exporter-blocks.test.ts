import { describe, expect, it } from "vitest";
import type { PlainTreeNode } from "@/lib/case/defined-terms";
import { exportNode } from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import { MarkdownExporter } from "../exporters/markdown-exporter";
import type { ContentBlock, RenderedDocument, RenderedSection } from "../types";

const exporter = new MarkdownExporter();
const BASE64_IMAGE_LINE =
	/^\n# Test Case\n\n## Goals\n\n!\[Alt\]\(\S+\)\n\*Cap\*\n$/;

/** What the exporter writes for the case name when a section is not a title page. */
const TITLE = "# Test Case\n";
/** The text between the front matter and the first block of a "Goals" section. */
const GOALS_HEAD = `\n${TITLE}\n## Goals\n\n`;

async function exportContent(document: RenderedDocument): Promise<string> {
	const result = await exporter.export(document, { caseName: "Test" });
	if (!(result.success && "content" in result)) {
		throw new Error("the Markdown export failed");
	}
	return result.content;
}

/** Everything after the front matter, starting with the line break that ends it. */
async function bodyOf(document: RenderedDocument): Promise<string> {
	const content = await exportContent(document);
	return content.slice(content.indexOf("\n---\n") + 5);
}

function withSections(...sections: RenderedSection[]): RenderedDocument {
	return exportDocument({ sections });
}

function goalsBody(blocks: ContentBlock[]): Promise<string> {
	return bodyOf(withSections(exportSection("goals", "Goals", blocks)));
}

function paragraph(text: string): ContentBlock {
	return { type: "paragraph", text };
}

function elementBlock(fields: Partial<PlainTreeNode>, depth = 0): ContentBlock {
	return {
		type: "element",
		node: exportNode({ id: "n1", type: "GOAL", name: "N", ...fields }),
		depth,
	};
}

describe("MarkdownExporter result", () => {
	it("names the file after the case and the export date and reports its type", async () => {
		const result = await exporter.export(exportDocument(), {
			caseName: "My Case!",
			timestamp: new Date("2024-03-05T10:00:00Z"),
		});

		expect(result).toMatchObject({
			success: true,
			filename: "my-case-2024-03-05.md",
			mimeType: "text/markdown",
		});
		expect(result).toHaveProperty("content");
	});

	it("reports a failure with the reason when the document cannot be read", async () => {
		const document: RenderedDocument = {
			...exportDocument(),
			get sections(): RenderedSection[] {
				throw new Error("boom");
			},
		};

		expect(await exporter.export(document, { caseName: "Test" })).toStrictEqual(
			{ success: false, error: "Markdown export failed: boom" }
		);
	});

	it("reports a failure with a general reason when something other than an error is thrown", async () => {
		const reason: unknown = "boom";
		const document: RenderedDocument = {
			...exportDocument(),
			get sections(): RenderedSection[] {
				throw reason;
			},
		};

		expect(await exporter.export(document, { caseName: "Test" })).toStrictEqual(
			{
				success: false,
				error: "Markdown export failed: Unknown error occurred",
			}
		);
	});
});

describe("MarkdownExporter front matter", () => {
	it("writes every field in order, then the case title", async () => {
		const content = await exportContent(
			exportDocument({
				metadata: {
					caseDescription: "Desc",
					exportedBy: "Ann",
					elementCount: 3,
				},
				branding: { organisationName: "Org" },
			})
		);

		expect(content).toBe(
			[
				"---",
				'title: "Test Case"',
				'description: "Desc"',
				'exportedAt: "2024-01-15T10:00:00Z"',
				'exportedBy: "Ann"',
				'version: "1.0"',
				"elementCount: 3",
				'generator: "TEA Platform"',
				'organisation: "Org"',
				"---",
				"",
				TITLE,
			].join("\n")
		);
	});

	it("leaves out the description, the author and the organisation when they are empty", async () => {
		const content = await exportContent(exportDocument());

		expect(content).toBe(
			[
				"---",
				'title: "Test Case"',
				'exportedAt: "2024-01-15T10:00:00Z"',
				'version: "1.0"',
				"elementCount: 1",
				'generator: "TEA Platform"',
				"---",
				"",
				TITLE,
			].join("\n")
		);
	});

	it.each([
		["a tab", "\t", "\\t"],
		["a line separator", " ", "\\u2028"],
		["a paragraph separator", " ", "\\u2029"],
		["a null character", "\u0000", "\\x00"],
		["the last C1 control character", "\u009f", "\\x9F"],
	])("writes %s in a value as a YAML escape", async (_label, typed, written) => {
		const content = await exportContent(
			exportDocument({ metadata: { caseDescription: `a${typed}b` } })
		);

		expect(content).toContain(`description: "a${written}b"`);
	});
});

describe("MarkdownExporter document layout", () => {
	it("keeps the sections in the order given and skips an empty one", async () => {
		const body = await bodyOf(
			withSections(
				exportSection("evidence", "Evidence", [paragraph("E")]),
				exportSection("goals", "Empty", []),
				exportSection("goals", "Goals", [paragraph("G")])
			)
		);

		expect(body).toBe(`\n${TITLE}\n## Evidence\n\nE\n\n## Goals\n\nG\n`);
	});

	it("writes no title for a section with an empty title", async () => {
		const body = await bodyOf(
			withSections(exportSection("goals", "", [paragraph("G")]))
		);

		expect(body).toBe(`\n${TITLE}\nG\n`);
	});

	it("leaves out the case title when the first section is a title page", async () => {
		const body = await bodyOf(
			withSections(exportSection("title-page", "Cover", [paragraph("Cover")]))
		);

		expect(body).toBe("\nCover\n");
	});

	it("writes the case title when a title page is not the first section", async () => {
		const body = await bodyOf(
			withSections(
				exportSection("goals", "Goals", [paragraph("G")]),
				exportSection("title-page", "Cover", [paragraph("Cover")])
			)
		);

		expect(body).toBe(`\n${TITLE}\n## Goals\n\nG\n\nCover\n`);
	});

	it("writes only the case title when there are no sections", async () => {
		expect(await bodyOf(exportDocument())).toBe(`\n${TITLE}`);
	});
});

describe("MarkdownExporter section title", () => {
	it("is not written twice when the first block is the same level 2 heading", async () => {
		const body = await goalsBody([
			{ type: "heading", level: 2, text: "Goals" },
			paragraph("P"),
		]);

		expect(body).toBe(`\n${TITLE}\n## Goals\n\nP\n`);
	});

	it.each([
		[
			"the heading is level 3",
			{ type: "heading", level: 3, text: "Goals" } as ContentBlock,
			"### Goals\n",
		],
		[
			"the heading has other text",
			{ type: "heading", level: 2, text: "Other" } as ContentBlock,
			"## Other\n",
		],
		[
			"the first block is a paragraph with the same text",
			paragraph("Goals"),
			"Goals\n",
		],
	])("is written when %s", async (_label, first, written) => {
		const body = await goalsBody([first, paragraph("P")]);

		expect(body).toBe(`${GOALS_HEAD}${written}\nP\n`);
	});

	it("is written when the matching heading is not the first block", async () => {
		const body = await goalsBody([
			paragraph("P"),
			{ type: "heading", level: 2, text: "Goals" },
		]);

		expect(body).toBe(`${GOALS_HEAD}P\n\n## Goals\n`);
	});
});

describe("MarkdownExporter blocks", () => {
	it.each([
		1, 2, 3, 4, 5, 6,
	] as const)("writes a level %i heading", async (level) => {
		const body = await goalsBody([{ type: "heading", level, text: "T" }]);

		expect(body).toBe(`${GOALS_HEAD}${"#".repeat(level)} T\n`);
	});

	it("skips empty and blank paragraphs without leaving a gap", async () => {
		const body = await goalsBody([
			paragraph("A"),
			paragraph(""),
			paragraph("  \n "),
			paragraph("B"),
		]);

		expect(body).toBe(`${GOALS_HEAD}A\n\nB\n`);
	});

	it.each([
		[false, "- a\n- b\n"],
		[true, "1. a\n2. b\n"],
	])("writes a list with ordered %s", async (ordered, written) => {
		const body = await goalsBody([
			{ type: "list", ordered, items: ["a", "b"] },
		]);

		expect(body).toBe(`${GOALS_HEAD}${written}`);
	});

	it("skips an empty list and a table without headers without leaving a gap", async () => {
		const body = await goalsBody([
			paragraph("A"),
			{ type: "list", ordered: true, items: [] },
			{ type: "table", headers: [], rows: [["x"]] },
			paragraph("B"),
		]);

		expect(body).toBe(`${GOALS_HEAD}A\n\nB\n`);
	});

	it("writes a table with its header row, a separator and one line per row", async () => {
		const body = await goalsBody([
			{
				type: "table",
				headers: ["A", "B"],
				rows: [
					["1", "2"],
					["3", "4"],
				],
			},
		]);

		expect(body).toBe(
			`${GOALS_HEAD}| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n`
		);
	});

	it("writes a table that has no rows as its header and separator", async () => {
		const body = await goalsBody([{ type: "table", headers: ["A"], rows: [] }]);

		expect(body).toBe(`${GOALS_HEAD}| A |\n| --- |\n`);
	});

	it("fills a short row with empty cells", async () => {
		const body = await goalsBody([
			{ type: "table", headers: ["A", "B", "C"], rows: [["1"], ["2", "3"]] },
		]);

		expect(body).toBe(
			`${GOALS_HEAD}| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |\n| 2 | 3 |  |\n`
		);
	});

	it("keeps every cell of a row longer than the header", async () => {
		const body = await goalsBody([
			{ type: "table", headers: ["A"], rows: [["1", "2"]] },
		]);

		expect(body).toBe(`${GOALS_HEAD}| A |\n| --- |\n| 1 | 2 |\n`);
	});

	it("writes a divider between two paragraphs", async () => {
		const body = await goalsBody([
			paragraph("A"),
			{ type: "divider" },
			paragraph("B"),
		]);

		expect(body).toBe(`${GOALS_HEAD}A\n\n---\n\nB\n`);
	});

	it("writes a metadata block as a bold key and its value", async () => {
		const body = await goalsBody([
			{ type: "metadata", key: "Key", value: "Value" },
			{ type: "metadata", key: "Other", value: "More" },
		]);

		expect(body).toBe(`${GOALS_HEAD}**Key:** Value\n\n**Other:** More\n`);
	});
});

describe("MarkdownExporter images", () => {
	it.each([
		[
			"with a caption",
			"https://x.test/a.png",
			"Cap",
			"![Alt](https://x.test/a.png)\n*Cap*\n",
		],
		[
			"without a caption",
			"https://x.test/a.png",
			undefined,
			"![Alt](https://x.test/a.png)\n",
		],
		[
			"without a source but with a caption",
			"",
			"Cap",
			"*[Image: Alt]*\n*Cap*\n",
		],
		["without a source or a caption", "", undefined, "*[Image: Alt]*\n"],
		[
			"a data address",
			"data:image/png;base64,AAAA",
			undefined,
			"![Alt](data:image/png;base64,AAAA)\n",
		],
		[
			"an unrecognised source",
			"pictures/a.png",
			undefined,
			"![Alt](pictures/a.png)\n",
		],
	])("writes an image %s", async (_label, src, caption, written) => {
		const body = await goalsBody([{ type: "image", src, alt: "Alt", caption }]);

		expect(body).toBe(`${GOALS_HEAD}${written}`);
	});

	it.each([
		["a PNG", "iVBORw0KGgoAAAANSUhEUg"],
		["an SVG", "PHN2ZyB4bWxucz0iaHR0cDovL3d3"],
		["an SVG with an XML declaration", "PD94bWwgdmVyc2lvbj0iMS4wIj8+"],
		["a JPEG", "/9j/4AAQSkZJRgABAQ"],
	])("refers to %s given as base64 without writing the data out", async (_label, src) => {
		const body = await goalsBody([
			{ type: "image", src, alt: "Alt", caption: "Cap" },
		]);

		expect(body).toMatch(BASE64_IMAGE_LINE);
		expect(body).not.toContain(src);
	});
});

describe("MarkdownExporter elements", () => {
	it.each([
		[0, "###"],
		[1, "####"],
		[2, "#####"],
		[3, "######"],
		[4, "######"],
		[9, "######"],
	])("writes an element at depth %i as a heading of that level", async (depth, hashes) => {
		const body = await goalsBody([elementBlock({}, depth)]);

		expect(body).toBe(`${GOALS_HEAD}${hashes} Goal: N\n`);
	});

	it("writes the type alone as the title of an element without a name", async () => {
		const body = await goalsBody([elementBlock({ name: null })]);

		expect(body).toBe(`${GOALS_HEAD}### Goal\n`);
	});

	it("writes nothing but the title for an element with no optional fields", async () => {
		const body = await goalsBody([
			elementBlock({ context: [], comments: [], inSandbox: false }),
		]);

		expect(body).toBe(`${GOALS_HEAD}### Goal: N\n`);
	});

	it("writes every field of an element in order", async () => {
		const body = await goalsBody([
			elementBlock({
				description: "D",
				context: ["c1", "c2"],
				assumption: "A",
				justification: "J",
				url: "https://u.test/x",
				inSandbox: true,
				comments: [
					{ author: "me", content: "hi", createdAt: "2024-01-15T12:00:00Z" },
				],
			}),
		]);

		expect(body).toBe(
			`${GOALS_HEAD}${[
				"### Goal: N\n",
				"D\n",
				"**Context:**\n\n- c1\n- c2\n",
				"**Assumption:** A\n",
				"**Justification:** J\n",
				"**URL:** [https://u.test/x](<https://u.test/x>)\n",
				"*\\[Draft\\]*\n",
				"**Comments:**\n\n> **me** (15/01/2024): hi\n",
			].join("\n")}`
		);
	});

	it("writes a comment without a date when it has none", async () => {
		const body = await goalsBody([
			elementBlock({
				comments: [{ author: "me", content: "hi", createdAt: "" }],
			}),
		]);

		expect(body).toBe(
			`${GOALS_HEAD}### Goal: N\n\n**Comments:**\n\n> **me**: hi\n`
		);
	});

	it("writes one line for each comment, in the order given", async () => {
		const body = await goalsBody([
			elementBlock({
				comments: [
					{ author: "b", content: "second", createdAt: "" },
					{ author: "a", content: "first", createdAt: "" },
				],
			}),
		]);

		expect(body).toBe(
			`${GOALS_HEAD}### Goal: N\n\n**Comments:**\n\n> **b**: second\n> **a**: first\n`
		);
	});

	it("writes the draft marker only for an element in the sandbox", async () => {
		const draft = await goalsBody([elementBlock({ inSandbox: true })]);
		const published = await goalsBody([elementBlock({ inSandbox: false })]);

		expect(draft).toContain("*\\[Draft\\]*");
		expect(published).not.toContain("Draft");
	});
});
