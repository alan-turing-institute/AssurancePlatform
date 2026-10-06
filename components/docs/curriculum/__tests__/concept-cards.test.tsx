import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { nodeTypeConfigs } from "@/components/shared/nodes/node-config";
import type { Concept, ModuleProgressContextValue } from "@/types/curriculum";
import ConceptCards from "../concept-cards";
import ModuleProgressContext from "../module-progress-context";

const concepts: Concept[] = [
	{
		id: "c-goal",
		type: "goal",
		name: "Goal",
		definition: "The main claim.",
		details: ["Sits at the root"],
		example: "G1 says the system is fair.",
	},
	{
		id: "c-context",
		type: "context",
		name: "Context",
		definition: "A boundary for a claim.",
	},
	{
		id: "c-assumption",
		type: "assumption",
		name: "Assumption",
		definition: "Something taken as given.",
	},
	{
		id: "c-justification",
		type: "justification",
		name: "Justification",
		definition: "The link between claim and evidence.",
	},
];

const CARD_ID = /^concept-card-c-/;

const iconOf = (id: string) =>
	screen
		.getByTestId(`concept-card-${id}`)
		.querySelector('[data-testid="concept-card-icon"]') as Element;

const expandAll = () => {
	for (const concept of concepts) {
		fireEvent.click(
			screen.getByRole("button", { name: `Expand ${concept.name}` })
		);
	}
};

describe("ConceptCards", () => {
	it("renders one card per concept", () => {
		render(<ConceptCards concepts={concepts} />);
		expect(screen.getAllByTestId(CARD_ID)).toHaveLength(4);
		expect(screen.getByText("0 of 4 reviewed")).toBeInTheDocument();
	});

	it("gives an element card the icon colour from the node config", () => {
		render(<ConceptCards concepts={concepts} />);
		expect(iconOf("c-goal")).toHaveClass(nodeTypeConfigs.goal.colours.icon);
	});

	it("gives attribute cards a muted attribute icon", () => {
		render(<ConceptCards concepts={concepts} />);
		for (const id of ["c-context", "c-assumption", "c-justification"]) {
			expect(iconOf(id)).toHaveClass("text-muted-foreground");
		}
		expect(iconOf("c-context")).not.toBe(iconOf("c-assumption"));
		expect(iconOf("c-context").innerHTML).not.toBe(
			iconOf("c-assumption").innerHTML
		);
	});

	it("toggles aria-expanded and reveals details and the example", () => {
		render(<ConceptCards concepts={concepts} />);
		const button = screen.getByRole("button", { name: "Expand Goal" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Sits at the root")).not.toBeInTheDocument();

		fireEvent.click(button);
		const collapse = screen.getByRole("button", { name: "Collapse Goal" });
		expect(collapse).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Sits at the root")).toBeInTheDocument();
		expect(screen.getByText("G1 says the system is fair.")).toBeInTheDocument();

		fireEvent.click(collapse);
		expect(screen.getByRole("button", { name: "Expand Goal" })).toHaveAttribute(
			"aria-expanded",
			"false"
		);
	});

	it("completes the task once, after every card has been expanded", () => {
		const completeTask = vi.fn();
		const getTask = vi.fn(() => undefined);
		render(
			<ModuleProgressContext.Provider
				value={
					{ completeTask, getTask } as unknown as ModuleProgressContextValue
				}
			>
				<ConceptCards concepts={concepts} taskId="review-core-elements" />
			</ModuleProgressContext.Provider>
		);
		for (const [index, concept] of concepts.entries()) {
			fireEvent.click(
				screen.getByRole("button", { name: `Expand ${concept.name}` })
			);
			if (index < concepts.length - 1) {
				fireEvent.click(
					screen.getByRole("button", { name: `Collapse ${concept.name}` })
				);
				expect(completeTask).not.toHaveBeenCalled();
			}
			if (index === 0) {
				expect(screen.getByText("1 of 4 reviewed")).toBeInTheDocument();
			}
		}
		expect(completeTask).toHaveBeenCalledTimes(1);
		expect(completeTask).toHaveBeenCalledWith("review-core-elements");

		// Collapsing and re-expanding does not complete it again.
		fireEvent.click(
			screen.getByRole("button", { name: "Collapse Justification" })
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Expand Justification" })
		);
		expect(completeTask).toHaveBeenCalledTimes(1);
	});

	it("renders and expands without a progress provider", () => {
		render(<ConceptCards concepts={concepts} taskId="review-core-elements" />);
		expandAll();
		expect(screen.getByText("4 of 4 reviewed")).toBeInTheDocument();
	});

	it("does not intercept key presses aimed at a sibling textarea", () => {
		render(
			<>
				<ConceptCards concepts={concepts} />
				<textarea aria-label="notes" />
			</>
		);
		const textarea = screen.getByLabelText("notes");
		for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
			const notPrevented = fireEvent.keyDown(textarea, { key });
			expect(notPrevented).toBe(true);
		}
	});
});
