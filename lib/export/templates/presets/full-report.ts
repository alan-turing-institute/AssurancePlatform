/**
 * Full Report template preset.
 *
 * Comprehensive document including all sections: title page, table of contents,
 * diagram, executive summary, all element types, comments, and metadata.
 */

import type {
	CaseExportNested,
	ExportComment,
	TreeNode,
} from "@/lib/schemas/case-export";
import type { BrandingConfig } from "../../schemas/branding-config";
import { DEFAULT_SECTIONS_FULL } from "../../schemas/section-config";
import type { TemplateConfig } from "../../schemas/template-config";
import type { ContentBlock, DiagramImage, RenderedSection } from "../../types";
import { ELEMENT_TYPE_LABELS } from "../../types";
import { BaseTemplate } from "../base-template";
import {
	collectAllComments,
	collectElementsByType,
	countElementsByType,
	renderHierarchicalTree,
} from "../renderers/tree-renderer";

/**
 * Full Report configuration
 */
export const FULL_REPORT_CONFIG: TemplateConfig = {
	name: "Full Report",
	description:
		"Comprehensive report with all case elements, comments, and diagram",
	preset: "full-report",
	sections: DEFAULT_SECTIONS_FULL,
};

/**
 * Format a comment with optional author and timestamp
 */
function formatComment(
	comment: ExportComment,
	includeAuthor: boolean,
	includeTimestamp: boolean
): string {
	if (!(includeAuthor || includeTimestamp)) {
		return comment.content;
	}

	const meta: string[] = [];
	if (includeAuthor) {
		meta.push(comment.author);
	}
	if (includeTimestamp) {
		const date = new Date(comment.createdAt).toLocaleDateString("en-GB");
		meta.push(date);
	}
	return `[${meta.join(" - ")}] ${comment.content}`;
}

/**
 * Full Report template implementation
 */
export class FullReportTemplate extends BaseTemplate {
	constructor(branding?: Partial<BrandingConfig>) {
		super(FULL_REPORT_CONFIG, branding);
	}

	protected renderSections(
		caseData: CaseExportNested,
		diagramImage?: DiagramImage
	): RenderedSection[] {
		const sections: RenderedSection[] = [];
		const tree = caseData.tree;

		if (this.isSectionEnabled("titlePage")) {
			sections.push(this.renderTitlePage(caseData));
		}

		if (this.isSectionEnabled("tableOfContents")) {
			sections.push(this.renderTableOfContents());
		}

		if (this.isSectionEnabled("diagram") && diagramImage) {
			sections.push(this.renderDiagram(caseData, diagramImage));
		}

		if (this.isSectionEnabled("executiveSummary")) {
			sections.push(this.renderExecutiveSummary(caseData));
		}

		this.addElementSections(sections, tree);

		if (this.isSectionEnabled("metadata")) {
			sections.push(this.renderMetadataSection(caseData));
		}

		return sections;
	}

	private addElementSections(
		sections: RenderedSection[],
		tree: TreeNode
	): void {
		// Hierarchical structure (preferred for full-report)
		if (this.isSectionEnabled("assuranceCaseStructure")) {
			const section = this.renderAssuranceCaseStructure(tree);
			if (section.blocks.length > 1) {
				sections.push(section);
			}
		}

		// Legacy flat sections (disabled by default for full-report)
		this.addSectionIfEnabled("goals", sections, () =>
			this.renderGoalsSection(tree)
		);
		this.addSectionIfEnabled("strategies", sections, () =>
			this.renderStrategiesSection(tree)
		);
		this.addSectionIfEnabled("propertyClaims", sections, () =>
			this.renderPropertyClaimsSection(tree)
		);
		this.addSectionIfEnabled("evidence", sections, () =>
			this.renderEvidenceSection(tree)
		);
		this.addSectionIfEnabled("comments", sections, () =>
			this.renderCommentsSection(tree)
		);
	}

	private addSectionIfEnabled(
		key: "goals" | "strategies" | "propertyClaims" | "evidence" | "comments",
		sections: RenderedSection[],
		renderFn: () => RenderedSection
	): void {
		if (this.isSectionEnabled(key)) {
			const section = renderFn();
			if (section.blocks.length > 1) {
				sections.push(section);
			}
		}
	}

