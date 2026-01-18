/**
 * Abstract base template class for document generation.
 *
 * Provides common rendering logic and helper methods for template implementations.
 * Subclasses implement the abstract renderSections() method to define their structure.
 */

import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import type { BrandingConfig } from "../schemas/branding-config";
import { DEFAULT_BRANDING, resolveBranding } from "../schemas/branding-config";
import type { SectionsConfig } from "../schemas/section-config";
import type { ElementFilter, TemplateConfig } from "../schemas/template-config";
import type {
	ContentBlock,
	DiagramImage,
	DocumentMetadata,
	ExportFormat,
	RenderedDocument,
	RenderedSection,
	ResolvedBranding,
	TemplateInput,
} from "../types";

/**
 * Abstract base template class
 *
 * Templates transform case data into format-agnostic RenderedDocument structures
 * that exporters then convert to specific output formats (PDF, Word, Markdown).
 */
export abstract class BaseTemplate {
	protected readonly config: TemplateConfig;
	protected readonly branding: BrandingConfig;
	protected sectionOverrides: Record<string, boolean> = {};

	constructor(config: TemplateConfig, branding?: Partial<BrandingConfig>) {
		this.config = config;
		this.branding = resolveBranding(branding);
	}

	/**
	 * Get the template name
	 */
	get name(): string {
		return this.config.name;
	}

	/**
	 * Get the template description
	 */
	get description(): string | undefined {
		return this.config.description;
	}

	/**
	 * Get the template preset identifier (if this is a preset template)
	 */
	get preset(): string | undefined {
		return this.config.preset;
	}

	/**
	 * Get the template configuration
	 */
	get templateConfig(): TemplateConfig {
		return this.config;
	}

	/**
	 * Get the branding configuration
	 */
	get brandingConfig(): BrandingConfig {
		return this.branding;
	}

	/**
	 * Render the template with the given input
	 *
	 * This is the main entry point for template rendering. It builds metadata,
	 * resolves branding, and delegates section rendering to the subclass.
	 */
	async render(input: TemplateInput): Promise<RenderedDocument> {
		const { caseData, diagramImage, exportedBy, sectionOverrides } = input;

		// Store section overrides for use in isSectionEnabled
		this.sectionOverrides = sectionOverrides ?? {};

		const metadata = this.buildMetadata(caseData, exportedBy);
		const resolvedBranding = this.buildResolvedBranding();
		const sections = await this.renderSections(caseData, diagramImage);

		return {
			metadata,
			branding: resolvedBranding,
			sections,
		};
	}

	/**
	 * Build document metadata from case data
	 */
	protected buildMetadata(
		caseData: CaseExportNested,
		exportedBy?: string
	): DocumentMetadata {
		return {
			caseName: caseData.case.name,
			caseDescription: caseData.case.description,
			exportedAt: new Date().toISOString(),
			exportedBy,
			version: caseData.version,
			elementCount: this.countElements(caseData.tree),
			format: (this.config.format ?? "pdf") as ExportFormat,
		};
	}

	/**
	 * Build resolved branding with all defaults applied
	 */
	protected buildResolvedBranding(): ResolvedBranding {
		return {
			primaryColour:
				this.branding.primaryColour ?? DEFAULT_BRANDING.primaryColour,
			secondaryColour:
				this.branding.secondaryColour ?? DEFAULT_BRANDING.secondaryColour,
			logoUrl: this.branding.logoUrl,
			logoBase64: this.branding.logoBase64,
			organisationName: this.branding.organisationName,
			footerText: this.branding.footerText ?? DEFAULT_BRANDING.footerText,
			fontFamily: this.branding.fontFamily ?? DEFAULT_BRANDING.fontFamily,
		};
	}

	/**
	 * Render all sections - subclasses must implement this
	 *
	 * @param caseData - The exported case data
	 * @param diagramImage - Optional diagram image to embed
	 * @returns Array of rendered sections (sync or async)
	 */
	protected abstract renderSections(
		caseData: CaseExportNested,
		diagramImage?: DiagramImage
	): RenderedSection[] | Promise<RenderedSection[]>;

	// ============================================
	// Helper Methods for Subclasses
	// ============================================

	/**
	 * Get section configurations
	 */
	protected get sections(): SectionsConfig {
		return this.config.sections;
	}

	/**
	 * Get element filter
	 */
	protected get elementFilter(): ElementFilter | undefined {
		return this.config.elementFilter;
	}

