import JSZip from "jszip";
import type { ExportResult } from "@/lib/export/types";

/**
 * A paragraph of the Word body: its text, its paragraph style, whether it holds
 * a picture, the line style of its bottom border, whether it ends a page section
 * and its left indent (zero when it has none).
 */
export interface DocxParagraph {
	bottomBorder: string | undefined;
	endsSection: boolean;
	hasImage: boolean;
	indent: number;
	style: string | undefined;
	text: string;
}

/** The paragraphs that hold text, in order; empty spacing paragraphs are left out. */
export function paragraphTexts(paragraphs: DocxParagraph[]): string[] {
	return paragraphs.map((p) => p.text).filter((text) => text !== "");
}

/** A table of the Word body: the text of each cell, row by row. */
export interface DocxTable {
	rows: string[][];
}

/** One item of the Word body, in document order. */
export type DocxBodyItem =
	| { kind: "paragraph"; paragraph: DocxParagraph }
	| { kind: "table"; table: DocxTable };

const BODY_ITEM =
	/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g;
const TABLE_ROW = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
const TABLE_CELL = /<w:tc>[\s\S]*?<\/w:tc>/g;
const TEXT_RUN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\/>|<w:br\/>/g;
const STYLE = /<w:pStyle w:val="([^"]*)"/;
const BOTTOM_BORDER = /<w:pBdr>\s*<w:bottom[^>]*?w:val="([^"]*)"/;
const LEFT_INDENT = /<w:ind\s[^>]*?w:left="([^"]*)"/;
const RUN_TEXT = /<(w:t|w:instrText|w:delText)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g;
const BARE_TEXT = />([^<>]*[^<>\s][^<>]*)</g;
const CHECKED_PART = /^word\/(document|header\d*|footer\d*)\.xml$/;

function readFile(blob: Blob): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as ArrayBuffer);
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(blob);
	});
}

/** Opens the Word file of a successful export as a zip. */
async function docxZip(result: ExportResult): Promise<JSZip> {
	if (!(result.success && "blob" in result)) {
		throw new Error(
			`the Word export did not produce a file: ${result.success ? "" : result.error}`
		);
	}
	return await JSZip.loadAsync(await readFile(result.blob));
}

/**
 * Refuses a body, header or footer part that holds text outside a run, as a
 * parser refuses bad markup: the reader sees only text inside runs.
 */
function assertNoBareText(name: string, xml: string): void {
	if (!CHECKED_PART.test(name)) {
		return;
	}
	const [stray] = Array.from(
		xml.replace(RUN_TEXT, "").matchAll(BARE_TEXT),
		(match) => match[1]
	);
	if (stray !== undefined) {
		throw new Error(
			`the Word part ${name} holds text outside a run: ${JSON.stringify(stray)}`
		);
	}
}

/** The text of one part of the Word file, such as `word/document.xml`. */
export async function docxPart(
	result: ExportResult,
	name: string
): Promise<string> {
	const file = (await docxZip(result)).file(name);
	if (!file) {
		throw new Error(`the Word file has no part ${name}`);
	}
	const xml = await file.async("string");
	assertNoBareText(name, xml);
	return xml;
}

/** The width and height written for a picture, as the file gives them. */
export interface DocxPictureSize {
	height: number;
	width: number;
}

const PICTURE_EXTENT = /<wp:extent\s+cx="([^"]*)"\s+cy="([^"]*)"\s*\/>/g;

/** The size of every picture placed in the body, the headers and the footers. */
export async function docxPictureSizes(
	result: ExportResult
): Promise<DocxPictureSize[]> {
	const zip = await docxZip(result);
	const names = Object.keys(zip.files).filter((name) =>
		CHECKED_PART.test(name)
	);
	const parts = await Promise.all(names.map((name) => docxPart(result, name)));
	return parts.flatMap((xml) =>
		Array.from(xml.matchAll(PICTURE_EXTENT), ([, cx, cy]) => ({
			width: Number(cx),
			height: Number(cy),
		}))
	);
}

/** The names of the media files stored in the Word file. */
export async function docxMediaNames(result: ExportResult): Promise<string[]> {
	const zip = await docxZip(result);
	return Object.values(zip.files)
		.filter((file) => !file.dir && file.name.startsWith("word/media/"))
		.map((file) => file.name);
}

/** The bytes of one media file stored in the Word file. */
export async function docxMediaBytes(
	result: ExportResult,
	name: string
): Promise<number[]> {
	const file = (await docxZip(result)).file(name);
	if (!file) {
		throw new Error(`the Word file has no media file ${name}`);
	}
	return Array.from(await file.async("uint8array"));
}

function decode(text: string): string {
	return text
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

/** The text of a run, or a newline for a line break element. */
function runText(match: RegExpMatchArray): string {
	return match[0] === "<w:br/>" ? "\n" : decode(match[1] ?? "");
}

function textOf(xml: string): string {
	return Array.from(xml.matchAll(TEXT_RUN), runText).join("");
}

function paragraphOf(xml: string): DocxParagraph {
	return {
		text: textOf(xml),
		style: STYLE.exec(xml)?.[1],
		hasImage: xml.includes("<w:drawing>"),
		endsSection: xml.includes("<w:sectPr>"),
		bottomBorder: BOTTOM_BORDER.exec(xml)?.[1],
		indent: Number(LEFT_INDENT.exec(xml)?.[1] ?? 0),
	};
}

function tableOf(xml: string): DocxTable {
	const rows = Array.from(xml.matchAll(TABLE_ROW), (row) =>
		Array.from(row[0].matchAll(TABLE_CELL), (cell) => textOf(cell[0]))
	);
	return { rows };
}

/** The paragraphs and tables of the document body, in order. */
function docxBody(documentXml: string): DocxBodyItem[] {
	return Array.from(documentXml.matchAll(BODY_ITEM), (match): DocxBodyItem => {
		if (match[0].startsWith("<w:tbl>")) {
			return { kind: "table", table: tableOf(match[0]) };
		}
		return { kind: "paragraph", paragraph: paragraphOf(match[0]) };
	});
}

/** What the document holds after the title page, in order. */
export async function docxContent(
	result: ExportResult
): Promise<DocxBodyItem[]> {
	const items = docxBody(await docxPart(result, "word/document.xml"));
	const titlePageEnd = items.findIndex(
		(item) => item.kind === "paragraph" && item.paragraph.endsSection
	);
	return titlePageEnd < 0 ? [] : items.slice(titlePageEnd + 1);
}

/** A link of the Word body: the text shown and the address it points to. */
export interface DocxLink {
	target: string;
	text: string;
}

const LINK = /<w:hyperlink\s[^>]*>[\s\S]*?<\/w:hyperlink>/g;
const LINK_ID = /r:id="([^"]*)"/;
const RELATIONSHIP = /<Relationship\s[^>]*>/g;
const RELATIONSHIP_ID = /\sId="([^"]*)"/;
const RELATIONSHIP_TARGET = /\sTarget="([^"]*)"/;

