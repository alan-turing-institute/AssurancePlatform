import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { AssistantProviderConfig } from "@/lib/plugins/assistant/provider-config";

/** Builds the AI SDK model for a resolved provider config. Kept apart from the route so tests can substitute a mock model. */
export function createAssistantModel(
	config: AssistantProviderConfig
): LanguageModel {
	if (config.provider === "anthropic") {
		return createAnthropic({ apiKey: config.apiKey })(config.model);
	}
	return createOpenAICompatible({
		name: "assistant",
		baseURL: config.baseUrl ?? "",
		apiKey: config.apiKey,
	}).chatModel(config.model);
}
