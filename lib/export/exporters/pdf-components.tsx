/**
 * Reusable PDF components for react-pdf/renderer.
 *
 * These components map ContentBlock types to PDF-renderable elements
 * with consistent styling based on BrandingConfig.
 *
 * @fileoverview Static PDF rendering - array indices as keys are safe since
 * content is never reordered or mutated after render.
 */

/* biome-ignore-all lint/suspicious/noArrayIndexKey: Static PDF content is never reordered */

import {
	Document,
	Image,
	Link,
	Page,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import type { TreeNode } from "@/lib/schemas/case-export";
import type {
	ContentBlock,
	RenderedDocument,
	RenderedSection,
	ResolvedBranding,
} from "../types";
import { getElementTitle } from "../utils";

/**
 * Create styles based on branding configuration.
 */
function createStyles(branding: ResolvedBranding) {
	return StyleSheet.create({
		page: {
			padding: 40,
			fontSize: 11,
			fontFamily: "Helvetica",
			lineHeight: 1.5,
		},
		header: {
			marginBottom: 20,
		},
		footer: {
			position: "absolute",
			bottom: 30,
			left: 40,
			right: 40,
			fontSize: 9,
			color: "#666666",
			flexDirection: "row",
			justifyContent: "space-between",
		},
		// Title page styles
		titlePage: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
		},
		titlePageTitle: {
			fontSize: 28,
			fontFamily: "Helvetica-Bold",
			marginBottom: 16,
			textAlign: "center",
			color: branding.primaryColour,
		},
		titlePageDescription: {
			fontSize: 14,
			textAlign: "center",
			color: "#666666",
			maxWidth: 400,
			marginBottom: 40,
		},
		titlePageMeta: {
			fontSize: 10,
			color: "#999999",
			textAlign: "center",
		},
		// Heading styles
		h1: {
			fontSize: 24,
			fontFamily: "Helvetica-Bold",
			marginTop: 20,
			marginBottom: 12,
			color: branding.primaryColour,
		},
		h2: {
			fontSize: 18,
			fontFamily: "Helvetica-Bold",
			marginTop: 16,
			marginBottom: 10,
			color: branding.primaryColour,
		},
		h3: {
			fontSize: 14,
			fontFamily: "Helvetica-Bold",
			marginTop: 12,
			marginBottom: 8,
		},
		h4: {
			fontSize: 12,
			fontFamily: "Helvetica-Bold",
			marginTop: 10,
			marginBottom: 6,
		},
		h5: {
			fontSize: 11,
			fontFamily: "Helvetica-Bold",
			marginTop: 8,
			marginBottom: 4,
		},
		h6: {
			fontSize: 10,
			fontFamily: "Helvetica-Bold",
			marginTop: 6,
			marginBottom: 4,
		},
		// Content styles
		paragraph: {
			marginBottom: 8,
		},
		list: {
			marginBottom: 8,
			marginLeft: 16,
		},
		listItem: {
			flexDirection: "row",
			marginBottom: 4,
		},
		listBullet: {
			width: 16,
		},
		listContent: {
			flex: 1,
		},
		// Table styles
		table: {
			marginBottom: 12,
			borderWidth: 1,
			borderColor: "#e5e7eb",
		},
		tableRow: {
			flexDirection: "row",
			borderBottomWidth: 1,
			borderBottomColor: "#e5e7eb",
		},
		tableHeaderRow: {
			flexDirection: "row",
			backgroundColor: branding.primaryColour,
			borderBottomWidth: 1,
			borderBottomColor: "#e5e7eb",
		},
		tableCell: {
			flex: 1,
			padding: 6,
			fontSize: 10,
		},
		tableHeaderCell: {
			flex: 1,
			padding: 6,
			fontSize: 10,
			fontFamily: "Helvetica-Bold",
			color: "#ffffff",
		},
		// Divider
		divider: {
			borderBottomWidth: 1,
			borderBottomColor: "#e5e7eb",
			marginVertical: 16,
		},
		// Image styles
		image: {
			maxWidth: "100%",
			marginBottom: 8,
		},
		imageCaption: {
			fontSize: 9,
			color: "#666666",
			textAlign: "center",
			marginBottom: 12,
		},
		// Metadata styles
		metadata: {
			flexDirection: "row",
			marginBottom: 4,
		},
		metadataKey: {
			fontFamily: "Helvetica-Bold",
			marginRight: 8,
		},
		metadataValue: {
			flex: 1,
		},
		// Element styles
		element: {
			marginBottom: 16,
			paddingLeft: 8,
			borderLeftWidth: 3,
			borderLeftColor: branding.primaryColour,
		},
		elementTitle: {
			fontSize: 12,
			fontFamily: "Helvetica-Bold",
			marginBottom: 4,
		},
		elementDescription: {
			marginBottom: 6,
		},
		elementField: {
			marginBottom: 4,
		},
		elementFieldLabel: {
			fontFamily: "Helvetica-Bold",
			fontSize: 10,
		},
		elementFieldValue: {
			fontSize: 10,
			color: "#444444",
		},
		draftBadge: {
			fontSize: 9,
			color: "#f59e0b",
			fontFamily: "Helvetica-Oblique",
		},
		link: {
			color: branding.primaryColour,
			textDecoration: "underline",
		},
		// Comment styles
		comment: {
			marginLeft: 16,
			marginBottom: 8,
			paddingLeft: 8,
			borderLeftWidth: 2,
			borderLeftColor: "#e5e7eb",
		},
		commentAuthor: {
			fontSize: 10,
			fontFamily: "Helvetica-Bold",
		},
		commentContent: {
			fontSize: 10,
			color: "#666666",
		},
	});
}

