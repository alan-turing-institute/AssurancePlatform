import { beforeEach, describe, expect, it, vi } from "vitest";
import { suggestionsSwitchedOff } from "@/lib/plugins/assistant/suggestion-switch";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));
const writes = vi.hoisted(() => ({
	createElement: vi.fn(),
	updateElement: vi.fn(),
}));
vi.mock("@/lib/services/element-service", () => writes);

const WINDOW = { id: "k3f9x2m7qa", name: "window", text: "Ten minutes" };

const TREE = {
	id: "g1",
	type: "GOAL",
	name: "G1",
	description: "top",
	inSandbox: false,
	children: [
		{
			id: "p1",
			type: "PROPERTY_CLAIM",
			name: "P1",
			description: "Alerts arrive within {window#k3f9x2m7qa}",
			justification: "Agreed",
			context: [WINDOW],
			inSandbox: false,
			children: [
				{
					id: "e1",
					type: "EVIDENCE",
					name: "E1",
					description: "A log",
					inSandbox: false,
					children: [],
				},
			],
		},
		{
			id: "p2",
			type: "PROPERTY_CLAIM",
			name: "P2",
			description: "Operators can respond",
			inSandbox: false,
			children: [
				{
					id: "e2",
					type: "EVIDENCE",
					name: "E2",
					description: "A drill report",
					inSandbox: false,
					children: [],
				},
			],
		},
		{
			id: "p3",
			type: "PROPERTY_CLAIM",
			name: "P3",
			description: "Operators are trained",
			inSandbox: false,
			children: [
				{
					id: "e2",
					type: "EVIDENCE",
					name: "E2",
					description: "A drill report",
					inSandbox: false,
					children: [],
				},
			],
		},
	],
};

const options = { toolCallId: "t", messages: [] };

function suggestionTools() {
	const tools = createCaseTools("u", "c", { suggestions: true });
	return {
		edit: (input: Record<string, unknown>) =>
			tools.suggest_edit?.execute?.(input as never, options),
		add: (input: Record<string, unknown>) =>
			tools.suggest_new_element?.execute?.(input as never, options),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree: TREE as never,
		},
	});
});

describe("registering the suggestion tools", () => {
	it("leaves them out unless asked, and adds them after the other tools when asked", () => {
		expect(Object.keys(createCaseTools("u", "c"))).toEqual([
			"read_case",
			"read_element",
			"lint_case",
		]);
		expect(
			Object.keys(createCaseTools("u", "c", { suggestions: true }))
		).toEqual([
			"read_case",
			"read_element",
			"lint_case",
			"suggest_edit",
			"suggest_new_element",
		]);
	});
});

describe("suggest_edit", () => {
	it("resolves a label to the element's id and takes the before text from the stored case", async () => {
		const result = await suggestionTools().edit({
			elementId: " p2 ",
			description: "Operators can respond within two minutes",
		});

		expect(result).toMatchObject({
			suggested: true,
			kind: "edit",
			elementId: "p2",
			label: "P2",
			changes: {
				description: {
					before: "Operators can respond",
					after: "Operators can respond within two minutes",
				},
			},
		});
	});

	it("tells the model it is only a suggestion", async () => {
		const result = await suggestionTools().edit({
			elementId: "p2",
			description: "Operators can respond within two minutes",
		});

		expect(result).toMatchObject({
			note: expect.stringContaining("Do not say it has been applied"),
		});
	});

	it("refuses to reword text that holds a reference, which the model's plain copy would hide", async () => {
		const result = await suggestionTools().edit({
			elementId: "p1",
			description: "Alerts arrive within ten minutes",
		});

		expect(result).toMatchObject({
			suggested: false,
			reason: expect.stringContaining("refers to a defined term"),
		});
	});

	it("refuses a context list that defines terms, but rewords another field of the same element", async () => {
		const tools = suggestionTools();

		expect(
			await tools.edit({ elementId: "p1", context: ["Ten minutes"] })
		).toMatchObject({
			suggested: false,
			reason: expect.stringContaining("defines terms"),
		});
		expect(
			await tools.edit({
				elementId: "p1",
				justification: "Agreed with operations",
			})
		).toMatchObject({ suggested: true });
	});

	it("refuses a label shared by evidence linked beneath two claims, and asks for the selected element", async () => {
		const result = await suggestionTools().edit({
			elementId: "E2",
			description: "A drill report from March",
		});

		expect(result).toMatchObject({
			suggested: false,
			reason: expect.stringContaining("ask the user to select the element"),
		});
	});

	it("prefers an id to a label, so shared evidence can still be reached by its id", async () => {
		const result = await suggestionTools().edit({
			elementId: "e2",
			description: "A drill report from March",
		});

		expect(result).toMatchObject({ suggested: true, elementId: "e2" });
	});

	it("refuses an element that is not in the case, and a case it cannot read", async () => {
		const tools = suggestionTools();
		expect(
			await tools.edit({ elementId: "elsewhere", description: "x" })
		).toMatchObject({
			suggested: false,
		});

		vi.mocked(exportCase).mockResolvedValue({ error: "Permission denied" });
		expect(
			await suggestionTools().edit({ elementId: "p2", description: "x" })
		).toEqual({ suggested: false, reason: "The case could not be read." });
	});

	it("writes nothing", async () => {
		await suggestionTools().edit({ elementId: "p2", description: "Changed" });

		expect(writes.updateElement).not.toHaveBeenCalled();
		expect(writes.createElement).not.toHaveBeenCalled();
	});
});

