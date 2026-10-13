// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { liveParts } from "@/src/__tests__/utils/live-dom";
import {
	renderWithoutProviders,
	screen,
	waitFor,
	within,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

function part(name: string, state: string, extra: object = {}) {
	return {
		type: `tool-${name}`,
		toolCallId: "c1",
		state,
		input: {},
		...extra,
	} as never;
}

/** Renders one row and opens it when it is collapsed. */
async function showRow(row: never) {
	renderWithoutProviders(<ToolCallRow part={row} />);
	const element = screen.getByTestId("assistant-tool-call");
	const closed = within(element).queryByRole("button", { expanded: false });
	if (closed) {
		await userEvent.click(closed);
	}
	return element;
}

const LINT_OUTPUT = {
	found: true,
	findings: [
		{
			ruleId: "TREE03",
			elementLabel: "S1",
			reason: "dangling",
			severity: "error",
		},
		{
			ruleId: "EVID01",
			elementLabel: "P2",
			reason: "no evidence",
			severity: "error",
		},
	],
	acknowledgedGaps: [],
	questions: [],
	truncated: 7,
	judgementRules: "long judgement text",
};

describe("a tool row's header", () => {
	it.each([
		["read_case", "Read the case"],
		["read_element", "Read an element"],
		["lint_case", "Check against the rules"],
		["suggest_techniques", "Suggest techniques"],
		["some_other_tool", "some_other_tool"],
	])("titles %s as '%s'", (name, title) => {
		renderWithoutProviders(
			<ToolCallRow part={part(name, "input-available")} />
		);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(title);
	});

	it("titles a dynamic tool by its name", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "dynamic-tool",
						toolName: "mystery",
						toolCallId: "d1",
						state: "input-available",
						input: {},
					} as never
				}
			/>
		);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"mystery"
		);
	});

	it.each([
		["input-streaming", "Pending"],
		["input-available", "Running"],
		["output-available", "Completed"],
		["output-error", "Error"],
	])("labels the %s state '%s'", (state, label) => {
		renderWithoutProviders(
			<ToolCallRow
				part={part("read_case", state, { output: {}, errorText: "x" })}
			/>
		);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(label);
	});

	it("is collapsed until opened", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part("lint_case", "output-available", { output: LINT_OUTPUT })}
			/>
		);

		expect(screen.queryByTestId("assistant-lint-result")).toBeNull();
		await userEvent.click(screen.getByRole("button"));
		expect(screen.getByTestId("assistant-lint-result")).toBeInTheDocument();
	});
});

