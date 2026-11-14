import { describe, expect, it } from "vitest";
import {
	CONNECTION_TYPES,
	connectionTypeCanDo,
	isModelConnectionType,
	MODEL_CONNECTION_TYPES,
	MODEL_JOBS,
} from "../connection-types";
import { RECOMMENDED_MODELS, recommendedModel } from "../recommended";

describe("the OpenAI connection type", () => {
	it("has OpenAI's own address, needs a key and does chat only", () => {
		expect(CONNECTION_TYPES.OPENAI).toEqual({
			jobs: ["chat"],
			baseUrl: "https://api.openai.com/v1",
			keyRequired: true,
		});
		expect(connectionTypeCanDo("OPENAI", "chat")).toBe(true);
		expect(connectionTypeCanDo("OPENAI", "ranking")).toBe(false);
		expect(connectionTypeCanDo("OPENAI", "search")).toBe(false);
	});

	it("is added after the four existing types, which keep their order and their first place", () => {
		expect([...MODEL_CONNECTION_TYPES]).toEqual([
			"OPENROUTER",
			"OLLAMA",
			"OPENAI_COMPATIBLE",
			"ANTHROPIC",
			"OPENAI",
		]);
		expect(isModelConnectionType("OPENAI")).toBe(true);
		expect(isModelConnectionType("openai")).toBe(false);
		expect(isModelConnectionType("OPENAI ")).toBe(false);
	});

	it("leaves the other four types as they were", () => {
		expect(CONNECTION_TYPES.OPENROUTER).toEqual({
			jobs: ["chat", "ranking", "search"],
			baseUrl: "https://openrouter.ai",
			keyRequired: true,
		});
		expect(CONNECTION_TYPES.OLLAMA).toEqual({
			jobs: ["chat", "ranking", "search"],
			baseUrl: null,
			keyRequired: false,
		});
		expect(CONNECTION_TYPES.OPENAI_COMPATIBLE).toEqual({
			jobs: ["chat", "search"],
			baseUrl: null,
			keyRequired: false,
		});
		expect(CONNECTION_TYPES.ANTHROPIC).toEqual({
			jobs: ["chat"],
			baseUrl: "https://api.anthropic.com",
			keyRequired: true,
		});
	});

	it("recommends no model for any job", () => {
		for (const job of MODEL_JOBS) {
			expect(recommendedModel("OPENAI", job)).toBeNull();
		}
		expect(RECOMMENDED_MODELS.OPENAI).toEqual({
			chat: null,
			ranking: null,
			search: null,
		});
	});
});
