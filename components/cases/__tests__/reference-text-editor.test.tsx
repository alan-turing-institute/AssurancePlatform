import { act, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DefinedTerm } from "@/lib/case/defined-terms";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import ReferenceTextEditor, {
	type ReferenceTextEditorHandle,
} from "../reference-text-editor";

const WINDOW: DefinedTerm = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the moving interval",
	value: "5 minutes",
	definedOn: { elementId: "g1", elementName: "G1" },
};
const RATE: DefinedTerm = {
	id: "a1b2c3d4e5",
	name: "rate",
	text: "events per second",
	definedOn: { elementId: "s1", elementName: "S1" },
};

const NOTHING_TO_INSERT = /No terms to insert yet/;
const NO_MATCH = /No matching terms/;

/** The editor instance Tiptap hangs on its editable element. */
function editorOf(box: HTMLElement): Editor {
	return (box as HTMLElement & { editor: Editor }).editor;
}

function renderEditor(
	props: Partial<React.ComponentProps<typeof ReferenceTextEditor>> = {}
) {
	const onChange = vi.fn();
	const view = render(
		<>
			<span id="label">Description</span>
			<ReferenceTextEditor
				aria-labelledby="label"
				onChange={onChange}
				terms={[WINDOW, RATE]}
				value=""
				{...props}
			/>
		</>,
		{ withProviders: false }
	);
	return { ...view, onChange };
}

describe("ReferenceTextEditor", () => {
	it("is a labelled multi-line text field carrying the form's attributes", async () => {
		renderEditor({
			"aria-describedby": "hint error",
			"aria-invalid": true,
			id: "field",
		});

		const box = await screen.findByRole("textbox", { name: "Description" });
		expect(box).toHaveAttribute("aria-multiline", "true");
		expect(box).toHaveAttribute("aria-describedby", "hint error");
		expect(box).toHaveAttribute("aria-invalid", "true");
		expect(box).toHaveAttribute("id", "field");
	});

	it("starts from the stored text, showing each reference as a word with the name stored in it", async () => {
		renderEditor({
			value: "first line\nuse {window#k3f9x2m7qa} here",
		});

		const box = await screen.findByRole("textbox", { name: "Description" });
		expect(box.querySelectorAll("p")).toHaveLength(2);
		const word = box.querySelector('span[data-type="mention"]');
		expect(word).toHaveTextContent("window");
		expect(word).toHaveAttribute("data-id", "k3f9x2m7qa");
	});

	it("hands back the same plain string a text box would, with references written {name#id}", async () => {
		const { onChange } = renderEditor({ value: "use " });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box)
				.chain()
				.focus("end")
				.insertContent([
					{
						type: "mention",
						attrs: { id: "k3f9x2m7qa", label: "window" },
					},
					{ type: "text", text: " ok" },
				])
				.run();
		});

		expect(onChange).toHaveBeenLastCalledWith("use {window#k3f9x2m7qa} ok");
	});

	it("loads text the form puts there, without reporting it as an edit", async () => {
		const { onChange, rerender } = renderEditor({ value: "before" });
		const box = await screen.findByRole("textbox", { name: "Description" });

		rerender(
			<>
				<span id="label">Description</span>
				<ReferenceTextEditor
					aria-labelledby="label"
					onChange={onChange}
					terms={[]}
					value="after the reset"
				/>
			</>
		);

		await waitFor(() => expect(box).toHaveTextContent("after the reset"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("is not editable but stays reachable from the keyboard when read only", async () => {
		const { onChange } = renderEditor({ readOnly: true, value: "fixed" });

		const box = await screen.findByRole("textbox", { name: "Description" });
		expect(box).toHaveAttribute("contenteditable", "false");
		expect(box).toHaveAttribute("aria-readonly", "true");
		expect(box).toHaveAttribute("tabindex", "0");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("gives the form a handle that puts the caret in the text", async () => {
		const handle = createRef<ReferenceTextEditorHandle>();
		render(
			<ReferenceTextEditor
				onChange={vi.fn()}
				ref={handle}
				terms={[]}
				value="x"
			/>,
			{ withProviders: false }
		);
		const box = await screen.findByRole("textbox");

		act(() => handle.current?.focus());

		await waitFor(() => expect(box).toHaveFocus());
	});

	it("lists the terms in reach, nearest first and labelled with their element, when { is typed", async () => {
		renderEditor({ value: "see " });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{").run();
		});
		const list = await screen.findByRole("listbox", {
			name: "Terms you can insert",
		});
		const options = () =>
			Array.from(list.querySelectorAll('[role="option"]')).map(
				(option) => option.textContent
			);
		expect(options()).toHaveLength(2);
		expect(options()[0]).toContain("window");
		expect(options()[0]).toContain("G1");
		expect(options()[1]).toContain("rate");
	});

	it("tells the author there is nothing to insert when no term is in reach", async () => {
		renderEditor({ terms: [], value: "" });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{").run();
		});

		expect(await screen.findByText(NOTHING_TO_INSERT)).toBeInTheDocument();
	});

	it("keeps the list open with a note while what was typed matches no term", async () => {
		renderEditor({ value: "" });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{zzz").run();
		});

		expect(await screen.findByText(NO_MATCH)).toBeInTheDocument();
		expect(screen.queryByRole("option")).not.toBeInTheDocument();
	});

	it("closes the list when a closing brace is typed, because the braces are then plain text", async () => {
		renderEditor({ value: "" });
		const box = await screen.findByRole("textbox", { name: "Description" });

		act(() => {
			editorOf(box).chain().focus("end").insertContent("{like").run();
		});
		expect(await screen.findByText(NO_MATCH)).toBeInTheDocument();

		act(() => {
			editorOf(box).chain().focus("end").insertContent(" this} and more").run();
		});

		await waitFor(() =>
			expect(screen.queryByText(NO_MATCH)).not.toBeInTheDocument()
		);
		expect(box).toHaveTextContent("{like this} and more");
	});
});