	/**
	 * Check if a section is enabled
	 *
	 * Section overrides take precedence over template defaults.
	 * If an override is explicitly set to false, the section is disabled
	 * regardless of the template configuration.
	 */
	protected isSectionEnabled(sectionKey: keyof SectionsConfig): boolean {
		// Check section overrides first (explicit user preference)
		if (sectionKey in this.sectionOverrides) {
			return this.sectionOverrides[sectionKey];
		}

		// Fall back to template configuration
		const section = this.sections[sectionKey];
		return section?.enabled !== false;
	}

	/**
	 * Get section title with custom override support
	 */
	protected getSectionTitle(
		sectionKey: keyof SectionsConfig,
		defaultTitle: string
	): string {
		const section = this.sections[sectionKey];
		return section?.title ?? defaultTitle;
	}

	/**
	 * Count total elements in tree
	 */
	protected countElements(node: TreeNode): number {
		let count = 1;
		for (const child of node.children ?? []) {
			count += this.countElements(child);
		}
		return count;
	}

	/**
	 * Count elements of a specific type in tree
	 */
	protected countElementsByType(node: TreeNode, type: string): number {
		let count = node.type === type ? 1 : 0;
		for (const child of node.children ?? []) {
			count += this.countElementsByType(child, type);
		}
		return count;
	}

	/**
	 * Check if an element should be included based on filter settings
	 */
	protected shouldIncludeElement(node: TreeNode, depth: number): boolean {
		const filter = this.elementFilter;
		if (!filter) {
			return true;
		}

		// Check sandbox filter
		if (!filter.includeSandbox && node.inSandbox) {
			return false;
		}

		// Check depth filter
		if (filter.maxDepth !== undefined && depth > filter.maxDepth) {
			return false;
		}

		// Check type filters
		if (filter.includeTypes && !filter.includeTypes.includes(node.type)) {
			return false;
		}

		if (filter.excludeTypes?.includes(node.type)) {
			return false;
		}

		return true;
	}

	/**
	 * Collect all elements of a specific type from tree
	 */
	protected collectElementsByType(
		node: TreeNode,
		type: string,
		depth = 0
	): Array<{ node: TreeNode; depth: number }> {
		const results: Array<{ node: TreeNode; depth: number }> = [];

		if (node.type === type && this.shouldIncludeElement(node, depth)) {
			results.push({ node, depth });
		}

		for (const child of node.children ?? []) {
			results.push(...this.collectElementsByType(child, type, depth + 1));
		}

		return results;
	}

	/**
	 * Collect all comments from tree
	 */
	protected collectAllComments(
		node: TreeNode,
		depth = 0
	): Array<{
		elementName: string | null;
		elementType: string;
		comments: NonNullable<TreeNode["comments"]>;
		depth: number;
	}> {
		const results: Array<{
			elementName: string | null;
			elementType: string;
			comments: NonNullable<TreeNode["comments"]>;
			depth: number;
		}> = [];

		if (
			node.comments &&
			node.comments.length > 0 &&
			this.shouldIncludeElement(node, depth)
		) {
			results.push({
				elementName: node.name,
				elementType: node.type,
				comments: node.comments,
				depth,
			});
		}

		for (const child of node.children ?? []) {
			results.push(...this.collectAllComments(child, depth + 1));
		}

		return results;
	}

	/**
	 * Create a heading block
	 */
	protected heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): ContentBlock {
		return { type: "heading", level, text };
	}

	/**
	 * Create a paragraph block
	 */
	protected paragraph(text: string): ContentBlock {
		return { type: "paragraph", text };
	}

	/**
	 * Create a divider block
	 */
	protected divider(): ContentBlock {
		return { type: "divider" };
	}

	/**
	 * Create a metadata block
	 */
	protected metadata(key: string, value: string): ContentBlock {
		return { type: "metadata", key, value };
	}

	/**
	 * Create a list block
	 */
	protected list(items: string[], ordered = false): ContentBlock {
		return { type: "list", ordered, items };
	}

	/**
	 * Create a table block
	 */
	protected table(headers: string[], rows: string[][]): ContentBlock {
		return { type: "table", headers, rows };
	}

	/**
	 * Create an image block
	 */
	protected image(src: string, alt: string, caption?: string): ContentBlock {
		return { type: "image", src, alt, caption };
	}

	/**
	 * Create an element block
	 */
	protected element(node: TreeNode, depth: number): ContentBlock {
		return { type: "element", node, depth };
	}
}
