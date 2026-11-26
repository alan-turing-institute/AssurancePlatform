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
import type { RenderedDocument, TemplateInput } from "../types";

const EXPORT_DATE = "04/03/2025";

/**
 * G-root -> [S-one -> [G-mid -> [G-deep -> [E-omega]], E-alpha],
 * G-hidden (sandbox) -> [E-hidden (sandbox)], G-unnamed -> [unnamed evidence]].
 * Names are deliberately not in alphabetical order, and the goal at depth one
 * comes after the goal at depth two in the tree, so tree order is told apart
 * from sorted order and from depth order.
 */
function sampleTree(): PlainTreeNode {
	const omega = exportNode({
		id: "e1",
		type: "EVIDENCE",
		name: "E-omega",
		description: "Omega evidence",
		url: "https://example.com/omega",
	});
	const alpha = exportNode({
		id: "e2",
		type: "EVIDENCE",
		name: "E-alpha",
		description: "Alpha evidence",
	});
	const bare = exportNode({ id: "e3", type: "EVIDENCE" });
	const hiddenEvidence = exportNode({
		id: "e4",
		type: "EVIDENCE",
		name: "E-hidden",
		inSandbox: true,
	});
	const deep = exportNode({
		id: "g3",
		type: "GOAL",
		name: "G-deep",
		children: [omega],
	});
	const mid = exportNode({
		id: "g2",
		type: "GOAL",
		name: "G-mid",
		description: "Mid goal",
		children: [deep],
	});
	const strategy = exportNode({
		id: "s1",
		type: "STRATEGY",
		name: "S-one",
		children: [mid, alpha],
	});
	const hidden = exportNode({
		id: "g4",
		type: "GOAL",
		name: "G-hidden",
		inSandbox: true,
		children: [hiddenEvidence],
	});
	const unnamed = exportNode({ id: "g5", type: "GOAL", children: [bare] });
	return exportNode({
		id: "g1",
		type: "GOAL",
		name: "G-root",
		description: "Root goal",
		children: [strategy, hidden, unnamed],
	});
}

function sampleCase(): PlainCase {
	return exportCase(sampleTree(), {
		name: "Sample case",
		description: "About it",
	});
}

function renderSummary(
	input: Partial<TemplateInput> = {},
	branding?: Parameters<typeof createTemplateFromPreset>[1]
): Promise<RenderedDocument> {
	return createTemplateFromPreset("summary", branding).render({
		caseData: sampleCase(),
		...input,
	});
}

function chain(depth: number): PlainTreeNode {
	let node = exportNode({ id: `g${depth}`, type: "GOAL", name: `G${depth}` });
	for (let n = depth - 1; n >= 0; n--) {
		node = exportNode({
			id: `g${n}`,
			type: "GOAL",
			name: `G${n}`,
			children: [node],
		});
	}
	return node;
}

