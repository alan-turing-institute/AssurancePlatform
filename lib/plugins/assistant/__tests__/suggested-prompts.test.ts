import { describe, expect, it } from "vitest";
import { suggestedPrompts } from "../suggested-prompts";

const ALL = ["read_case", "read_element", "lint_case", "suggest_techniques"];
const WITHOUT_TECHNIQUES = ["read_case", "read_element", "lint_case"];

describe("suggestedPrompts", () => {
	it("offers the case-wide questions when nothing is selected", () => {
		expect(
			suggestedPrompts({ tools: WITHOUT_TECHNIQUES, selected: false })
		).toEqual({
			prompts: [
				"What is the top-level goal?",
				"Which claims lack evidence?",
				"Check this case against the rules",
			],
			mentionsTechniques: false,
		});
	});

	it("offers questions about the selected element, and techniques when the tool exists", () => {
		expect(
			suggestedPrompts({ tools: ALL, selected: true, label: "P1" })
		).toEqual({
			prompts: [
				"Explain P1's role",
				"What evidence supports P1?",
				"Suggest techniques for P1",
				"Check this case against the rules",
			],
			mentionsTechniques: true,
		});
	});

	it("leaves out the technique prompt when no element is selected, even if the tool exists", () => {
		const { prompts, mentionsTechniques } = suggestedPrompts({
			tools: ALL,
			selected: false,
		});

		expect(prompts.some((prompt) => prompt.includes("techniques"))).toBe(false);
		expect(mentionsTechniques).toBe(true);
	});

	it("leaves out the technique prompt when the tool is not registered", () => {
		const { prompts } = suggestedPrompts({
			tools: WITHOUT_TECHNIQUES,
			selected: true,
			label: "P1",
		});

		expect(prompts).toEqual([
			"Explain P1's role",
			"What evidence supports P1?",
			"Check this case against the rules",
		]);
	});

	it("names a selected element that has no label as the selected element", () => {
		const { prompts } = suggestedPrompts({ tools: ALL, selected: true });

		expect(prompts).toContain("Explain the selected element's role");
		expect(prompts).toContain("Suggest techniques for the selected element");
	});

	it("offers only the prompts whose tool is registered", () => {
		expect(
			suggestedPrompts({ tools: ["lint_case"], selected: false }).prompts
		).toEqual(["Check this case against the rules"]);
		expect(suggestedPrompts({ tools: [], selected: true })).toEqual({
			prompts: [],
			mentionsTechniques: false,
		});
	});
});
