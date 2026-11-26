import { afterEach, describe, expect, it, vi } from "vitest";
import { elementBlock, paragraph } from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import {
	docxContent,
	docxMediaBytes,
	docxMediaNames,
	docxPart,
	docxPictureSizes,
	docxSections,
	paragraphTexts,
} from "@/src/__tests__/utils/export-docx-kit";
import { WordExporter } from "../exporters/word-exporter";
import type {
	ContentBlock,
	ExportResult,
	RenderedDocument,
	RenderedSection,
} from "../types";

const exporter = new WordExporter();

const PNG_DATA = "iVBORw0KGgo=";
const OTHER_PNG_DATA = "iVBORw0KGgoAAAA=";
const EXPORTED_AT = "2024-03-25T12:00:00Z";

function exportDoc(
	document: RenderedDocument,
	timestamp?: Date
): Promise<ExportResult> {
	return exporter.export(document, { caseName: "Test", timestamp });
}

function exportSections(sections: RenderedSection[]): Promise<ExportResult> {
	return exportDoc(
		exportDocument({ metadata: { exportedAt: EXPORTED_AT }, sections })
	);
}

function imageBlock(src: string, caption?: string): ContentBlock {
	return { type: "image", src, alt: "Alt", caption };
}

/** The text of the paragraphs that hold text in each page section. */
async function textsPerSection(result: ExportResult): Promise<string[][]> {
	const sections = await docxSections(result);
	return sections.map((s) => paragraphTexts(s.paragraphs));
}

afterEach(() => {
	vi.useRealTimers();
});

describe("WordExporter title page", () => {
	it("writes the case name, the description and the export date, then starts the content on a new page section", async () => {
		const result = await exportDoc(
			exportDocument({
				metadata: {
					caseName: "Safety case",
					caseDescription: "About safety",
					exportedAt: EXPORTED_AT,
				},
				sections: [exportSection("goals", "Goals", [paragraph("Body")])],
			})
		);

		expect(await textsPerSection(result)).toStrictEqual([
			["Safety case", "About safety", "Exported: 25/03/2024"],
			["Goals", "Body"],
		]);
	});

	it("leaves the description out when the case has none", async () => {
		const result = await exportDoc(
			exportDocument({
				metadata: { caseDescription: "", exportedAt: EXPORTED_AT },
			})
		);

		expect(await textsPerSection(result)).toStrictEqual([
			["Test Case", "Exported: 25/03/2024"],
		]);
	});

	it("writes only the title page for a document with no sections", async () => {
		const result = await exportSections([]);

		expect(await docxSections(result)).toHaveLength(1);
	});

	it("writes no content page section when the content sections hold nothing", async () => {
		const result = await exportSections([exportSection("goals", "", [])]);

		expect(await docxSections(result)).toHaveLength(1);
	});
});

describe("WordExporter diagram pages", () => {
	it("writes one landscape page section per diagram, in the order given, between the title page and the content", async () => {
		const result = await exportSections([
			exportSection("goals", "Goals", [paragraph("G")]),
			exportSection("diagram", "Second", [imageBlock(PNG_DATA, "Cap two")]),
			exportSection("evidence", "Evidence", [paragraph("E")]),
			exportSection("diagram", "First", [imageBlock(OTHER_PNG_DATA)]),
		]);
		const sections = await docxSections(result);

		expect(await textsPerSection(result)).toStrictEqual([
			["Test Case", "Exported: 25/03/2024"],
			["Second", "Cap two"],
			["First"],
			["Goals", "G", "Evidence", "E"],
		]);
		expect(sections.map((s) => s.orientation)).toStrictEqual([
			"portrait",
			"landscape",
			"landscape",
			"portrait",
		]);
		expect(
			sections.map((s) => s.paragraphs.some((p) => p.hasImage))
		).toStrictEqual([false, true, true, false]);
		expect(await docxMediaNames(result)).toHaveLength(2);
	});

	it("embeds the picture of the diagram block", async () => {
		const result = await exportSections([
			exportSection("diagram", "D", [imageBlock(OTHER_PNG_DATA)]),
		]);
		const names = await docxMediaNames(result);

		expect(await docxMediaBytes(result, names[0] ?? "")).toStrictEqual(
			Array.from(Buffer.from(OTHER_PNG_DATA, "base64"))
		);
	});

	it("uses the first picture of a diagram section, wherever it sits among its blocks", async () => {
		const result = await exportSections([
			exportSection("diagram", "D", [
				paragraph("Note"),
				imageBlock(PNG_DATA, "First cap"),
				imageBlock(OTHER_PNG_DATA, "Second cap"),
			]),
		]);

		expect(await textsPerSection(result)).toStrictEqual([
			["Test Case", "Exported: 25/03/2024"],
			["D", "First cap"],
		]);
		expect(await docxMediaNames(result)).toHaveLength(1);
	});

	it("writes the title and caption but no picture for a diagram picture with no source", async () => {
		const result = await exportSections([
			exportSection("diagram", "D", [imageBlock("", "Cap")]),
		]);

		expect((await textsPerSection(result))[1]).toStrictEqual(["D", "Cap"]);
		expect(await docxMediaNames(result)).toStrictEqual([]);
	});

	it("keeps diagram sections out of the content pages", async () => {
		const result = await exportSections([
			exportSection("diagram", "D", [imageBlock(PNG_DATA)]),
		]);

		expect(await docxSections(result)).toHaveLength(2);
	});
});

