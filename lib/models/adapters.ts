import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModel, JSONValue, LanguageModel } from "ai";
import {
	connectionTypeCanDo,
	type ModelConnectionAccess,
	type ModelJob,
} from "@/lib/models/connection-types";
import { guardedFetch } from "@/lib/models/guarded-fetch";

/**
 * The AI SDK models for a stored connection. Every request they make goes
 * through the guarded fetch, so the address checks, the redirect refusal and
 * the size and time limits apply to chat and embedding calls alike. A chat
 * reply is cut off past 4 MiB and an embeddings answer past 2 MiB, well under
 * the guard's own default.
 */

const TRAILING_SLASHES = /\/+$/;
const UNDERSCORES = /_/g;

/** The most bytes a chat reply may stream back, tool calls and all. */
const CHAT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
/** The most bytes an embeddings answer may hold. */
export const EMBEDDING_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * The most tokens OpenRouter lets a model spend reasoning before it answers.
 * Some models reason until the reply's whole token cap is used and then stop
 * with no answer at all, so the bound leaves most of the cap for the answer.
 */
const OPENROUTER_REASONING_MAX_TOKENS = 3072;

/** The guarded fetch with a cap on the response body that suits the job. */
function guardedFetchCappedAt(maxBytes: number) {
	return (input: RequestInfo | URL, init?: RequestInit) =>
		guardedFetch(input, init, { maxBytes });
}

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

/**
 * Sends a chat request's reply length limit in the field OpenAI requires. The
 * SDK writes it as `max_tokens`, which OpenAI's reasoning models refuse and its
 * other chat models still accept as `max_completion_tokens`. A body with no
 * limit is returned as it came.
 */
function withCompletionTokenLimit(
	body: Record<string, unknown>
): Record<string, unknown> {
	if (!("max_tokens" in body)) {
		return body;
	}
	const { max_tokens: limit, ...rest } = body;
	return { ...rest, max_completion_tokens: limit };
}

function openAiStyleProvider(
	connection: ModelConnectionAccess,
	maxResponseBytes: number
) {
	return createOpenAICompatible({
		// Names the provider in the SDK's metadata and keys its provider options.
		name: connection.type.toLowerCase().replace(UNDERSCORES, "-"),
		baseURL: openAiStyleBaseUrl(connection),
		apiKey: connection.apiKey || undefined,
		fetch: guardedFetchCappedAt(maxResponseBytes),
		// Applies to chat requests only; the SDK does not pass it to embeddings.
		transformRequestBody:
			connection.type === "OPENAI" ? withCompletionTokenLimit : undefined,
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
			fetch: guardedFetchCappedAt(CHAT_MAX_RESPONSE_BYTES),
		})(model);
	}
	return openAiStyleProvider(connection, CHAT_MAX_RESPONSE_BYTES).chatModel(
		model
	);
}

/** The model for the search job. Throws when the connection's type cannot embed. */
export function embeddingModelFor(
	connection: ModelConnectionAccess,
	model: string
): EmbeddingModel {
	requireJob(connection, "search");
	return openAiStyleProvider(
		connection,
		EMBEDDING_MAX_RESPONSE_BYTES
	).embeddingModel(model);
}

/**
 * Provider options to pass with each chat request on this connection, or
 * undefined when there are none. OpenRouter is asked to bound the reasoning of
 * models that reason. Other servers get nothing, since they may refuse a
 * parameter they do not know; Anthropic's extended thinking is off unless it
 * is asked for, so there is nothing to bound there.
 */
export function chatProviderOptions(
	connection: ModelConnectionAccess
): Record<string, Record<string, JSONValue>> | undefined {
	if (connection.type !== "OPENROUTER") {
		return undefined;
	}
	return {
		openrouter: { reasoning: { max_tokens: OPENROUTER_REASONING_MAX_TOKENS } },
	};
}
