import JSZip from "jszip";
import type { ExportResult } from "@/lib/export/types";

/**
 * A paragraph of the Word body: its text, its paragraph style, whether it holds
 * a picture, the line style of its bottom border and whether it ends a page section.
 */
export interface DocxParagraph {
	bottomBorder: string | undefined;
	endsSection: boolean;
	hasImage: boolean;
	style: string | undefined;
	text: string;
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
const TEXT_RUN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t\/>/g;
const STYLE = /<w:pStyle w:val="([^"]*)"/;
const BOTTOM_BORDER = /<w:pBdr>\s*<w:bottom[^>]*?w:val="([^"]*)"/;

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

/** The text of one part of the Word file, such as `word/document.xml`. */
export async function docxPart(
	result: ExportResult,
	name: string
): Promise<string> {
	const file = (await docxZip(result)).file(name);
	if (!file) {
		throw new Error(`the Word file has no part ${name}`);
	}
	return await file.async("string");
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

function textOf(xml: string): string {
	return Array.from(xml.matchAll(TEXT_RUN), (match) =>
		decode(match[1] ?? "")
	).join("");
}

function paragraphOf(xml: string): DocxParagraph {
	return {
		text: textOf(xml),
		style: STYLE.exec(xml)?.[1],
		hasImage: xml.includes("<w:drawing>"),
		endsSection: xml.includes("<w:sectPr>"),
		bottomBorder: BOTTOM_BORDER.exec(xml)?.[1],
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

/** The links of the document body, in order, with the address each one points to. */
export async function docxLinks(result: ExportResult): Promise<DocxLink[]> {
	const targets = new Map<string, string>();
	const rels = await docxPart(result, "word/_rels/document.xml.rels");
	for (const [tag] of rels.matchAll(RELATIONSHIP)) {
		const id = RELATIONSHIP_ID.exec(tag)?.[1];
		const target = RELATIONSHIP_TARGET.exec(tag)?.[1];
		if (id && target !== undefined) {
			targets.set(id, decode(target));
		}
	}
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

/** The tables of the body, in order. */
export function docxTables(documentXml: string): DocxTable[] {
	return docxBody(documentXml).flatMap((item) =>
		item.kind === "table" ? [item.table] : []
	);
}
