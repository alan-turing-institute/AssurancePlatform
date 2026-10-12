import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { describe, expect, it, vi } from "vitest";
import { guardedFetch } from "@/lib/models/guarded-fetch";
import { createAssistantModel } from "@/lib/plugins/assistant/model";

vi.mock("@ai-sdk/anthropic", () => ({
	createAnthropic: vi.fn(() => vi.fn(() => ({ provider: "anthropic" }))),
}));
vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: vi.fn(() => ({
		chatModel: vi.fn(() => ({ provider: "openai-compatible" })),
	})),
}));

describe("createAssistantModel", () => {
	it("sends Anthropic requests through the guarded fetch", () => {
		createAssistantModel({
			provider: "anthropic",
			apiKey: "k",
			model: "claude-test",
		});

		expect(createAnthropic).toHaveBeenCalledWith(
			expect.objectContaining({ apiKey: "k", fetch: guardedFetch })
		);
	});

	it("sends OpenAI-compatible requests through the guarded fetch", () => {
		createAssistantModel({
			provider: "openai-compatible",
			apiKey: "k",
			baseUrl: "https://models.example.test/v1",
			model: "m",
		});

		expect(createOpenAICompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://models.example.test/v1",
				fetch: guardedFetch,
			})
		);
	});
});
