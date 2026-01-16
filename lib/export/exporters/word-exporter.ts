/**
 * Word document exporter for document generation.
 *
 * Uses the docx library to convert RenderedDocument structures
 * into professionally styled Word documents matching the PDF export styling.
 */

import {
	AlignmentType,
	BorderStyle,
	convertInchesToTwip,
	Document,
	ExternalHyperlink,
	Footer,
	Header,
	HeadingLevel,
	ImageRun,
	Packer,
	PageBreak,
	PageNumber,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
} from "docx";
import type {
	ContentBlock,
	ElementBlock,
	ExportOptions,
	ExportResult,
	HeadingBlock,
	ImageBlock,
	ListBlock,
	MetadataBlock,
	ParagraphBlock,
	RenderedDocument,
	RenderedSection,
	ResolvedBranding,
	TableBlock,
} from "../types";
import { getElementTitle } from "../utils";
import type { Exporter } from "./base-exporter";

/**
 * Convert hex colour to DOCX-compatible format (without hash).
 */
function normaliseColour(hex: string): string {
	return hex.replace("#", "");
}

/**
 * Detect image type from base64 data.
 */
function detectImageType(data: string): "png" | "jpg" | "gif" | "bmp" {
	if (data.startsWith("iVBORw0KGgo")) {
		return "png";
	}
	if (data.startsWith("/9j/")) {
		return "jpg";
	}
	if (data.startsWith("R0lGOD")) {
		return "gif";
	}
	if (data.startsWith("Qk")) {
		return "bmp";
	}
	// Default to PNG
	return "png";
}

/**
 * Convert base64 string to Buffer for docx ImageRun.
 */
function base64ToBuffer(base64: string): Buffer {
	// Remove data URL prefix if present
	const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
	return Buffer.from(base64Data, "base64");
}

/**
 * Create heading paragraph based on level.
 */
function createHeading(
	block: HeadingBlock,
	branding: ResolvedBranding
): Paragraph {
	const headingLevelMap: Record<
		number,
		(typeof HeadingLevel)[keyof typeof HeadingLevel]
	> = {
		1: HeadingLevel.HEADING_1,
		2: HeadingLevel.HEADING_2,
		3: HeadingLevel.HEADING_3,
		4: HeadingLevel.HEADING_4,
		5: HeadingLevel.HEADING_5,
		6: HeadingLevel.HEADING_6,
	};

	const level = headingLevelMap[block.level] ?? HeadingLevel.HEADING_6;
	const isPrimary = block.level <= 2;

	return new Paragraph({
		heading: level,
		children: [
			new TextRun({
				text: block.text,
				bold: true,
				color: isPrimary ? normaliseColour(branding.primaryColour) : undefined,
				size: getSizeForHeadingLevel(block.level),
			}),
		],
		spacing: {
			before: getSpacingBefore(block.level),
			after: getSpacingAfter(block.level),
		},
	});
}

/**
 * Get font size (in half-points) for heading level.
 */
function getSizeForHeadingLevel(level: number): number {
	const sizes: Record<number, number> = {
		1: 48, // 24pt
		2: 36, // 18pt
		3: 28, // 14pt
		4: 24, // 12pt
		5: 22, // 11pt
		6: 20, // 10pt
	};
	return sizes[level] ?? 20;
}

/**
 * Get spacing before heading (in twips).
 */
function getSpacingBefore(level: number): number {
	const spacing: Record<number, number> = {
		1: 400,
		2: 320,
		3: 240,
		4: 200,
		5: 160,
		6: 120,
	};
	return spacing[level] ?? 120;
}

/**
 * Get spacing after heading (in twips).
 */
function getSpacingAfter(level: number): number {
	const spacing: Record<number, number> = {
		1: 240,
		2: 200,
		3: 160,
		4: 120,
		5: 80,
		6: 80,
	};
	return spacing[level] ?? 80;
}

/**
 * Create a paragraph element.
 */
function createParagraph(block: ParagraphBlock): Paragraph {
	if (!block.text.trim()) {
		return new Paragraph({ children: [] });
	}

	return new Paragraph({
		children: [new TextRun({ text: block.text })],
		spacing: { after: 160 },
	});
}

