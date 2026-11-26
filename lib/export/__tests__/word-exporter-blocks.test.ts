import { describe, expect, it } from "vitest";
import { paragraph } from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import {
	type DocxBodyItem,
	type DocxParagraph,
	docxContent,
	docxMediaBytes,
	docxMediaNames,
	docxParagraphs,
	docxPart,
	docxTables,
} from "@/src/__tests__/utils/export-docx-kit";
import { WordExporter } from "../exporters/word-exporter";
import type { ContentBlock, ExportResult } from "../types";

const exporter = new WordExporter();

/** Eight bytes that start every PNG file, as base64. */
const PNG_DATA = "iVBORw0KGgo=";
const JPEG_DATA = "/9j/4AA=";
const GIF_DATA = "R0lGODlh";
const BMP_DATA = "Qk0AAAAA";
/** Text that is none of the four picture kinds. */
const OTHER_DATA = "PHN2Zz4=";
/** Starts like a JPEG file but ends with the characters that start a PNG file. */
const JPEG_ENDING_LIKE_PNG = "/9j/4AAiVBORw0KGgo";

async function exportBlocks(blocks: ContentBlock[]): Promise<ExportResult> {
	return await exporter.export(
		exportDocument({ sections: [exportSection("goals", "", blocks)] }),
		{ caseName: "Test" }
	);
}

/** What the document holds after the title page, in order. */
async function contentOf(blocks: ContentBlock[]): Promise<DocxBodyItem[]> {
	return await docxContent(await exportBlocks(blocks));
}

async function paragraphsOf(blocks: ContentBlock[]): Promise<DocxParagraph[]> {
	return docxParagraphs(await contentOf(blocks));
}

async function textsOf(blocks: ContentBlock[]): Promise<string[]> {
	return (await paragraphsOf(blocks)).map((p) => p.text);
}

describe("WordExporter headings", () => {
	it.each([
		1, 2, 3, 4, 5, 6,
	] as const)("writes a level %i heading as a paragraph of the matching heading style", async (level) => {
		const paragraphs = await paragraphsOf([
			{ type: "heading", level, text: "Title" },
		]);

		expect(paragraphs).toMatchObject([
			{ text: "Title", style: `Heading${level}` },
		]);
	});

	it("keeps headings and paragraphs in the order given", async () => {
		const paragraphs = await paragraphsOf([
			{ type: "heading", level: 3, text: "Second" },
			paragraph("Third"),
			{ type: "heading", level: 1, text: "First" },
		]);

		expect(paragraphs.map((p) => [p.text, p.style])).toStrictEqual([
			["Second", "Heading3"],
			["Third", undefined],
			["First", "Heading1"],
		]);
	});
});

describe("WordExporter paragraphs", () => {
	it("writes the text of each paragraph in the order given", async () => {
		expect(await textsOf([paragraph("Two"), paragraph("One")])).toStrictEqual([
			"Two",
			"One",
		]);
	});

	it("writes a blank paragraph, and one of only spaces, as an empty paragraph", async () => {
		const paragraphs = await paragraphsOf([
			paragraph("A"),
			paragraph(""),
			paragraph("  \n "),
			paragraph("B"),
		]);

		expect(paragraphs.map((p) => p.text)).toStrictEqual(["A", "", "", "B"]);
	});
});

describe("WordExporter lists", () => {
	it.each([
		[false, ["• b", "• a"]],
		[true, ["1. b", "2. a"]],
	])("writes each item of a list with ordered %s as its own paragraph, in order", async (ordered, written) => {
		const texts = await textsOf([{ type: "list", ordered, items: ["b", "a"] }]);

		expect(texts).toStrictEqual(written);
	});

	it("writes nothing for an empty list", async () => {
		const blocks: ContentBlock[] = [
			paragraph("A"),
			{ type: "list", ordered: true, items: [] },
			paragraph("B"),
		];

		expect((await exportBlocks(blocks)).success).toBe(true);
		expect(await textsOf(blocks)).toStrictEqual(["A", "B"]);
	});
});