/** One block of each kind. */
function everyKindOfBlock(): ContentBlock[] {
	return [
		{ type: "heading", level: 2, text: "Heading" },
		paragraph("Paragraph"),
		{ type: "list", ordered: true, items: ["one"] },
		{ type: "table", headers: ["H"], rows: [["c"]] },
		imageBlock(PNG_DATA, "Cap"),
		{ type: "divider" },
		{ type: "metadata", key: "K", value: "V" },
		elementBlock({ description: "D", url: "https://u.test/x" }),
	];
}

describe("WordExporter well-formed parts", () => {
	it("holds no text outside a run in a document of every kind of block, a diagram page and both footers", async () => {
		const result = await exportDoc(
			exportDocument({
				branding: { footerText: "Confidential" },
				sections: [
					exportSection("diagram", "D", [imageBlock(PNG_DATA, "Cap")]),
					exportSection("goals", "Goals", everyKindOfBlock()),
				],
			})
		);

		await expect(docxSections(result)).resolves.toHaveLength(3);
		await expect(docxContent(result)).resolves.not.toHaveLength(0);
	});

	it("gives the picture of a diagram and the logo a width and a height that are positive whole numbers", async () => {
		const result = await exportDoc(
			exportDocument({
				branding: { logoBase64: PNG_DATA },
				sections: [exportSection("diagram", "D", [imageBlock(PNG_DATA)])],
			})
		);
		const sizes = await docxPictureSizes(result);

		expect(sizes).toHaveLength(2);
		for (const { width, height } of sizes) {
			expect(Number.isInteger(width) && width > 0).toBe(true);
			expect(Number.isInteger(height) && height > 0).toBe(true);
		}
	});
});

describe("WordExporter footers", () => {
	it("gives the title page the footer text and every other page section the page numbers", async () => {
		const result = await exportDoc(
			exportDocument({
				branding: { footerText: "Confidential" },
				sections: [
					exportSection("diagram", "D", [imageBlock(PNG_DATA)]),
					exportSection("goals", "Goals", [paragraph("G")]),
				],
			})
		);
		const footers = (await docxSections(result)).map((s) => s.footer);

		expect(footers).toStrictEqual([
			{ text: "Confidential", hasImage: false },
			{ text: "Page {PAGE} of {NUMPAGES}", hasImage: false },
			{ text: "Page {PAGE} of {NUMPAGES}", hasImage: false },
		]);
	});

	it("puts the logo in the title page footer in place of the footer text", async () => {
		const result = await exportDoc(
			exportDocument({
				branding: { footerText: "Confidential", logoBase64: PNG_DATA },
				sections: [exportSection("goals", "Goals", [paragraph("G")])],
			})
		);
		const footers = (await docxSections(result)).map((s) => s.footer);
		const names = await docxMediaNames(result);

		expect(footers).toStrictEqual([
			{ text: "", hasImage: true },
			{ text: "Page {PAGE} of {NUMPAGES}", hasImage: false },
		]);
		expect(names).toHaveLength(1);
		expect(await docxMediaBytes(result, names[0] ?? "")).toStrictEqual(
			Array.from(Buffer.from(PNG_DATA, "base64"))
		);
	});

	it("writes no logo on the title page body", async () => {
		const result = await exportDoc(
			exportDocument({ branding: { logoBase64: PNG_DATA } })
		);
		const [titlePage] = await docxSections(result);

		expect(titlePage?.paragraphs.some((p) => p.hasImage)).toBe(false);
	});
});

describe("WordExporter result", () => {
	it("returns a Word file as a readable zip, with its file type and name", async () => {
		const result = await exporter.export(exportDocument(), {
			caseName: "My Case",
			timestamp: new Date("2024-03-25T12:00:00Z"),
		});

		expect(result).toMatchObject({
			success: true,
			filename: "my-case-2024-03-25.docx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});
		expect(result.success && "blob" in result && result.blob.type).toBe(
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		);
		expect(await docxPart(result, "word/document.xml")).toContain("Test Case");
	});

	it.each([
		["Hello, World!!", "hello-world"],
		["  Spaced   out  ", "spaced-out"],
		["A/B: C_D", "a-b-c-d"],
		["Café 2", "caf-2"],
		["--Edge--", "edge"],
	])("builds the file name for the case name %j as %s", async (caseName, slug) => {
		const result = await exporter.export(exportDocument(), {
			caseName,
			timestamp: new Date("2024-03-25T12:00:00Z"),
		});

		expect(result.success && "filename" in result && result.filename).toBe(
			`${slug}-2024-03-25.docx`
		);
	});

	it("dates the file name by the UTC day of the timestamp", async () => {
		const result = await exporter.export(exportDocument(), {
			caseName: "Case",
			timestamp: new Date("2024-03-25T23:59:00Z"),
		});

		expect(result.success && "filename" in result && result.filename).toBe(
			"case-2024-03-25.docx"
		);
	});

	it("dates the file name by the clock when no timestamp is given", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2031-07-09T08:00:00Z"));
		const result = await exporter.export(exportDocument(), {
			caseName: "Case",
		});

		expect(result.success && "filename" in result && result.filename).toBe(
			"case-2031-07-09.docx"
		);
	});

	it("records the case name, description and creator in the file's own properties", async () => {
		const result = await exportDoc(
			exportDocument({
				metadata: { caseName: "Props case", caseDescription: "Props desc" },
			})
		);
		const core = await docxPart(result, "docProps/core.xml");

		expect(core).toContain("<dc:title>Props case</dc:title>");
		expect(core).toContain("<dc:description>Props desc</dc:description>");
		expect(core).toContain("<dc:creator>TEA Platform</dc:creator>");
	});

	it("returns a failure naming the reason when the file cannot be built", async () => {
		const result = await exportDoc(exportDocument(), new Date(Number.NaN));

		expect(result).toStrictEqual({
			success: false,
			error: "Word export failed: Invalid time value",
		});
	});
});
