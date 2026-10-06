import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DiagramNodeType } from "@/components/shared/nodes/node-config";
import type {
	ElementRef,
	SelectedElementSummary,
} from "@/lib/docs/selected-element";
import ElementInspector from "../element-inspector";

const TYPES: DiagramNodeType[] = [
	"goal",
	"strategy",
	"property",
	"evidence",
	"awayGoal",
	"module",
];
const EVIDENCES = /evidences/i;
const EVIDENCE = /evidence/i;
const SUPPORTED_BY_P1 = /supported by P1\./;
const SUPPORTED_BY_P1_P2 = /supported by P1 and P2\./;
const SUPPORTED_BY_S1_S3 = /supported by S1, S2 and S3\./;
const COLOUR_WORDS = /\b(blue|green|purple|red|orange|yellow)\b/i;

const summary = (
	type: DiagramNodeType,
	overrides: Partial<SelectedElementSummary> = {}
): SelectedElementSummary => ({
	id: "n1",
	name: "N1",
	type,
	isDefeater: false,
	attributes: { context: 0, assumption: false, justification: false },
	parent: null,
	children: [],
	...overrides,
});

const refs = (...names: string[]): ElementRef[] =>
	names.map((name) => ({ name, type: "property" }));

describe("ElementInspector (adversarial)", () => {
	it.each(TYPES)("uses no colour words for a %s", (type) => {
		const { container } = render(
			<ElementInspector
				element={summary(type, {
					isDefeater: true,
					attributes: { context: 2, assumption: true, justification: true },
					parent: { name: "G1", type: "goal" },
					children: refs("P1"),
				})}
			/>
		);
		expect(container.textContent).not.toMatch(COLOUR_WORDS);
	});

	it("does not pluralise evidence in the footer link", () => {
		render(<ElementInspector element={summary("evidence")} />);
		const link = screen.getByRole("link");
		expect(link.textContent).not.toMatch(EVIDENCES);
		expect(link.textContent).toMatch(EVIDENCE);
	});

	it.each(["awayGoal", "module"] as const)("shows no link for %s", (type) => {
		render(<ElementInspector element={summary(type)} />);
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("keeps a polite live line in the empty state", () => {
		render(<ElementInspector element={null} />);
		const region = screen.getByRole("region", { name: "Selected element" });
		const live = region.querySelector("[aria-live='polite']");
		expect(live).toHaveTextContent("Nothing selected");
	});

	it.each([
		[["P1"], SUPPORTED_BY_P1],
		[["P1", "P2"], SUPPORTED_BY_P1_P2],
		[["S1", "S2", "S3"], SUPPORTED_BY_S1_S3],
	])("lists children %j with natural punctuation", (names, pattern) => {
		const { container } = render(
			<ElementInspector
				element={summary("goal", { name: "G1", children: refs(...names) })}
			/>
		);
		expect(container.textContent).toMatch(pattern);
	});
});
