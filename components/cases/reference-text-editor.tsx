"use client";

/**
 * The editor for an element's description: plain paragraphs and references to
 * defined terms, nothing else. Typing `{` lists the terms the element can
 * refer to and picking one inserts a highlighted word.
 *
 * It behaves as a form field. The text it hands back is the same plain string
 * a text box would give, with each reference written `{name#id}`, and the
 * labelling and error attributes the form supplies are put on the editable
 * region itself. It is loaded on demand by the edit dialog, so the editor
 * library stays out of the case page's first load.
 */

import { Mention, type MentionOptions } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import {
	type Editor,
	EditorContent,
	Extension,
	useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { exitSuggestion, SuggestionPluginKey } from "@tiptap/suggestion";
import {
	forwardRef,
	type MutableRefObject,
	useEffect,
	useId,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { buildReferenceClasses } from "@/components/shared/nodes/node-styles";
import {
	type ReferenceListState,
	useReferenceSuggestion,
} from "@/hooks/use-reference-suggestion";
import { type DefinedTerm, formatReference } from "@/lib/case/defined-terms";
import { cn } from "@/lib/utils";
import { documentToText, textToDocument } from "./reference-document";
import ReferenceSuggestionList, {
	referenceOptionId,
} from "./reference-suggestion-list";

export interface ReferenceTextEditorHandle {
	focus: () => void;
}

export interface ReferenceTextEditorProps {
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	/** The id of the label that names the editable region. */
	"aria-labelledby"?: string;
	/** Puts the caret in the text when the editor first appears, unless focus has already gone elsewhere. */
	autoFocus?: boolean;
	id?: string;
	onBlur?: () => void;
	onChange: (text: string) => void;
	placeholder?: string;
	readOnly?: boolean;
	/** What a reference typed here can point at: the form's own entries first, then those above. */
	terms: readonly DefinedTerm[];
	/** The stored text. */
	value: string;
}

const EDITOR_CLASSES = cn(
	"min-h-20 w-full whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
	"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
	"[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-(--reference-placeholder)"
);

/** Shift+Enter starts a new line, as Enter does; the text has no soft breaks. */
const NewLineOnShiftEnter = Extension.create({
	name: "newLineOnShiftEnter",
	addKeyboardShortcuts() {
		return { "Shift-Enter": () => this.editor.commands.splitBlock() };
	},
});

/** The editor starts from the starter kit with every kind of formatting off. */
const PLAIN_TEXT_ONLY = {
	blockquote: false,
	bold: false,
	bulletList: false,
	code: false,
	codeBlock: false,
	dropcursor: false,
	gapcursor: false,
	hardBreak: false,
	heading: false,
	horizontalRule: false,
	italic: false,
	link: false,
	listItem: false,
	listKeymap: false,
	orderedList: false,
	strike: false,
	trailingNode: false,
	underline: false,
} as const;

type SuggestionOptions = MentionOptions["suggestion"];

export function buildExtensions(
	suggestion: SuggestionOptions,
	placeholder: string
) {
	return [
		StarterKit.configure(PLAIN_TEXT_ONLY),
		Placeholder.configure({ placeholder }),
		NewLineOnShiftEnter,
		Mention.configure({
			HTMLAttributes: { class: buildReferenceClasses(true) },
			// Backspace after a reference removes it whole.
			deleteTriggerWithBackspace: true,
			renderText: ({ node }) =>
				formatReference(String(node.attrs.label ?? ""), String(node.attrs.id)),
			renderHTML: ({ node, options }) =>
				[
					"span",
					options.HTMLAttributes,
					String(node.attrs.label ?? ""),
				] as const,
			suggestion,
		}),
	];
}

interface AttributeInput {
	activeOptionId?: string;
	describedBy?: string;
	id?: string;
	invalid?: boolean;
	labelledBy?: string;
	listId?: string;
	placeholder: string;
	readOnly: boolean;
}

/** What goes on the editable region so it reads as a labelled, multi-line text field. */
function buildEditorAttributes(input: AttributeInput): Record<string, string> {
	const attributes: Record<string, string> = {
		role: "textbox",
		"aria-multiline": "true",
		"aria-autocomplete": "list",
		"aria-placeholder": input.placeholder,
		class: EDITOR_CLASSES,
		// The placeholder is drawn from this variable by the class above.
		style: `--reference-placeholder: ${JSON.stringify(input.placeholder)}`,
	};
	const optional: Record<string, string | undefined> = {
		id: input.id,
		"aria-labelledby": input.labelledBy,
		"aria-describedby": input.describedBy,
		"aria-invalid": input.invalid ? "true" : undefined,
		"aria-controls": input.listId,
		"aria-activedescendant": input.activeOptionId,
		// A read-only region has to stay reachable from the keyboard.
		"aria-readonly": input.readOnly ? "true" : undefined,
		tabindex: input.readOnly ? "0" : undefined,
	};
	for (const [name, value] of Object.entries(optional)) {
		if (value !== undefined) {
			attributes[name] = value;
		}
	}
	return attributes;
}

function focusIsFree(): boolean {
	const active = document.activeElement;
	return (
		!active ||
		active === document.body ||
		active.getAttribute("role") === "dialog"
	);
}

function openList(
	list: ReferenceListState | null,
	visible: boolean
): ReferenceListState | null {
	return visible && list ? list : null;
}

/**
 * The form can replace the text under the editor (when the dialog is reloaded
 * for the element). Only a value the editor did not just send itself is
 * loaded, and it is kept out of the undo history.
 */
function useLoadReplacedText(
	editor: Editor | null,
	value: string,
	lastTextRef: MutableRefObject<string>
) {
	useEffect(() => {
		if (!editor || editor.isDestroyed || value === lastTextRef.current) {
			return;
		}
		lastTextRef.current = value;
		editor
			.chain()
			.setMeta("addToHistory", false)
			.setContent(textToDocument(value), { emitUpdate: false })
			.run();
	}, [editor, value, lastTextRef]);
}

/** Keeps the attributes on the editable region in step with the form's state. */
function useEditorAttributes(
	editor: Editor | null,
	attributes: Record<string, string>
) {
	const serialised = JSON.stringify(attributes);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `attributes` is rebuilt every render; its serialised form says when it changed
	useEffect(() => {
		if (editor && !editor.isDestroyed) {
			editor.setOptions({ editorProps: { attributes } });
		}
	}, [editor, serialised]);
}

/** Read-only state, and the caret when the dialog opens with the editor first. */
function useEditorMode(
	editor: Editor | null,
	readOnly: boolean,
	autoFocus: boolean
) {
	useEffect(() => {
		if (editor && !editor.isDestroyed && editor.isEditable === readOnly) {
			// Switching editability is not a change to the text, so no update is sent.
			editor.setEditable(!readOnly, false);
		}
	}, [editor, readOnly]);

	useEffect(() => {
		if (autoFocus && editor && !readOnly && focusIsFree()) {
			editor.commands.focus("end");
		}
	}, [autoFocus, editor, readOnly]);
}

const ReferenceTextEditor = forwardRef<
	ReferenceTextEditorHandle,
	ReferenceTextEditorProps
>(function ReferenceTextEditor(
	{
		"aria-describedby": describedBy,
		"aria-invalid": invalid,
		"aria-labelledby": labelledBy,
		autoFocus = false,
		id,
		onBlur,
		onChange,
		placeholder = "",
		readOnly = false,
		terms,
		value,
	},
	ref
) {
	const listId = useId();
	const { suggestion, list, activeIndex, setActiveIndex, visible } =
		useReferenceSuggestion(terms);
	const shownList = openList(list, visible);

	const lastTextRef = useRef(value);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const onBlurRef = useRef(onBlur);
	onBlurRef.current = onBlur;

	const [initialContent] = useState(() => textToDocument(value));
	const extensions = useMemo(
		() => buildExtensions(suggestion, placeholder),
		[suggestion, placeholder]
	);
	const attributes = buildEditorAttributes({
		id,
		labelledBy,
		describedBy,
		invalid,
		placeholder,
		readOnly,
		listId: shownList?.items.length ? listId : undefined,
		activeOptionId: shownList?.items.length
			? referenceOptionId(listId, activeIndex)
			: undefined,
	});

	const editor = useEditor({
		extensions,
		content: initialContent,
		editable: !readOnly,
		immediatelyRender: true,
		shouldRerenderOnTransaction: false,
		editorProps: { attributes },
		onUpdate: ({ editor: current }) => {
			const text = documentToText(current.getJSON());
			lastTextRef.current = text;
			onChangeRef.current(text);
		},
		onBlur: () => onBlurRef.current?.(),
	});

	useImperativeHandle(
		ref,
		() => ({ focus: () => editor?.commands.focus("end") }),
		[editor]
	);

	useLoadReplacedText(editor, value, lastTextRef);
	useEditorAttributes(editor, attributes);
	useEditorMode(editor, readOnly, autoFocus);

	const closeList = () => {
		if (editor && !editor.isDestroyed) {
			exitSuggestion(editor.view, SuggestionPluginKey);
		}
	};

	return (
		<>
			<EditorContent editor={editor} />
			{shownList && (
				<ReferenceSuggestionList
					activeIndex={activeIndex}
					hasTerms={terms.length > 0}
					list={shownList}
					listId={listId}
					onClose={closeList}
					onHover={setActiveIndex}
				/>
			)}
		</>
	);
});

export default ReferenceTextEditor;