type PDFStyles = ReturnType<typeof createStyles>;

/**
 * Render a heading block.
 */
function PDFHeading({
	level,
	text,
	styles,
}: {
	level: number;
	text: string;
	styles: PDFStyles;
}) {
	const styleMap = {
		1: styles.h1,
		2: styles.h2,
		3: styles.h3,
		4: styles.h4,
		5: styles.h5,
		6: styles.h6,
	} as const;
	const clampedLevel = Math.min(level, 6) as keyof typeof styleMap;
	const style = styleMap[clampedLevel] ?? styles.h6;
	return <Text style={style}>{text}</Text>;
}

/**
 * Render a paragraph block.
 */
function PDFParagraph({ text, styles }: { text: string; styles: PDFStyles }) {
	if (!text.trim()) {
		return null;
	}
	return <Text style={styles.paragraph}>{text}</Text>;
}

/**
 * Render a list block.
 */
function PDFList({
	ordered,
	items,
	styles,
}: {
	ordered: boolean;
	items: string[];
	styles: PDFStyles;
}) {
	if (items.length === 0) {
		return null;
	}
	return (
		<View style={styles.list}>
			{items.map((item, index) => (
				<View key={`list-item-${index}`} style={styles.listItem}>
					<Text style={styles.listBullet}>
						{ordered ? `${index + 1}.` : "\u2022"}
					</Text>
					<Text style={styles.listContent}>{item}</Text>
				</View>
			))}
		</View>
	);
}

/**
 * Render a table block.
 */
function PDFTable({
	headers,
	rows,
	styles,
}: {
	headers: string[];
	rows: string[][];
	styles: PDFStyles;
}) {
	if (headers.length === 0) {
		return null;
	}
	return (
		<View style={styles.table}>
			<View style={styles.tableHeaderRow}>
				{headers.map((header, index) => (
					<Text key={`header-${index}`} style={styles.tableHeaderCell}>
						{header}
					</Text>
				))}
			</View>
			{rows.map((row, rowIndex) => (
				<View key={`row-${rowIndex}`} style={styles.tableRow}>
					{headers.map((_, cellIndex) => (
						<Text
							key={`cell-${rowIndex}-${cellIndex}`}
							style={styles.tableCell}
						>
							{row[cellIndex] ?? ""}
						</Text>
					))}
				</View>
			))}
		</View>
	);
}

