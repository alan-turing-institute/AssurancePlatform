import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { renderWithReactFlow } from "@/src/__tests__/utils/test-utils";
import BaseNode from "../base-node";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

const TERMS: DefinedTerm[] = [
	{
		id: ID_A,
		name: "window",
		text: "the moving interval",
		value: "5 minutes",
		definedOn: { elementId: "g1", elementName: "G1" },
	},
];

const SHORT = `Inside the {old#${ID_A}} and the {gone#${ID_B}}.`;

function words(container: HTMLElement) {
	return Array.from(container.querySelectorAll("[data-reference-id]"));
}

describe("a collapsed card with references", () => {
	it("shows each reference as a highlighted word and adds no tooltip when the text is not cut short", async () => {
		const user = userEvent.setup();
		const { container } = renderWithReactFlow(
			<BaseNode
				description={SHORT}
				name="P1"
				nodeType="property"
				terms={TERMS}
			/>
		);
		expect(
			words(container).map((word) => word.getAttribute("data-reference-state"))
		).toEqual(["found", "not-found"]);
		await user.hover(words(container)[0] as Element);
		expect(document.body.textContent).not.toContain("the moving interval");
		expect(container.textContent).not.toContain(ID_A);
	});

	it("counts the words people see, not the stored characters, when it decides to cut the text", async () => {
		const user = userEvent.setup();
		// 170 visible characters + "window": 176 visible, but 186 as stored.
		const description = `${"a".repeat(170)}{old#${ID_A}}`;
		expect(description.length).toBeGreaterThan(180);
		const { container } = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P1"
				nodeType="property"
				terms={TERMS}
			/>
		);
		expect(container.textContent).not.toContain("...");
		expect(words(container)).toHaveLength(1);
		// Nothing is left out, so there is no tooltip repeating the text.
		await user.hover(container.querySelector("p") as Element);
		expect(document.querySelector('[role="tooltip"]')).toBeNull();
	});

	it("gives a visible reference no tooltip of its own on a card whose text is cut short", async () => {
		const user = userEvent.setup();
		const description = `See the {old#${ID_A}} first. ${"c".repeat(200)}`;
		const { container } = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P1"
				nodeType="property"
				terms={TERMS}
			/>
		);
		expect(container.textContent).toContain("...");
		expect(words(container)).toHaveLength(1);
		await user.hover(words(container)[0] as Element);
		// The one tooltip is the whole text in plain form; the term's meaning is not shown.
		expect(document.body.textContent).toContain("See the {window} first.");
		expect(document.body.textContent).not.toContain("the moving interval");
		expect(document.body.textContent).not.toContain("Value: 5 minutes");
	});

	it("cuts long text before a reference rather than through it, with the full text in plain form in its tooltip", async () => {
		const user = userEvent.setup();
		const description = `${"b".repeat(176)} {old#${ID_A}} and then more words after it`;
		const { container } = renderWithReactFlow(
			<BaseNode
				description={description}
				name="P1"
				nodeType="property"
				terms={TERMS}
			/>
		);
		expect(container.textContent).toContain("...");
		expect(container.textContent).not.toContain("{");
		expect(container.textContent).not.toContain("#");
		await user.hover(container.querySelector("p") as Element);
		expect(document.body.textContent).toContain(
			`${"b".repeat(176)} {window} and then more words after it`
		);
		expect(document.body.textContent).not.toContain(ID_A);
		expect(document.body.textContent).not.toContain("the moving interval");
	});
});

describe("an expanded card with references", () => {
	it("gives each reference its own tooltip, and writes the text it holds in the sections as plain words", async () => {
		const user = userEvent.setup();
		const { container } = renderWithReactFlow(
			<BaseNode
				assumption={`Assumes {old#${ID_A}}`}
				context={[
					"plain entry",
					{
						id: ID_A,
						name: "window",
						text: "the moving interval",
						value: "5 minutes",
					},
				]}
				description={SHORT}
				initialExpanded
				justification={`Because {gone#${ID_B}}`}
				name="P1"
				nodeType="property"
				terms={TERMS}
			/>
		);
		await user.hover(words(container)[0] as Element);
		expect(document.body.textContent).toContain("the moving interval");
		expect(document.body.textContent).toContain("Value: 5 minutes");
		expect(document.body.textContent).toContain("Defined on G1");
		// The sections beneath the description read as words, not tokens.
		expect(container.textContent).toContain(
			"window — the moving interval (5 minutes)"
		);
		expect(container.textContent).toContain("Assumes {window}");
		expect(container.textContent).toContain("Because {gone}");
		expect(container.textContent).not.toContain(ID_A);
		expect(container.textContent).not.toContain(ID_B);
	});
});