/**
 * Create a list of paragraphs for a list block.
 */
function createList(block: ListBlock): Paragraph[] {
	if (block.items.length === 0) {
		return [];
	}

	return block.items.map(
		(item, index) =>
			new Paragraph({
				children: [
					new TextRun({
						text: block.ordered ? `${index + 1}. ${item}` : `• ${item}`,
					}),
				],
				indent: { left: convertInchesToTwip(0.25) },
				spacing: { after: 80 },
			})
	);
}

/**
 * Create a table element.
 */
function createTable(block: TableBlock, branding: ResolvedBranding): Table {
	if (block.headers.length === 0) {
		return new Table({ rows: [] });
	}

	const headerRow = new TableRow({
		children: block.headers.map(
			(header) =>
				new TableCell({
					children: [
						new Paragraph({
							children: [
								new TextRun({
									text: header,
									bold: true,
									color: "FFFFFF",
								}),
							],
						}),
					],
					shading: {
						type: ShadingType.SOLID,
						color: normaliseColour(branding.primaryColour),
					},
					margins: {
						top: 80,
						bottom: 80,
						left: 120,
						right: 120,
					},
				})
		),
	});

	const dataRows = block.rows.map(
		(row) =>
			new TableRow({
				children: block.headers.map(
					(_, index) =>
						new TableCell({
							children: [
								new Paragraph({
									children: [new TextRun({ text: row[index] ?? "" })],
								}),
							],
							margins: {
								top: 80,
								bottom: 80,
								left: 120,
								right: 120,
							},
						})
				),
			})
	);

	return new Table({
		rows: [headerRow, ...dataRows],
		width: { size: 100, type: WidthType.PERCENTAGE },
	});
}

/**
 * Create an image paragraph.
 */
function createImage(block: ImageBlock): Paragraph[] {
	const paragraphs: Paragraph[] = [];

	if (!block.src) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: `[Image: ${block.alt}]`,
						italics: true,
						color: "666666",
					}),
				],
				alignment: AlignmentType.CENTER,
			})
		);
		return paragraphs;
	}

	try {
		const imageType = detectImageType(block.src);
		const imageBuffer = base64ToBuffer(block.src);

		paragraphs.push(
			new Paragraph({
				children: [
					new ImageRun({
						data: imageBuffer,
						transformation: {
							width: 500,
							height: 300,
						},
						type: imageType,
					}),
				],
				alignment: AlignmentType.CENTER,
				spacing: { after: 160 },
			})
		);

		if (block.caption) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: block.caption,
							italics: true,
							size: 18,
							color: "666666",
						}),
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 240 },
				})
			);
		}
	} catch {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: `[Unable to render image: ${block.alt}]`,
						italics: true,
						color: "666666",
					}),
				],
				alignment: AlignmentType.CENTER,
			})
		);
	}

	return paragraphs;
}

/**
 * Create a divider paragraph.
 */
function createDivider(): Paragraph {
	return new Paragraph({
		border: {
			bottom: {
				style: BorderStyle.SINGLE,
				size: 6,
				color: "E5E7EB",
			},
		},
		spacing: { before: 320, after: 320 },
	});
}

/**
 * Create a metadata paragraph.
 */
function createMetadata(block: MetadataBlock): Paragraph {
	return new Paragraph({
		children: [
			new TextRun({
				text: `${block.key}: `,
				bold: true,
			}),
			new TextRun({
				text: block.value,
			}),
		],
		spacing: { after: 80 },
	});
}

/**
 * Create paragraphs for an element block with left border styling.
 */
