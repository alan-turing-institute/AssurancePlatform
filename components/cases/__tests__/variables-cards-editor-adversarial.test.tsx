import { act, configure, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import type React from "react";
import type { ComponentType } from "react";
import type { NodeProps } from "reactflow";
import { describe, expect, it, vi } from "vitest";
import { type DefinedTerm, termsInReach } from "@/lib/case/defined-terms";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { renderWithReactFlow, screen } from "@/src/__tests__/utils/test-utils";
import EvidenceNode from "../evidence-node";
import GoalNode from "../goal-node";
import PropertyNode from "../property-node";
import { documentToText, textToDocument } from "../reference-document";
import ReferenceTextEditor from "../reference-text-editor";
import StrategyNode from "../strategy-node";

// The dialogs, editors and cards are slow to settle on a busy machine.
configure({ asyncUtilTimeout: 10_000 });

/**
 * Cards of every kind that resolve references, and the editor that keeps
 * names: a variable's value is drawn on a card and never enters the editor or
 * the text it hands back.
 */

vi.mock("reactflow", () => {
	const ReactLib: typeof React = require("react");
	return {
		ReactFlowProvider: ({ children }: { children: React.ReactNode }) =>
			children,
		useNodes: () => [],
		useEdges: () => [],
		useReactFlow: () => ({
			fitView: vi.fn(),
			getNodes: vi.fn(() => []),
			getEdges: vi.fn(() => []),
		}),
		Handle: ({
			type,
			position,
			id,
		}: {
			id?: string;
			position: string;
			type: string;
		}) =>
			ReactLib.createElement("div", {
				"data-testid": `handle-${type}-${position}`,
				"data-id": id,
			}),
		Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
	};
});

const SYS = "aaaaaaaaaa";
const OTHER = "bbbbbbbbbb";
const WIN = "cccccccccc";
const IMG = "<img src=x onerror=alert(1)>";
const MARKUP_IN_CARD = "img, script, b, iframe, h1";
const NOT_SET = /not set/i;
const CAPITAL_ACME = /Acme/;

type Entry = Extract<ContextEntry, object>;
const variable = (value?: string, name = "system", id = SYS): Entry => ({
	id,
	name,
	text: "the system under test",
	...(value === undefined ? {} : { value }),
	variable: true,
});
const ordinary = (value?: string, name = "window", id = WIN): Entry => ({
	id,
	name,
	text: "the moving interval",
	...(value === undefined ? {} : { value }),
});
function reach(...entries: Entry[]): DefinedTerm[] {
	return termsInReach([{ id: "g1", name: "G1", context: entries }]);
}
const ref = (name: string, id: string) => `{${name}#${id}}`;

const NODES: [string, ComponentType<NodeProps>, string][] = [
	["goal", GoalNode, "goal"],
	["strategy", StrategyNode, "strategy"],
	["property claim", PropertyNode, "property"],
	["evidence", EvidenceNode, "evidence"],
];

function nodeProps(type: string, data: Record<string, unknown>): NodeProps {
	return {
		id: "node-1",
		data: { id: "el-1", name: "X1", description: "", ...data },
		type,
		selected: false,
		zIndex: 0,
		isConnectable: true,
		xPos: 0,
		yPos: 0,
		dragging: false,
	} as NodeProps;
}

function words(container: HTMLElement) {
	return Array.from(container.querySelectorAll("[data-reference-id]"));
}

describe.each(
	NODES
)("the %s card with a variable in its text", (_label, Node, type) => {
	const description = `Checked the ${ref("system", SYS)} twice`;

	it("shows the variable's value in place of its name", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable("AcmeBot")),
				})}
			/>
		);

		expect(container.textContent).toContain("Checked the AcmeBot twice");
		expect(container.textContent).not.toContain(SYS);
		expect(container.textContent).not.toContain("{system");
		expect(words(container)[0]?.hasAttribute("data-reference-unfilled")).toBe(
			false
		);
	});

	it("shows [name] in a dashed outline while the variable has no value", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable()),
				})}
			/>
		);

		expect(container.textContent).toContain("[system]");
		const [word] = words(container);
		expect(word?.hasAttribute("data-reference-unfilled")).toBe(true);
		expect(word?.className).toContain("border-dashed");
	});

	it("follows a change of value when the same card is given the new terms", () => {
		const { container, rerender } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable("AcmeBot")),
				})}
			/>
		);
		expect(container.textContent).toContain("Checked the AcmeBot twice");

		rerender(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable("BetaBot")),
				})}
			/>
		);

		expect(container.textContent).toContain("Checked the BetaBot twice");
		expect(container.textContent).not.toMatch(CAPITAL_ACME);

		rerender(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable("   ")),
				})}
			/>
		);
		expect(container.textContent).toContain("Checked the [system]");
	});

	it("draws a hostile value as text", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable(`${IMG} {other#${OTHER}}`)),
				})}
			/>
		);

		expect(container.querySelector(MARKUP_IN_CARD)).toBeNull();
		expect(container.textContent).toContain(`${IMG} {other#${OTHER}}`);
	});

	it("shows an ordinary term as its name and never its value", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description: `Within the ${ref("window", WIN)}`,
					termsInReach: reach(ordinary("5 minutes")),
				})}
			/>
		);

		expect(container.textContent).toContain("Within the window");
		expect(container.textContent).not.toContain("5 minutes");
		expect(container.querySelector("[data-reference-unfilled]")).toBeNull();
	});

	it("shows a variable the card cannot reach as its stored name in braces or as a missing definition, never as a value", () => {
		const { container } = renderWithReactFlow(
			<Node
				{...nodeProps(type, {
					description,
					termsInReach: reach(variable("AcmeBot", "elsewhere", OTHER)),
				})}
			/>
		);

		expect(container.textContent).not.toContain("AcmeBot");
		expect(container.textContent).not.toContain("[system]");
		expect(container.querySelector("[data-reference-unfilled]")).toBeNull();
	});
});