/**
 * Render an image block.
 */
function PDFImage({
	src,
	alt,
	caption,
	styles,
}: {
	src: string;
	alt: string;
	caption?: string;
	styles: PDFStyles;
}) {
	if (!src) {
		return <Text style={styles.imageCaption}>[Image: {alt}]</Text>;
	}
	return (
		<View>
			<Image src={src} style={styles.image} />
			{caption && <Text style={styles.imageCaption}>{caption}</Text>}
		</View>
	);
}

/**
 * Render a divider block.
 */
function PDFDivider({ styles }: { styles: PDFStyles }) {
	return <View style={styles.divider} />;
}

/**
 * Render a metadata block.
 */
function PDFMetadata({
	keyName,
	value,
	styles,
}: {
	keyName: string;
	value: string;
	styles: PDFStyles;
}) {
	return (
		<View style={styles.metadata}>
			<Text style={styles.metadataKey}>{keyName}:</Text>
			<Text style={styles.metadataValue}>{value}</Text>
		</View>
	);
}

/**
 * Render context list for an element.
 */
function PDFContextList({
	context,
	styles,
}: {
	context: string[];
	styles: PDFStyles;
}) {
	return (
		<View style={styles.elementField}>
			<Text style={styles.elementFieldLabel}>Context:</Text>
			{context.map((ctx, index) => (
				<Text key={`ctx-${index}`} style={styles.elementFieldValue}>
					{"\u2022"} {ctx}
				</Text>
			))}
		</View>
	);
}

/**
 * Render comments for an element.
 */
function PDFCommentsList({
	comments,
	styles,
}: {
	comments: Array<{ author: string; content: string; createdAt: string }>;
	styles: PDFStyles;
}) {
	return (
		<View style={styles.elementField}>
			<Text style={styles.elementFieldLabel}>Comments:</Text>
			{comments.map((comment, index) => (
				<View key={`comment-${index}`} style={styles.comment}>
					<Text style={styles.commentAuthor}>
						{comment.author}
						{comment.createdAt &&
							` (${new Date(comment.createdAt).toLocaleDateString("en-GB")})`}
					</Text>
					<Text style={styles.commentContent}>{comment.content}</Text>
				</View>
			))}
		</View>
	);
}

/**
 * Render an element block.
 */
function PDFElement({
	node,
	styles,
}: {
	node: TreeNode;
	depth: number;
	styles: PDFStyles;
}) {
	const title = getElementTitle(node);

	return (
		<View style={styles.element}>
			<Text style={styles.elementTitle}>{title}</Text>

			{node.description && (
				<Text style={styles.elementDescription}>{node.description}</Text>
			)}

			{node.context && node.context.length > 0 && (
				<PDFContextList context={node.context} styles={styles} />
			)}

			{node.assumption && (
				<View style={styles.elementField}>
					<Text style={styles.elementFieldLabel}>Assumption:</Text>
					<Text style={styles.elementFieldValue}>{node.assumption}</Text>
				</View>
			)}

			{node.justification && (
				<View style={styles.elementField}>
					<Text style={styles.elementFieldLabel}>Justification:</Text>
					<Text style={styles.elementFieldValue}>{node.justification}</Text>
				</View>
			)}

			{node.url && (
				<View style={styles.elementField}>
					<Text style={styles.elementFieldLabel}>URL:</Text>
					<Link src={node.url} style={styles.link}>
						<Text>{node.url}</Text>
					</Link>
				</View>
			)}

			{node.inSandbox && <Text style={styles.draftBadge}>[Draft]</Text>}

			{node.comments && node.comments.length > 0 && (
				<PDFCommentsList comments={node.comments} styles={styles} />
			)}
		</View>
	);
}

