import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nodeTypeConfigs } from "@/components/shared/nodes/node-config";
import type { Concept } from "@/types/curriculum";
import ConceptCards from "../concept-cards";

const CARD_TEST_ID = /^concept-card-[a-h]$/;
const NODE_COLOUR = /(text|border)-node-/;

const completeTask = vi.fn();
let progress: {
	completeTask: (id: string) => void;
	getTask: (id: string) => { id: string; completed: boolean } | undefined;
} | null = null;

vi.mock("../module-progress-context", () => ({
	useOptionalModuleProgress: () => progress,
}));

const make = (id: string, type: Concept["type"], extra?: Partial<Concept>) =>
	({
		id,
		type,
		name: `NaMe ${id}`,
		definition: `DeF ${id}`,
		...extra,
	}) as Concept;

const concepts: Concept[] = [
	make("a", "goal", { details: ["d1"], example: "ex" }),
	make("b", "strategy"),
	make("c", "property_claim"),
	make("d", "evidence"),
	make("e", "context"),
	make("f", "assumption"),
	make("g", "justification"),
	make("h", "general"),
];

const conceptAt = (index: number): Concept => {
	const concept = concepts[index];
	if (!concept) {
		throw new Error(`No concept at index ${index}`);
	}
	return concept;
};

const expand = (c: Concept) =>
	fireEvent.click(screen.getByRole("button", { name: `Expand ${c.name}` }));
const collapse = (c: Concept) =>
	fireEvent.click(screen.getByRole("button", { name: `Collapse ${c.name}` }));

beforeEach(() => {
	completeTask.mockReset();
	progress = {
		completeTask,
		getTask: (id) => ({ id, completed: false }),
	};
});

describe("ConceptCards rendering", () => {
	it("renders one card per concept in the given order, text as given", () => {
		render(<ConceptCards concepts={concepts} />);
		const cards = screen.getAllByTestId(CARD_TEST_ID);
		expect(cards.map((c) => c.dataset.testid)).toEqual(
			concepts.map((c) => `concept-card-${c.id}`)
		);
		expect(screen.getByText("NaMe a")).toBeTruthy();
		expect(screen.getByText("DeF h")).toBeTruthy();
	});

	it("colours element icons by kind and gives attribute cards no node colour", () => {
		render(<ConceptCards concepts={concepts} />);
		const iconClass = (id: string) =>
			screen
				.getByTestId(`concept-card-${id}`)
				.querySelector('[data-testid="concept-card-icon"]')
				?.getAttribute("class") ?? "";
		expect(iconClass("a")).toContain(nodeTypeConfigs.goal.colours.icon);
		expect(iconClass("b")).toContain(nodeTypeConfigs.strategy.colours.icon);
		expect(iconClass("c")).toContain(nodeTypeConfigs.property.colours.icon);
		expect(iconClass("d")).toContain(nodeTypeConfigs.evidence.colours.icon);
		for (const id of ["e", "f", "g", "h"]) {
			const card = screen.getByTestId(`concept-card-${id}`);
			expect(card.outerHTML).not.toMatch(NODE_COLOUR);
		}
	});

	it("renders no empty list or quote when details and example are absent", () => {
		render(<ConceptCards concepts={[make("x", "general")]} />);
		expand(make("x", "general"));
		const card = screen.getByTestId("concept-card-x");
		expect(card.querySelector("ul")).toBeNull();
		expect(card.querySelector("blockquote")).toBeNull();
	});

	it("shows details and example only once expanded", () => {
		render(<ConceptCards concepts={concepts} />);
		expect(screen.queryByText("d1")).toBeNull();
		expand(conceptAt(0));
		expect(screen.getByText("d1")).toBeTruthy();
		expect(screen.getByText("ex")).toBeTruthy();
	});
});

describe("ConceptCards expand and reviewed count", () => {
	it("toggles aria-expanded and never lowers the reviewed count", () => {
		render(<ConceptCards concepts={concepts} />);
		expect(screen.getByText("0 of 8 reviewed")).toBeTruthy();
		const btn = screen.getByRole("button", { name: "Expand NaMe a" });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(btn);
		expect(btn.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByText("1 of 8 reviewed")).toBeTruthy();
		collapse(conceptAt(0));
		expect(btn.getAttribute("aria-expanded")).toBe("false");
		expect(screen.getByText("1 of 8 reviewed")).toBeTruthy();
		expand(conceptAt(0));
		expect(screen.getByText("1 of 8 reviewed")).toBeTruthy();
	});

	it("announces the count politely and reaches m of m", () => {
		render(<ConceptCards concepts={concepts} />);
		expect(screen.getByText("0 of 8 reviewed").getAttribute("aria-live")).toBe(
			"polite"
		);
		for (const c of concepts) {
			expand(c);
		}
		expect(screen.getByText("8 of 8 reviewed")).toBeTruthy();
	});
});

describe("ConceptCards completion", () => {
	it("calls completeTask once, only after the last card is first expanded", () => {
		render(<ConceptCards concepts={concepts} taskId="t1" />);
		for (const c of concepts.slice(0, -1)) {
			expand(c);
		}
		expect(completeTask).not.toHaveBeenCalled();
		expand(concepts.at(-1) as Concept);
		expect(completeTask).toHaveBeenCalledTimes(1);
		expect(completeTask).toHaveBeenCalledWith("t1");
		// further toggling does not re-fire
		collapse(conceptAt(0));
		expand(conceptAt(0));
		collapse(conceptAt(1));
		expect(completeTask).toHaveBeenCalledTimes(1);
	});

	it("does not complete when a card is toggled repeatedly but others are unseen", () => {
		render(<ConceptCards concepts={concepts} taskId="t1" />);
		for (let i = 0; i < 3; i++) {
			expand(conceptAt(0));
			collapse(conceptAt(0));
		}
		expect(completeTask).not.toHaveBeenCalled();
	});

	it("never calls completeTask without a taskId", () => {
		render(<ConceptCards concepts={concepts} />);
		for (const c of concepts) {
			expand(c);
		}
		expect(completeTask).not.toHaveBeenCalled();
	});

	it("works outside any provider", () => {
		progress = null;
		render(<ConceptCards concepts={concepts} taskId="t1" />);
		expect(() => {
			for (const c of concepts) {
				expand(c);
			}
		}).not.toThrow();
		expect(screen.getByText("8 of 8 reviewed")).toBeTruthy();
	});

	it("does not call completeTask when the task is already completed", () => {
		progress = {
			completeTask,
			getTask: (id) => ({ id, completed: true }),
		};
		render(<ConceptCards concepts={concepts} taskId="t1" />);
		for (const c of concepts) {
			expand(c);
		}
		expect(completeTask).not.toHaveBeenCalled();
	});
});

describe("ConceptCards keyboard handling", () => {
	it("adds no window listener and leaves arrow keys in a textarea alone", () => {
		const add = vi.spyOn(window, "addEventListener");
		render(
			<div>
				<ConceptCards concepts={concepts} />
				<textarea data-testid="ta" />
			</div>
		);
		expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(
			0
		);
		for (const key of ["ArrowLeft", "ArrowRight"]) {
			const ev = new KeyboardEvent("keydown", {
				key,
				bubbles: true,
				cancelable: true,
			});
			screen.getByTestId("ta").dispatchEvent(ev);
			expect(ev.defaultPrevented).toBe(false);
		}
		expect(screen.getByText("0 of 8 reviewed")).toBeTruthy();
		add.mockRestore();
	});
});
