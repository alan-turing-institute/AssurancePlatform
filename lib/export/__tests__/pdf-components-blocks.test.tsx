import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlainTreeNode } from "@/lib/case/defined-terms";
import {
	elementBlock,
	exportNode,
	paragraph,
} from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import {
	type PdfOutline,
	pdfBody,
	pdfImages,
	pdfLinks,
	pdfPages,
	pdfTexts,
} from "@/src/__tests__/utils/export-pdf-kit";
import { PDFDocumentComponent } from "../exporters/pdf-components";
import type { ContentBlock } from "../types";

vi.mock(
	"@react-pdf/renderer",
	async () => (await import("@/src/__tests__/utils/export-pdf-kit")).pdfStandIn
);

/** The page after the title page. */
function pageOf(blocks: ContentBlock[]): Element {
	const { container } = render(
		<PDFDocumentComponent
			document={exportDocument({
				sections: [exportSection("goals", "", blocks)],
			})}
		/>
	);
	const page = pdfPages(container)[1];
	if (!page) {
		throw new Error("no content page");
	}
	return page;
}

/** What that page holds, apart from its footer. */
function bodyOf(blocks: ContentBlock[]): PdfOutline[] {
	return pdfBody(pageOf(blocks));
}

/** What an element block holds after its title, in order. */
function elementFieldsOf(fields: Partial<PlainTreeNode>): PdfOutline[] {
	const [element] = bodyOf([elementBlock(fields)]);
	return (element as PdfOutline[]).slice(1);
}

describe("PDF headings", () => {
	it.each([
		1, 2, 3, 4, 5, 6,
	] as const)("draws the text of a level %i heading", (level) => {
		expect(bodyOf([{ type: "heading", level, text: "Title" }])).toStrictEqual([
			"Title",
		]);
	});

	it("keeps headings and paragraphs in the order given", () => {
		expect(
			bodyOf([
				{ type: "heading", level: 3, text: "Second" },
				paragraph("Third"),
				{ type: "heading", level: 1, text: "First" },
			])
		).toStrictEqual(["Second", "Third", "First"]);
	});
});

describe("PDF paragraphs", () => {
	it("draws the text of each paragraph in the order given", () => {
		expect(bodyOf([paragraph("Two"), paragraph("One")])).toStrictEqual([
			"Two",
			"One",
		]);
	});

	it("draws nothing for a blank paragraph or one of only spaces, and keeps its neighbours", () => {
		expect(
			bodyOf([
				paragraph("A"),
				paragraph(""),
				paragraph("  \n "),
				paragraph("B"),
			])
		).toStrictEqual(["A", "B"]);
	});
});

describe("PDF lists", () => {
	it.each([
		[
			false,
			[
				["•", "b"],
				["•", "a"],
			],
		],
		[
			true,
			[
				["1.", "b"],
				["2.", "a"],
			],
		],
	])("draws each item of a list with ordered %s with its marker, in order", (ordered, items) => {
		expect(
			bodyOf([{ type: "list", ordered, items: ["b", "a"] }])
		).toStrictEqual([items]);
	});

	it("draws nothing for an empty list and keeps its neighbours", () => {
		expect(
			bodyOf([
				paragraph("A"),
				{ type: "list", ordered: true, items: [] },
				paragraph("B"),
			])
		).toStrictEqual(["A", "B"]);
	});
});

describe("PDF tables", () => {
	it("draws the header row first, then one row for each row given, in order", () => {
		expect(
			bodyOf([
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
			])
		).toStrictEqual([
			"Before",
			[
				["B", "A"],
				["4", "3"],
				["2", "1"],
			],
			"After",
		]);
	});

	it("draws a table that has no rows as its header row alone", () => {
		expect(
			bodyOf([{ type: "table", headers: ["A", "B"], rows: [] }])
		).toStrictEqual([[["A", "B"]]]);
	});

	it("fills a short row with empty cells", () => {
		expect(
			bodyOf([
				{ type: "table", headers: ["A", "B", "C"], rows: [["1"], ["2", "3"]] },
			])
		).toStrictEqual([
			[
				["A", "B", "C"],
				["1", "", ""],
				["2", "3", ""],
			],
		]);
	});

	it("draws nothing for a table with no headers and no rows, and keeps its neighbours", () => {
		expect(
			bodyOf([
				paragraph("A"),
				{ type: "table", headers: [], rows: [] },
				paragraph("B"),
			])
		).toStrictEqual(["A", "B"]);
	});
});

