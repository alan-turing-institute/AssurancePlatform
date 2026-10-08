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
});