describe("suggest_new_element", () => {
	it("suggests evidence beneath a claim named by label", async () => {
		const result = await suggestionTools().add({
			parentId: "P2",
			type: "evidence",
			description: "Quarterly drill report",
		});

		expect(result).toMatchObject({
			suggested: true,
			kind: "new",
			parentId: "p2",
			parentLabel: "P2",
			childType: "evidence",
			description: "Quarterly drill report",
		});
	});

	it("refuses evidence directly beneath a goal, saying what is allowed there", async () => {
		const result = await suggestionTools().add({
			parentId: "g1",
			type: "evidence",
			description: "A log",
		});

		expect(result).toMatchObject({
			suggested: false,
			reason: expect.stringContaining("strategies and claims"),
		});
	});

	it("refuses an unknown parent, and writes nothing", async () => {
		const result = await suggestionTools().add({
			parentId: "nope",
			type: "strategy",
			description: "Argue by hazard",
		});

		expect(result).toMatchObject({ suggested: false });
		expect(writes.createElement).not.toHaveBeenCalled();
	});
});

describe("the suggestion tools in a reply", () => {
	it("share the reply's cap on tool calls", async () => {
		const tools = suggestionTools();
		const results = await Promise.all(
			Array.from({ length: 25 }, () =>
				tools.edit({ elementId: "p2", description: "x" })
			)
		);

		expect(results.at(-1)).toEqual({
			error: "Too many tool calls in one reply.",
		});
	});
});

describe("the system prompt", () => {
	const READ = ["read_case", "read_element", "lint_case"];

	it("keeps the read-only sentence to the read tools and says the case cannot be changed when there are no suggestion tools", () => {
		const prompt = buildSystemPrompt(READ);

		expect(prompt).toContain(
			"You have these read-only tools: read_case, read_element, lint_case."
		);
		expect(prompt).toContain("You cannot change the case.");
		expect(prompt).not.toContain("suggest_edit");
	});

	it("names the suggestion tools in a sentence of their own, and says the user decides what is applied", () => {
		const prompt = buildSystemPrompt([
			...READ,
			"suggest_edit",
			"suggest_new_element",
		]);

		expect(prompt).toContain(
			"You have these read-only tools: read_case, read_element, lint_case."
		);
		expect(prompt).toContain(
			"suggest changes with suggest_edit, suggest_new_element"
		);
		expect(prompt).toContain(
			"the user decides whether to apply each suggestion"
		);
		expect(prompt).toContain(
			"Never say that a change was made unless the user applied it"
		);
		expect(prompt).not.toContain("You cannot change the case.");
	});
});

describe("suggestionsSwitchedOff", () => {
	it.each([
		undefined,
		"",
		"  ",
		"0",
		"false",
		"FALSE",
		"no",
		"off",
	])("leaves the suggestions on when the setting is %j", (value) => {
		expect(suggestionsSwitchedOff(value)).toBe(false);
	});

	it.each([
		"1",
		"true",
		"TRUE",
		"yes",
		"disabled",
	])("switches them off when the setting is %j", (value) => {
		expect(suggestionsSwitchedOff(value)).toBe(true);
	});
});
