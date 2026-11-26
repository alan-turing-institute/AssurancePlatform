import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlainCase, PlainTreeNode } from "@/lib/case/defined-terms";
import {
	exportCase,
	exportNode,
	heading,
	metadata,
	OVERVIEW,
	paragraph,
	sectionOf,
	typesOf,
} from "@/src/__tests__/utils/export-case-kit";
import { createTemplateFromPreset } from "../templates";
import type {
	ContentBlock,
	HeadingBlock,
	RenderedDocument,
	SectionType,
	TemplateInput,
} from "../types";

const EXPORT_DATE = "04/03/2025";

function comment(author: string, content: string, createdAt: string) {
	return { author, content, createdAt };
}

/**
 * G-root -> [S-zulu -> [P-beta, P-alpha -> [E-two, unnamed evidence]],
 * G-hidden (sandbox) -> [G-under], unnamed goal]. Names are deliberately not
 * in alphabetical order, so tree order is told apart from sorted order.
 */
function sampleTree(): PlainTreeNode {
	const evidenceTwo = exportNode({
		id: "e2",
		type: "EVIDENCE",
		name: "E-two",
		description: "Evidence two",
		url: "https://example.com/e2",
	});
	const evidenceBare = exportNode({ id: "e1", type: "EVIDENCE" });
	const claimBeta = exportNode({
		id: "p2",
		type: "PROPERTY_CLAIM",
		name: "P-beta",
		description: "Beta claim",
		comments: [comment("bo", "beta note", "2024-06-30T12:00:00Z")],
	});
	const claimAlpha = exportNode({
		id: "p1",
		type: "PROPERTY_CLAIM",
		name: "P-alpha",
		children: [evidenceTwo, evidenceBare],
	});
	const strategy = exportNode({
		id: "s1",
		type: "STRATEGY",
		name: "S-zulu",
		description: "Zulu strategy",
		children: [claimBeta, claimAlpha],
	});
	const underHidden = exportNode({
		id: "g3",
		type: "GOAL",
		name: "G-under",
		context: [],
		comments: [comment("cy", "under note", "2024-01-02T12:00:00Z")],
	});
	const hidden = exportNode({
		id: "g2",
		type: "GOAL",
		name: "G-hidden",
		inSandbox: true,
		comments: [comment("dee", "hidden note", "2024-01-02T12:00:00Z")],
		children: [underHidden],
	});
	const unnamed = exportNode({
		id: "g4",
		type: "GOAL",
		comments: [comment("eli", "unnamed note", "2024-03-05T12:00:00Z")],
	});
	return exportNode({
		id: "g1",
		type: "GOAL",
		name: "G-root",
		description: "Root goal",
		assumption: "A1",
		justification: "J1",
		context: ["c-two", "c-one"],
		comments: [
			comment("zed", "first", "2024-01-02T12:00:00Z"),
			comment("amy", "second", "2024-12-25T12:00:00Z"),
		],
		children: [strategy, hidden, unnamed],
	});
}

function sampleCase(): PlainCase {
	return exportCase(sampleTree(), {
		name: "Sample case",
		description: "About it",
	});
}

function renderReport(
	input: Partial<TemplateInput> = {},
	branding?: Parameters<typeof createTemplateFromPreset>[1]
): Promise<RenderedDocument> {
	return createTemplateFromPreset("full-report", branding).render({
		caseData: sampleCase(),
		...input,
	});
}

function headingsOf(blocks: ContentBlock[]): [number, string][] {
	return blocks
		.filter((b): b is HeadingBlock => b.type === "heading")
		.map((b) => [b.level, b.text]);
}