describe("WordExporter tables", () => {
	it("writes a table with its header row first and one row for each row given", async () => {
		const items = await contentOf([
			paragraph("Before"),
			{
				type: "table",
				headers: ["B", "A"],
				rows: [
					["4", "3"],
					["2", "1"],
				],
			},
			paragraph("After"),
		]);

		expect(items.map((item) => item.kind)).toStrictEqual([
			"paragraph",
			"table",
			"paragraph",
		]);
		expect(items[1]).toMatchObject({
			table: {
				rows: [
					["B", "A"],
					["4", "3"],
					["2", "1"],
				],
			},
		});
	});

	it("writes a table that has no rows as its header row alone", async () => {
		const result = await exportBlocks([
			{ type: "table", headers: ["A", "B"], rows: [] },
		]);
		const tables = docxTables(await docxPart(result, "word/document.xml"));

		expect(tables).toStrictEqual([{ rows: [["A", "B"]] }]);
	});

	it("fills a short row with empty cells", async () => {
		const result = await exportBlocks([
			{ type: "table", headers: ["A", "B", "C"], rows: [["1"], ["2", "3"]] },
		]);
		const tables = docxTables(await docxPart(result, "word/document.xml"));

		expect(tables[0]?.rows).toStrictEqual([
			["A", "B", "C"],
			["1", "", ""],
			["2", "3", ""],
		]);
	});
});

describe("WordExporter images", () => {
	it.each([
		["a PNG", PNG_DATA, ".png", PNG_DATA],
		["a JPEG", JPEG_DATA, ".jpg", JPEG_DATA],
		["a GIF", GIF_DATA, ".gif", GIF_DATA],
		["a BMP", BMP_DATA, ".bmp", BMP_DATA],
		[
			"a JPEG that ends like a PNG",
			JPEG_ENDING_LIKE_PNG,
			".jpg",
			JPEG_ENDING_LIKE_PNG,
		],
		["data of no known kind, as a PNG", OTHER_DATA, ".png", OTHER_DATA],
		[
			"a PNG given as a data address, without the address prefix",
			`data:image/png;base64,${PNG_DATA}`,
			".png",
			PNG_DATA,
		],
	])("embeds %s as one media file of the right type", async (_label, src, extension, payload) => {
		const result = await exportBlocks([{ type: "image", src, alt: "Alt" }]);
		const names = await docxMediaNames(result);

		expect(names).toHaveLength(1);
		expect(names[0]).toMatch(new RegExp(`\\${extension}$`));
		expect(await docxMediaBytes(result, names[0] ?? "")).toStrictEqual(
			Array.from(Buffer.from(payload, "base64"))
		);
	});

	it("writes the picture, then its caption, in the place of the block", async () => {
		const paragraphs = await paragraphsOf([
			paragraph("Before"),
			{ type: "image", src: PNG_DATA, alt: "Alt", caption: "Cap" },
			paragraph("After"),
		]);

		expect(paragraphs.map((p) => [p.text, p.hasImage])).toStrictEqual([
			["Before", false],
			["", true],
			["Cap", false],
			["After", false],
		]);
	});

	it("writes no caption paragraph for a picture without a caption", async () => {
		const paragraphs = await paragraphsOf([
			{ type: "image", src: PNG_DATA, alt: "Alt" },
			paragraph("After"),
		]);

		expect(paragraphs.map((p) => [p.text, p.hasImage])).toStrictEqual([
			["", true],
			["After", false],
		]);
	});

	it("writes the alternative text in place of an image with no source, without its caption", async () => {
		const blocks: ContentBlock[] = [
			{ type: "image", src: "", alt: "Alt", caption: "Cap" },
		];
		const result = await exportBlocks(blocks);

		expect(await textsOf(blocks)).toStrictEqual(["[Image: Alt]"]);
		expect(await docxMediaNames(result)).toStrictEqual([]);
	});
});

describe("WordExporter dividers and metadata", () => {
	it("writes a divider as an empty paragraph with a line under it, between its neighbours", async () => {
		const paragraphs = await paragraphsOf([
			paragraph("A"),
			{ type: "divider" },
			paragraph("B"),
		]);

		expect(paragraphs.map((p) => [p.text, p.bottomBorder])).toStrictEqual([
			["A", undefined],
			["", "single"],
			["B", undefined],
		]);
	});

	it("writes a metadata block as its key, a colon and its value", async () => {
		const texts = await textsOf([
			{ type: "metadata", key: "Other", value: "More" },
			{ type: "metadata", key: "Key", value: "Value" },
		]);

		expect(texts).toStrictEqual(["Other: More", "Key: Value"]);
	});
});
