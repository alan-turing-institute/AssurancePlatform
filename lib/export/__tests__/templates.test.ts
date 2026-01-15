import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import {
	createTemplateFromPreset,
	FullReportTemplate,
	SummaryTemplate,
	EvidenceListTemplate,
	getAvailablePresets,
	FULL_REPORT_CONFIG,
} from "../templates";
import {
	collectElementsByType,
	countElementsByType,
	shouldIncludeElement,
	getTotalElementCount,
	getTreeDepth,
} from "../templates/renderers/tree-renderer";
import { validateTemplateConfig } from "../schemas";
import type { TemplateConfig } from "../schemas";

/**
 * Sample tree node for testing
 */
function createSampleTree(): TreeNode {
	return {
		id: "goal-1",
		type: "GOAL",
		name: "G1",
		description: "Top-level goal",
		inSandbox: false,
		children: [
			{
				id: "strategy-1",
				type: "STRATEGY",
				name: "S1",
				description: "Strategy for G1",
				inSandbox: false,
				children: [
					{
						id: "claim-1",
						type: "PROPERTY_CLAIM",
						name: "P1",
						description: "Property claim under S1",
						inSandbox: false,
						children: [
							{
								id: "evidence-1",
								type: "EVIDENCE",
								name: "E1",
								description: "Evidence supporting P1",
								url: "https://example.com/evidence1",
								inSandbox: false,
								children: [],
							},
						],
					},
					{
						id: "claim-2",
						type: "PROPERTY_CLAIM",
						name: "P2",
						description: "Another property claim",
						inSandbox: true, // Sandbox element
						children: [],
					},
				],
			},
		],
		comments: [
			{
				author: "testuser",
				content: "This is a test comment",
				createdAt: "2024-01-15T10:00:00Z",
			},
		],
	};
}

/**
 * Sample case export data for testing
 */
function createSampleCaseExport(): CaseExportNested {
	return {
		version: "1.0",
		exportedAt: "2024-01-15T10:00:00Z",
		case: {
			name: "Test Assurance Case",
			description: "A test case for unit testing",
		},
		tree: createSampleTree(),
	};
}

