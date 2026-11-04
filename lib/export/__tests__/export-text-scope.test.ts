import { inflateSync } from "node:zlib";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import type { PlainCase, PlainTreeNode } from "@/lib/case/defined-terms";
import {
	exportMarkdown,
	inlineLinkCount,
	linkTargets,
	readAs,
	splitFrontMatter,
	unescapedPositions,
} from "@/src/__tests__/utils/markdown-plain-text-kit";
import { PDFExporter } from "../exporters/pdf-exporter";
import { WordExporter } from "../exporters/word-exporter";
import {
	createTemplateFromPreset,
	getAvailablePresets,
} from "../templates/index";
import type { ContentBlock, RenderedDocument } from "../types";

const GOAL_TEXT = "Goal text with [a link](b) and <b>tags</b> & an ampersand";
const CASE_TEXT = "Case text with [a link](b) and <i>tags</i> & more";
const EVIDENCE_TEXT = "see {defined-term} and a well-known - item";
const COMMENT_TEXT = "Comment with [a link](b) and <u>tags</u> & more";
const RAW_TEXTS = [GOAL_TEXT, CASE_TEXT, COMMENT_TEXT];

const XML_TEXT = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
const XML_ENTITY = /&(lt|gt|amp|quot|apos);/g;
const PDF_TEXT_ARRAY = /\[((?:\s*(?:<[0-9a-fA-F]*>|-?[0-9.]+))+)\s*\]\s*TJ/g;
const PDF_HEX_STRING = /<([0-9a-fA-F]*)>/g;
const PDF_STREAM = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
/** A wrapped line or a split run reads as one space, so text is compared as a viewer reads it. */
const WHITESPACE_RUN = /\s+/g;
const WEB_OR_MAIL = /^(?:https?:|mailto:)/i;
const EXAMPLE_ADDRESS = /^https:\/\/example\.com\/a/;
const ESCAPED_MARKUP_CHARACTER = /\\[<[\]&]/;
const XML_CHARACTERS: Record<string, string> = {
	amp: "&",
	apos: "'",
	gt: ">",
	lt: "<",
	quot: '"',
};

function evidence(id: string, url: string, description: string): PlainTreeNode {
	return {
		id,
		type: "EVIDENCE",
		name: id,
		description,
		url,
		inSandbox: false,
		children: [],
	};
}

function createCase(): PlainCase {
	return {
		version: "1.0",
		exportedAt: "2024-01-15T10:00:00Z",
		case: { name: "Case <b>one</b> [x]", description: CASE_TEXT },
		tree: {
			id: "goal-1",
			type: "GOAL",
			name: "G1 <u>x</u>",
			description: GOAL_TEXT,
			inSandbox: false,
			context: ["Context with [c](d) and <i>tags</i>"],
			assumption: "Assumption with [a](b) and <b>tags</b>",
			justification: "Justification with [j](k) and <b>tags</b>",
			children: [
				evidence("E1", "https://example.com/a)b", EVIDENCE_TEXT),
				evidence("E2", "javascript:alert(1)", "second"),
			],
			comments: [
				{
					author: "bob <b>",
					content: COMMENT_TEXT,
					createdAt: "2024-01-15T10:00:00Z",
				},
			],
		},
	};
}

async function render(preset: string): Promise<RenderedDocument> {
	return await createTemplateFromPreset(
		preset as Parameters<typeof createTemplateFromPreset>[0],
		{ organisationName: "Org <b>x</b>" }
	).render({ caseData: createCase(), exportedBy: 'Some "One"' });
}

function blockTexts(block: ContentBlock): string[] {
	switch (block.type) {
		case "heading":
		case "paragraph":
			return [block.text];
		case "list":
			return block.items;
		case "table":
			return [...block.headers, ...block.rows.flat()];
		case "image":
			return [block.alt, block.caption ?? ""];
		case "metadata":
			return [block.key, block.value];
		case "element":
			return nodeTexts(block.node);
		default:
			return [];
	}
}

function nodeTexts(node: PlainTreeNode): string[] {
	return [
		node.name ?? "",
		node.description ?? "",
		node.assumption ?? "",
		node.justification ?? "",
		node.url ?? "",
		...(node.context ?? []),
		...(node.comments ?? []).flatMap((c) => [c.author, c.content]),
	];
}

function documentTexts(document: RenderedDocument): string[] {
	return [
		document.metadata.caseName,
		document.metadata.caseDescription,
		...document.sections.flatMap((section) => [
			section.title,
			...section.blocks.flatMap(blockTexts),
		]),
	];
}

