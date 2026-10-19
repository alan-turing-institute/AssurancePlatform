import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import {
	render,
	renderWithReactFlow,
	screen,
} from "@/src/__tests__/utils/test-utils";
import BaseNode from "../base-node";
import ReferenceText from "../reference-text";

const WINDOW: DefinedTerm = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the moving interval over which separation is measured",
	value: "5 minutes",
	definedOn: { elementId: "g1", elementName: "G1" },
};

const TEXT = "Separation holds in each {window#k3f9x2m7qa} of use";

const CARD_START = /Separation holds across/;
const PLAIN_TAIL =
	/It is measured over each \{window\} of use and reported again for each \{window\} of review\./;
const NAMED_CONTEXT_LINE = /window — the moving interval \(5 minutes\)/;
const PLAIN_CONTEXT_LINE = /Operating in the UK/;

describe("ReferenceText", () => {
	it("draws a reference as a highlighted word using the entry's current name", () => {
		render(
			<ReferenceText terms={[WINDOW]} text="a {old name#k3f9x2m7qa} b" />,
			{ withProviders: false }
		);

		const word = screen.getByText("window");
		expect(word).toHaveAttribute("data-reference-state", "found");
		expect(word).not.toHaveAttribute("tabindex");
	});

	it("shows the tooltip's meaning, value and origin when a reference is hovered", async () => {
		const user = userEvent.setup();
		render(<ReferenceText terms={[WINDOW]} text={TEXT} withTooltips />, {
			withProviders: false,
		});

		await user.hover(screen.getByText("window"));

		expect(await screen.findByText(WINDOW.text)).toBeInTheDocument();
		expect(screen.getByText("Value: 5 minutes")).toBeInTheDocument();
		expect(screen.getByText("Defined on G1")).toBeInTheDocument();
	});

	it("marks a reference with no definition in reach, for sighted and screen-reader users", async () => {
		const user = userEvent.setup();
		render(<ReferenceText terms={[]} text={TEXT} withTooltips />, {
			withProviders: false,
		});

		const word = screen.getByText("window", { exact: false });
		expect(word).toHaveAttribute("data-reference-state", "not-found");
		expect(screen.getByText("(definition not found)")).toHaveClass("sr-only");

		await user.hover(word);
		expect(
			await screen.findByText("No definition of 'window' above this element")
		).toBeInTheDocument();
	});

	it("gives a reference no tooltip of its own unless asked", async () => {
		const user = userEvent.setup();
		render(<ReferenceText terms={[WINDOW]} text={TEXT} />, {
			withProviders: false,
		});

		await user.hover(screen.getByText("window"));

		expect(screen.queryByText(WINDOW.text)).not.toBeInTheDocument();
	});

	it("keeps text without a reference as the single piece of text it was", () => {
		const { container } = render(<ReferenceText text="plain words" />, {
			withProviders: false,
		});

		expect(container).toHaveTextContent("plain words");
		expect(container.querySelector("span")).toBeNull();
	});
});

describe("BaseNode — defined terms", () => {
	const LONG = `${"Separation holds across every subgroup the evaluation covers. ".repeat(
		3
	)}It is measured over each {window#k3f9x2m7qa} of use and reported again for each {window#k3f9x2m7qa} of review.`;

	it("highlights a reference on a collapsed card and gives it no tooltip when the text is short", async () => {
		const user = userEvent.setup();
		renderWithReactFlow(
			<BaseNode
				description={TEXT}
				name="P1"
				nodeType="property"
				terms={[WINDOW]}
			/>
		);

		const word = screen.getByText("window");
		expect(word).toHaveAttribute("data-reference-state", "found");
		await user.hover(word);
		expect(screen.queryByText(WINDOW.text)).not.toBeInTheDocument();
	});

	it("shows one tooltip on a cut-short collapsed card, in plain text with {name}", async () => {
		const user = userEvent.setup();
		renderWithReactFlow(
			<BaseNode
				description={LONG}
				name="P1"
				nodeType="property"
				terms={[WINDOW]}
			/>
		);

		await user.hover(screen.getByText(CARD_START));

		const plain = await screen.findByText(PLAIN_TAIL);
		expect(plain.textContent).not.toContain("#");
		expect(screen.queryByText(WINDOW.text)).not.toBeInTheDocument();
	});

	it("never cuts through a reference when the text is cut short", () => {
		const text = `${"x".repeat(176)} {window#k3f9x2m7qa} y`;
		const { container } = renderWithReactFlow(
			<BaseNode
				description={text}
				name="P1"
				nodeType="property"
				terms={[WINDOW]}
			/>
		);

		// 176 characters leave room for "xxxx" but not for the six-letter word.
		expect(container).not.toHaveTextContent("{window");
		expect(container).not.toHaveTextContent("#k3f9");
		expect(container.querySelector("[data-reference-id]")).toBeNull();
		expect(container).toHaveTextContent(`${"x".repeat(176)}...`);
	});

	it("does not treat text of exactly the limit as cut short", () => {
		const { container } = renderWithReactFlow(
			<BaseNode description={"y".repeat(180)} name="P1" nodeType="property" />
		);

		expect(container).toHaveTextContent("y".repeat(180));
		expect(container).not.toHaveTextContent("...");
	});

	it("gives each reference a tooltip once the card is expanded", async () => {
		const user = userEvent.setup();
		renderWithReactFlow(
			<BaseNode
				description={TEXT}
				initialExpanded
				name="P1"
				nodeType="property"
				terms={[WINDOW]}
			/>
		);

		await user.hover(screen.getByText("window"));

		expect(await screen.findByText(WINDOW.text)).toBeInTheDocument();
		expect(screen.getByText("Defined on G1")).toBeInTheDocument();
	});

	it("reads a named entry in the expanded context section as name, meaning and value", () => {
		renderWithReactFlow(
			<BaseNode
				context={[
					{
						id: WINDOW.id,
						name: WINDOW.name,
						text: "the moving interval",
						value: "5 minutes",
					},
					"Operating in the UK",
				]}
				description="A goal"
				initialExpanded
				name="G1"
				nodeType="goal"
			/>
		);

		expect(screen.getByText(NAMED_CONTEXT_LINE)).toBeInTheDocument();
		expect(screen.getByText(PLAIN_CONTEXT_LINE)).toBeInTheDocument();
	});
});
