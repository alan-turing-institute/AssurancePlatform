import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

const CASE_NAME = /"name": "Case A"/;

describe("ToolCallRow", () => {
	it("shows the tool name, its state and its result", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-read_case",
						toolCallId: "c1",
						state: "output-available",
						input: {},
						output: { name: "Case A" },
					} as never
				}
			/>
		);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"read_case"
		);
		expect(screen.getByText("(done)")).toBeInTheDocument();
		expect(screen.getByText(CASE_NAME)).toBeInTheDocument();
	});

	it("shows the error text of a failed call", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-read_case",
						toolCallId: "c2",
						state: "output-error",
						input: {},
						errorText: "not found",
					} as never
				}
			/>
		);

		expect(screen.getByText("not found")).toBeInTheDocument();
	});

	it("renders nothing for a text part", () => {
		renderWithoutProviders(<ToolCallRow part={{ type: "text", text: "hi" }} />);

		expect(screen.queryByTestId("assistant-tool-call")).toBeNull();
	});

	it("lists suggested techniques with a link, a two-decimal score and goals", () => {
		renderWithoutProviders(
			<ToolCallRow
				part={
					{
						type: "tool-suggest_techniques",
						toolCallId: "c2",
						state: "output-available",
						input: {},
						output: {
							rankingAvailable: true,
							results: [
								{
									name: "SHAP",
									url: "https://example.org/shap",
									score: 0.9,
									goals: ["Explainability"],
								},
							],
						},
					} as never
				}
			/>
		);

		const link = screen.getByRole("link", { name: "SHAP" });
		expect(link).toHaveAttribute("href", "https://example.org/shap");
		expect(link).toHaveAttribute("target", "_blank");
		expect(screen.getByTestId("assistant-techniques")).toHaveTextContent(
			"(0.90): Explainability"
		);
	});
});