/** The address each relationship id points to, from a `.rels` part. */
function relationshipTargets(rels: string): Map<string, string> {
	const targets = new Map<string, string>();
	for (const [tag] of rels.matchAll(RELATIONSHIP)) {
		const id = RELATIONSHIP_ID.exec(tag)?.[1];
		const target = RELATIONSHIP_TARGET.exec(tag)?.[1];
		if (id && target !== undefined) {
			targets.set(id, decode(target));
		}
	}
	return targets;
}

/** The links of the document body, in order, with the address each one points to. */
export async function docxLinks(result: ExportResult): Promise<DocxLink[]> {
	const targets = relationshipTargets(
		await docxPart(result, "word/_rels/document.xml.rels")
	);
	const xml = await docxPart(result, "word/document.xml");
	return Array.from(xml.matchAll(LINK), ([link]) => ({
		text: textOf(link),
		target: targets.get(LINK_ID.exec(link)?.[1] ?? "") ?? "",
	}));
}

/** The paragraphs among body items that are not inside a table, in order. */
export function docxParagraphs(items: DocxBodyItem[]): DocxParagraph[] {
	return items.flatMap((item) =>
		item.kind === "paragraph" ? [item.paragraph] : []
	);
}

/**
 * The footer of a page section: its text, with each page-number field written
 * as its name in braces, and whether it holds a picture.
 */
export interface DocxFooter {
	hasImage: boolean;
	text: string;
}

/** A page section of the Word file: its paragraphs, page orientation and footer. */
export interface DocxSection {
	footer: DocxFooter | undefined;
	orientation: string | undefined;
	paragraphs: DocxParagraph[];
}

const SECTION_SPLIT = /(<w:sectPr>[\s\S]*?<\/w:sectPr>)/;
const ORIENTATION = /<w:pgSz[^>]*w:orient="([^"]*)"/;
const FOOTER_REFERENCE = /<w:footerReference[^>]*r:id="([^"]*)"/;
const FOOTER_PART =
	/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g;

function footerOf(xml: string): DocxFooter {
	const text = Array.from(xml.matchAll(FOOTER_PART), ([, shown, field]) =>
		field === undefined ? decode(shown ?? "") : `{${field.trim()}}`
	).join("");
	return { text, hasImage: xml.includes("<w:drawing>") };
}

async function sectionFooter(
	result: ExportResult,
	targets: Map<string, string>,
	properties: string
): Promise<DocxFooter | undefined> {
	const target = targets.get(FOOTER_REFERENCE.exec(properties)?.[1] ?? "");
	return target === undefined
		? undefined
		: footerOf(await docxPart(result, `word/${target}`));
}

/** The page sections of the Word file, in order, from the title page on. */
export async function docxSections(
	result: ExportResult
): Promise<DocxSection[]> {
	const targets = relationshipTargets(
		await docxPart(result, "word/_rels/document.xml.rels")
	);
	const parts = (await docxPart(result, "word/document.xml")).split(
		SECTION_SPLIT
	);
	const sections: Promise<DocxSection>[] = [];
	for (let i = 0; i + 1 < parts.length; i += 2) {
		const body = parts[i] ?? "";
		const properties = parts[i + 1] ?? "";
		sections.push(
			sectionFooter(result, targets, properties).then((footer) => ({
				footer,
				orientation: ORIENTATION.exec(properties)?.[1],
				paragraphs: docxParagraphs(docxBody(body)),
			}))
		);
	}
	return await Promise.all(sections);
}

/** The tables of the body, in order. */
export function docxTables(documentXml: string): DocxTable[] {
	return docxBody(documentXml).flatMap((item) =>
		item.kind === "table" ? [item.table] : []
	);
}
