import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlainTreeNode } from "@/lib/case/defined-terms";
import { exportNode, metadata } from "@/src/__tests__/utils/export-case-kit";
import {
	exportDocument,
	exportSection,
} from "@/src/__tests__/utils/export-document-kit";
import {
	type PdfOutline,
	pdfBody,
	pdfFixed,
	pdfLinks,
	pdfOrientations,
	pdfPages,
	pdfProperties,
} from "@/src/__tests__/utils/export-pdf-kit";
import type { PDFDocumentProps } from "../exporters/pdf-components";
import { PDFDocumentComponent } from "../exporters/pdf-components";
import type { ContentBlock, RenderedDocument, RenderedSection } from "../types";

vi.mock(
	"@react-pdf/renderer",
	async () => (await import("@/src/__tests__/utils/export-pdf-kit")).pdfStandIn
);

const EXPORTED_AT = "2024-03-25T12:00:00Z";
const LOGO = "data:image/png;base64,LOGO";
const PAGE_NUMBERS = "Page 1 of 1";

function paragraph(text: string): ContentBlock {
	return { type: "paragraph", text };
}

function picture(src: string, caption?: string): ContentBlock {
	return { type: "image", src, alt: "Alt", caption };
}

function draw(document: RenderedDocument): HTMLElement {
	const props: PDFDocumentProps = { document };
	return render(<PDFDocumentComponent {...props} />).container;
}

function drawSections(
	sections: RenderedSection[],
	parts: Parameters<typeof exportDocument>[0] = {}
): HTMLElement {
	return draw(
		exportDocument({
			...parts,
			metadata: { exportedAt: EXPORTED_AT, ...parts.metadata },
			sections,
		})
	);
}

function bodies(container: HTMLElement): PdfOutline[][] {
	return pdfPages(container).map(pdfBody);
}

function fixedParts(container: HTMLElement): PdfOutline[][] {
	return pdfPages(container).map(pdfFixed);
}

/** The element block as drawn, with the given fields on a goal. */
function elementOf(fields: Partial<PlainTreeNode>, depth = 0): PdfOutline {
	const container = drawSections([
		exportSection("goals", "", [
			{
				type: "element",
				depth,
				node: exportNode({ id: "n1", type: "GOAL", name: "N", ...fields }),
			},
		]),
	]);
	const [element] = pdfBody(pdfPages(container)[1] as Element);
	return element as PdfOutline;
}

function numbered(count: number): ContentBlock[] {
	return Array.from({ length: count }, (_, i) => metadata(`p${i}`, "v"));
}

describe("PDF element type and name", () => {
	it.each([
		["GOAL", "Goal"],
		["STRATEGY", "Strategy"],
		["PROPERTY_CLAIM", "Property Claim"],
		["EVIDENCE", "Evidence"],
		["AWAY_GOAL", "Away Goal"],
	] as const)("draws an element of type %s with the label %s and its name", (type, label) => {
		expect(elementOf({ type })).toStrictEqual([`${label}: N`]);
	});

	it("draws the type alone as the title of an element without a name", () => {
		expect(elementOf({ name: null })).toStrictEqual(["Goal"]);
	});

	it("draws the same content for an element at any depth", () => {
		const outlines = [0, 1, 2, 3, 4, 9].map((depth) =>
			elementOf({ description: "D" }, depth)
		);

		expect(outlines).toStrictEqual(outlines.map(() => ["Goal: N", "D"]));
	});
});