	private renderAssuranceCaseStructure(tree: TreeNode): RenderedSection {
		const title = this.getSectionTitle(
			"assuranceCaseStructure",
			"Assurance Case Structure"
		);

		// Render the tree hierarchically, preserving parent-child chains
		// Section title is rendered automatically by exporters, no need for heading block
		const blocks: ContentBlock[] = renderHierarchicalTree(tree, 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		return {
			type: "assurance-case-structure",
			title,
			blocks,
		};
	}

	private renderTableOfContents(): RenderedSection {
		return {
			type: "table-of-contents",
			title: this.getSectionTitle("tableOfContents", "Contents"),
			blocks: [],
		};
	}

	private renderTitlePage(caseData: CaseExportNested): RenderedSection {
		const blocks: ContentBlock[] = [
			this.heading(1, caseData.case.name),
			this.paragraph(caseData.case.description),
			this.divider(),
			this.metadata("Export Date", new Date().toLocaleDateString("en-GB")),
			this.metadata("Export Version", caseData.version),
		];

		if (this.branding.organisationName) {
			blocks.push(
				this.metadata("Organisation", this.branding.organisationName)
			);
		}

		return {
			type: "title-page",
			title: caseData.case.name,
			blocks,
		};
	}

	private renderDiagram(
		caseData: CaseExportNested,
		diagramImage: DiagramImage
	): RenderedSection {
		return {
			type: "diagram",
			title: this.getSectionTitle("diagram", "Assurance Case Diagram"),
			blocks: [
				this.image(
					diagramImage.data,
					`Diagram for ${caseData.case.name}`,
					"Assurance Case Structure"
				),
			],
		};
	}

	private renderExecutiveSummary(caseData: CaseExportNested): RenderedSection {
		const counts = countElementsByType(caseData.tree);
		const totalElements = this.countElements(caseData.tree);

		const summaryRows: string[][] = [
			["Total Elements", String(totalElements)],
			["Goals", String(counts.GOAL)],
			["Strategies", String(counts.STRATEGY)],
			["Property Claims", String(counts.PROPERTY_CLAIM)],
			["Evidence Items", String(counts.EVIDENCE)],
		];

		return {
			type: "executive-summary",
			title: this.getSectionTitle("executiveSummary", "Executive Summary"),
			blocks: [
				// Section title rendered automatically by exporters
				this.paragraph(caseData.case.description),
				this.divider(),
				this.heading(3, "Case Statistics"),
				this.table(["Metric", "Count"], summaryRows),
			],
		};
	}

	private renderGoalsSection(tree: TreeNode): RenderedSection {
		const goals = collectElementsByType(tree, "GOAL", 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		const blocks: ContentBlock[] = [
			this.heading(2, this.getSectionTitle("goals", "Goals")),
		];

		for (const { node, depth } of goals) {
			blocks.push(...this.renderElementWithContext(node, depth));
		}

		return {
			type: "goals",
			title: this.getSectionTitle("goals", "Goals"),
			blocks,
		};
	}

	private renderStrategiesSection(tree: TreeNode): RenderedSection {
		const strategies = collectElementsByType(tree, "STRATEGY", 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		const blocks: ContentBlock[] = [
			this.heading(2, this.getSectionTitle("strategies", "Strategies")),
		];

		for (const { node, depth } of strategies) {
			blocks.push(...this.renderElementWithContext(node, depth));
		}

		return {
			type: "strategies",
			title: this.getSectionTitle("strategies", "Strategies"),
			blocks,
		};
	}

	private renderPropertyClaimsSection(tree: TreeNode): RenderedSection {
		const claims = collectElementsByType(tree, "PROPERTY_CLAIM", 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		const blocks: ContentBlock[] = [
			this.heading(
				2,
				this.getSectionTitle("propertyClaims", "Property Claims")
			),
		];

		for (const { node, depth } of claims) {
			blocks.push(...this.renderElementWithContext(node, depth));
		}

		return {
			type: "property-claims",
			title: this.getSectionTitle("propertyClaims", "Property Claims"),
			blocks,
		};
	}

	private renderEvidenceSection(tree: TreeNode): RenderedSection {
		const evidence = collectElementsByType(tree, "EVIDENCE", 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		const blocks: ContentBlock[] = [
			this.heading(2, this.getSectionTitle("evidence", "Evidence")),
		];

		const includeUrls = this.sections.evidence?.options?.includeUrls !== false;

		for (const { node } of evidence) {
			blocks.push(...this.renderEvidenceItem(node, includeUrls));
		}

		return {
			type: "evidence",
			title: this.getSectionTitle("evidence", "Evidence"),
			blocks,
		};
	}

	private renderEvidenceItem(
		node: TreeNode,
		includeUrls: boolean
	): ContentBlock[] {
		const blocks: ContentBlock[] = [];
		const typeLabel = ELEMENT_TYPE_LABELS[node.type];
		const title = node.name ? `${typeLabel}: ${node.name}` : typeLabel;

		blocks.push(this.heading(3, title));

		if (node.description) {
			blocks.push(this.paragraph(node.description));
		}

		if (includeUrls && node.url) {
			blocks.push(this.metadata("URL", node.url));
		}

		return blocks;
	}

	private renderCommentsSection(tree: TreeNode): RenderedSection {
		const allComments = collectAllComments(tree, 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
		});

		const blocks: ContentBlock[] = [
			this.heading(2, this.getSectionTitle("comments", "Comments")),
		];

		const includeAuthor =
			this.sections.comments?.options?.includeAuthor !== false;
		const includeTimestamp =
			this.sections.comments?.options?.includeTimestamp !== false;

		for (const { elementName, elementType, comments } of allComments) {
			blocks.push(
				...this.renderElementComments(
					elementName,
					elementType,
					comments,
					includeAuthor,
					includeTimestamp
				)
			);
		}

		return {
			type: "comments",
			title: this.getSectionTitle("comments", "Comments"),
			blocks,
		};
	}

	private renderElementComments(
		elementName: string | null,
		elementType: string,
		comments: ExportComment[],
		includeAuthor: boolean,
		includeTimestamp: boolean
	): ContentBlock[] {
		const blocks: ContentBlock[] = [];
		const typeLabel =
			ELEMENT_TYPE_LABELS[elementType as keyof typeof ELEMENT_TYPE_LABELS] ??
			elementType;
		const elementTitle = elementName
			? `${typeLabel}: ${elementName}`
			: typeLabel;

		blocks.push(this.heading(3, `Comments on ${elementTitle}`));

		for (const comment of comments) {
			const text = formatComment(comment, includeAuthor, includeTimestamp);
			blocks.push(this.paragraph(text));
		}

		return blocks;
	}

	private renderMetadataSection(caseData: CaseExportNested): RenderedSection {
		return {
			type: "metadata",
			title: this.getSectionTitle("metadata", "Document Information"),
			blocks: [
				// Section title rendered automatically by exporters
				this.metadata("Case Name", caseData.case.name),
				this.metadata("Export Version", caseData.version),
				this.metadata("Exported At", caseData.exportedAt),
			],
		};
	}

	private renderElementWithContext(
		node: TreeNode,
		depth: number
	): ContentBlock[] {
		const blocks: ContentBlock[] = [];
		// Standardised formula: depth + 2 (consistent with tree-renderer.ts)
		const headingLevel = Math.min(depth + 2, 6) as 1 | 2 | 3 | 4 | 5 | 6;

		const typeLabel = ELEMENT_TYPE_LABELS[node.type];
		const title = node.name ? `${typeLabel}: ${node.name}` : typeLabel;
		blocks.push(this.heading(headingLevel, title));

		if (node.description) {
			blocks.push(this.paragraph(node.description));
		}

		if (node.assumption) {
			blocks.push(this.metadata("Assumption", node.assumption));
		}

		if (node.justification) {
			blocks.push(this.metadata("Justification", node.justification));
		}

		if (node.context && node.context.length > 0) {
			blocks.push(this.metadata("Context", node.context.join(", ")));
		}

		return blocks;
	}
}
