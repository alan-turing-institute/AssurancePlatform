import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

const withoutPrechecks = {
	found: true,
	findings: [
		{
			ruleId: "TREE03",
			elementLabel: "S1",
			reason: "dangling",
			severity: "error",
		},
		{
			ruleId: "TREE01",
			elementLabel: "P1",
			reason: "no root",
			severity: "warning",
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
	judgementRules: "long text",
};

const output = {
	...withoutPrechecks,
	prechecks: [
		{ ruleId: "SCOP01", elementLabel: "G1", detail: "context list is empty" },
	],
};

describe("lint_case row", () => {
	it("groups findings by rule family and omits the judgement text", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-lint_case",
						toolCallId: "l1",
						state: "output-available",
						input: {},
						output,
					} as never
				}
			/>
		);

		expect(
			screen.getByRole("heading", { name: "TREE Structure" })
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "EVID Support" })
		).toBeInTheDocument();
		expect(screen.getByText("TREE03")).toBeInTheDocument();
		expect(screen.getByText("S1")).toBeInTheDocument();
		expect(screen.queryByText("long text")).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Prechecks" })
		).toBeInTheDocument();
		expect(
			screen.getByText("context list is empty", { exact: false })
		).toBeInTheDocument();
	});

	it("shows the findings and no Prechecks section for a result with no prechecks field", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-lint_case",
						toolCallId: "l3",
						state: "output-available",
						input: {},
						output: withoutPrechecks,
					} as never
				}
			/>
		);

		expect(screen.getByText("TREE03")).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Prechecks" })
		).not.toBeInTheDocument();
	});

	it("reads the left-out counts from the result and shows each", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-lint_case",
						toolCallId: "l4",
						state: "output-available",
						input: {},
						output: {
							...output,
							truncated: 12,
							acknowledgedGapsTruncated: 50,
							questionsTruncated: 3,
						},
					} as never
				}
			/>
		);

		expect(screen.getByText("12 more not shown")).toBeInTheDocument();
		expect(
			screen.getByText(
				"0 acknowledged gaps (50 more not shown), 0 questions (3 more not shown)"
			)
		).toBeInTheDocument();
	});

	it("treats left-out counts that are not positive numbers as 0", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-lint_case",
						toolCallId: "l5",
						state: "output-available",
						input: {},
						output: {
							...output,
							truncated: "many",
							acknowledgedGapsTruncated: -4,
							questionsTruncated: null,
						},
					} as never
				}
			/>
		);

		expect(
			screen.getByText("0 acknowledged gaps, 0 questions")
		).toBeInTheDocument();
	});

	it("ignores a malformed prechecks field and still shows the findings", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-lint_case",
						toolCallId: "l2",
						state: "output-available",
						input: {},
						output: { ...output, prechecks: [{ ruleId: 1 }] },
					} as never
				}
			/>
		);

		expect(screen.getByText("TREE03")).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Prechecks" })
		).not.toBeInTheDocument();
	});
});