const DEFAULT_TYPES: SectionType[] = [
	"title-page",
	"table-of-contents",
	"executive-summary",
	"assurance-case-structure",
	"comments",
	"metadata",
];

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2025-03-04T10:30:00Z") });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("full report template", () => {
	describe("section order and switches", () => {
		it("lists its sections in report order with their titles", async () => {
			const document = await renderReport({
				diagramImage: OVERVIEW,
				branchDiagrams: [
					{ ...OVERVIEW, title: "Zeta branch" },
					{ ...OVERVIEW, title: "Alpha branch" },
				],
				sectionOverrides: {
					goals: true,
					strategies: true,
					propertyClaims: true,
					evidence: true,
				},
			});

			expect(document.sections.map((s) => [s.type, s.title])).toStrictEqual([
				["title-page", "Sample case"],
				["table-of-contents", "Contents"],
				["diagram", "Assurance Case Diagram"],
				["diagram", "Zeta branch"],
				["diagram", "Alpha branch"],
				["executive-summary", "Executive Summary"],
				["assurance-case-structure", "Assurance Case Structure"],
				["goals", "Goals"],
				["strategies", "Strategies"],
				["property-claims", "Property Claims"],
				["evidence", "Evidence"],
				["comments", "Comments"],
				["metadata", "Document Information"],
			]);
		});

		it("leaves out the flat element sections by default", async () => {
			const document = await renderReport();

			expect(typesOf(document)).toStrictEqual(DEFAULT_TYPES);
		});

		it.each([
			["titlePage", "title-page"],
			["tableOfContents", "table-of-contents"],
			["executiveSummary", "executive-summary"],
			["assuranceCaseStructure", "assurance-case-structure"],
			["comments", "comments"],
			["metadata", "metadata"],
		] as const)("leaves out %s only when the user switches it off", async (key, type) => {
			const document = await renderReport({
				sectionOverrides: { [key]: false },
			});

			expect(typesOf(document)).toStrictEqual(
				DEFAULT_TYPES.filter((t) => t !== type)
			);
		});

		it.each([
			["goals", "goals"],
			["strategies", "strategies"],
			["propertyClaims", "property-claims"],
			["evidence", "evidence"],
		] as const)("adds the %s section after the structure when the user switches it on", async (key, type) => {
			const document = await renderReport({
				sectionOverrides: { [key]: true },
			});

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"table-of-contents",
				"executive-summary",
				"assurance-case-structure",
				type,
				"comments",
				"metadata",
			]);
		});

		it("leaves a flat section out when the case has no element of its kind", async () => {
			const lone = exportCase(exportNode({ id: "g1", type: "GOAL" }));
			const document = await renderReport({
				caseData: lone,
				sectionOverrides: {
					goals: true,
					strategies: true,
					propertyClaims: true,
					evidence: true,
				},
			});

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"table-of-contents",
				"executive-summary",
				"goals",
				"metadata",
			]);
		});

		it("leaves out the structure and comments for a case of one uncommented element", async () => {
			const lone = exportCase(exportNode({ id: "g1", type: "GOAL" }));
			const document = await renderReport({ caseData: lone });

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"table-of-contents",
				"executive-summary",
				"metadata",
			]);
		});

		it("leaves out the structure when the only element is in the sandbox", async () => {
			const sandboxed = exportCase(
				exportNode({ id: "g1", type: "GOAL", inSandbox: true })
			);
			const document = await renderReport({ caseData: sandboxed });

			expect(typesOf(document)).not.toContain("assurance-case-structure");
		});
	});

	describe("title page", () => {
		it("holds the case name, description, export date and version", async () => {
			const document = await renderReport();

			expect(sectionOf(document, "title-page").blocks).toStrictEqual([
				heading(1, "Sample case"),
				paragraph("About it"),
				{ type: "divider" },
				metadata("Export Date", EXPORT_DATE),
				metadata("Export Version", "1.0"),
			]);
		});

		it("ends with the organisation when the branding names one", async () => {
			const document = await renderReport(
				{},
				{ organisationName: "Example Org" }
			);

			expect(sectionOf(document, "title-page").blocks.at(-1)).toStrictEqual(
				metadata("Organisation", "Example Org")
			);
		});

		it("has no organisation line when the branding names none", async () => {
			const document = await renderReport();

			expect(sectionOf(document, "title-page").blocks).toHaveLength(5);
		});
	});

	describe("table of contents", () => {
		it("is an empty section the exporters fill in", async () => {
			const document = await renderReport();

			expect(sectionOf(document, "table-of-contents").blocks).toStrictEqual([]);
		});
	});

	describe("diagrams", () => {
		it("leaves out every diagram when no overview image is given", async () => {
			const document = await renderReport({
				branchDiagrams: [{ ...OVERVIEW, title: "Branch" }],
			});

			expect(typesOf(document)).not.toContain("diagram");
		});

		it("leaves out the diagrams when the user switches the diagram off", async () => {
			const document = await renderReport({
				diagramImage: OVERVIEW,
				branchDiagrams: [{ ...OVERVIEW, title: "Branch" }],
				sectionOverrides: { diagram: false },
			});

			expect(typesOf(document)).not.toContain("diagram");
		});

		it("holds only the overview when no branch diagrams are given", async () => {
			const document = await renderReport({
				diagramImage: OVERVIEW,
				branchDiagrams: [],
			});

			expect(
				document.sections.filter((s) => s.type === "diagram")
			).toHaveLength(1);
		});

		it("places the diagrams between the contents and the summary", async () => {
			const document = await renderReport({
				diagramImage: OVERVIEW,
				branchDiagrams: [{ ...OVERVIEW, title: "Branch" }],
			});

			expect(typesOf(document).slice(0, 5)).toStrictEqual([
				"title-page",
				"table-of-contents",
				"diagram",
				"diagram",
				"executive-summary",
			]);
		});

		it("gives each branch its own diagram section with an image and caption", async () => {
			const document = await renderReport({
				diagramImage: OVERVIEW,
				branchDiagrams: [
					{ data: "data:image/png;base64,BBBB", format: "png", title: "Zeta" },
				],
			});

			const branch = document.sections.filter((s) => s.type === "diagram")[1];

			expect(branch?.title).toBe("Zeta");
			expect(branch?.blocks).toStrictEqual([
				{
					type: "image",
					src: "data:image/png;base64,BBBB",
					alt: "Branch diagram: Zeta — Sample case",
					caption: "Zeta",
				},
			]);
		});
	});

	describe("executive summary", () => {
		it("gives the description, a divider and a statistics table", async () => {
			const tree = exportNode({
				id: "g1",
				type: "GOAL",
				children: [
					exportNode({
						id: "s1",
						type: "STRATEGY",
						children: [
							exportNode({ id: "p1", type: "PROPERTY_CLAIM" }),
							exportNode({ id: "p2", type: "PROPERTY_CLAIM" }),
						],
					}),
					exportNode({ id: "e1", type: "EVIDENCE" }),
					exportNode({ id: "c1", type: "CONTEXT" }),
				],
			});
			const document = await renderReport({
				caseData: exportCase(tree, { description: "Summary text" }),
			});

			expect(sectionOf(document, "executive-summary").blocks).toStrictEqual([
				paragraph("Summary text"),
				{ type: "divider" },
				heading(3, "Case Statistics"),
				{
					type: "table",
					headers: ["Metric", "Count"],
					rows: [
						["Total Elements", "6"],
						["Goals", "1"],
						["Strategies", "1"],
						["Property Claims", "2"],
						["Evidence Items", "1"],
					],
				},
			]);
		});

		it("shows zero for kinds the case lacks", async () => {
			const lone = exportCase(exportNode({ id: "g1", type: "GOAL" }));
			const document = await renderReport({ caseData: lone });

			const table = sectionOf(document, "executive-summary").blocks.find(
				(b) => b.type === "table"
			);

			expect(table).toMatchObject({
				rows: [
					["Total Elements", "1"],
					["Goals", "1"],
					["Strategies", "0"],
					["Property Claims", "0"],
					["Evidence Items", "0"],
				],
			});
		});
	});

	describe("assurance case structure", () => {
		it("lists the elements in tree order with their depth, leaving out sandbox elements", async () => {
			const document = await renderReport();

			const elements = sectionOf(
				document,
				"assurance-case-structure"
			).blocks.map((b) =>
				b.type === "element" ? [b.node.id, b.depth] : b.type
			);

			expect(elements).toStrictEqual([
				["g1", 0],
				["s1", 1],
				["p2", 2],
				["p1", 2],
				["e2", 3],
				["e1", 3],
				["g3", 2],
				["g4", 1],
			]);
		});
	});

	describe("flat element sections", () => {
		const ALL_ON = {
			goals: true,
			strategies: true,
			propertyClaims: true,
			evidence: true,
		};

		it("lists goals in tree order with depth-based heading levels and their fields", async () => {
			const document = await renderReport({ sectionOverrides: ALL_ON });

			expect(sectionOf(document, "goals").blocks).toStrictEqual([
				heading(2, "Goals"),
				heading(2, "Goal: G-root"),
				paragraph("Root goal"),
				metadata("Assumption", "A1"),
				metadata("Justification", "J1"),
				metadata("Context", "c-two, c-one"),
				heading(4, "Goal: G-under"),
				heading(3, "Goal"),
			]);
		});

		it("lists strategies with their description", async () => {
			const document = await renderReport({ sectionOverrides: ALL_ON });

			expect(sectionOf(document, "strategies").blocks).toStrictEqual([
				heading(2, "Strategies"),
				heading(3, "Strategy: S-zulu"),
				paragraph("Zulu strategy"),
			]);
		});

		it("lists property claims in tree order", async () => {
			const document = await renderReport({ sectionOverrides: ALL_ON });

			expect(sectionOf(document, "property-claims").blocks).toStrictEqual([
				heading(2, "Property Claims"),
				heading(4, "Property Claim: P-beta"),
				paragraph("Beta claim"),
				heading(4, "Property Claim: P-alpha"),
			]);
		});

		it("lists evidence at one heading level, with its address when it has one", async () => {
			const document = await renderReport({ sectionOverrides: ALL_ON });

			expect(sectionOf(document, "evidence").blocks).toStrictEqual([
				heading(2, "Evidence"),
				heading(3, "Evidence: E-two"),
				paragraph("Evidence two"),
				metadata("URL", "https://example.com/e2"),
				heading(3, "Evidence"),
			]);
		});

		it("caps the heading level of deeply nested elements at six", async () => {
			let tree = exportNode({ id: "g6", type: "GOAL", name: "G6" });
			for (let n = 5; n >= 0; n--) {
				tree = exportNode({
					id: `g${n}`,
					type: "GOAL",
					name: `G${n}`,
					children: [tree],
				});
			}
			const document = await renderReport({
				caseData: exportCase(tree),
				sectionOverrides: { goals: true },
			});

			expect(
				headingsOf(sectionOf(document, "goals").blocks).map(([level]) => level)
			).toStrictEqual([2, 2, 3, 4, 5, 6, 6, 6]);
		});
	});

	describe("comments", () => {
		it("lists each commented element in tree order with author and date", async () => {
			const document = await renderReport();

			expect(sectionOf(document, "comments").blocks).toStrictEqual([
				heading(2, "Comments"),
				heading(3, "Comments on Goal: G-root"),
				paragraph("[zed - 02/01/2024] first"),
				paragraph("[amy - 25/12/2024] second"),
				heading(3, "Comments on Property Claim: P-beta"),
				paragraph("[bo - 30/06/2024] beta note"),
				heading(3, "Comments on Goal: G-under"),
				paragraph("[cy - 02/01/2024] under note"),
				heading(3, "Comments on Goal"),
				paragraph("[eli - 05/03/2024] unnamed note"),
			]);
		});

		it("leaves the section out when no element carries a comment", async () => {
			const bare = exportCase(
				exportNode({
					id: "g1",
					type: "GOAL",
					children: [exportNode({ id: "s1", type: "STRATEGY", comments: [] })],
				})
			);
			const document = await renderReport({ caseData: bare });

			expect(typesOf(document)).not.toContain("comments");
		});
	});

	describe("document information", () => {
		it("gives the case name, version and the time of export", async () => {
			const document = await renderReport();

			expect(sectionOf(document, "metadata").blocks).toStrictEqual([
				metadata("Case Name", "Sample case"),
				metadata("Export Version", "1.0"),
				metadata("Exported At", "2025-03-04T10:30:00.000Z"),
			]);
		});
	});
});