/**
 * Render a content block to PDF components.
 */
export function renderBlock(block: ContentBlock, styles: PDFStyles) {
	switch (block.type) {
		case "heading":
			return (
				<PDFHeading level={block.level} styles={styles} text={block.text} />
			);
		case "paragraph":
			return <PDFParagraph styles={styles} text={block.text} />;
		case "list":
			return (
				<PDFList items={block.items} ordered={block.ordered} styles={styles} />
			);
		case "table":
			return (
				<PDFTable headers={block.headers} rows={block.rows} styles={styles} />
			);
		case "image":
			return (
				<PDFImage
					alt={block.alt}
					caption={block.caption}
					src={block.src}
					styles={styles}
				/>
			);
		case "divider":
			return <PDFDivider styles={styles} />;
		case "metadata":
			return (
				<PDFMetadata keyName={block.key} styles={styles} value={block.value} />
			);
		case "element":
			return (
				<PDFElement depth={block.depth} node={block.node} styles={styles} />
			);
		default:
			return null;
	}
}

/**
 * Render a section to PDF components.
 */
function PDFSection({
	section,
	styles,
}: {
	section: RenderedSection;
	styles: PDFStyles;
}) {
	if (section.blocks.length === 0) {
		return null;
	}

	return (
		<View>
			{section.type !== "title-page" && section.title && (
				<Text style={styles.h2}>{section.title}</Text>
			)}
			{section.blocks.map((block, index) => (
				<View key={`block-${section.type}-${index}`}>
					{renderBlock(block, styles)}
				</View>
			))}
		</View>
	);
}

/**
 * Render the title page.
 */
function PDFTitlePage({
	document,
	styles,
}: {
	document: RenderedDocument;
	styles: PDFStyles;
}) {
	return (
		<Page size="A4" style={styles.page}>
			<View style={styles.titlePage}>
				{document.branding.logoBase64 && (
					<Image
						src={document.branding.logoBase64}
						style={{ width: 120, marginBottom: 24 }}
					/>
				)}
				<Text style={styles.titlePageTitle}>{document.metadata.caseName}</Text>
				{document.metadata.caseDescription && (
					<Text style={styles.titlePageDescription}>
						{document.metadata.caseDescription}
					</Text>
				)}
				<Text style={styles.titlePageMeta}>
					Exported:{" "}
					{new Date(document.metadata.exportedAt).toLocaleDateString("en-GB")}
				</Text>
				{document.branding.organisationName && (
					<Text style={styles.titlePageMeta}>
						{document.branding.organisationName}
					</Text>
				)}
			</View>
			<View style={styles.footer}>
				<Text>{document.branding.footerText}</Text>
			</View>
		</Page>
	);
}

/**
 * Props for the PDF document component.
 */
export type PDFDocumentProps = {
	document: RenderedDocument;
};

/**
 * Main PDF document component.
 */
export function PDFDocumentComponent({ document }: PDFDocumentProps) {
	const styles = createStyles(document.branding);

	// Filter content sections (title page is rendered separately)
	const contentSections = document.sections.filter(
		(s) => s.type !== "title-page"
	);

	return (
		<Document
			author={document.metadata.exportedBy ?? "TEA Platform"}
			creator="TEA Platform"
			subject={document.metadata.caseDescription}
			title={document.metadata.caseName}
		>
			{/* Title Page */}
			<PDFTitlePage document={document} styles={styles} />

			{/* Content Pages */}
			<Page size="A4" style={styles.page}>
				{contentSections.map((section, index) => (
					<PDFSection
						key={`section-${section.type}-${index}`}
						section={section}
						styles={styles}
					/>
				))}
				<View fixed style={styles.footer}>
					<Text>{document.branding.footerText}</Text>
					<Text
						render={({ pageNumber, totalPages }) =>
							`Page ${pageNumber} of ${totalPages}`
						}
					/>
				</View>
			</Page>
		</Document>
	);
}
