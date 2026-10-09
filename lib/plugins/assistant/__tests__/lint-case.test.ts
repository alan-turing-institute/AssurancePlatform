import { beforeEach, describe, expect, it, vi } from "vitest";
import { JUDGEMENT_RULE_IDS } from "@/lib/plugins/assistant/linter/judgement-prompt";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";
import { exportCase } from "@/lib/services/case-export-service";

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: vi.fn(),
}));

const options = { toolCallId: "t", messages: [] };

// A supporting claim as the root (no top goal), with one strategy that has no children.
const tree = {
	id: "root",
	type: "PROPERTY_CLAIM",
	name: "P1",
	description: "claim",
	inSandbox: false,
	role: "SUPPORTING",
	children: [
		{
			id: "orphan",
			type: "STRATEGY",
			name: "S1",
			description: "an empty strategy",
			inSandbox: false,
			children: [],
		},
	],
} as never;

beforeEach(() => {
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: "2025-01-01T00:00:00.000Z",
			case: { name: "Case", description: "d" },
			tree,
		},
	});
});

describe("lint_case tool", () => {
	it("reports a missing root and an orphan element with rule ids and labels", async () => {
		const result = (await createCaseTools("u", "c").lint_case.execute?.(
			{},
			options
		)) as {
			findings: { ruleId: string; elementLabel: string; fix: string }[];
		};

		const byRule = new Map(result.findings.map((f) => [f.ruleId, f]));
		expect(byRule.get("TREE01")?.elementLabel).toBe("P1");
		expect(byRule.get("TREE03")?.elementLabel).toBe("S1");
		expect(byRule.get("TREE03")?.fix).toBeTruthy();
	});

	it("returns the judgement rules as prompt text for the model to apply", async () => {
		const result = (await createCaseTools("u", "c").lint_case.execute?.(
			{},
			options
		)) as { judgementRules: string };

		expect(result.judgementRules).toContain(JUDGEMENT_RULE_IDS[0]);
		expect(result.judgementRules).toContain("Look for:");
	});

	it("is introduced in the system prompt", () => {
		expect(buildSystemPrompt(["lint_case"])).toContain("lint_case");
	});

	it("names the registered tools in registration order in the base prompt", () => {
		const names = Object.keys(createCaseTools("u", "c"));

		expect(names).toEqual(["read_case", "read_element", "lint_case"]);
		expect(buildSystemPrompt(names)).toContain(
			"You have these read-only tools: read_case, read_element, lint_case."
		);
		expect(buildSystemPrompt([...names, "extra_tool"])).toContain(
			"read_case, read_element, lint_case, extra_tool."
		);
	});
});
