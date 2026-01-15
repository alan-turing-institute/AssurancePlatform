/**
 * Summary template preset.
 *
 * Condensed overview with title page, diagram, executive summary,
 * goals, and evidence. Excludes detailed strategies, property claims,
 * and comments for a more concise document.
 */

import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import type { BrandingConfig } from "../../schemas/branding-config";
import { DEFAULT_SECTIONS_SUMMARY } from "../../schemas/section-config";
import type { TemplateConfig } from "../../schemas/template-config";
import type { ContentBlock, DiagramImage, RenderedSection } from "../../types";
import { ELEMENT_TYPE_LABELS } from "../../types";
import { BaseTemplate } from "../base-template";
import {
	collectElementsByType,
	countElementsByType,
} from "../renderers/tree-renderer";

/**
 * Summary configuration
 */
export const SUMMARY_CONFIG: TemplateConfig = {
	name: "Summary",
	description: "Condensed overview with goals and key evidence only",
	preset: "summary",
	sections: DEFAULT_SECTIONS_SUMMARY,
	elementFilter: {
		maxDepth: 2,
	},
};

/**
 * Summary template implementation
 */
export class SummaryTemplate extends BaseTemplate {
	constructor(branding?: Partial<BrandingConfig>) {
		super(SUMMARY_CONFIG, branding);
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

		if (this.isSectionEnabled("diagram") && diagramImage) {
			sections.push(this.renderDiagram(caseData, diagramImage));
		}

		if (this.isSectionEnabled("executiveSummary")) {
			sections.push(this.renderExecutiveSummary(caseData));
		}

		if (this.isSectionEnabled("goals")) {
			const goalsSection = this.renderGoalsSection(tree);
			if (goalsSection.blocks.length > 1) {
				sections.push(goalsSection);
			}
		}

		if (this.isSectionEnabled("evidence")) {
			const evidenceSection = this.renderEvidenceSection(tree);
			if (evidenceSection.blocks.length > 1) {
				sections.push(evidenceSection);
			}
		}

		return sections;
	}

	private renderTitlePage(caseData: CaseExportNested): RenderedSection {
		const blocks: ContentBlock[] = [
			this.heading(1, caseData.case.name),
			this.paragraph(caseData.case.description),
			this.divider(),
			this.metadata("Export Date", new Date().toLocaleDateString("en-GB")),
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

		return {
			type: "executive-summary",
			title: this.getSectionTitle("executiveSummary", "Executive Summary"),
			blocks: [
				this.heading(2, "Overview"),
				this.paragraph(caseData.case.description),
				this.divider(),
				this.table(
					["Metric", "Count"],
					[
						["Total Elements", String(totalElements)],
						["Goals", String(counts.GOAL)],
						["Evidence Items", String(counts.EVIDENCE)],
					]
				),
			],
		};
	}

	private renderGoalsSection(tree: TreeNode): RenderedSection {
		const goals = collectElementsByType(tree, "GOAL", 0, {
			includeSandbox: this.elementFilter?.includeSandbox,
			maxDepth: this.elementFilter?.maxDepth,
		});

		const blocks: ContentBlock[] = [
			this.heading(2, this.getSectionTitle("goals", "Goals")),
		];

		for (const { node } of goals) {
			const typeLabel = ELEMENT_TYPE_LABELS[node.type];
			const title = node.name ? `${typeLabel}: ${node.name}` : typeLabel;
			blocks.push(this.heading(3, title));

			if (node.description) {
				blocks.push(this.paragraph(node.description));
			}
		}

		return {
			type: "goals",
			title: this.getSectionTitle("goals", "Goals"),
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
			const typeLabel = ELEMENT_TYPE_LABELS[node.type];
			const title = node.name ? `${typeLabel}: ${node.name}` : typeLabel;
			blocks.push(this.heading(3, title));

			if (node.description) {
				blocks.push(this.paragraph(node.description));
			}

			if (includeUrls && node.url) {
				blocks.push(this.metadata("URL", node.url));
			}
		}

		return {
			type: "evidence",
			title: this.getSectionTitle("evidence", "Evidence"),
			blocks,
		};
	}
}
