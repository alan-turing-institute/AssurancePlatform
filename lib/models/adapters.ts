import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, LanguageModel } from "ai";
import {
	connectionTypeCanDo,
	type ModelConnectionAccess,
	type ModelJob,
} from "@/lib/models/connection-types";
import { guardedFetch } from "@/lib/models/guarded-fetch";

/**
 * The AI SDK models for a stored connection. Every request they make goes
 * through the guarded fetch, so the address checks, the redirect refusal and
 * the size and time limits apply to chat and embedding calls alike.
 */

const TRAILING_SLASHES = /\/+$/;
const UNDERSCORES = /_/g;

function requireJob(connection: ModelConnectionAccess, job: ModelJob): void {
	if (!connectionTypeCanDo(connection.type, job)) {
		throw new Error(`A ${connection.type} connection cannot do the ${job} job`);
	}
}

function withoutTrailingSlashes(address: string): string {
	return address.replace(TRAILING_SLASHES, "");
}

/** The address of the connection's OpenAI-style API: OpenRouter and Ollama keep it under a fixed path, other servers at the address as entered. */
function openAiStyleBaseUrl(connection: ModelConnectionAccess): string {
	const base = withoutTrailingSlashes(connection.baseUrl);
	switch (connection.type) {
		case "OPENROUTER":
			return `${base}/api/v1`;
		case "OLLAMA":
			return `${base}/v1`;
		default:
			return base;
	}
}

function openAiStyleProvider(connection: ModelConnectionAccess) {
	return createOpenAICompatible({
		// Names the provider in the SDK's metadata and keys its provider options.
		name: connection.type.toLowerCase().replace(UNDERSCORES, "-"),
		baseURL: openAiStyleBaseUrl(connection),
		apiKey: connection.apiKey || undefined,
		fetch: guardedFetch,
	});
}

/**
 * The model for the chat job. Throws when the connection's type cannot chat,
 * and for an Anthropic connection without a key, because the SDK would then
 * fall back to a key in the server's own environment.
 */
export function chatModelFor(
	connection: ModelConnectionAccess,
	model: string
): LanguageModel {
	requireJob(connection, "chat");
	if (connection.type === "ANTHROPIC") {
		if (!connection.apiKey) {
			throw new Error("An ANTHROPIC connection needs a key to chat");
		}
		return createAnthropic({
			baseURL: `${withoutTrailingSlashes(connection.baseUrl)}/v1`,
			apiKey: connection.apiKey,
			fetch: guardedFetch,
		})(model);
	}
	return openAiStyleProvider(connection).chatModel(model);
}

/** The model for the search job. Throws when the connection's type cannot embed. */
export function embeddingModelFor(
	connection: ModelConnectionAccess,
	model: string
): EmbeddingModel {
	requireJob(connection, "search");
	return openAiStyleProvider(connection).embeddingModel(model);
}
