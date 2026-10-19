import { beforeEach, describe, expect, it, vi } from "vitest";
import { toPlainCase } from "@/lib/case/defined-terms";
import { lintCase } from "@/lib/plugins/assistant/linter/lint-case";
import { resolveSelectedElement } from "@/lib/plugins/assistant/selected-element";
import { createCaseTools } from "@/lib/plugins/assistant/tools";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));

const options = { toolCallId: "t", messages: [] };
const WINDOW_ID = "k3f9x2m7qa";
const NARROW_ID = "p4n8c2d6xz";
const MEANING = "the interval over which separation is measured";
const PLAIN_ENTRY = `window: ${MEANING} (value: 5 minutes)`;

/** A goal that defines `window`, and a claim below it that refers to it and restates it. */
function storedCase(): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-10-19T00:00:00.000Z",
		case: { name: "Case", description: "d" },
		tree: {
			id: "g1",
			type: "GOAL",
			name: "G1",
			description: "The system keeps aircraft apart.",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: [
				{ id: WINDOW_ID, name: "window", text: MEANING, value: "5 minutes" },
			],
			children: [
				{
					id: "p1",
					type: "PROPERTY_CLAIM",
					name: "P1",
					description: `Separation holds within the {win#${WINDOW_ID}}.`,
					inSandbox: false,
					context: [
						{
							id: NARROW_ID,
							name: "window",
							text: MEANING,
							value: "5 minutes",
						},
					],
					children: [],
				},
			],
		},
	};
}

/** The same case as an author would have written it before named entries existed. */
function plainCase(): CaseExportNested {
	const stored = storedCase();
	return {
		...stored,
		version: "1.0",
		tree: {
			...stored.tree,
			context: [PLAIN_ENTRY],
			children: stored.tree.children.map((child) => ({
				...child,
				description: "Separation holds within the {window}.",
				context: [PLAIN_ENTRY],
			})),
		},
	};
}

beforeEach(() => {
	vi.mocked(exportCase).mockResolvedValue({ data: storedCase() });
});

describe("the Case Assistant's tools on a case with named entries", () => {
	it("read_case shows {name} in the text and the name, meaning and value as one string", async () => {
		const result = (await createCaseTools("u", "c").read_case.execute?.(
			{},
			options
		)) as { tree: CaseExportNested["tree"] };

		expect(result.tree.context).toEqual([PLAIN_ENTRY]);
		expect(result.tree.children[0]?.description).toBe(
			"Separation holds within the {window}."
		);
	});

	it("read_element shows the same plain form for one element", async () => {
		const result = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "p1" },
			options
		);

		expect(result).toMatchObject({
			found: true,
			element: {
				description: "Separation holds within the {window}.",
				context: [PLAIN_ENTRY],
			},
		});
	});

	it("hands the selected element's text to the prompt with references written as {name}", async () => {
		const selection = await resolveSelectedElement("u", "c", "p1");

		expect(selection?.text).toBe("Separation holds within the {window}.");
	});
});

describe("the rules check on a case with named entries", () => {
	it("gives the findings it gives for the same case written in plain text", () => {
		const fromNamed = lintCase(toPlainCase(storedCase()));
		const fromPlain = lintCase(toPlainCase(plainCase()));

		expect(fromNamed.findings.some((f) => f.ruleId === "SCOP02")).toBe(true);
		expect(fromNamed).toEqual(fromPlain);
	});
});
