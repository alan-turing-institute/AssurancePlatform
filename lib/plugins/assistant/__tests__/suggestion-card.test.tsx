import userEvent from "@testing-library/user-event";
import type { UIMessage } from "ai";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import type { ApplyResult } from "../apply-suggestion";
import { SuggestionResult } from "../suggestion-card";

const apply = vi.hoisted(() =>
	vi.fn<(...args: unknown[]) => Promise<ApplyResult>>()
);
vi.mock("../apply-suggestion", () => ({ applySuggestion: apply }));

const onOutcome = vi.fn();

const EDIT = {
	suggested: true,
	kind: "edit",
	elementId: "p1",
	elementType: "property_claim",
	label: "P1",
	changes: {
		description: {
			before: "The model is accurate",
			after: "It is accurate to 2%",
		},
		context: { before: ["Hospital A"], after: ["Hospital A", "Hospital B"] },
	},
};

const NEW = {
	suggested: true,
	kind: "new",
	parentId: "p1",
	parentLabel: "P1",
	parentType: "property_claim",
	childType: "evidence",
	description: "Quarterly test report",
};

const part = (output: unknown, tool = "suggest_edit") =>
	({
		type: `tool-${tool}`,
		toolCallId: "call-1",
		state: "output-available",
		input: {},
		output,
	}) as UIMessage["parts"][number];

function show(
	output: unknown,
	options: {
		canEdit?: boolean;
		outcome?: "applied" | "dismissed" | "changed";
		tool?: string;
	} = {}
) {
	return renderWithoutProviders(
		<SuggestionResult
			canEdit={options.canEdit ?? true}
			caseId="case-1"
			onOutcome={onOutcome}
			outcome={options.outcome}
			part={part(output, options.tool)}
		/>
	);
}

beforeEach(() => {
	apply.mockReset();
	onOutcome.mockReset();
});

