/**
 * Template preset exports.
 */

export { EvidenceListTemplate } from "./evidence-list";
export { FullReportTemplate } from "./full-report";
export { SummaryTemplate } from "./summary";

import type { BrandingConfig } from "../../schemas/branding-config";
import type { TemplatePreset } from "../../schemas/template-config";
import type { BaseTemplate } from "../base-template";
import { EvidenceListTemplate } from "./evidence-list";
import { FullReportTemplate } from "./full-report";
import { SummaryTemplate } from "./summary";

/**
 * Create a template instance from a preset identifier
 */
export function createTemplateFromPreset(
	preset: TemplatePreset,
	branding?: Partial<BrandingConfig>
): BaseTemplate {
	switch (preset) {
		case "full-report":
			return new FullReportTemplate(branding);
		case "summary":
			return new SummaryTemplate(branding);
		case "evidence-list":
			return new EvidenceListTemplate(branding);
		default: {
			const exhaustiveCheck: never = preset;
			throw new Error(`Unknown preset: ${exhaustiveCheck}`);
		}
	}
}

/**
 * Get all available preset identifiers
 */
export function getAvailablePresets(): TemplatePreset[] {
	return ["full-report", "summary", "evidence-list"];
}
