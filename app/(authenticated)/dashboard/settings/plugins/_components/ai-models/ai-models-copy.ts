import type {
	ModelConnectionType,
	ModelJob,
} from "@/lib/models/connection-types";

/** The names and hints the AI models block shows, kept apart from the components that lay them out. */

export const CONNECTION_TYPE_LABELS: Record<ModelConnectionType, string> = {
	OPENROUTER: "OpenRouter",
	OLLAMA: "Ollama",
	OPENAI_COMPATIBLE: "OpenAI-compatible",
	ANTHROPIC: "Anthropic",
	OPENAI: "OpenAI",
};

export const CONNECTION_TYPE_HINTS: Record<ModelConnectionType, string> = {
	OPENROUTER: "One key reaches many hosted models.",
	OLLAMA: "A model server you run yourself.",
	OPENAI_COMPATIBLE: "Any server that follows the OpenAI API, such as vLLM.",
	ANTHROPIC: "Claude models, for chat only.",
	OPENAI: "OpenAI's own models, for chat only.",
};

/** What an edit can change, which differs by type: only some types have an address or an optional key. */
export const EDIT_HINTS: Record<ModelConnectionType, string> = {
	OPENROUTER: "Change the label, or replace the key.",
	ANTHROPIC: "Change the label, or replace the key.",
	OPENAI: "Change the label, or replace the key.",
	OLLAMA: "Change the label or address, or replace or remove the key.",
	OPENAI_COMPATIBLE:
		"Change the label or address, or replace or remove the key.",
};

export const ADDRESS_HINTS: Partial<Record<ModelConnectionType, string>> = {
	OLLAMA: "The address of the Ollama server, with no path after it.",
	OPENAI_COMPATIBLE:
		"The address of the server, up to and including /v1 where it has one.",
};

export const ADDRESS_PLACEHOLDERS: Partial<
	Record<ModelConnectionType, string>
> = {
	OLLAMA: "https://ollama.example.com",
	OPENAI_COMPATIBLE: "https://models.example.com/v1",
};

export const JOB_COPY: Record<
	ModelJob,
	{ hint: string; off: string | null; title: string }
> = {
	chat: {
		title: "Chat",
		hint: "The model the assistant talks to you with.",
		off: null,
	},
	ranking: {
		title: "Ranking",
		hint: "Puts the techniques the search finds in order, best first.",
		off: "Techniques stay in the order the search found them.",
	},
	search: {
		title: "Search",
		hint: "Lets the assistant find techniques by meaning, not only by keyword.",
		off: "Techniques are found by keyword only.",
	},
};

/** An Ollama model name may end in ":latest" where the recommended name does not. */
const LATEST_TAG = /:latest$/;

function withoutLatestTag(name: string): string {
	return name.trim().replace(LATEST_TAG, "");
}

/** Whether `name` is the recommended model, ignoring an Ollama ":latest" tag on either. */
export function isRecommendedModel(
	name: string,
	recommended: string | null
): boolean {
	return (
		recommended !== null &&
		withoutLatestTag(name) === withoutLatestTag(recommended)
	);
}

/**
 * The models to offer in a picker: the recommended one first (added when the
 * connection's own list lacks it), then the connection's list in its order,
 * without repeats.
 */
export function modelOptions(
	listed: readonly string[],
	recommended: string | null
): string[] {
	const options: string[] = [];
	const seen = new Set<string>();
	const add = (name: string) => {
		const key = withoutLatestTag(name);
		if (!seen.has(key)) {
			seen.add(key);
			options.push(name);
		}
	};
	if (recommended) {
		const own = listed.find((name) => isRecommendedModel(name, recommended));
		add(own ?? recommended);
	}
	for (const name of listed) {
		add(name);
	}
	return options;
}
