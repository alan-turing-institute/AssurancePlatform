import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Editor } from "@tiptap/react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	documentToText,
	type ReferenceDocumentJson,
	textToDocument,
} from "../reference-document";
import { buildExtensions } from "../reference-text-editor";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

function jsonFilesUnder(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) {
			return jsonFilesUnder(path);
		}
		return path.endsWith(".json") ? [path] : [];
	});
}

function descriptionsIn(value: unknown, found: string[] = []): string[] {
	if (Array.isArray(value)) {
		for (const item of value) {
			descriptionsIn(item, found);
		}
	} else if (value && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			if (key === "description" && typeof child === "string") {
				found.push(child);
			} else {
				descriptionsIn(child, found);
			}
		}
	}
	return found;
}

const LITERAL_DESCRIPTION = /description:\s*(["'`])((?:\\.|(?!\1).)*)\1/g;

function literalDescriptionsIn(path: string): string[] {
	const source = readFileSync(join(REPO_ROOT, path), "utf8");
	return Array.from(
		source.matchAll(LITERAL_DESCRIPTION),
		(match) => match[2] ?? ""
	);
}

/** Every description in the example cases that ship with the app. */
const BUNDLED = jsonFilesUnder(join(REPO_ROOT, "public", "data")).flatMap(
	(path) => descriptionsIn(JSON.parse(readFileSync(path, "utf8")))
);

/** Every description written as a string in the development seed and the demo case. */
const SEEDED = [
	"prisma/seed/dev-seed.ts",
	"lib/services/demo-case-service.ts",
].flatMap(literalDescriptionsIn);

const AWKWARD = [
	"",
	" ",
	"a  b   c",
	"  leading and trailing  ",
	"line one\nline two",
	"line one\n\n\nline four",
	"\nstarts and ends with a break\n",
	"a < b && c > d",
	"fish &amp; chips &lt;b&gt;",
	"quotes \"double\" and 'single'",
	"{like this} and {also#this}",
	"{window#short}",
	"{window#k3f9x2m7qa}",
	"before {window#k3f9x2m7qa} after",
	"{window#k3f9x2m7qa}{rate#a1b2c3d4e5}",
	"first line\n{window#k3f9x2m7qa} opens the second",
	"{ spaced name #k3f9x2m7qa}",
	"unicode: naïve café — 日本語 🙂",
	"tab\there",
	"carriage\r\nreturn",
];

describe("textToDocument and documentToText", () => {
	let editor: Editor;

	beforeAll(() => {
		editor = new Editor({
			extensions: buildExtensions({ char: "{" }, ""),
			content: textToDocument(""),
		});
	});

	afterAll(() => {
		editor.destroy();
	});

	/** The text after it has been through the editor's own document, not only the JSON. */
	function throughEditor(text: string): string {
		editor.commands.setContent(textToDocument(text), { emitUpdate: false });
		return documentToText(editor.getJSON());
	}

	it("found descriptions to try", () => {
		expect(BUNDLED.length).toBeGreaterThan(50);
		expect(SEEDED.length).toBeGreaterThan(20);
	});

	it.each(BUNDLED)("returns the bundled description unchanged: %s", (text) => {
		expect(throughEditor(text)).toBe(text);
	});

	it.each(SEEDED)("returns the seeded description unchanged: %s", (text) => {
		expect(throughEditor(text)).toBe(text);
	});

	it.each(AWKWARD)("returns %j unchanged", (text) => {
		expect(throughEditor(text)).toBe(text);
	});

	it("makes one paragraph per line", () => {
		const document = textToDocument("one\n\nthree");
		expect(
			document.content.map((paragraph) => paragraph.content ?? [])
		).toEqual([
			[{ type: "text", text: "one" }],
			[],
			[{ type: "text", text: "three" }],
		]);
	});

	it("makes a reference word of each reference and leaves other braces as text", () => {
		const document: ReferenceDocumentJson = textToDocument(
			"see {window#k3f9x2m7qa} not {window}"
		);
		expect(document.content[0]?.content).toEqual([
			{ type: "text", text: "see " },
			{
				type: "mention",
				attrs: {
					id: "k3f9x2m7qa",
					label: "window",
					mentionSuggestionChar: "{",
				},
			},
			{ type: "text", text: " not {window}" },
		]);
	});

	it("keeps the name stored in a reference, so an untouched text is not rewritten", () => {
		expect(throughEditor("a {Old name#k3f9x2m7qa} b")).toBe(
			"a {Old name#k3f9x2m7qa} b"
		);
	});
});
