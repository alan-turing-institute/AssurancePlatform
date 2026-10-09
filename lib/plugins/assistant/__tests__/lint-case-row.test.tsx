import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

const output = {
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
	prechecks: [
		{ ruleId: "SCOP01", elementLabel: "G1", detail: "context list is empty" },
	],
	questions: [],
	judgementRules: "long text",
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