describe("PDF element fields", () => {
	it("draws every field of an element in order", () => {
		expect(
			elementOf({
				description: "D",
				context: ["c1", "c2"],
				assumption: "A",
				justification: "J",
				url: "https://u.test/x",
				inSandbox: true,
				comments: [
					{ author: "me", content: "hi", createdAt: "2024-01-15T12:00:00Z" },
				],
			})
		).toStrictEqual([
			"Goal: N",
			"D",
			["Context:", "• c1", "• c2"],
			["Assumption:", "A"],
			["Justification:", "J"],
			["URL:", { link: "https://u.test/x", content: ["https://u.test/x"] }],
			"[Draft]",
			["Comments:", ["me (15/01/2024)", "hi"]],
		]);
	});

	it.each([
		["a description", { description: "D" }, "D"],
		["an assumption", { assumption: "A" }, ["Assumption:", "A"]],
		["a justification", { justification: "J" }, ["Justification:", "J"]],
	] as const)("draws %s on its own when it is the only field", (_label, fields, drawn) => {
		expect(elementOf(fields)).toStrictEqual(["Goal: N", drawn]);
	});

	it("leaves out empty descriptions, assumptions, justifications and addresses", () => {
		expect(
			elementOf({ description: "", assumption: "", justification: "", url: "" })
		).toStrictEqual(["Goal: N"]);
	});

	it("draws the address of an element as a link that points to it", () => {
		const container = drawSections([
			exportSection("goals", "", [
				{
					type: "element",
					depth: 0,
					node: exportNode({
						id: "n1",
						type: "GOAL",
						url: "https://u.test/a?x=1&y=2",
					}),
				},
			]),
		]);

		expect(pdfLinks(container)).toStrictEqual([
			{ href: "https://u.test/a?x=1&y=2", text: "https://u.test/a?x=1&y=2" },
		]);
	});

	it("draws no link for an element without an address", () => {
		const container = drawSections([
			exportSection("goals", "", [
				{
					type: "element",
					depth: 0,
					node: exportNode({ id: "n1", type: "GOAL", description: "D" }),
				},
			]),
		]);

		expect(pdfLinks(container)).toStrictEqual([]);
	});

	it("draws neither a context list nor comments for empty ones", () => {
		expect(elementOf({ context: [], comments: [] })).toStrictEqual(["Goal: N"]);
	});

	it.each([
		[true, ["Goal: N", "[Draft]"]],
		[false, ["Goal: N"]],
	])("draws the draft marker only when in the sandbox is %s", (inSandbox, drawn) => {
		expect(elementOf({ inSandbox })).toStrictEqual(drawn);
	});
});

describe("PDF document properties", () => {
	it("gives the file the case name, its description, the exporter as author and the platform as creator", () => {
		const container = draw(
			exportDocument({
				metadata: {
					caseName: "Safety case",
					caseDescription: "About safety",
					exportedBy: "Alex",
				},
			})
		);

		expect(pdfProperties(container)).toStrictEqual({
			title: "Safety case",
			author: "Alex",
			subject: "About safety",
			creator: "TEA Platform",
		});
	});

	it("names the platform as author when no exporter is given", () => {
		expect(pdfProperties(draw(exportDocument())).author).toBe("TEA Platform");
	});
});

describe("PDF title page", () => {
	it("draws the case name, the description and the export date, then the footer text", () => {
		const container = drawSections([], {
			metadata: { caseName: "Safety case", caseDescription: "About safety" },
			branding: { footerText: "Confidential" },
		});

		expect(bodies(container)).toStrictEqual([
			[
				["Safety case", "About safety", "Exported: 25/03/2024"],
				["Confidential"],
			],
		]);
	});

	it("leaves the description out when the case has none", () => {
		const container = drawSections([], { metadata: { caseDescription: "" } });

		expect(bodies(container)[0]?.[0]).toStrictEqual([
			"Test Case",
			"Exported: 25/03/2024",
		]);
	});

	it("draws the logo in place of the footer text", () => {
		const container = drawSections([], {
			branding: { footerText: "Confidential", logoBase64: LOGO },
		});

		expect(bodies(container)[0]?.[1]).toStrictEqual([{ image: LOGO }]);
	});

	it("builds the title page from the metadata alone, ignoring any title-page section", () => {
		const container = drawSections([
			exportSection("title-page", "Cover", [paragraph("Cover text")]),
		]);

		expect(bodies(container)).toStrictEqual([
			[["Test Case", "Exported: 25/03/2024"], ["Footer"]],
		]);
	});

	it("draws only the title page for a document with no sections", () => {
		expect(pdfPages(drawSections([]))).toHaveLength(1);
	});
});

describe("PDF diagram pages", () => {
	it("draws one landscape page per diagram, in the order given, between the title page and the content", () => {
		const container = drawSections([
			exportSection("goals", "Goals", [paragraph("G")]),
			exportSection("diagram", "Second", [
				picture("https://x.test/2.png", "Cap two"),
			]),
			exportSection("evidence", "Evidence", [paragraph("E")]),
			exportSection("diagram", "First", [picture("iVBORw0KGgoAAAA")]),
		]);

		expect(pdfOrientations(container)).toStrictEqual([
			null,
			"landscape",
			"landscape",
			null,
			null,
		]);
		expect(bodies(container).slice(1)).toStrictEqual([
			[["Second", { image: "https://x.test/2.png" }, "Cap two"]],
			[["First", { image: "data:image/png;base64,iVBORw0KGgoAAAA" }]],
			["Goals", "G"],
			["Evidence", "E"],
		]);
	});

	it("uses the first picture of a diagram section, wherever it sits among its blocks", () => {
		const container = drawSections([
			exportSection("diagram", "D", [
				paragraph("Note"),
				picture("https://x.test/1.png", "First cap"),
				picture("https://x.test/2.png", "Second cap"),
			]),
		]);

		expect(bodies(container)[1]).toStrictEqual([
			["D", { image: "https://x.test/1.png" }, "First cap"],
		]);
	});

	it("draws no page for a diagram section with no picture, and keeps the others", () => {
		const container = drawSections([
			exportSection("diagram", "Empty", [paragraph("Not a picture")]),
			exportSection("diagram", "Kept", [picture("https://x.test/1.png")]),
		]);

		expect(bodies(container).slice(1)).toStrictEqual([
			[["Kept", { image: "https://x.test/1.png" }]],
		]);
	});

	it("keeps diagram sections out of the content pages and pictures of other sections out of the diagram pages", () => {
		const container = drawSections([
			exportSection("diagram", "D", [picture("https://x.test/d.png")]),
			exportSection("goals", "Goals", [picture("https://x.test/g.png")]),
		]);

		expect(pdfOrientations(container)).toStrictEqual([null, "landscape", null]);
		expect(bodies(container)[2]).toStrictEqual([
			"Goals",
			[{ image: "https://x.test/g.png" }],
		]);
	});

	it("draws no diagram page for a document with no diagrams", () => {
		const container = drawSections([
			exportSection("goals", "Goals", [paragraph("G")]),
		]);

		expect(pdfOrientations(container)).toStrictEqual([null, null]);
	});
});

