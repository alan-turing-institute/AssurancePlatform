import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { ToolCallRow } from "../tool-call-row";

function part(output: unknown, state = "output-available") {
	return {
		type: "tool-suggest_techniques",
		toolCallId: "c1",
		state,
		input: { claimText: "x" },
		output,
	} as never;
}

async function open() {
	await userEvent.click(screen.getByRole("button"));
}

describe("ToolCallRow for suggest_techniques", () => {
	it("lists two results that share a url without a duplicate-key warning", async () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const same = {
			retrievalScore: 0.1,
			goals: [],
			score: 0.5,
			url: "https://techniques.example/same",
		};
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					rankingAvailable: true,
					results: [
						{ ...same, slug: "a", name: "First" },
						{ ...same, slug: "b", name: "Second" },
					],
				})}
			/>
		);

		await open();

		expect(screen.getAllByRole("link")).toHaveLength(2);
		expect(error).not.toHaveBeenCalled();
		error.mockRestore();
	});

	it("links each technique name to its url in a new tab, with score and goals", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					rankingAvailable: true,
					results: [
						{
							slug: "a",
							name: "SHAP",
							score: 0.8765,
							retrievalScore: 0.1,
							goals: ["Explainability", "Fairness"],
							url: "https://techniques.example/shap",
						},
						{
							slug: "b",
							name: "LIME",
							score: 0.5,
							retrievalScore: 0.1,
							goals: [],
							url: "https://techniques.example/lime",
						},
					],
				})}
			/>
		);
		await open();
		const shap = screen.getByRole("link", { name: "SHAP" });
		expect(shap).toHaveAttribute("href", "https://techniques.example/shap");
		expect(shap).toHaveAttribute("target", "_blank");
		expect(shap.getAttribute("rel")).toContain("noopener");
		expect(screen.getByRole("link", { name: "LIME" })).toHaveAttribute(
			"href",
			"https://techniques.example/lime"
		);
		const list = screen.getByTestId("assistant-techniques");
		expect(list.textContent).toContain("0.88");
		expect(list.textContent).toContain("0.50");
		expect(list.textContent).toContain("Explainability");
		expect(list.textContent).toContain("Fairness");
	});

	it("does not make a link of a non-http url", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					results: [
						{ name: "Bad", url: "javascript:alert(1)", score: 1, goals: [] },
					],
				})}
			/>
		);
		await open();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByTestId("assistant-techniques").textContent).toContain(
			"Bad"
		);
	});

	it("lists a technique that has no url, as a name without a link", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({ results: [{ name: "Bare", score: 1, goals: [] }] })}
			/>
		);
		await open();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByTestId("assistant-techniques").textContent).toContain(
			"Bare"
		);
	});

	it("shows no list for the unreachable error", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({ error: "The techniques service is not reachable." })}
			/>
		);
		await open();
		expect(screen.queryByTestId("assistant-techniques")).toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("shows no list while the call is still running", () => {
		renderWithoutProviders(
			<ToolCallRow part={part(undefined, "input-available")} />
		);
		expect(screen.queryByTestId("assistant-techniques")).toBeNull();
	});
});

describe("ToolCallRow for suggest_techniques: the steps of the lookup", () => {
	const result = {
		slug: "a",
		name: "SHAP",
		score: 0.9,
		retrievalScore: 0.1,
		goals: [],
		url: "https://techniques.example/shap",
	};

	it("says that semantic search and ranking were used", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					searchUsed: true,
					rankingUsed: true,
					results: [result],
				})}
			/>
		);
		await open();

		const steps = screen.getByTestId("assistant-technique-steps");
		expect(steps).toHaveTextContent("Semantic search: used.");
		expect(steps).toHaveTextContent("Ranking: used.");
		expect(screen.getByRole("link", { name: "SHAP" })).toBeInTheDocument();
	});

	it("says which step was not used, with the reason for each", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					searchUsed: false,
					searchReason: "check not passed",
					rankingUsed: false,
					rankingReason: "timed out",
					results: [result],
				})}
			/>
		);
		await open();

		const steps = screen.getByTestId("assistant-technique-steps");
		expect(steps).toHaveTextContent(
			"Semantic search: not used (check not passed)."
		);
		expect(steps).toHaveTextContent("Ranking: not used (timed out).");
	});

	it("shows the semantic search step the tool reported and leaves out a ranking value that is not a boolean", async () => {
		renderWithoutProviders(
			<ToolCallRow
				part={part({
					searchUsed: true,
					rankingUsed: "yes",
					results: [result],
				})}
			/>
		);
		await open();

		const steps = screen.getByTestId("assistant-technique-steps");
		expect(steps).toHaveTextContent("Semantic search: used.");
		expect(steps).not.toHaveTextContent("Ranking");
		expect(screen.getByTestId("assistant-techniques")).toBeInTheDocument();
	});

	it("shows no steps line for a result from before the tool reported them", async () => {
		renderWithoutProviders(<ToolCallRow part={part({ results: [result] })} />);
		await open();

		expect(screen.queryByTestId("assistant-technique-steps")).toBeNull();
	});
});
