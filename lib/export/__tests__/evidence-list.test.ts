import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlainCase, PlainTreeNode } from "@/lib/case/defined-terms";
import {
	exportCase,
	exportNode,
	heading,
	metadata,
	paragraph,
	sectionOf,
	typesOf,
} from "@/src/__tests__/utils/export-case-kit";
import { createTemplateFromPreset } from "../templates";
import type { RenderedDocument, TemplateInput } from "../types";

const EXPORT_DATE = "04/03/2025";
const EXPORTED_AT = "2025-03-04T10:30:00.000Z";
const LONG_DESCRIPTION = "x".repeat(101);
const EXACT_DESCRIPTION = "y".repeat(100);

/**
 * G-root -> [PC-one -> [E-zeta, E-hidden (sandbox)],
 * PC-two -> [E-alpha, unnamed evidence with an address, E-exact]].
 * Names are deliberately not in alphabetical order, and the evidence sits under
 * two claims, so tree order is told apart from sorted order. E-zeta has a
 * description that is one character too long for the table, E-exact one that
 * just fits, E-alpha has no address and the unnamed item has no description.
 */
function sampleTree(): PlainTreeNode {
	const zeta = exportNode({
		id: "e1",
		type: "EVIDENCE",
		name: "E-zeta",
		description: LONG_DESCRIPTION,
		url: "https://example.com/zeta",
	});
	const hidden = exportNode({
		id: "e2",
		type: "EVIDENCE",
		name: "E-hidden",
		description: "Hidden evidence",
		url: "https://example.com/hidden",
		inSandbox: true,
	});
	const alpha = exportNode({
		id: "e3",
		type: "EVIDENCE",
		name: "E-alpha",
		description: "Alpha evidence",
	});
	const unnamed = exportNode({
		id: "e4",
		type: "EVIDENCE",
		url: "https://example.com/unnamed",
	});
	const exact = exportNode({
		id: "e5",
		type: "EVIDENCE",
		name: "E-exact",
		description: EXACT_DESCRIPTION,
	});
	const one = exportNode({
		id: "p1",
		type: "PROPERTY_CLAIM",
		name: "PC-one",
		children: [zeta, hidden],
	});
	const two = exportNode({
		id: "p2",
		type: "PROPERTY_CLAIM",
		name: "PC-two",
		children: [alpha, unnamed, exact],
	});
	return exportNode({
		id: "g1",
		type: "GOAL",
		name: "G-root",
		children: [one, two],
	});
}

function sampleCase(): PlainCase {
	return exportCase(sampleTree(), {
		name: "Sample case",
		description: "About it",
	});
}

function renderList(
	input: Partial<TemplateInput> = {},
	branding?: Parameters<typeof createTemplateFromPreset>[1]
): Promise<RenderedDocument> {
	return createTemplateFromPreset("evidence-list", branding).render({
		caseData: sampleCase(),
		...input,
	});
}

function bareCase(): PlainCase {
	return exportCase(exportNode({ id: "g1", type: "GOAL", name: "G-root" }));
}

const ALL_TYPES = ["title-page", "evidence", "metadata"] as const;

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2025-03-04T10:30:00Z") });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("evidence list template", () => {
	describe("section order and switches", () => {
		it("lists its sections in report order with their titles", async () => {
			const document = await renderList();

			expect(document.sections.map((s) => [s.type, s.title])).toStrictEqual([
				["title-page", "Sample case - Evidence Register"],
				["evidence", "Evidence Register"],
				["metadata", "Document Information"],
			]);
		});

		it.each([
			["titlePage", "title-page"],
			["evidence", "evidence"],
			["metadata", "metadata"],
		] as const)("leaves out %s only when the user switches it off", async (key, type) => {
			const document = await renderList({ sectionOverrides: { [key]: false } });

			expect(typesOf(document)).toStrictEqual(
				ALL_TYPES.filter((t) => t !== type)
			);
		});

		it("gives no diagram, summary or goal sections even when a diagram is supplied", async () => {
			const document = await renderList({
				diagramImage: { data: "data:image/png;base64,AAAA", format: "png" },
			});

			expect(typesOf(document)).toStrictEqual([...ALL_TYPES]);
		});
	});

	describe("title page", () => {
		it("holds the register heading, the case description and the export date", async () => {
			const document = await renderList();

			expect(sectionOf(document, "title-page").blocks).toStrictEqual([
				heading(1, "Sample case - Evidence Register"),
				paragraph("About it"),
				{ type: "divider" },
				metadata("Export Date", EXPORT_DATE),
			]);
		});

		it("ends with the organisation when the branding names one", async () => {
			const document = await renderList({}, { organisationName: "Example" });

			expect(sectionOf(document, "title-page").blocks.at(-1)).toStrictEqual(
				metadata("Organisation", "Example")
			);
		});

		it("has no organisation line when the branding names none", async () => {
			const document = await renderList();

			expect(sectionOf(document, "title-page").blocks).toHaveLength(4);
		});
	});

	describe("evidence table", () => {
		it("opens with the section heading and a table of all evidence in tree order", async () => {
			const document = await renderList();
			const blocks = sectionOf(document, "evidence").blocks;

			expect(blocks.slice(0, 2)).toStrictEqual([
				heading(2, "Evidence Register"),
				{
					type: "table",
					headers: ["#", "Name", "Description", "URL"],
					rows: [
						["1", "E-zeta", `${"x".repeat(97)}...`, "https://example.com/zeta"],
						["2", "E-alpha", "Alpha evidence", "-"],
						["3", "Evidence", "", "https://example.com/unnamed"],
						["4", "E-exact", EXACT_DESCRIPTION, "-"],
					],
				},
			]);
		});

		it("says so when the case has no evidence outside the sandbox", async () => {
			const document = await renderList({ caseData: bareCase() });

			expect(sectionOf(document, "evidence").blocks).toStrictEqual([
				heading(2, "Evidence Register"),
				paragraph("No evidence items found in this case."),
				{ type: "divider" },
				heading(3, "Evidence Details"),
			]);
		});
	});

	describe("evidence details", () => {
		it("follows the table with a divider and one entry per evidence item in tree order", async () => {
			const document = await renderList();

			expect(sectionOf(document, "evidence").blocks.slice(2)).toStrictEqual([
				{ type: "divider" },
				heading(3, "Evidence Details"),
				heading(4, "Evidence: E-zeta"),
				paragraph(LONG_DESCRIPTION),
				metadata("URL", "https://example.com/zeta"),
				heading(4, "Evidence: E-alpha"),
				paragraph("Alpha evidence"),
				heading(4, "Evidence"),
				metadata("URL", "https://example.com/unnamed"),
				heading(4, "Evidence: E-exact"),
				paragraph(EXACT_DESCRIPTION),
			]);
		});
	});

	describe("document information", () => {
		it("gives the case name, version, export time and the default footer text", async () => {
			const document = await renderList();

			expect(sectionOf(document, "metadata").blocks).toStrictEqual([
				heading(2, "Document Information"),
				metadata("Case Name", "Sample case"),
				metadata("Export Version", "1.0"),
				metadata("Exported At", EXPORTED_AT),
				metadata("Generated By", "Generated by TEA Platform"),
			]);
		});

		it("names the branding's footer text as the generator", async () => {
			const document = await renderList({}, { footerText: "Example footer" });

			expect(sectionOf(document, "metadata").blocks.at(-1)).toStrictEqual(
				metadata("Generated By", "Example footer")
			);
		});
	});
});
