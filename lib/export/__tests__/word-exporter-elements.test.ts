import { describe, expect, it } from "vitest";
import { elementBlock } from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import {
	type DocxBodyItem,
	docxContent,
	docxLinks,
	docxParagraphs,
	paragraphTexts,
} from "@/src/__tests__/utils/export-docx-kit";
import { WordExporter } from "../exporters/word-exporter";
import type { ContentBlock, ExportResult, RenderedSection } from "../types";

const exporter = new WordExporter();

const PNG_DATA = "iVBORw0KGgo=";

function exportSections(sections: RenderedSection[]): Promise<ExportResult> {
	return exporter.export(exportDocument({ sections }), { caseName: "Test" });
}

function exportBlocks(blocks: ContentBlock[]): Promise<ExportResult> {
	return exportSections([exportSection("goals", "", blocks)]);
}

/** The text of the paragraphs that hold text, in order. */
async function textsOfSections(sections: RenderedSection[]): Promise<string[]> {
	const items = await docxContent(await exportSections(sections));
	return paragraphTexts(docxParagraphs(items));
}

async function textsOf(blocks: ContentBlock[]): Promise<string[]> {
	return await textsOfSections([exportSection("goals", "", blocks)]);
}

/** The items without the empty paragraphs that only space the content. */
function withoutSpacers(items: DocxBodyItem[]): DocxBodyItem[] {
	return items.filter(
		(item) =>
			item.kind === "table" ||
			item.paragraph.text !== "" ||
			item.paragraph.hasImage ||
			item.paragraph.bottomBorder !== undefined
	);
}

/** One entry for each item: a table as its rows, a paragraph as what it holds. */
function describeItem(item: DocxBodyItem): unknown {
	if (item.kind === "table") {
		return item.table.rows;
	}
	const { text, style, hasImage, bottomBorder } = item.paragraph;
	return { text, style, hasImage, bottomBorder };
}

describe("WordExporter element type and name", () => {
	it.each([
		["GOAL", "Goal"],
		["STRATEGY", "Strategy"],
		["PROPERTY_CLAIM", "Property Claim"],
		["EVIDENCE", "Evidence"],
		["AWAY_GOAL", "Away Goal"],
	] as const)("writes an element of type %s with the label %s and its name", async (type, label) => {
		const texts = await textsOf([elementBlock({ type })]);

		expect(texts).toStrictEqual([`${label}: N`]);
	});

	it("writes the type alone as the title of an element without a name", async () => {
		expect(await textsOf([elementBlock({ name: null })])).toStrictEqual([
			"Goal",
		]);
	});

	it("writes only the title for an element with no optional fields", async () => {
		const texts = await textsOf([
			elementBlock({ context: [], comments: [], inSandbox: false }),
		]);

		expect(texts).toStrictEqual(["Goal: N"]);
	});

	it("writes the title of an element as a paragraph that is not a heading", async () => {
		const items = await docxContent(await exportBlocks([elementBlock({})]));

		expect(docxParagraphs(items)[0]?.style).toBeUndefined();
	});

	it("writes elements in the order given", async () => {
		const texts = await textsOf([
			elementBlock({ name: "Second" }),
			elementBlock({ name: "First" }),
		]);

		expect(texts).toStrictEqual(["Goal: Second", "Goal: First"]);
	});
});

