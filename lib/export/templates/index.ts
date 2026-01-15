/**
 * Template exports for the document export system.
 */

export type { TemplateInput } from "../types";
export { BaseTemplate } from "./base-template";
export {
	createTemplateFromPreset,
	EVIDENCE_LIST_CONFIG,
	EvidenceListTemplate,
	FULL_REPORT_CONFIG,
	FullReportTemplate,
	getAvailablePresets,
	SUMMARY_CONFIG,
	SummaryTemplate,
} from "./presets";
export {
	collectAllComments,
	collectElementsByType,
	countElementsByType,
	getTotalElementCount,
	getTreeDepth,
	type RenderedElement,
	renderElementAsBlocks,
	renderTreeAsBlocks,
	shouldIncludeElement,
	type TreeRenderOptions,
} from "./renderers";
