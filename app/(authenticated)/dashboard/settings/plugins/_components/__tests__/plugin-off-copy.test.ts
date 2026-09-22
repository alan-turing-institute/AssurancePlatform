import { describe, expect, it } from "vitest";
import { buildPluginOffCopy } from "../plugin-off-copy";

const INTEGRATION_REGEX = /integration/;

describe("buildPluginOffCopy", () => {
	it("builds the title, health-plugin intro line and closing line with no consequences data", () => {
		const copy = buildPluginOffCopy({
			consequences: null,
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.title).toBe("Turn off Claim/Evidence Health for your account?");
		expect(copy.introLine).toBe(
			"Health badges and the Evidence tab will disappear for you."
		);
		expect(copy.closingLine).toBe("Other collaborators are not affected.");
		expect(copy.variableLines).toEqual([]);
	});

	it("uses the generic case-builder intro line for a non-health plugin", () => {
		const copy = buildPluginOffCopy({
			consequences: null,
			pluginId: "tea.techniques",
			pluginName: "Techniques",
		});

		expect(copy.introLine).toBe(
			"Its additions to the case builder will disappear for you."
		);
	});

	it("pluralises the evidence line for plural counts", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 212,
				caseCount: 3,
				activeIntegrations: [],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines).toEqual([
			"The 212 evidence records on 3 of your cases stay stored and are never deleted.",
		]);
	});

	it("uses singular grammar for the evidence record noun, but keeps 'cases' plural (a partitive phrase, not a count) at 1 record on 1 case", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 1,
				caseCount: 1,
				activeIntegrations: [],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines).toEqual([
			"The 1 evidence record on 1 of your cases stays stored and is never deleted.",
		]);
	});

	it("omits the evidence line entirely when evidenceRecordCount is 0", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 0,
				caseCount: 0,
				activeIntegrations: [],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines).toEqual([]);
	});

	it("adds the integration line, pluralised, when active integrations are present", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 2,
				caseCount: 1,
				activeIntegrations: [
					{ id: "int-1", name: "DARTER pipeline" },
					{ id: "int-2", name: "Sourcery" },
				],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines).toEqual([
			"The 2 evidence records on 1 of your cases stay stored and are never deleted.",
			"2 integrations (DARTER pipeline, Sourcery) currently write evidence to your cases; they will keep doing so, and you will see what was written when you turn the plugin back on.",
		]);
	});

	it("uses singular grammar for exactly one active integration", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 2,
				caseCount: 1,
				activeIntegrations: [{ id: "int-1", name: "DARTER pipeline" }],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines[1]).toBe(
			"1 integration (DARTER pipeline) currently writes evidence to your cases; it will keep doing so, and you will see what was written when you turn the plugin back on."
		);
	});

	it("omits the integration line entirely when there are none active", () => {
		const copy = buildPluginOffCopy({
			consequences: {
				evidenceRecordCount: 2,
				caseCount: 1,
				activeIntegrations: [],
			},
			pluginId: "tea.health",
			pluginName: "Claim/Evidence Health",
		});

		expect(copy.variableLines).toHaveLength(1);
		expect(copy.variableLines[0]).not.toMatch(INTEGRATION_REGEX);
	});
});