const ALL_TYPES = [
	"title-page",
	"diagram",
	"executive-summary",
	"goals",
	"evidence",
] as const;

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2025-03-04T10:30:00Z") });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("summary template", () => {
	describe("identity", () => {
		it("names itself and carries its description and preset", () => {
			const template = createTemplateFromPreset("summary");

			expect(template.name).toBe("Summary");
			expect(template.description).toBe(
				"Condensed overview with goals and key evidence only"
			);
			expect(template.preset).toBe("summary");
		});
	});

	describe("section order and switches", () => {
		it("lists its sections in report order with their titles", async () => {
			const document = await renderSummary({
				diagramImage: OVERVIEW,
				branchDiagrams: [
					{ ...OVERVIEW, title: "Zeta branch" },
					{ ...OVERVIEW, title: "Alpha branch" },
				],
			});

			expect(document.sections.map((s) => [s.type, s.title])).toStrictEqual([
				["title-page", "Sample case"],
				["diagram", "Assurance Case Diagram"],
				["diagram", "Zeta branch"],
				["diagram", "Alpha branch"],
				["executive-summary", "Executive Summary"],
				["goals", "Goals"],
				["evidence", "Evidence"],
			]);
		});

		it("leaves out the diagram when no overview image is given", async () => {
			const document = await renderSummary();

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"executive-summary",
				"goals",
				"evidence",
			]);
		});

		it.each([
			["titlePage", "title-page"],
			["diagram", "diagram"],
			["executiveSummary", "executive-summary"],
			["goals", "goals"],
			["evidence", "evidence"],
		] as const)("leaves out %s only when the user switches it off", async (key, type) => {
			const document = await renderSummary({
				diagramImage: OVERVIEW,
				sectionOverrides: { [key]: false },
			});

			expect(typesOf(document)).toStrictEqual(
				ALL_TYPES.filter((t) => t !== type)
			);
		});
	});

	describe("title page", () => {
		it("holds the case name, description and export date", async () => {
			const document = await renderSummary();

			expect(sectionOf(document, "title-page").blocks).toStrictEqual([
				heading(1, "Sample case"),
				paragraph("About it"),
				{ type: "divider" },
				metadata("Export Date", EXPORT_DATE),
			]);
		});

		it("ends with the organisation when the branding names one", async () => {
			const document = await renderSummary({}, { organisationName: "Example" });

			expect(sectionOf(document, "title-page").blocks.at(-1)).toStrictEqual(
				metadata("Organisation", "Example")
			);
		});

		it("has no organisation line when the branding names none", async () => {
			const document = await renderSummary();

			expect(sectionOf(document, "title-page").blocks).toHaveLength(4);
		});
	});

	describe("diagrams", () => {
		it("gives the overview an image with alt text and caption", async () => {
			const document = await renderSummary({
				diagramImage: { data: "data:image/png;base64,CCCC", format: "png" },
			});

			expect(sectionOf(document, "diagram").blocks).toStrictEqual([
				{
					type: "image",
					src: "data:image/png;base64,CCCC",
					alt: "Diagram for Sample case",
					caption: "Assurance Case Structure",
				},
			]);
		});

		it("gives each branch its own diagram section with an image and caption", async () => {
			const document = await renderSummary({
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

		it("holds only the overview when no branch diagrams are given", async () => {
			const document = await renderSummary({
				diagramImage: OVERVIEW,
				branchDiagrams: [],
			});

			expect(
				document.sections.filter((s) => s.type === "diagram")
			).toHaveLength(1);
		});

		it("leaves out the branch diagrams when no overview image is given", async () => {
			const document = await renderSummary({
				branchDiagrams: [{ ...OVERVIEW, title: "Branch" }],
			});

			expect(typesOf(document)).not.toContain("diagram");
		});

		it("leaves out the branch diagrams when the user switches the diagram off", async () => {
			const document = await renderSummary({
				diagramImage: OVERVIEW,
				branchDiagrams: [{ ...OVERVIEW, title: "Branch" }],
				sectionOverrides: { diagram: false },
			});

			expect(typesOf(document)).not.toContain("diagram");
		});
	});

	describe("executive summary", () => {
		it("gives the overview, a divider and a statistics table", async () => {
			const document = await renderSummary();

			expect(sectionOf(document, "executive-summary").blocks).toStrictEqual([
				heading(2, "Overview"),
				paragraph("About it"),
				{ type: "divider" },
				{
					type: "table",
					headers: ["Metric", "Count"],
					rows: [
						["Total Elements", "10"],
						["Goals", "4"],
						["Evidence Items", "3"],
					],
				},
			]);
		});

		it("shows zero for kinds the case lacks", async () => {
			const lone = exportCase(exportNode({ id: "s1", type: "STRATEGY" }));
			const document = await renderSummary({ caseData: lone });

			expect(
				sectionOf(document, "executive-summary").blocks.at(-1)
			).toMatchObject({
				rows: [
					["Total Elements", "1"],
					["Goals", "0"],
					["Evidence Items", "0"],
				],
			});
		});
	});

	describe("goals", () => {
		it("lists named and unnamed goals in tree order, with their description", async () => {
			const document = await renderSummary();

			expect(sectionOf(document, "goals").blocks).toStrictEqual([
				heading(2, "Goals"),
				heading(3, "Goal: G-root"),
				paragraph("Root goal"),
				heading(3, "Goal: G-mid"),
				paragraph("Mid goal"),
				heading(3, "Goal"),
			]);
		});

		it("lists goals down to the second level and no further", async () => {
			const document = await renderSummary({ caseData: exportCase(chain(4)) });

			expect(sectionOf(document, "goals").blocks).toStrictEqual([
				heading(2, "Goals"),
				heading(3, "Goal: G0"),
				heading(3, "Goal: G1"),
				heading(3, "Goal: G2"),
			]);
		});

		it("leaves the section out when the case has no goal outside the sandbox", async () => {
			const tree = exportNode({
				id: "s1",
				type: "STRATEGY",
				children: [
					exportNode({ id: "g1", type: "GOAL", inSandbox: true }),
					exportNode({ id: "e1", type: "EVIDENCE" }),
				],
			});
			const document = await renderSummary({ caseData: exportCase(tree) });

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"executive-summary",
				"evidence",
			]);
		});

		it("keeps the section for a case of a single goal", async () => {
			const lone = exportCase(exportNode({ id: "g1", type: "GOAL" }));
			const document = await renderSummary({ caseData: lone });

			expect(typesOf(document)).toStrictEqual([
				"title-page",
				"executive-summary",
				"goals",
			]);
		});
	});

	describe("evidence", () => {
		it("lists evidence at any depth in tree order, with its address when it has one", async () => {
			const document = await renderSummary();

			expect(sectionOf(document, "evidence").blocks).toStrictEqual([
				heading(2, "Evidence"),
				heading(3, "Evidence: E-omega"),
				paragraph("Omega evidence"),
				metadata("URL", "https://example.com/omega"),
				heading(3, "Evidence: E-alpha"),
				paragraph("Alpha evidence"),
				heading(3, "Evidence"),
			]);
		});

		it("leaves the section out when the case has no evidence outside the sandbox", async () => {
			const tree = exportNode({
				id: "g1",
				type: "GOAL",
				children: [exportNode({ id: "e1", type: "EVIDENCE", inSandbox: true })],
			});
			const document = await renderSummary({ caseData: exportCase(tree) });

			expect(typesOf(document)).not.toContain("evidence");
		});

		it("keeps the section for a case with a single evidence item", async () => {
			const tree = exportNode({
				id: "g1",
				type: "GOAL",
				children: [exportNode({ id: "e1", type: "EVIDENCE" })],
			});
			const document = await renderSummary({ caseData: exportCase(tree) });

			expect(sectionOf(document, "evidence").blocks).toStrictEqual([
				heading(2, "Evidence"),
				heading(3, "Evidence"),
			]);
		});
	});
});