function createElementBlock(
	block: ElementBlock,
	branding: ResolvedBranding
): Paragraph[] {
	const { node } = block;
	const paragraphs: Paragraph[] = [];
	const title = getElementTitle(node);

	const borderStyle = {
		left: {
			style: BorderStyle.SINGLE,
			size: 12,
			color: normaliseColour(branding.primaryColour),
		},
	};

	// Title
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: title,
					bold: true,
					size: 24,
				}),
			],
			border: borderStyle,
			indent: { left: convertInchesToTwip(0.15) },
			spacing: { after: 80 },
		})
	);

	// Description
	if (node.description) {
		paragraphs.push(
			new Paragraph({
				children: [new TextRun({ text: node.description })],
				border: borderStyle,
				indent: { left: convertInchesToTwip(0.15) },
				spacing: { after: 120 },
			})
		);
	}

	// Context
	if (node.context && node.context.length > 0) {
		paragraphs.push(
			new Paragraph({
				children: [new TextRun({ text: "Context:", bold: true, size: 20 })],
				border: borderStyle,
				indent: { left: convertInchesToTwip(0.15) },
				spacing: { after: 40 },
			})
		);
		for (const ctx of node.context) {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({ text: `• ${ctx}`, size: 20, color: "444444" }),
					],
					border: borderStyle,
					indent: { left: convertInchesToTwip(0.3) },
					spacing: { after: 40 },
				})
			);
		}
	}

	// Assumption
	if (node.assumption) {
		paragraphs.push(
			createFieldParagraph("Assumption", node.assumption, borderStyle)
		);
	}

	// Justification
	if (node.justification) {
		paragraphs.push(
			createFieldParagraph("Justification", node.justification, borderStyle)
		);
	}

	// URL
	if (node.url) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({ text: "URL: ", bold: true, size: 20 }),
					new ExternalHyperlink({
						children: [
							new TextRun({
								text: node.url,
								color: normaliseColour(branding.primaryColour),
								underline: {},
								size: 20,
							}),
						],
						link: node.url,
					}),
				],
				border: borderStyle,
				indent: { left: convertInchesToTwip(0.15) },
				spacing: { after: 80 },
			})
		);
	}

	// Draft badge
	if (node.inSandbox) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: "[Draft]",
						italics: true,
						color: "F59E0B",
						size: 18,
					}),
				],
				border: borderStyle,
				indent: { left: convertInchesToTwip(0.15) },
				spacing: { after: 80 },
			})
		);
	}

	// Comments
	if (node.comments && node.comments.length > 0) {
		paragraphs.push(
			new Paragraph({
				children: [new TextRun({ text: "Comments:", bold: true, size: 20 })],
				border: borderStyle,
				indent: { left: convertInchesToTwip(0.15) },
				spacing: { after: 40 },
			})
		);
		for (const comment of node.comments) {
			paragraphs.push(createCommentParagraph(comment, borderStyle));
		}
	}

	// Add spacing after the element block
	const lastIndex = paragraphs.length - 1;
	const lastParagraph = paragraphs.at(-1);
	if (lastParagraph && lastIndex >= 0) {
		paragraphs[lastIndex] = new Paragraph({
			...lastParagraph,
			spacing: { after: 320 },
		});
	}

	return paragraphs;
}

/**
 * Create a field paragraph with label and value.
 */
function createFieldParagraph(
	label: string,
	value: string,
	borderStyle: {
		left: {
			style: (typeof BorderStyle)[keyof typeof BorderStyle];
			size: number;
			color: string;
		};
	}
): Paragraph {
	return new Paragraph({
		children: [
			new TextRun({ text: `${label}: `, bold: true, size: 20 }),
			new TextRun({ text: value, size: 20, color: "444444" }),
		],
		border: borderStyle,
		indent: { left: convertInchesToTwip(0.15) },
		spacing: { after: 80 },
	});
}

/**
 * Create a comment paragraph.
 */
function createCommentParagraph(
	comment: { author: string; content: string; createdAt: string },
	borderStyle: {
		left: {
			style: (typeof BorderStyle)[keyof typeof BorderStyle];
			size: number;
			color: string;
		};
	}
): Paragraph {
	const dateStr = comment.createdAt
		? ` (${new Date(comment.createdAt).toLocaleDateString("en-GB")})`
		: "";

	return new Paragraph({
		children: [
			new TextRun({
				text: `${comment.author}${dateStr}`,
				bold: true,
				size: 20,
			}),
			new TextRun({ text: `\n${comment.content}`, size: 20, color: "666666" }),
		],
		border: {
			...borderStyle,
			left: {
				style: BorderStyle.SINGLE,
				size: 6,
				color: "E5E7EB",
			},
		},
		indent: { left: convertInchesToTwip(0.3) },
		spacing: { after: 80 },
	});
}