describe("PDF content pages", () => {
	it("draws one page per section, in the order given, each headed by its title", () => {
		const container = drawSections([
			exportSection("evidence", "Two", [paragraph("b")]),
			exportSection("goals", "One", [paragraph("a")]),
		]);

		expect(bodies(container).slice(1)).toStrictEqual([
			["Two", "b"],
			["One", "a"],
		]);
	});

	it("draws no heading for a section with an empty title", () => {
		const container = drawSections([
			exportSection("goals", "", [paragraph("P")]),
		]);

		expect(bodies(container)[1]).toStrictEqual(["P"]);
	});

	it("draws no page for a section with no blocks, and keeps the others", () => {
		const container = drawSections([
			exportSection("goals", "Empty", []),
			exportSection("goals", "Kept", [paragraph("P")]),
		]);

		expect(bodies(container).slice(1)).toStrictEqual([["Kept", "P"]]);
	});

	it.each([
		[30, [31]],
		[31, [31, 2]],
		[60, [31, 31]],
		[61, [31, 31, 2]],
	])("splits a section of %i blocks into pages of at most 30 blocks (page lengths %j, counting the heading)", (count, lengths) => {
		const container = drawSections([
			exportSection("goals", "Goals", numbered(count)),
		]);

		expect(
			bodies(container)
				.slice(1)
				.map((body) => body.length)
		).toStrictEqual(lengths);
	});

	it("continues the heading and the blocks in order over a second page", () => {
		const container = drawSections([
			exportSection("goals", "Goals", numbered(32)),
		]);
		const [, first, second] = bodies(container);

		expect(first?.slice(0, 2)).toStrictEqual(["Goals", ["p0:", "v"]]);
		expect(first?.at(-1)).toStrictEqual(["p29:", "v"]);
		expect(second).toStrictEqual([
			"Goals (continued)",
			["p30:", "v"],
			["p31:", "v"],
		]);
	});

	it("draws no heading on the continued pages of a section with no title", () => {
		const container = drawSections([exportSection("goals", "", numbered(31))]);

		expect(bodies(container)[2]).toStrictEqual([["p30:", "v"]]);
	});
});

describe("PDF footers", () => {
	it("gives the title page no repeated part, and every other page the footer text and page numbers", () => {
		const container = drawSections(
			[
				exportSection("diagram", "D", [picture("https://x.test/d.png")]),
				exportSection("goals", "Goals", [paragraph("G")]),
			],
			{ branding: { footerText: "Confidential" } }
		);

		expect(fixedParts(container)).toStrictEqual([
			[],
			[["Confidential", PAGE_NUMBERS]],
			[["Confidential", PAGE_NUMBERS]],
		]);
	});

	it("puts the logo in the footer of every page in place of the footer text", () => {
		const container = drawSections(
			[
				exportSection("diagram", "D", [picture("https://x.test/d.png")]),
				exportSection("goals", "Goals", [paragraph("G")]),
			],
			{ branding: { footerText: "Confidential", logoBase64: LOGO } }
		);

		expect(fixedParts(container).slice(1)).toStrictEqual([
			[[{ image: LOGO }, PAGE_NUMBERS]],
			[[{ image: LOGO }, PAGE_NUMBERS]],
		]);
	});

	it("repeats the footer on each page of a section that spreads over several", () => {
		const container = drawSections([
			exportSection("goals", "Goals", numbered(31)),
		]);

		expect(fixedParts(container).slice(1)).toStrictEqual([
			[["Footer", PAGE_NUMBERS]],
			[["Footer", PAGE_NUMBERS]],
		]);
	});
});
