import { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";
import { documentToText, textToDocument } from "../reference-document";
import { buildExtensions } from "../reference-text-editor";

const ID_A = "aaaaaaaaaa";
const ID_B = "bbbbbbbbbb";

const AWKWARD_TEXTS = [
	"",
	" ",
	"\n",
	"\n\n\n",
	"first\n\nthird after a blank line",
	"  leading and trailing  ",
	"trailing space \nnext line",
	"a\t\ttab and non-breaking space",
	"two  spaces   and    four",
	"<b>bold</b> &amp; &lt;tag&gt; &nbsp; <script>alert(1)</script>",
	"<p>paragraph</p><br><img src=x onerror=alert(1)>",
	"{like this}",
	"{",
	"}",
	"{{",
	"}}",
	"{#}",
	"{name#}",
	"{name#short}",
	`{name#${ID_A}0}`,
	`{{${"x"}#${ID_A}}}`,
	`{window#${ID_A}}`,
	`x{window#${ID_A}}y\nz{other#${ID_B}}`,
	`{window#${ID_A}}{other#${ID_B}}`,
	`{window#${ID_A}}\n{window#${ID_A}}`,
	`{two words-and_more#${ID_A}}`,
	"emoji \u{1F642} and a family \u{1F469}‍\u{1F469}‍\u{1F467}",
	"decomposed é and right-to-left مرحبا",
	"\\n is not a newline, and neither is \\u0041",
	// biome-ignore lint/suspicious/noTemplateCurlyInString: the text under test holds a literal dollar-brace
	"${template} %s %d `code` **not bold** # not a heading - not a list 1. nor numbered",
	"> quote\n- item\n1. first\n---\n```fence```",
	"line one\r\nline two with a carriage return",
	"ends with a hash #",
	"https://example.org/path?a=1&b=2#fragment",
] as const;

describe("the editor's document and the stored text", () => {
	it.each(
		AWKWARD_TEXTS
	)("round-trips %j through the document helpers", (text) => {
		expect(documentToText(textToDocument(text))).toBe(text);
	});

	it("writes one paragraph per line and one word per reference", () => {
		const document = textToDocument(`a {w#${ID_A}} b\n\nc`);
		expect(document.content).toHaveLength(3);
		expect(document.content[0]?.content?.map((node) => node.type)).toEqual([
			"text",
			"mention",
			"text",
		]);
		expect(document.content[1]).toEqual({ type: "paragraph" });
	});

	it("keeps the name a reference was stored with, whatever the entry is called now", () => {
		const document = textToDocument(`{stored#${ID_A}}`);
		expect(document.content[0]?.content?.[0]).toMatchObject({
			type: "mention",
			attrs: { id: ID_A, label: "stored" },
		});
	});
});

describe("the same text through the real editor", () => {
	let editor: Editor | null = null;

	afterEach(() => {
		editor?.destroy();
		editor = null;
	});

	function open(text: string) {
		editor = new Editor({
			extensions: buildExtensions(
				{ char: "{", items: () => [], render: () => ({}) },
				""
			),
			content: textToDocument(text),
		});
		return editor;
	}

	it.each(AWKWARD_TEXTS)("opens and saves %j unchanged", (text) => {
		const opened = open(text);
		expect(documentToText(opened.getJSON())).toBe(text);
	});

	it("reports a reference as the stored token after the text around it is edited", () => {
		const opened = open(`before {w#${ID_A}} after`);
		opened.commands.insertContentAt(1, "X");
		expect(documentToText(opened.getJSON())).toBe(`Xbefore {w#${ID_A}} after`);
	});
});
