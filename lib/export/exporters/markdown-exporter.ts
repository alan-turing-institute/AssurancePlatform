/**
 * Markdown exporter for document generation.
 *
 * Converts RenderedDocument structures to clean, readable Markdown
 * with YAML frontmatter and proper formatting for GitHub compatibility.
 */

import type { PlainTreeNode } from "@/lib/case/defined-terms";
import type {
	ContentBlock,
	ExportOptions,
	ExportResult,
	RenderedDocument,
	RenderedSection,
} from "../types";
import {
	escapeMarkdown,
	escapeMarkdownCharacters,
	escapeMarkdownTableCell,
	escapeMarkdownText,
	getElementTitle,
} from "../utils";
import { AbstractExporter } from "./base-exporter";

/** An address that may be written as a link: no whitespace, web or mail scheme. */
const LINKABLE_URL = /^(?:https?:\/\/|mailto:)\S+$/i;

/** Characters that cannot appear unencoded inside a `<...>` link target. */
const UNSAFE_LINK_TARGET_CHARACTER = /[<>\\]|[\s\p{Cc}]/gu;

/** Characters written as escapes inside a double-quoted YAML value. */
const YAML_ESCAPED_CHARACTER = /[\\"<[\]&]|[\p{Cc}\u2028\u2029]/gu;

const YAML_NAMED_ESCAPES: Record<string, string> = {
	"\\": "\\\\",
	'"': '\\"',
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
};

function escapeYamlCharacter(character: string): string {
	const named = YAML_NAMED_ESCAPES[character];
	if (named !== undefined) {
		return named;
	}
	const code = character.codePointAt(0) ?? 0;
	const hex = code.toString(16).toUpperCase();
	return code > 0xff
		? `\\u${hex.padStart(4, "0")}`
		: `\\x${hex.padStart(2, "0")}`;
}

/**
 * Exporter that converts RenderedDocument to Markdown format.
 *
 * Features:
 * - YAML frontmatter with case metadata
 * - Clean heading hierarchy
 * - GitHub-flavoured Markdown tables
 * - Proper escaping of special characters
 */
export class MarkdownExporter extends AbstractExporter {
	readonly format = "markdown" as const;
	readonly mimeType = "text/markdown";
	readonly fileExtension = "md";

	/**
	 * Export a rendered document to Markdown format.
	 */
	export(
		document: RenderedDocument,
		options: ExportOptions
	): Promise<ExportResult> {
		try {
			const parts: string[] = [];

			// Add YAML frontmatter
			parts.push(this.renderFrontmatter(document));

			// Only add main title if first section is NOT title-page
			// (title-page section already contains an h1 heading)
			const firstSection = document.sections[0];
			if (!firstSection || firstSection.type !== "title-page") {
				parts.push(`# ${escapeMarkdown(document.metadata.caseName)}\n`);
			}

			// Render each section
			for (const section of document.sections) {
				const rendered = this.renderSection(section);
				if (rendered) {
					parts.push(rendered);
				}
			}

			const content = parts.join("\n");
			return Promise.resolve(
				this.successContent(content, options.caseName, options.timestamp)
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error occurred";
			return Promise.resolve(
				this.failure(`Markdown export failed: ${message}`)
			);
		}
	}

	/**
	 * Render YAML frontmatter with document metadata.
	 */
	private renderFrontmatter(document: RenderedDocument): string {
		const lines: string[] = ["---"];

		lines.push(`title: "${this.escapeYamlString(document.metadata.caseName)}"`);

		if (document.metadata.caseDescription) {
			lines.push(
				`description: "${this.escapeYamlString(document.metadata.caseDescription)}"`
			);
		}

		lines.push(`exportedAt: "${document.metadata.exportedAt}"`);

		if (document.metadata.exportedBy) {
			lines.push(
				`exportedBy: "${this.escapeYamlString(document.metadata.exportedBy)}"`
			);
		}

		lines.push(`version: "${document.metadata.version}"`);
		lines.push(`elementCount: ${document.metadata.elementCount}`);
		lines.push(`generator: "TEA Platform"`);

		if (document.branding.organisationName) {
			lines.push(
				`organisation: "${this.escapeYamlString(document.branding.organisationName)}"`
			);
		}

		lines.push("---\n");
		return lines.join("\n");
	}

	/**
	 * Escape a value for a double-quoted YAML string. Front matter is data, not
	 * Markdown, so the characters a viewer could read as markup (`<`, `[`, `]`
	 * and `&`) are written as YAML escapes, and so are line breaks and every
	 * other control character. The value reads back exactly as it was.
	 */
	private escapeYamlString(text: string): string {
		return text.replace(YAML_ESCAPED_CHARACTER, escapeYamlCharacter);
	}

	/**
	 * Render a section to Markdown.
	 */
	protected renderSection(section: RenderedSection): string {
		if (section.blocks.length === 0) {
			return "";
		}

		const parts: string[] = [];

		// Section title (except for title-page which has the main heading)
		if (section.type !== "title-page" && section.title) {
			// Check if first block is already the same heading to avoid duplicates
			const firstBlock = section.blocks[0];
			const isDuplicateHeading =
				firstBlock?.type === "heading" &&
				firstBlock.level === 2 &&
				firstBlock.text === section.title;

			if (!isDuplicateHeading) {
				parts.push(`## ${escapeMarkdown(section.title)}\n`);
			}
		}

		// Render each block
		for (const block of section.blocks) {
			const rendered = this.renderBlock(block);
			if (rendered) {
				parts.push(rendered);
			}
		}

		return parts.join("\n");
	}

	/**
	 * Render a content block to Markdown.
	 */
	protected renderBlock(block: ContentBlock): string {
		switch (block.type) {
			case "heading":
				return this.renderHeading(block);
			case "paragraph":
				return this.renderParagraph(block);
			case "list":
				return this.renderList(block);
			case "table":
				return this.renderTable(block);
			case "image":
				return this.renderImage(block);
			case "divider":
				return "---\n";
			case "metadata":
				return this.renderMetadata(block);
			case "element":
				return this.renderElement(block.node, block.depth);
			default:
				return "";
		}
	}

	/**
	 * Render a heading block.
	 */
	private renderHeading(block: { level: number; text: string }): string {
		const hashes = "#".repeat(Math.min(block.level, 6));
		return `${hashes} ${escapeMarkdown(block.text)}\n`;
	}

	/**
	 * Render a paragraph block.
	 */
	private renderParagraph(block: { text: string }): string {
		if (!block.text.trim()) {
			return "";
		}
		return `${escapeMarkdownText(block.text)}\n`;
	}

	/**
	 * Render a list block.
	 */
	private renderList(block: { ordered: boolean; items: string[] }): string {
		if (block.items.length === 0) {
			return "";
		}

		const lines = block.items.map((item, index) => {
			const prefix = block.ordered ? `${index + 1}.` : "-";
			return `${prefix} ${escapeMarkdown(item)}`;
		});

		return `${lines.join("\n")}\n`;
	}

	/**
	 * Render a table block using GitHub-flavoured Markdown.
	 */
	private renderTable(block: { headers: string[]; rows: string[][] }): string {
		if (block.headers.length === 0) {
			return "";
		}

		const lines: string[] = [];

		// Header row
		const headerCells = block.headers.map((h) => this.escapeTableCell(h));
		lines.push(`| ${headerCells.join(" | ")} |`);

		// Separator row
		const separators = block.headers.map(() => "---");
		lines.push(`| ${separators.join(" | ")} |`);

		// Data rows
		for (const row of block.rows) {
			const cells = row.map((cell) => this.escapeTableCell(cell));
			// Pad if fewer cells than headers
			while (cells.length < block.headers.length) {
				cells.push("");
			}
			lines.push(`| ${cells.join(" | ")} |`);
		}

		return `${lines.join("\n")}\n`;
	}

	/**
	 * Escape special characters for table cells.
	 */
	private escapeTableCell(text: string): string {
		return escapeMarkdownTableCell(text);
	}

	/**
	 * Render an image block.
	 *
	 * Handles both URLs and base64 data. Base64 data is detected by checking
	 * if the src doesn't start with http/https and contains valid base64 chars.
	 */
	private renderImage(block: {
		src: string;
		alt: string;
		caption?: string;
	}): string {
		const parts: string[] = [];

		if (block.src) {
			const imageSrc = this.formatImageSrc(block.src);
			parts.push(`![${escapeMarkdown(block.alt)}](${imageSrc})`);
		} else {
			parts.push(`*[Image: ${escapeMarkdown(block.alt)}]*`);
		}

		if (block.caption) {
			parts.push(`\n*${escapeMarkdown(block.caption)}*`);
		}

		return `${parts.join("")}\n`;
	}

	/**
	 * Format image source for markdown output.
	 *
	 * For base64 images (diagrams), uses a relative path reference since
	 * the image will be exported as a separate file in a ZIP archive.
	 * For URLs, passes through as-is.
	 */
	private formatImageSrc(src: string): string {
		// Already a URL or data URL - pass through
		if (
			src.startsWith("http://") ||
			src.startsWith("https://") ||
			src.startsWith("data:")
		) {
			return src;
		}

		// Base64 images (diagrams) - use relative path
		// These will be exported as separate files in a ZIP archive
		if (
			src.startsWith("iVBORw0KGgo") || // PNG
			src.startsWith("PHN2Zy") || // SVG
			src.startsWith("PD94bW") || // SVG with XML declaration
			src.startsWith("/9j/") // JPEG
		) {
			return "./diagram.png";
		}

		// Unknown format, return as-is
		return src;
	}

	/**
	 * Render a metadata key-value block.
	 * A web or mail address stays a working link; any other value is text.
	 */
	private renderMetadata(block: { key: string; value: string }): string {
		return `**${escapeMarkdown(block.key)}:** ${this.renderAddress(block.value)}\n`;
	}

	/**
	 * Render an address as a link when it is a web or mail address, and as
	 * escaped text otherwise. The link target is written inside `<...>` with
	 * the characters that would end it encoded, so no address can close the
	 * link early or add markup after it.
	 */
	private renderAddress(address: string): string {
		if (!LINKABLE_URL.test(address)) {
			return escapeMarkdown(address);
		}
		const target = address.replace(UNSAFE_LINK_TARGET_CHARACTER, (character) =>
			encodeURIComponent(character)
		);
		return `[${escapeMarkdownCharacters(address)}](<${target}>)`;
	}

	/**
	 * Render an element block with structured formatting.
	 */
	private renderElement(node: PlainTreeNode, depth: number): string {
		const parts: string[] = [];
		const headingLevel = Math.min(depth + 3, 6); // Start at h3, max h6
		const hashes = "#".repeat(headingLevel);

		// Element title
		const title = getElementTitle(node);
		parts.push(`${hashes} ${escapeMarkdown(title)}\n`);

		// Description
		if (node.description) {
			parts.push(`${escapeMarkdownText(node.description)}\n`);
		}

		// Context (for goals, strategies, property claims)
		if (node.context && node.context.length > 0) {
			parts.push(this.renderContextList(node.context));
		}

		// Assumption
		if (node.assumption) {
			parts.push(`**Assumption:** ${escapeMarkdown(node.assumption)}\n`);
		}

		// Justification
		if (node.justification) {
			parts.push(`**Justification:** ${escapeMarkdown(node.justification)}\n`);
		}

		// URL (for evidence)
		if (node.url) {
			parts.push(`**URL:** ${this.renderAddress(node.url)}\n`);
		}

		// Sandbox indicator
		if (node.inSandbox) {
			parts.push("*\\[Draft\\]*\n");
		}

		// Comments
		if (node.comments && node.comments.length > 0) {
			parts.push(this.renderCommentsList(node.comments));
		}

		return parts.join("\n");
	}

	/**
	 * Render a context list for an element.
	 */
	private renderContextList(context: string[]): string {
		const lines = ["**Context:**\n"];
		for (const ctx of context) {
			lines.push(`- ${escapeMarkdown(ctx)}`);
		}
		lines.push("");
		return lines.join("\n");
	}

	/**
	 * Render comments for an element.
	 */
	private renderCommentsList(
		comments: Array<{ author: string; content: string; createdAt: string }>
	): string {
		const lines = ["**Comments:**\n"];
		for (const comment of comments) {
			const timestamp = comment.createdAt
				? ` (${new Date(comment.createdAt).toLocaleDateString("en-GB")})`
				: "";
			lines.push(
				`> **${escapeMarkdown(comment.author)}**${timestamp}: ${escapeMarkdown(comment.content)}`
			);
		}
		lines.push("");
		return lines.join("\n");
	}
}
