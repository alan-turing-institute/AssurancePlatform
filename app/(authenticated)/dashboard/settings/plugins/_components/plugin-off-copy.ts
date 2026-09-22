import type { PluginOffConsequenceNumbers } from "@/hooks/use-plugin-consequences";

const HEALTH_PLUGIN_ID = "tea.health";

export interface PluginOffCopyInput {
	/** `null` while the consequence read is loading, or after it failed — both cases drop the two number-dependent lines, never the switch itself (D3). */
	consequences: PluginOffConsequenceNumbers | null;
	pluginId: string;
	pluginName: string;
}

export interface PluginOffCopy {
	/** Always shown, last — never depends on live numbers. */
	closingLine: string;
	/** Always shown, first — never depends on live numbers. */
	introLine: string;
	title: string;
	/** Zero, one or two lines built from `consequences`; empty while loading or on a failed read. */
	variableLines: string[];
}

function pluralise(word: string, count: number): string {
	return count === 1 ? word : `${word}s`;
}

/**
 * Builds the off-switch confirmation dialog's copy (TEA — Plugin management
 * surface D3, wording corrected by the 2026-09-22 design amendment: a user's
 * own switch never makes an integration's writes fail, so the integration
 * line says the write keeps happening, not that it will be refused).
 *
 * `introLine` and `closingLine` are general statements that hold regardless
 * of the live numbers, so they render even while those numbers are loading
 * or failed to load — only `variableLines` (evidence/case counts, active
 * integrations) depends on `consequences` being present.
 */
export function buildPluginOffCopy({
	consequences,
	pluginId,
	pluginName,
}: PluginOffCopyInput): PluginOffCopy {
	const title = `Turn off ${pluginName} for your account?`;

	const introLine =
		pluginId === HEALTH_PLUGIN_ID
			? "Health badges and the Evidence tab will disappear for you."
			: "Its additions to the case builder will disappear for you.";

	const closingLine = "Other collaborators are not affected.";

	const variableLines: string[] = [];

	if (consequences && consequences.evidenceRecordCount > 0) {
		const { evidenceRecordCount, caseCount } = consequences;
		const stayVerb = evidenceRecordCount === 1 ? "stays" : "stay";
		const isVerb = evidenceRecordCount === 1 ? "is" : "are";
		// "N of your cases" is a partitive phrase — "cases" stays plural
		// regardless of N, the same way "1 of your friends" never becomes
		// "1 of your friend". Only the evidence-record noun pluralises.
		variableLines.push(
			`The ${evidenceRecordCount} evidence ${pluralise("record", evidenceRecordCount)} on ${caseCount} of your cases ${stayVerb} stored and ${isVerb} never deleted.`
		);
	}

	if (consequences && consequences.activeIntegrations.length > 0) {
		const { activeIntegrations } = consequences;
		const count = activeIntegrations.length;
		const names = activeIntegrations
			.map((integration) => integration.name)
			.join(", ");
		const writeVerb = count === 1 ? "writes" : "write";
		const pronoun = count === 1 ? "it" : "they";
		variableLines.push(
			`${count} ${pluralise("integration", count)} (${names}) currently ${writeVerb} evidence to your cases; ${pronoun} will keep doing so, and you will see what was written when you turn the plugin back on.`
		);
	}

	return { title, introLine, closingLine, variableLines };
}
