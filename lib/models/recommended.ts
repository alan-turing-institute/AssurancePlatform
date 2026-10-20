import type {
	ModelConnectionType,
	ModelJob,
} from "@/lib/models/connection-types";

/**
 * The model to suggest for each job on each connection type. Plain data with no
 * server imports, so screens can read it. A null entry means the type has no
 * recommendation for that job, either because it cannot do the job or because
 * the right model depends on what the user has installed; a screen then marks
 * nothing in that picker.
 */
export const RECOMMENDED_MODELS: Readonly<
	Record<ModelConnectionType, Readonly<Record<ModelJob, string | null>>>
> = {
	OPENROUTER: {
		chat: "anthropic/claude-sonnet-5.5",
		ranking: "cloudflare/clef-flash",
		search: "qwen/qwen3-embedding-4b",
	},
	OLLAMA: {
		chat: null,
		ranking: "clef-flash",
		search: "qwen3-embedding:4b-fp16",
	},
	OPENAI_COMPATIBLE: { chat: null, ranking: null, search: null },
	ANTHROPIC: { chat: null, ranking: null, search: null },
	OPENAI: { chat: null, ranking: null, search: null },
};

/** The recommended model for `job` on a connection of `type`, or null when there is none. */
export function recommendedModel(
	type: ModelConnectionType,
	job: ModelJob
): string | null {
	return RECOMMENDED_MODELS[type][job];
}