async function wordText(document: RenderedDocument): Promise<string> {
	const result = await new WordExporter().export(document, {
		caseName: "Case",
	});
	if (!(result.success && "blob" in result)) {
		throw new Error("the Word export did not return a file");
	}
	const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
	const xml = await zip.file("word/document.xml")?.async("string");
	return Array.from((xml ?? "").matchAll(XML_TEXT))
		.map((match) =>
			(match[1] ?? "").replace(
				XML_ENTITY,
				(_, name: string) => XML_CHARACTERS[name] ?? ""
			)
		)
		.join(" ")
		.replace(WHITESPACE_RUN, " ");
}

async function pdfText(document: RenderedDocument): Promise<string> {
	const result = await new PDFExporter().export(document, { caseName: "Case" });
	if (!(result.success && "blob" in result)) {
		throw new Error("the PDF export did not return a file");
	}
	const raw = Buffer.from(await result.blob.arrayBuffer()).toString("latin1");
	const lines: string[] = [];
	for (const stream of raw.matchAll(PDF_STREAM)) {
		let content = "";
		try {
			content = inflateSync(Buffer.from(stream[1] ?? "", "latin1")).toString(
				"latin1"
			);
		} catch {
			continue;
		}
		for (const array of content.matchAll(PDF_TEXT_ARRAY)) {
			lines.push(
				Array.from((array[1] ?? "").matchAll(PDF_HEX_STRING))
					.map((hex) => Buffer.from(hex[1] ?? "", "hex").toString("latin1"))
					.join("")
			);
		}
	}
	return lines.join(" ").replace(WHITESPACE_RUN, " ");
}

describe("the shared templates keep case text raw", () => {
	it.each(
		getAvailablePresets()
	)("the %s template passes text on without Markdown escapes", async (preset) => {
		const texts = documentTexts(await render(preset));

		expect(texts).toContain(CASE_TEXT);
		expect(texts.join("\n")).not.toMatch(ESCAPED_MARKUP_CHARACTER);
	});

	it("the full report carries each description, comment and name exactly as stored", async () => {
		const texts = documentTexts(await render("full-report"));

		expect(texts).toContain(GOAL_TEXT);
		expect(texts).toContain(EVIDENCE_TEXT);
		expect(texts).toContain("Case <b>one</b> [x]");
		expect(texts.some((text) => text.includes(COMMENT_TEXT))).toBe(true);
	});
});

describe("Word and PDF reports show case text as stored", () => {
	it("a Word report shows each text exactly as stored", async () => {
		const text = await wordText(await render("full-report"));

		for (const raw of RAW_TEXTS) {
			expect(text).toContain(raw);
		}
		expect(text).toContain(EVIDENCE_TEXT);
		expect(text).not.toMatch(ESCAPED_MARKUP_CHARACTER);
	});

	it("a PDF report shows each text exactly as stored", async () => {
		const text = await pdfText(await render("full-report"));

		expect(text).toContain(GOAL_TEXT);
		expect(text).toContain(EVIDENCE_TEXT);
		expect(text).not.toMatch(ESCAPED_MARKUP_CHARACTER);
	});
});

describe("a Markdown report built from the templates", () => {
	it.each(
		getAvailablePresets()
	)("the %s report starts no markup from case text and links only web addresses", async (preset) => {
		const { body } = splitFrontMatter(
			await exportMarkdown(await render(preset))
		);

		const targets = linkTargets(body);
		for (const target of targets) {
			expect(target).toMatch(WEB_OR_MAIL);
		}
		expect(unescapedPositions(body, "[")).toHaveLength(inlineLinkCount(body));
		expect(unescapedPositions(body, "]")).toHaveLength(inlineLinkCount(body));
		for (const position of unescapedPositions(body, "<")) {
			expect(body.slice(position - 2, position)).toBe("](");
		}
	});

	it.each(
		getAvailablePresets()
	)("the %s report leaves {term} references and hyphens readable", async (preset) => {
		const { body } = splitFrontMatter(
			await exportMarkdown(await render(preset))
		);

		expect(body).toContain(EVIDENCE_TEXT);
	});

	it("the full report shows every description as typed", async () => {
		const { body } = splitFrontMatter(
			await exportMarkdown(await render("full-report"))
		);

		expect(readAs(body)).toContain(GOAL_TEXT);
		expect(readAs(body)).toContain(CASE_TEXT);
		expect(readAs(body)).toContain(COMMENT_TEXT);
	});

	it("the full report links the web address and writes the other as text", async () => {
		const { body } = splitFrontMatter(
			await exportMarkdown(await render("full-report"))
		);

		expect(linkTargets(body)).toHaveLength(1);
		expect(linkTargets(body)[0]).toMatch(EXAMPLE_ADDRESS);
		expect(body).toContain("javascript:alert");
	});

	it("the front matter reads back the exporter name unchanged", async () => {
		const { frontMatter } = splitFrontMatter(
			await exportMarkdown(await render("full-report"))
		);

		const data = parseYaml(frontMatter) as Record<string, unknown>;
		expect(data.exportedBy).toBe('Some "One"');
	});
});