/**
 * Render a content block to docx paragraphs.
 */
function renderContentBlock(
	block: ContentBlock,
	branding: ResolvedBranding
): (Paragraph | Table)[] {
	switch (block.type) {
		case "heading":
			return [createHeading(block, branding)];
		case "paragraph":
			return [createParagraph(block)];
		case "list":
			return createList(block);
		case "table":
			return [createTable(block, branding)];
		case "image":
			return createImage(block);
		case "divider":
			return [createDivider()];
		case "metadata":
			return [createMetadata(block)];
		case "element":
			return createElementBlock(block, branding);
		default:
			return [];
	}
}

/**
 * Render a section to docx paragraphs.
 */
function renderSection(
	section: RenderedSection,
	branding: ResolvedBranding
): (Paragraph | Table)[] {
	const elements: (Paragraph | Table)[] = [];

	// Add section title (except for title-page which is handled separately)
	if (section.type !== "title-page" && section.title) {
		elements.push(
			new Paragraph({
				heading: HeadingLevel.HEADING_2,
				children: [
					new TextRun({
						text: section.title,
						bold: true,
						color: normaliseColour(branding.primaryColour),
						size: 36,
					}),
				],
				spacing: { before: 320, after: 200 },
			})
		);
	}

	// Render all blocks
	for (const block of section.blocks) {
		elements.push(...renderContentBlock(block, branding));
	}

	return elements;
}

/**
 * Create title page content.
 */
function createTitlePage(document: RenderedDocument): Paragraph[] {
	const paragraphs: Paragraph[] = [];
	const { metadata, branding } = document;

	// Logo (if available)
	if (branding.logoBase64) {
		try {
			const imageType = detectImageType(branding.logoBase64);
			const imageBuffer = base64ToBuffer(branding.logoBase64);

			paragraphs.push(
				new Paragraph({
					children: [
						new ImageRun({
							data: imageBuffer,
							transformation: { width: 120, height: 60 },
							type: imageType,
						}),
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 480 },
				})
			);
		} catch {
			// Skip logo on error
		}
	}

	// Add spacing before title
	paragraphs.push(
		new Paragraph({
			children: [],
			spacing: { before: 2000 },
		})
	);

	// Case name
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: metadata.caseName,
					bold: true,
					size: 56,
					color: normaliseColour(branding.primaryColour),
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 320 },
		})
	);

	// Description
	if (metadata.caseDescription) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: metadata.caseDescription,
						size: 28,
						color: "666666",
					}),
				],
				alignment: AlignmentType.CENTER,
				spacing: { after: 800 },
			})
		);
	}

	// Export date
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: `Exported: ${new Date(metadata.exportedAt).toLocaleDateString("en-GB")}`,
					size: 20,
					color: "999999",
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 80 },
		})
	);

	// Organisation
	if (branding.organisationName) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: branding.organisationName,
						size: 20,
						color: "999999",
					}),
				],
				alignment: AlignmentType.CENTER,
			})
		);
	}

	// Page break after title page
	paragraphs.push(
		new Paragraph({
			children: [new PageBreak()],
		})
	);

	return paragraphs;
}

/**
 * Create diagram page content (landscape orientation handled at section level).
 */