describe("the edit dialog's editor", () => {
	const unset = variable(undefined, "pending", OTHER);
	const terms = reach(variable(`AcmeBot ${IMG} {other#${OTHER}}`), unset);

	function renderEditor(
		props: Partial<React.ComponentProps<typeof ReferenceTextEditor>> = {}
	) {
		const onChange = vi.fn();
		const view = renderWithReactFlow(
			<>
				<span id="label">Description</span>
				<ReferenceTextEditor
					aria-labelledby="label"
					onChange={onChange}
					terms={terms}
					value=""
					{...props}
				/>
			</>
		);
		return { ...view, onChange };
	}

	function editorOf(box: HTMLElement): Editor {
		return (box as HTMLElement & { editor: Editor }).editor;
	}

	it("shows each variable by its name, never by its value or in brackets", async () => {
		renderEditor({
			value: `Checked the ${ref("system", SYS)} and ${ref("pending", OTHER)}`,
		});

		const box = await screen.findByRole("textbox", { name: "Description" });
		const chips = Array.from(box.querySelectorAll('span[data-type="mention"]'));
		expect(chips.map((chip) => chip.textContent)).toEqual([
			"system",
			"pending",
		]);
		expect(box.textContent).not.toContain("AcmeBot");
		expect(box.textContent).not.toContain("[");
		// The editor draws its own empty image to keep the caret in an empty line.
		expect(
			box.querySelector(
				"img:not(.ProseMirror-separator), script, b, iframe, h1"
			)
		).toBeNull();
	});

	it("shows the variable under its current name when the text stored an older one", async () => {
		renderEditor({ value: `Checked the ${ref("an old name", SYS)}` });

		const box = await screen.findByRole("textbox", { name: "Description" });
		expect(box.querySelector('span[data-type="mention"]')).toHaveTextContent(
			"system"
		);
	});

	it("hands back the stored text with the token and nothing else after an edit", async () => {
		const { onChange } = renderEditor({
			value: `Checked the ${ref("system", SYS)}`,
		});
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent(" again").run();
		});

		expect(onChange).toHaveBeenLastCalledWith(
			`Checked the ${ref("system", SYS)} again`
		);
		const everything = JSON.stringify(onChange.mock.calls);
		expect(everything).not.toContain("AcmeBot");
		expect(everything).not.toContain("[pending]");
	});

	it("hands back an unset variable's token, not its brackets", async () => {
		const { onChange } = renderEditor({
			value: `Waiting for ${ref("pending", OTHER)}`,
		});
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent(".").run();
		});

		expect(onChange).toHaveBeenLastCalledWith(
			`Waiting for ${ref("pending", OTHER)}.`
		);
	});

	it("writes the variable's new name into the text when it is renamed", async () => {
		const { onChange, rerender } = renderEditor({
			value: `Checked the ${ref("system", SYS)}`,
		});
		const box = await screen.findByRole("textbox", { name: "Description" });

		rerender(
			<>
				<span id="label">Description</span>
				<ReferenceTextEditor
					aria-labelledby="label"
					onChange={onChange}
					terms={reach(variable("AcmeBot", "machine"))}
					value={`Checked the ${ref("system", SYS)}`}
				/>
			</>
		);
		await waitFor(() =>
			expect(box.querySelector('span[data-type="mention"]')).toHaveTextContent(
				"machine"
			)
		);
		act(() => {
			editorOf(box).chain().focus("end").insertContent("!").run();
		});

		expect(onChange).toHaveBeenLastCalledWith(
			`Checked the ${ref("machine", SYS)}!`
		);
	});

	it("lists a variable with its value, or that it is not set, as text, when { is typed", async () => {
		renderEditor({ value: "see " });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{").run();
		});
		const list = await screen.findByRole("listbox", {
			name: "Terms you can insert",
		});
		const options = Array.from(list.querySelectorAll('[role="option"]'));
		expect(options).toHaveLength(2);
		expect(options[0]?.textContent).toContain(
			`variable: AcmeBot ${IMG} {other#${OTHER}}`
		);
		expect(options[1]?.textContent).toContain("variable, not set");
		expect(list.querySelector("img, script, b, iframe, h1")).toBeNull();
	});

	it("inserts the token of a variable picked from the list, never its value", async () => {
		const user = userEvent.setup();
		const { onChange } = renderEditor({ value: "see " });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{").run();
		});
		const list = await screen.findByRole("listbox", {
			name: "Terms you can insert",
		});
		const option = Array.from(list.querySelectorAll('[role="option"]')).find(
			(candidate) => candidate.textContent?.includes("system")
		);
		await user.click(option as Element);

		await waitFor(() =>
			expect(onChange).toHaveBeenLastCalledWith(
				expect.stringContaining(ref("system", SYS))
			)
		);
		const last = onChange.mock.calls.at(-1)?.[0] as string;
		expect(last).not.toContain("AcmeBot");
		expect(last).not.toContain("[system]");
		expect(last).not.toContain(IMG);
	});

	it("shows an ordinary term in the list with its value as before", async () => {
		renderEditor({ terms: reach(ordinary("5 minutes")), value: "see " });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{").run();
		});
		const list = await screen.findByRole("listbox", {
			name: "Terms you can insert",
		});
		expect(list.textContent).toContain("Value: 5 minutes");
		expect(list.textContent).not.toMatch(NOT_SET);
		expect(list.textContent).not.toContain("variable");
	});
});