describe("WordExporter element fields", () => {
	it("writes every field of an element in order", async () => {
		const texts = await textsOf([
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

		expect(texts).toStrictEqual([
			"Goal: N",
			"D",
			"Context:",
			"• c1",
			"• c2",
			"Assumption: A",
			"Justification: J",
			"URL: https://u.test/x",
			"[Draft]",
			"Comments:",
			"me (15/01/2024)\nhi",
		]);
	});

	it.each([
		["a description", { description: "D" }, "D"],
		["an assumption", { assumption: "A" }, "Assumption: A"],
		["a justification", { justification: "J" }, "Justification: J"],
	] as const)("writes %s on its own when it is the only field", async (_label, fields, written) => {
		const texts = await textsOf([elementBlock(fields)]);

		expect(texts).toStrictEqual(["Goal: N", written]);
	});

	it("leaves out empty descriptions, assumptions, justifications and addresses", async () => {
		const texts = await textsOf([
			elementBlock({
				description: "",
				assumption: "",
				justification: "",
				url: "",
			}),
		]);

		expect(texts).toStrictEqual(["Goal: N"]);
	});

	it("writes the address of an element as a link that points to it", async () => {
		const result = await exportBlocks([
			elementBlock({ url: "https://u.test/a?x=1&y=2" }),
		]);

		expect(await docxLinks(result)).toStrictEqual([
			{ text: "https://u.test/a?x=1&y=2", target: "https://u.test/a?x=1&y=2" },
		]);
	});

	it("writes no link for an element without an address", async () => {
		const result = await exportBlocks([elementBlock({ description: "D" })]);

		expect(await docxLinks(result)).toStrictEqual([]);
	});
});

describe("WordExporter element context", () => {
	it("writes each context item as its own line, in the order given", async () => {
		const texts = await textsOf([elementBlock({ context: ["b", "a"] })]);

		expect(texts).toStrictEqual(["Goal: N", "Context:", "• b", "• a"]);
	});

	it("writes no context heading for an empty context", async () => {
		const texts = await textsOf([elementBlock({ context: [] })]);

		expect(texts).toStrictEqual(["Goal: N"]);
	});
});

describe("WordExporter element comments", () => {
	it("writes the author, the date and the content of a comment", async () => {
		const texts = await textsOf([
			elementBlock({
				comments: [
					{ author: "me", content: "hi", createdAt: "2024-01-15T12:00:00Z" },
				],
			}),
		]);

		expect(texts).toStrictEqual([
			"Goal: N",
			"Comments:",
			"me (15/01/2024)\nhi",
		]);
	});

	it("writes a comment without a date when it has none", async () => {
		const texts = await textsOf([
			elementBlock({
				comments: [{ author: "me", content: "hi", createdAt: "" }],
			}),
		]);

		expect(texts).toStrictEqual(["Goal: N", "Comments:", "me\nhi"]);
	});

	it("writes one paragraph for each comment, in the order given", async () => {
		const texts = await textsOf([
			elementBlock({
				comments: [
					{ author: "b", content: "second", createdAt: "" },
					{ author: "a", content: "first", createdAt: "" },
				],
			}),
		]);

		expect(texts).toStrictEqual([
			"Goal: N",
			"Comments:",
			"b\nsecond",
			"a\nfirst",
		]);
	});

	it("writes no comments heading for an empty list of comments", async () => {
		const texts = await textsOf([elementBlock({ comments: [] })]);

		expect(texts).toStrictEqual(["Goal: N"]);
	});
});

describe("WordExporter element sandbox marker", () => {
	it.each([
		[true, ["Goal: N", "[Draft]"]],
		[false, ["Goal: N"]],
	])("writes the draft marker only when in the sandbox is %s", async (inSandbox, written) => {
		const texts = await textsOf([elementBlock({ inSandbox })]);

		expect(texts).toStrictEqual(written);
	});
});

/** The depth at which the indent of an element stops growing. */
const LAST_INDENTED_DEPTH = 3;

/** The left indent of the title line of elements drawn at depths 0 to 5 in one document. */
async function titleIndentsByDepth(): Promise<number[]> {
	const depths = [0, 1, 2, 3, 4, 5];
	const items = await docxContent(
		await exportBlocks(
			depths.map((depth) =>
				elementBlock({ id: `n${depth}`, name: `D${depth}` }, depth)
			)
		)
	);
	const paragraphs = docxParagraphs(items);
	return depths.map(
		(depth) =>
			paragraphs.find((p) => p.text === `Goal: D${depth}`)?.indent ?? Number.NaN
	);
}

describe("WordExporter element depth", () => {
	it("indents an element further for each level of depth, up to the deepest indented level", async () => {
		const indents = await titleIndentsByDepth();

		for (let depth = 0; depth < LAST_INDENTED_DEPTH; depth++) {
			expect(indents[depth + 1]).toBeGreaterThan(indents[depth] as number);
		}
	});

	it("keeps the indent of an element the same beyond the deepest indented level", async () => {
		const indents = await titleIndentsByDepth();

		expect(indents[4]).toBe(indents[LAST_INDENTED_DEPTH]);
		expect(indents[5]).toBe(indents[LAST_INDENTED_DEPTH]);
	});
});

const COMMENT_LINE = "me (15/01/2024)\nhi";

/** The left indent of each line of one fully written element, by its text. */
async function indentsOfLines(depth: number): Promise<Map<string, number>> {
	const items = await docxContent(
		await exportBlocks([
			elementBlock(
				{
					description: "D",
					context: ["c1"],
					assumption: "A",
					justification: "J",
					url: "https://u.test/x",
					inSandbox: true,
					comments: [
						{ author: "me", content: "hi", createdAt: "2024-01-15T12:00:00Z" },
					],
				},
				depth
			),
		])
	);
	return new Map(
		docxParagraphs(items)
			.filter((p) => p.text !== "")
			.map((p) => [p.text, p.indent])
	);
}

describe("WordExporter element line indentation", () => {
	it.each([
		0, 2, 5,
	])("indents the context lines and the comment lines of an element at depth %i further than its title", async (depth) => {
		const indents = await indentsOfLines(depth);
		const title = indents.get("Goal: N") as number;

		expect(indents.get("• c1") as number).toBeGreaterThan(title);
		expect(indents.get(COMMENT_LINE) as number).toBeGreaterThan(title);
	});

	it.each([
		"D",
		"Context:",
		"Assumption: A",
		"Justification: J",
		"URL: https://u.test/x",
		"[Draft]",
		"Comments:",
	])("indents the line %j of an element at least as far as its title", async (line) => {
		const indents = await indentsOfLines(2);

		expect(indents.get(line) as number).toBeGreaterThanOrEqual(
			indents.get("Goal: N") as number
		);
	});
});

describe("WordExporter content blocks of a section", () => {
	it("turns each kind of block into its own kind of content, in the order given", async () => {
		const items = await docxContent(
			await exportBlocks([
				{ type: "metadata", key: "K", value: "V" },
				elementBlock({}),
				{ type: "divider" },
				{ type: "image", src: PNG_DATA, alt: "Alt" },
				{ type: "table", headers: ["H"], rows: [["c"]] },
				{ type: "list", ordered: false, items: ["i"] },
				{ type: "paragraph", text: "P" },
				{ type: "heading", level: 3, text: "T" },
			])
		);

		expect(withoutSpacers(items).map(describeItem)).toStrictEqual([
			{
				text: "K: V",
				style: undefined,
				hasImage: false,
				bottomBorder: undefined,
			},
			{
				text: "Goal: N",
				style: undefined,
				hasImage: false,
				bottomBorder: undefined,
			},
			{ text: "", style: undefined, hasImage: false, bottomBorder: "single" },
			{ text: "", style: undefined, hasImage: true, bottomBorder: undefined },
			[["H"], ["c"]],
			{
				text: "• i",
				style: undefined,
				hasImage: false,
				bottomBorder: undefined,
			},
			{ text: "P", style: undefined, hasImage: false, bottomBorder: undefined },
			{
				text: "T",
				style: "Heading3",
				hasImage: false,
				bottomBorder: undefined,
			},
		]);
	});
});

describe("WordExporter section titles", () => {
	it("writes the title of a section as a level 2 heading before its blocks", async () => {
		const items = await docxContent(
			await exportSections([
				exportSection("goals", "Goals", [{ type: "paragraph", text: "P" }]),
			])
		);

		expect(items.map(describeItem)).toMatchObject([
			{ text: "Goals", style: "Heading2" },
			{ text: "P", style: undefined },
		]);
	});

	it("writes no title for a section with an empty title", async () => {
		const texts = await textsOfSections([
			exportSection("goals", "", [{ type: "paragraph", text: "P" }]),
		]);

		expect(texts).toStrictEqual(["P"]);
	});

	it("writes only its title for a section with no blocks", async () => {
		const items = await docxContent(
			await exportSections([exportSection("goals", "Goals", [])])
		);

		expect(items.map(describeItem)).toMatchObject([
			{ text: "Goals", style: "Heading2" },
		]);
	});

	it("writes nothing for a section with no title and no blocks", async () => {
		const texts = await textsOfSections([
			exportSection("goals", "", []),
			exportSection("goals", "", [{ type: "paragraph", text: "P" }]),
		]);

		expect(texts).toStrictEqual(["P"]);
	});

	it("keeps the sections in the order given", async () => {
		const texts = await textsOfSections([
			exportSection("evidence", "Two", [{ type: "paragraph", text: "b" }]),
			exportSection("goals", "One", [{ type: "paragraph", text: "a" }]),
		]);

		expect(texts).toStrictEqual(["Two", "b", "One", "a"]);
	});
});