function createDiagramPage(section: RenderedSection): Paragraph[] {
	const paragraphs: Paragraph[] = [];

	// Find the image block
	const imageBlock = section.blocks.find((b) => b.type === "image") as
		| ImageBlock
		| undefined;

	if (!imageBlock) {
		return paragraphs;
	}

	// Diagram title
	paragraphs.push(
		new Paragraph({
			children: [
				new TextRun({
					text: section.title,
					bold: true,
					size: 36,
				}),
			],
			alignment: AlignmentType.CENTER,
			spacing: { after: 320 },
		})
	);

	// Diagram image
	if (imageBlock.src) {
		try {
			const imageType = detectImageType(imageBlock.src);
			const imageBuffer = base64ToBuffer(imageBlock.src);

			paragraphs.push(
				new Paragraph({
					children: [
						new ImageRun({
							data: imageBuffer,
							transformation: {
								width: 700,
								height: 450,
							},
							type: imageType,
						}),
					],
					alignment: AlignmentType.CENTER,
					spacing: { after: 240 },
				})
			);
		} catch {
			paragraphs.push(
				new Paragraph({
					children: [
						new TextRun({
							text: `[Unable to render diagram: ${imageBlock.alt}]`,
							italics: true,
							color: "666666",
						}),
					],
					alignment: AlignmentType.CENTER,
				})
			);
		}
	}

	// Caption
	if (imageBlock.caption) {
		paragraphs.push(
			new Paragraph({
				children: [
					new TextRun({
						text: imageBlock.caption,
						italics: true,
						size: 20,
						color: "666666",
					}),
				],
				alignment: AlignmentType.CENTER,
			})
		);
	}

	// Page break after diagram
	paragraphs.push(
		new Paragraph({
			children: [new PageBreak()],
		})
	);

	return paragraphs;
}

/**
 * Create footer for the document.
 */
function createFooter(branding: ResolvedBranding): Footer {
	return new Footer({
		children: [
			new Paragraph({
				children: [
					new TextRun({
						text: branding.footerText,
						size: 18,
						color: "666666",
					}),
				],
			}),
			new Paragraph({
				children: [
					new TextRun({
						children: [
							"Page ",
							PageNumber.CURRENT,
							" of ",
							PageNumber.TOTAL_PAGES,
						],
						size: 18,
						color: "666666",
					}),
				],
				alignment: AlignmentType.RIGHT,
			}),
		],
	});
}

/**
 * Exporter that converts RenderedDocument to Word format.
 *
 * Features:
 * - Professional styling matching PDF export
 * - Title page with logo and metadata
 * - Consistent heading hierarchy
 * - Tables, lists, and structured content
 * - Page numbers and footer text
 * - Elements with left border accent
 */
export class WordExporter implements Exporter {
	readonly format = "docx" as const;
	readonly mimeType =
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	readonly fileExtension = "docx";

	/**
	 * Export a rendered document to Word format.
	 */
	async export(
		document: RenderedDocument,
		options: ExportOptions
	): Promise<ExportResult> {
		try {
			const { branding } = document;

			// Separate sections by type
			const diagramSections = document.sections.filter(
				(s) => s.type === "diagram"
			);
			const contentSections = document.sections.filter(
				(s) => s.type !== "title-page" && s.type !== "diagram"
			);

			// Build document content
			const children: (Paragraph | Table)[] = [];

			// Title page
			children.push(...createTitlePage(document));

			// Diagram pages
			for (const diagramSection of diagramSections) {
				children.push(...createDiagramPage(diagramSection));
			}

			// Content sections
			for (const section of contentSections) {
				children.push(...renderSection(section, branding));
			}

			// Create the document
			const doc = new Document({
				creator: "TEA Platform",
				title: document.metadata.caseName,
				description: document.metadata.caseDescription,
				sections: [
					{
						properties: {
							page: {
								margin: {
									top: convertInchesToTwip(0.75),
									right: convertInchesToTwip(0.75),
									bottom: convertInchesToTwip(0.75),
									left: convertInchesToTwip(0.75),
								},
							},
						},
						headers: {
							default: new Header({ children: [] }),
						},
						footers: {
							default: createFooter(branding),
						},
						children,
					},
				],
			});

			// Generate the document as a Buffer
			const buffer = await Packer.toBuffer(doc);
			const blob = new Blob([buffer], { type: this.mimeType });

			return {
				success: true,
				blob,
				filename: this.generateFilename(options.caseName, options.timestamp),
				mimeType: this.mimeType,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				success: false,
				error: `Word export failed: ${message}`,
			};
		}
	}

	/**
	 * Generate a filename for the export.
	 */
	private generateFilename(caseName: string, timestamp?: Date): string {
		const sanitised = caseName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");

		const dateStr = (timestamp ?? new Date()).toISOString().split("T")[0];
		return `${sanitised}-${dateStr}.${this.fileExtension}`;
	}
}