describe("PDF images", () => {
	it.each([
		["an http address", "http://x.test/a.png", "http://x.test/a.png"],
		["an https address", "https://x.test/a.png", "https://x.test/a.png"],
		[
			"a data address",
			"data:image/gif;base64,R0lGODlh",
			"data:image/gif;base64,R0lGODlh",
		],
		[
			"bare PNG data",
			"iVBORw0KGgoAAAA",
			"data:image/png;base64,iVBORw0KGgoAAAA",
		],
		["bare JPEG data", "/9j/4AAQ", "data:image/jpeg;base64,/9j/4AAQ"],
		[
			"bare SVG data",
			"PHN2ZyB4bWxucz0",
			"data:image/svg+xml;base64,PHN2ZyB4bWxucz0",
		],
		[
			"bare SVG data with an XML declaration",
			"PD94bWwgdmVy",
			"data:image/svg+xml;base64,PD94bWwgdmVy",
		],
		["bare data of no known kind", "R0lGODlh", "R0lGODlh"],
	])("hands over %s as the source of the picture", (_label, src, handedOver) => {
		expect(bodyOf([{ type: "image", src, alt: "Alt" }])).toStrictEqual([
			[{ image: handedOver }],
		]);
	});

	it("draws the picture, then its caption, in the place of the block", () => {
		expect(
			bodyOf([
				paragraph("Before"),
				{
					type: "image",
					src: "https://x.test/a.png",
					alt: "Alt",
					caption: "Cap",
				},
				paragraph("After"),
			])
		).toStrictEqual([
			"Before",
			[{ image: "https://x.test/a.png" }, "Cap"],
			"After",
		]);
	});

	it("draws no caption for a picture without one", () => {
		expect(
			bodyOf([
				{ type: "image", src: "https://x.test/a.png", alt: "Alt" },
				{
					type: "image",
					src: "https://x.test/b.png",
					alt: "Other",
					caption: "",
				},
			])
		).toStrictEqual([
			[{ image: "https://x.test/a.png" }],
			[{ image: "https://x.test/b.png" }],
		]);
	});

	it("draws the alternative text in place of an image with no source, without its caption", () => {
		expect(
			bodyOf([{ type: "image", src: "", alt: "Alt", caption: "Cap" }])
		).toStrictEqual(["[Image: Alt]"]);
	});
});

describe("PDF dividers and metadata", () => {
	it("draws a divider as an empty part between its neighbours", () => {
		expect(
			bodyOf([paragraph("A"), { type: "divider" }, paragraph("B")])
		).toStrictEqual(["A", [], "B"]);
	});

	it("draws a metadata block as its key with a colon, then its value", () => {
		expect(
			bodyOf([
				{ type: "metadata", key: "Other", value: "More" },
				{ type: "metadata", key: "Key", value: "Value" },
			])
		).toStrictEqual([
			["Other:", "More"],
			["Key:", "Value"],
		]);
	});
});

describe("PDF content read as a whole", () => {
	it("reads table cells in reading order, header row first", () => {
		const page = pageOf([
			{ type: "table", headers: ["B", "A"], rows: [["2", "1"]] },
		]);

		expect(pdfTexts(page).slice(0, 4)).toStrictEqual(["B", "A", "2", "1"]);
	});

	it("reads the pictures of a page in the order given", () => {
		const page = pageOf([
			{ type: "image", src: "https://x.test/b.png", alt: "B" },
			{ type: "image", src: "https://x.test/a.png", alt: "A" },
		]);

		expect(pdfImages(page)).toStrictEqual([
			"https://x.test/b.png",
			"https://x.test/a.png",
		]);
	});

	it("draws the address of an element as a link to that address", () => {
		const page = pageOf([
			{
				type: "element",
				depth: 0,
				node: exportNode({ id: "n1", type: "GOAL", url: "https://x.test/u" }),
			},
		]);

		expect(pdfLinks(page)).toStrictEqual([
			{ href: "https://x.test/u", text: "https://x.test/u" },
		]);
	});
});

describe("PDF element context and comments", () => {
	it("draws the context items in the order given, each after a bullet", () => {
		expect(elementFieldsOf({ context: ["second", "first"] })).toStrictEqual([
			["Context:", "• second", "• first"],
		]);
	});

	it("draws no context list for an empty context", () => {
		expect(elementFieldsOf({ context: [] })).toStrictEqual([]);
	});

	it("draws each comment with its author, the date and its content, in order", () => {
		expect(
			elementFieldsOf({
				comments: [
					{ author: "b", content: "second", createdAt: "2024-03-09T12:00:00Z" },
					{ author: "a", content: "first", createdAt: "2024-01-15T12:00:00Z" },
				],
			})
		).toStrictEqual([
			["Comments:", ["b (09/03/2024)", "second"], ["a (15/01/2024)", "first"]],
		]);
	});

	it("draws a comment with no date as its author alone", () => {
		expect(
			elementFieldsOf({
				comments: [{ author: "me", content: "hi", createdAt: "" }],
			})
		).toStrictEqual([["Comments:", ["me", "hi"]]]);
	});

	it("draws no comments list for an empty list of comments", () => {
		expect(elementFieldsOf({ comments: [] })).toStrictEqual([]);
	});
});