describe("the text conversion of the editor", () => {
	const terms = reach(variable(`AcmeBot ${IMG} {other#${OTHER}}`));

	it("writes a variable as a word carrying its name, with no value in the document", () => {
		const document = textToDocument(`A ${ref("system", SYS)} here`, terms);

		expect(document.content[0]?.content?.[1]).toEqual({
			type: "mention",
			attrs: { id: SYS, label: "system", mentionSuggestionChar: "{" },
		});
		expect(JSON.stringify(document)).not.toContain("AcmeBot");
		expect(JSON.stringify(document)).not.toContain(IMG);
	});

	it("gives back the stored text exactly, whatever the variable's value", () => {
		for (const text of [
			`A ${ref("system", SYS)} here`,
			`${ref("system", SYS)}`,
			`line one ${ref("system", SYS)}\nline two ${ref("system", SYS)}${ref("system", SYS)}`,
			`${ref("a stale name", SYS)} with <b>markup</b> and {braces}`,
		]) {
			const back = documentToText(textToDocument(text, terms), terms);
			expect(back).toBe(text.replace("a stale name", "system"));
		}
	});

	it("keeps an unset variable's token, not its brackets, through the round trip", () => {
		const unsetTerms = reach(variable(undefined));
		const text = `Waiting for ${ref("system", SYS)}`;
		expect(documentToText(textToDocument(text, unsetTerms), unsetTerms)).toBe(
			text
		);
		expect(JSON.stringify(textToDocument(text, unsetTerms))).not.toContain(
			"[system]"
		);
	});
});