describe("Template System", () => {
	describe("Tree Renderer Utilities", () => {
		const tree = createSampleTree();

		describe("shouldIncludeElement", () => {
			it("should include non-sandbox elements by default", () => {
				expect(shouldIncludeElement(tree, 0, {})).toBe(true);
			});

			it("should exclude sandbox elements by default", () => {
				const sandboxNode = tree.children?.[0]?.children?.[1];
				expect(sandboxNode?.inSandbox).toBe(true);
				expect(shouldIncludeElement(sandboxNode!, 2, {})).toBe(false);
			});

			it("should include sandbox elements when includeSandbox is true", () => {
				const sandboxNode = tree.children?.[0]?.children?.[1];
				expect(
					shouldIncludeElement(sandboxNode!, 2, { includeSandbox: true })
				).toBe(true);
			});

			it("should respect maxDepth filter", () => {
				expect(shouldIncludeElement(tree, 0, { maxDepth: 1 })).toBe(true);
				expect(shouldIncludeElement(tree, 1, { maxDepth: 1 })).toBe(true);
				expect(shouldIncludeElement(tree, 2, { maxDepth: 1 })).toBe(false);
			});

			it("should respect includeTypes filter", () => {
				expect(
					shouldIncludeElement(tree, 0, { includeTypes: ["GOAL"] })
				).toBe(true);
				expect(
					shouldIncludeElement(tree, 0, { includeTypes: ["EVIDENCE"] })
				).toBe(false);
			});

			it("should respect excludeTypes filter", () => {
				expect(
					shouldIncludeElement(tree, 0, { excludeTypes: ["STRATEGY"] })
				).toBe(true);
				expect(
					shouldIncludeElement(tree, 0, { excludeTypes: ["GOAL"] })
				).toBe(false);
			});
		});

		describe("collectElementsByType", () => {
			it("should collect all GOAL elements", () => {
				const goals = collectElementsByType(tree, "GOAL");
				expect(goals).toHaveLength(1);
				expect(goals[0].node.name).toBe("G1");
			});

			it("should collect all PROPERTY_CLAIM elements", () => {
				const claims = collectElementsByType(tree, "PROPERTY_CLAIM", 0, {
					includeSandbox: true,
				});
				expect(claims).toHaveLength(2);
			});

			it("should exclude sandbox elements by default", () => {
				const claims = collectElementsByType(tree, "PROPERTY_CLAIM");
				expect(claims).toHaveLength(1);
				expect(claims[0].node.name).toBe("P1");
			});

			it("should include correct depth information", () => {
				const evidence = collectElementsByType(tree, "EVIDENCE");
				expect(evidence).toHaveLength(1);
				expect(evidence[0].depth).toBe(3);
			});
		});

		describe("countElementsByType", () => {
			it("should count elements correctly", () => {
				const counts = countElementsByType(tree);
				expect(counts.GOAL).toBe(1);
				expect(counts.STRATEGY).toBe(1);
				expect(counts.PROPERTY_CLAIM).toBe(1); // Excludes sandbox
				expect(counts.EVIDENCE).toBe(1);
			});

			it("should count sandbox elements when included", () => {
				const counts = countElementsByType(tree, { includeSandbox: true });
				expect(counts.PROPERTY_CLAIM).toBe(2);
			});
		});

		describe("getTotalElementCount", () => {
			it("should count total elements", () => {
				const total = getTotalElementCount(tree);
				expect(total).toBe(4); // goal, strategy, claim, evidence (excludes sandbox)
			});

			it("should include sandbox when specified", () => {
				const total = getTotalElementCount(tree, { includeSandbox: true });
				expect(total).toBe(5);
			});
		});

		describe("getTreeDepth", () => {
			it("should calculate correct tree depth", () => {
				const depth = getTreeDepth(tree);
				expect(depth).toBe(3); // goal(0) -> strategy(1) -> claim(2) -> evidence(3)
			});
		});
	});

	describe("Schema Validation", () => {
		describe("validateTemplateConfig", () => {
			it("should validate a minimal correct config", () => {
				const minimalConfig = {
					name: "Test Config",
					sections: {},
				};
				const result = validateTemplateConfig(minimalConfig);
				expect(result.success).toBe(true);
			});

			it("should validate a config with sections", () => {
				const configWithSections = {
					name: "Test Config",
					sections: {
						titlePage: { enabled: true },
						evidence: { enabled: true },
					},
				};
				const result = validateTemplateConfig(configWithSections);
				expect(result.success).toBe(true);
			});

			it("should reject config without name", () => {
				const invalidConfig = {
					sections: {},
				};
				const result = validateTemplateConfig(invalidConfig);
				expect(result.success).toBe(false);
			});

			it("should accept config with valid preset", () => {
				const config = {
					name: "Test",
					preset: "full-report",
					sections: {},
				};
				const result = validateTemplateConfig(config);
				expect(result.success).toBe(true);
			});

			it("should reject invalid preset", () => {
				const config = {
					name: "Test",
					preset: "invalid-preset",
					sections: {},
				};
				const result = validateTemplateConfig(config);
				expect(result.success).toBe(false);
			});
		});
	});

	describe("Template Presets", () => {
		describe("getAvailablePresets", () => {
			it("should return all available presets", () => {
				const presets = getAvailablePresets();
				expect(presets).toContain("full-report");
				expect(presets).toContain("summary");
				expect(presets).toContain("evidence-list");
				expect(presets).toHaveLength(3);
			});
		});

		describe("createTemplateFromPreset", () => {
			it("should create FullReportTemplate for full-report preset", () => {
				const template = createTemplateFromPreset("full-report");
				expect(template).toBeInstanceOf(FullReportTemplate);
				expect(template.name).toBe("Full Report");
			});

			it("should create SummaryTemplate for summary preset", () => {
				const template = createTemplateFromPreset("summary");
				expect(template).toBeInstanceOf(SummaryTemplate);
				expect(template.name).toBe("Summary");
			});

			it("should create EvidenceListTemplate for evidence-list preset", () => {
				const template = createTemplateFromPreset("evidence-list");
				expect(template).toBeInstanceOf(EvidenceListTemplate);
				expect(template.name).toBe("Evidence List");
			});

			it("should apply custom branding", () => {
				const template = createTemplateFromPreset("full-report", {
					organisationName: "Test Org",
					primaryColour: "#ff0000",
				});
				expect(template.brandingConfig.organisationName).toBe("Test Org");
				expect(template.brandingConfig.primaryColour).toBe("#ff0000");
			});
		});
	});

	describe("Template Rendering", () => {
		const caseData = createSampleCaseExport();

		describe("FullReportTemplate", () => {
			it("should render all sections", async () => {
				const template = new FullReportTemplate();
				const document = await template.render({ caseData });

				expect(document.metadata.caseName).toBe("Test Assurance Case");
				expect(document.sections.length).toBeGreaterThan(0);

				// Check for expected section types
				const sectionTypes = document.sections.map((s) => s.type);
				expect(sectionTypes).toContain("title-page");
				expect(sectionTypes).toContain("executive-summary");
			});

			it("should include metadata in document", async () => {
				const template = new FullReportTemplate();
				const document = await template.render({
					caseData,
					exportedBy: "testuser",
				});

				expect(document.metadata.exportedBy).toBe("testuser");
				expect(document.metadata.version).toBe("1.0");
				expect(document.metadata.elementCount).toBeGreaterThan(0);
			});

			it("should apply branding", async () => {
				const template = new FullReportTemplate({
					primaryColour: "#123456",
					organisationName: "Test Corp",
				});
				const document = await template.render({ caseData });

				expect(document.branding.primaryColour).toBe("#123456");
				expect(document.branding.organisationName).toBe("Test Corp");
			});
		});

		describe("SummaryTemplate", () => {
			it("should render fewer sections than full report", async () => {
				const fullTemplate = new FullReportTemplate();
				const summaryTemplate = new SummaryTemplate();

				const fullDoc = await fullTemplate.render({ caseData });
				const summaryDoc = await summaryTemplate.render({ caseData });

				expect(summaryDoc.sections.length).toBeLessThanOrEqual(
					fullDoc.sections.length
				);
			});

			it("should not include comments section", async () => {
				const template = new SummaryTemplate();
				const document = await template.render({ caseData });

				const sectionTypes = document.sections.map((s) => s.type);
				expect(sectionTypes).not.toContain("comments");
			});
		});

		describe("EvidenceListTemplate", () => {
			it("should focus on evidence section", async () => {
				const template = new EvidenceListTemplate();
				const document = await template.render({ caseData });

				const sectionTypes = document.sections.map((s) => s.type);
				expect(sectionTypes).toContain("evidence");
				expect(sectionTypes).toContain("title-page");
			});

			it("should not include diagram section", async () => {
				const template = new EvidenceListTemplate();
				const document = await template.render({ caseData });

				const sectionTypes = document.sections.map((s) => s.type);
				expect(sectionTypes).not.toContain("diagram");
			});
		});
	});
});
