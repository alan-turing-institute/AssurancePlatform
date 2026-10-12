import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { guardedFetch } from "@/lib/models/guarded-fetch";
import type { AssistantProviderConfig } from "@/lib/plugins/assistant/provider-config";

/**
 * Builds the AI SDK model for a resolved provider config. Kept apart from the
 * route so tests can substitute a mock model. Both providers send their
 * requests through the guarded fetch, which refuses private addresses, plain
 * http (unless the operator listed the origin), redirects and oversized
 * responses.
 */
export function createAssistantModel(
	config: AssistantProviderConfig
): LanguageModel {
	if (config.provider === "anthropic") {
		return createAnthropic({ apiKey: config.apiKey, fetch: guardedFetch })(
			config.model
		);
	}
	return createOpenAICompatible({
		name: "assistant",
		baseURL: config.baseUrl ?? "",
		apiKey: config.apiKey,
		fetch: guardedFetch,
	}).chatModel(config.model);
}
