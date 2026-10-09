import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

const CASE_NAME = /"name": "Case A"/;

function part(overrides: Record<string, unknown>) {
	return {
		type: "tool-read_case",
		toolCallId: "c1",
		state: "output-available",
		input: {},
		...overrides,
	} as never;
}

async function open() {
	await userEvent.click(screen.getByRole("button"));
}

describe("ToolCallRow", () => {
	it("shows a plain title and the state label, and the result once opened", async () => {
		renderWithoutProviders(
			<ToolCallRow part={part({ output: { name: "Case A" } })} />
		);
		const row = screen.getByTestId("assistant-tool-call");

		expect(row).toHaveTextContent("Read the case");
		expect(row).toHaveTextContent("Completed");
		expect(row).not.toHaveTextContent(CASE_NAME);

		await open();

		expect(row).toHaveTextContent(CASE_NAME);
	});

	it.each([
		["tool-read_case", "Read the case"],
		["tool-read_element", "Read an element"],
		["tool-lint_case", "Check against the rules"],
		["tool-suggest_techniques", "Suggest techniques"],
		["tool-something_else", "something_else"],
	])("titles %s as %s", (type, title) => {
		renderWithoutProviders(<ToolCallRow part={part({ type })} />);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(title);
	});

	it.each([
		["input-streaming", "Pending"],
		["input-available", "Running"],
		["output-available", "Completed"],
		["output-error", "Error"],
	])("labels the %s state as %s", (state, label) => {
		renderWithoutProviders(<ToolCallRow part={part({ state })} />);

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(label);
	});

	it("shows the error text of a failed call", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({ state: "output-error", errorText: "not found" })}
			/>
		);

		await open();

		expect(screen.getByText("not found")).toBeInTheDocument();
	});

	it("shows the input as Parameters only when it has a key", async () => {
		const { unmount } = renderWithoutProviders(
			<ToolCallRow part={part({ input: { elementId: "e1" } })} />
		);
		await open();
		expect(screen.getByText("Parameters")).toBeInTheDocument();
		unmount();

		for (const input of [{}, undefined]) {
			const view = renderWithoutProviders(
				<ToolCallRow part={part({ input })} />
			);
			await open();
			expect(screen.queryByText("Parameters")).toBeNull();
			view.unmount();
		}
	});

	it("shows a result longer than the limit cut short", async () => {
		renderWithoutProviders(
			<ToolCallRow part={part({ output: { text: "x".repeat(5000) } })} />
		);

		await open();

		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"more characters"
		);
	});

	it("renders nothing for a text part", () => {
		renderWithoutProviders(<ToolCallRow part={{ type: "text", text: "hi" }} />);

		expect(screen.queryByTestId("assistant-tool-call")).toBeNull();
	});

	it("shows a result that is not in the expected shape as text, so an error message stays readable", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					type: "tool-suggest_techniques",
					output: { error: "The techniques service is not reachable." },
				})}
			/>
		);

		await open();

		expect(screen.queryByTestId("assistant-techniques")).toBeNull();
		expect(screen.getByTestId("assistant-tool-call")).toHaveTextContent(
			"The techniques service is not reachable."
		);
	});

	it("lists suggested techniques with a link, a two-decimal score and goals", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					type: "tool-suggest_techniques",
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
				})}
			/>
		);

		await open();

		const link = screen.getByRole("link", { name: "SHAP" });
		expect(link).toHaveAttribute("href", "https://example.org/shap");
		expect(link).toHaveAttribute("target", "_blank");
		expect(screen.getByTestId("assistant-techniques")).toHaveTextContent(
			"(0.90): Explainability"
		);
	});
});