describe("a tool row's input", () => {
	it.each([
		["an empty object", {}],
		["no input", undefined],
	])("shows no parameters section for %s", async (_name, input) => {
		const row = await showRow(
			part("lint_case", "output-available", { input, output: LINT_OUTPUT })
		);

		expect(row).not.toHaveTextContent("Parameters");
		expect(row.textContent).not.toContain("{}");
	});

	it("does not fail while the input is still streaming in", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

		const row = await showRow(
			part("suggest_techniques", "input-streaming", { input: undefined })
		);

		expect(row).toHaveTextContent("Pending");
		expect(row).not.toHaveTextContent("Parameters");
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("shows the parameters of a call that has some", async () => {
		const row = await showRow(
			part("suggest_techniques", "input-available", {
				input: { claimText: "The model is fair" },
			})
		);

		expect(row).toHaveTextContent("Parameters");
		await waitFor(() => expect(row).toHaveTextContent("The model is fair"));
	});
});

describe("a tool row's result", () => {
	it("lists techniques with a link, a two-decimal score and goals", async () => {
		const row = await showRow(
			part("suggest_techniques", "output-available", {
				output: {
					rankingAvailable: true,
					results: [
						{
							slug: "shap",
							name: "SHAP",
							url: "https://techniques.example/shap",
							score: 0.8765,
							goals: ["Explainability", "Fairness"],
						},
						{
							slug: "lime",
							name: "LIME",
							url: "https://techniques.example/lime",
							score: 0.5,
							goals: [],
						},
					],
				},
			})
		);

		const link = within(row).getByRole("link", { name: "SHAP" });
		expect(link).toHaveAttribute("href", "https://techniques.example/shap");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
		const list = within(row).getByTestId("assistant-techniques");
		expect(list).toHaveTextContent("(0.88): Explainability, Fairness");
		expect(list).toHaveTextContent("(0.50)");
	});

	it("does not make a link of a technique address that is not http", async () => {
		const row = await showRow(
			part("suggest_techniques", "output-available", {
				output: {
					results: [
						{ name: "Bad", url: "javascript:alert(1)", score: 1, goals: [] },
					],
				},
			})
		);

		expect(within(row).queryByRole("link")).toBeNull();
		expect(within(row).getByTestId("assistant-techniques")).toHaveTextContent(
			"Bad"
		);
	});

	it("lists two techniques that share an address without a duplicate-key warning", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const same = {
			url: "https://techniques.example/same",
			score: 0.5,
			goals: [],
		};

		const row = await showRow(
			part("suggest_techniques", "output-available", {
				output: {
					results: [
						{ ...same, slug: "a", name: "First" },
						{ ...same, slug: "b", name: "Second" },
					],
				},
			})
		);

		expect(within(row).getAllByRole("link")).toHaveLength(2);
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("groups lint findings by rule family, counts what was left out and omits the judgement text", async () => {
		const row = await showRow(
			part("lint_case", "output-available", { output: LINT_OUTPUT })
		);

		expect(
			within(row).getByRole("heading", { name: "TREE Structure" })
		).toBeInTheDocument();
		expect(
			within(row).getByRole("heading", { name: "EVID Support" })
		).toBeInTheDocument();
		expect(within(row).getByText("7 more not shown")).toBeInTheDocument();
		expect(row).not.toHaveTextContent("long judgement text");
		expect(
			within(row).queryByRole("heading", { name: "Prechecks" })
		).toBeNull();
	});

	it("shows the error text of a failed call", async () => {
		const row = await showRow(
			part("read_case", "output-error", { errorText: "case not found" })
		);

		expect(row).toHaveTextContent("case not found");
	});

	it("shows a read tool's result as text", async () => {
		const row = await showRow(
			part("read_case", "output-available", {
				output: { name: "Case A", elements: 12 },
			})
		);

		await waitFor(() => expect(row).toHaveTextContent("Case A"));
		expect(row).toHaveTextContent("12");
	});

	it("cuts a very long result short and says how much was left out", async () => {
		const row = await showRow(
			part("read_case", "output-available", {
				output: { text: `${"a".repeat(6000)}END` },
			})
		);

		await waitFor(() => expect(row).toHaveTextContent("more characters"));
		expect(row.textContent).not.toContain("END");
	});

	it.each([
		[
			"a technique result that is not a list",
			"suggest_techniques",
			{ results: "nope" },
			"nope",
		],
		[
			"a technique result that is an error",
			"suggest_techniques",
			{ error: "The techniques service is not reachable." },
			"not reachable",
		],
		[
			"a technique result of the wrong shape",
			"suggest_techniques",
			{ results: [{ name: 1 }] },
			"name",
		],
		[
			"a lint result of the wrong shape",
			"lint_case",
			{ findings: "none" },
			"none",
		],
		[
			"a lint result that is a string",
			"lint_case",
			"plain words",
			"plain words",
		],
		["a lint result that is null", "lint_case", null, "null"],
	])("shows %s as text, without the list or lint view", async (_name, tool, output, shown) => {
		const row = await showRow(part(tool, "output-available", { output }));

		await waitFor(() => expect(row).toHaveTextContent(shown));
		expect(within(row).queryByTestId("assistant-techniques")).toBeNull();
		expect(within(row).queryByTestId("assistant-lint-result")).toBeNull();
	});
});

describe("text inside a tool row that came from the case or the model", () => {
	const HOSTILE =
		"<img src=x onerror=alert(1)><script>alert(1)</script>[x](javascript:alert(1))";

	it("stays text in the parameters, the result and the error", async () => {
		const row = await showRow(
			part("read_case", "output-error", {
				input: { note: HOSTILE },
				output: undefined,
				errorText: HOSTILE,
			})
		);

		await waitFor(() => expect(row).toHaveTextContent("Parameters"));
		expect(row.textContent).toContain("onerror=alert(1)");
		expect(liveParts(row)).toEqual([]);
	});

	it("stays text in a read tool's result", async () => {
		const row = await showRow(
			part("read_case", "output-available", {
				output: { case: { name: HOSTILE, description: HOSTILE } },
			})
		);

		await waitFor(() => expect(row).toHaveTextContent("onerror=alert(1)"));
		expect(liveParts(row)).toEqual([]);
	});

	it("stays text in a technique's name, goals and address", async () => {
		const row = await showRow(
			part("suggest_techniques", "output-available", {
				output: {
					results: [
						{
							name: HOSTILE,
							url: 'https://techniques.example/x" onmouseover="alert(1)',
							score: 1,
							goals: [HOSTILE],
						},
					],
				},
			})
		);

		expect(within(row).getByTestId("assistant-techniques")).toHaveTextContent(
			"onerror=alert(1)"
		);
		expect(liveParts(row)).toEqual([]);
	});

	it("stays text in a lint finding", async () => {
		const row = await showRow(
			part("lint_case", "output-available", {
				output: {
					...LINT_OUTPUT,
					findings: [
						{
							ruleId: "TREE03",
							elementLabel: HOSTILE,
							reason: HOSTILE,
							severity: "error",
						},
					],
				},
			})
		);

		expect(within(row).getByTestId("assistant-lint-result")).toHaveTextContent(
			"onerror=alert(1)"
		);
		expect(liveParts(row)).toEqual([]);
	});
});

describe("parts that are not tool calls", () => {
	it.each([
		["text", { type: "text", text: "hi" }],
		["a step marker", { type: "step-start" }],
		["thinking", { type: "reasoning", text: "hmm" }],
		["a notice", { type: "data-notice", data: "timeout" }],
	])("render nothing for %s", (_name, other) => {
		const { container } = renderWithoutProviders(
			<ToolCallRow part={other as never} />
		);

		expect(container).toBeEmptyDOMElement();
	});
});
