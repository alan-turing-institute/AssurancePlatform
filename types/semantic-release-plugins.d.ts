/**
 * Ambient shims for the two semantic-release plugins the release notes test
 * calls directly. Neither package ships its own type declarations.
 */
declare module "@semantic-release/commit-analyzer" {
	export function analyzeCommits(
		pluginConfig: Record<string, unknown>,
		context: Record<string, unknown>
	): Promise<string | false>;
}

declare module "@semantic-release/release-notes-generator" {
	export function generateNotes(
		pluginConfig: Record<string, unknown>,
		context: Record<string, unknown>
	): Promise<string>;
}
