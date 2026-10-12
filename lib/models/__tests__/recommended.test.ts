import { describe, expect, it } from "vitest";
import {
	CONNECTION_TYPES,
	connectionTypeCanDo,
	MODEL_JOBS,
	type ModelConnectionType,
} from "../connection-types";
import { RECOMMENDED_MODELS, recommendedModel } from "../recommended";

const TYPES = Object.keys(CONNECTION_TYPES) as ModelConnectionType[];

describe("recommendedModel", () => {
	it("recommends Clef-Flash for ranking on OpenRouter and on Ollama", () => {
		expect(recommendedModel("OPENROUTER", "ranking")).toBe(
			"cloudflare/clef-flash"
		);
		expect(recommendedModel("OLLAMA", "ranking")).toBe("clef-flash");
	});

	it("recommends nothing yet for chat or search", () => {
		for (const type of TYPES) {
			expect(recommendedModel(type, "chat")).toBeNull();
			expect(recommendedModel(type, "search")).toBeNull();
		}
	});

	it("recommends nothing for ranking on a type that cannot rank", () => {
		expect(recommendedModel("OPENAI_COMPATIBLE", "ranking")).toBeNull();
		expect(recommendedModel("ANTHROPIC", "ranking")).toBeNull();
	});

	it("has an entry for every type and job, and only recommends a job the type can do", () => {
		for (const type of TYPES) {
			for (const job of MODEL_JOBS) {
				expect(RECOMMENDED_MODELS[type]).toHaveProperty(job);
				if (!connectionTypeCanDo(type, job)) {
					expect(recommendedModel(type, job)).toBeNull();
				}
			}
		}
	});
});
