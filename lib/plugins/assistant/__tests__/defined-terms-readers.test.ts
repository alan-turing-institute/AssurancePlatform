import { beforeEach, describe, expect, it, vi } from "vitest";
import { toPlainCase } from "@/lib/case/defined-terms";
import { lintCase } from "@/lib/plugins/assistant/linter/lint-case";
import {
	resolveSelectedElement,
	selectionPrompt,
} from "@/lib/plugins/assistant/selected-element";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));
vi.mock("@/lib/plugins/assistant/linter/lint-case", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/plugins/assistant/linter/lint-case")
		>();
	return { ...actual, lintCase: vi.fn(actual.lintCase) };
});

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

describe("the Case Assistant's tools on a case with a variable and a placeholder", () => {
	const SYSTEM_ID = "sysaaaaaaa";

	function caseWithVariable(value?: string): CaseExportNested {
		const stored = storedCase();
		return {
			...stored,
			tree: {
				...stored.tree,
				context: [
					{
						id: SYSTEM_ID,
						name: "system",
						text: "the system under test",
						variable: true,
						...(value ? { value } : {}),
					},
				],
				children: [
					{
						...stored.tree.children[0],
						id: "p1",
						type: "PROPERTY_CLAIM",
						name: "P1",
						description: `Safe on {sys#${SYSTEM_ID}}.`,
						inSandbox: false,
						context: [],
						children: [],
					},
					{
						id: "p2",
						type: "PROPERTY_CLAIM",
						name: "P2",
						description: "",
						inSandbox: false,
						isPlaceholder: true,
						placeholderHint: "Say how it is tested",
						children: [],
					},
				],
			},
		};
	}

	it('read_case marks a variable as {name = "value"} and a placeholder as {to fill in: "hint"}', async () => {
		vi.mocked(exportCase).mockResolvedValue({
			data: caseWithVariable("AcmeBot"),
		});

		const result = (await createCaseTools("u", "c").read_case.execute?.(
			{},
			options
		)) as { tree: CaseExportNested["tree"] };

		expect(result.tree.context).toEqual([
			"system: the system under test (variable: AcmeBot)",
		]);
		expect(result.tree.children[0]?.description).toBe(
			'Safe on {system = "AcmeBot"}.'
		);
		expect(result.tree.children[1]?.description).toBe(
			'{to fill in: "Say how it is tested"}'
		);
	});

	it("read_element marks a variable with no value as not set, and its children's placeholders too", async () => {
		vi.mocked(exportCase).mockResolvedValue({ data: caseWithVariable() });

		const claim = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "p1" },
			options
		);
		const goal = await createCaseTools("u", "c").read_element.execute?.(
			{ elementId: "g1" },
			options
		);

		expect(claim).toMatchObject({
			element: { description: "Safe on {system = (not set)}." },
		});
		expect(goal).toMatchObject({
			element: {
				children: [
					{ id: "p1", description: "Safe on {system = (not set)}." },
					{ id: "p2", description: '{to fill in: "Say how it is tested"}' },
				],
			},
		});
	});

	it("shows the prompt the selected element's marked text and keeps the plain text for the search", async () => {
		vi.mocked(exportCase).mockResolvedValue({
			data: caseWithVariable("AcmeBot"),
		});

		const claim = await resolveSelectedElement("u", "c", "p1");
		const blank = await resolveSelectedElement("u", "c", "p2");

		expect(claim).toMatchObject({
			text: "Safe on AcmeBot.",
			markedText: 'Safe on {system = "AcmeBot"}.',
		});
		expect(selectionPrompt(claim)).toContain(
			JSON.stringify('Safe on {system = "AcmeBot"}.')
		);
		expect(blank).toMatchObject({
			text: "",
			markedText: '{to fill in: "Say how it is tested"}',
		});
	});

	it("does not send an empty placeholder's marker to the techniques search as a query", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "http://localhost:9");
		vi.mocked(exportCase).mockResolvedValue({
			data: caseWithVariable("AcmeBot"),
		});
		const selection = await resolveSelectedElement("u", "c", "p2");
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const result = await createCaseTools("u", "c", {
			selection,
		}).suggest_techniques?.execute?.({}, options);

		expect(result).toEqual({ error: "The selected element has no text." });
		expect(fetchSpy).not.toHaveBeenCalled();
		vi.unstubAllEnvs();
		fetchSpy.mockRestore();
	});

	it("gives the rules check the plain form, with the value where the card shows it", async () => {
		vi.mocked(exportCase).mockResolvedValue({
			data: caseWithVariable("AcmeBot"),
		});

		await createCaseTools("u", "c").lint_case.execute?.({}, options);

		const checked = vi.mocked(lintCase).mock.calls.at(-1)?.[0];
		expect(checked?.tree.children[0]?.description).toBe("Safe on AcmeBot.");
		expect(checked?.tree.children[1]?.description).toBe("");
	});

	it("explains the markers to the model and tells it not to copy them", () => {
		const prompt = buildSystemPrompt(["read_case"]);

		expect(prompt).toContain('{name = "value"}');
		expect(prompt).toContain('{to fill in: "hint"}');
		expect(prompt).toContain("JSON string");
		expect(prompt).toContain("Never write these markers");
	});
});