describe("the suggestion card for a rewording", () => {
	it("shows the label, the current text and the suggested text, and changes nothing until Apply", () => {
		show(EDIT);

		const card = screen.getByTestId("assistant-suggestion");
		expect(card).toHaveTextContent("Suggested change to P1");
		const changes = screen.getAllByTestId("assistant-suggestion-change");
		expect(changes[0]).toHaveTextContent("Description");
		expect(changes[0]).toHaveTextContent("The model is accurate");
		expect(changes[0]).toHaveTextContent("It is accurate to 2%");
		expect(changes[1]).toHaveTextContent("Hospital B");
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
		expect(screen.getByRole("button", { name: "Dismiss" })).toBeEnabled();
		expect(apply).not.toHaveBeenCalled();
		expect(onOutcome).not.toHaveBeenCalled();
	});

	it("shows case text as plain text, so that it cannot become a link or an image", () => {
		show({
			...EDIT,
			changes: {
				description: {
					before: "[old](https://evil.example)",
					after: "![x](https://evil.example/a.png) <b>bold</b>",
				},
			},
		});

		const card = screen.getByTestId("assistant-suggestion");
		expect(card).toHaveTextContent("[old](https://evil.example)");
		expect(card).toHaveTextContent("<b>bold</b>");
		expect(card.querySelector("a, img, b")).toBeNull();
	});

	it("applies on Apply, then says Applied and records the outcome against the call", async () => {
		apply.mockResolvedValue({ status: "applied" });
		show(EDIT);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(apply).toHaveBeenCalledWith(
			"case-1",
			expect.objectContaining({ elementId: "p1" })
		);
		expect(onOutcome).toHaveBeenCalledWith("call-1", "applied");
	});

	it("says the element has changed, and offers nothing to retry, when Apply refuses", async () => {
		apply.mockResolvedValue({ status: "changed" });
		const view = show(EDIT);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(onOutcome).toHaveBeenCalledWith("call-1", "changed");
		view.unmount();
		show(EDIT, { outcome: "changed" });

		expect(screen.getByRole("status")).toHaveTextContent(
			"This element has changed since the suggestion was made, so nothing was saved. Ask the assistant again."
		);
		expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
	});

	it("keeps the buttons and shows the reason when the save fails", async () => {
		apply.mockResolvedValue({ status: "failed", message: "Permission denied" });
		show(EDIT);

		await userEvent.click(screen.getByRole("button", { name: "Apply" }));

		expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
		expect(onOutcome).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
	});

	it("leaves the case alone on Dismiss", async () => {
		show(EDIT);

		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

		expect(apply).not.toHaveBeenCalled();
		expect(onOutcome).toHaveBeenCalledWith("call-1", "dismissed");
	});

	it.each([
		["applied", "Applied"],
		["dismissed", "Dismissed"],
	] as const)("shows %s once the user has decided, with no buttons", (outcome, text) => {
		show(EDIT, { outcome });

		expect(screen.getByRole("status")).toHaveTextContent(text);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("offers no buttons to a user who cannot edit the case", () => {
		show(EDIT, { canEdit: false });

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByTestId("assistant-suggestion")).toHaveTextContent(
			"needs permission to edit"
		);
	});
});

/** A card that keeps the outcome the way the panel does, so the buttons go once the user has chosen. */
function DecidingCard({ output = EDIT }: { output?: unknown }) {
	const [outcome, setOutcome] = useState<
		"applied" | "dismissed" | "changed" | undefined
	>();
	return (
		<>
			<input aria-label="Elsewhere" />
			<SuggestionResult
				canEdit
				caseId="case-1"
				onOutcome={(_id, decision) => setOutcome(decision)}
				outcome={outcome}
				part={part(output)}
			/>
		</>
	);
}

describe("the suggestion card: accessibility", () => {
	it("passes axe with two cards for the same element, which share a heading", async () => {
		const { container } = renderWithoutProviders(
			<main>
				<h1>Case</h1>
				<h2>Chat</h2>
				<SuggestionResult
					canEdit
					caseId="case-1"
					onOutcome={onOutcome}
					outcome={undefined}
					part={part(EDIT)}
				/>
				<SuggestionResult
					canEdit
					caseId="case-1"
					onOutcome={onOutcome}
					outcome={undefined}
					part={
						{
							...part(EDIT),
							toolCallId: "call-2",
						} as UIMessage["parts"][number]
					}
				/>
			</main>
		);

		expect(screen.getAllByText("Suggested change to P1")).toHaveLength(2);
		const results = await axe(container);

		expect(results.violations).toEqual([]);
	});

	it.each([
		["Apply", "Applied"],
		["Dismiss", "Dismissed"],
	])("moves focus to the outcome line when %s removes the buttons", async (button, text) => {
		apply.mockResolvedValue({ status: "applied" });
		renderWithoutProviders(<DecidingCard />);

		await userEvent.click(screen.getByRole("button", { name: button }));

		const line = await screen.findByRole("status");
		expect(line).toHaveTextContent(text);
		expect(line).toHaveFocus();
	});

	it("leaves focus where the user has moved to while the save was running", async () => {
		let finish: (result: ApplyResult) => void = () => undefined;
		apply.mockReturnValue(new Promise((resolve) => (finish = resolve)));
		renderWithoutProviders(<DecidingCard />);
		await userEvent.click(screen.getByRole("button", { name: "Apply" }));
		await userEvent.click(screen.getByLabelText("Elsewhere"));

		finish({ status: "applied" });

		expect(await screen.findByRole("status")).toHaveTextContent("Applied");
		expect(screen.getByLabelText("Elsewhere")).toHaveFocus();
	});
});

describe("the suggestion card for a new element", () => {
	it("shows where it would go, its type and its text", () => {
		show(NEW, { tool: "suggest_new_element" });

		const card = screen.getByTestId("assistant-suggestion");
		expect(card).toHaveTextContent("Suggested new evidence");
		expect(card).toHaveTextContent("New evidence beneath P1");
		expect(card).toHaveTextContent("Quarterly test report");
		expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
	});

	it("says the parent has changed when Apply refuses", () => {
		show(NEW, { tool: "suggest_new_element", outcome: "changed" });

		expect(screen.getByRole("status")).toHaveTextContent(
			"The element it would go beneath has changed"
		);
	});
});

describe("a refused suggestion and other results", () => {
	it("shows a refusal in plain words with no buttons", () => {
		show({
			suggested: false,
			reason: "TEA does not allow evidence directly beneath G1.",
		});

		expect(
			screen.getByTestId("assistant-suggestion-refused")
		).toHaveTextContent(
			"Not suggested: TEA does not allow evidence directly beneath G1."
		);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("shows nothing for a result of another shape, an unfinished call or another tool", () => {
		const { container, rerender } = show({
			error: "Too many tool calls in one reply.",
		});
		expect(container).toBeEmptyDOMElement();

		rerender(
			<SuggestionResult
				canEdit
				caseId="case-1"
				onOutcome={onOutcome}
				outcome={undefined}
				part={
					{
						...part(EDIT),
						state: "input-available",
					} as UIMessage["parts"][number]
				}
			/>
		);
		expect(container).toBeEmptyDOMElement();

		rerender(
			<SuggestionResult
				canEdit
				caseId="case-1"
				onOutcome={onOutcome}
				outcome={undefined}
				part={part(EDIT, "read_case")}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});
