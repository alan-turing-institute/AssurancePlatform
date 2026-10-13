import { describe, expect, it } from "vitest";
import { MODEL_CONNECTION_TYPES } from "@/lib/models/connection-types";
import {
	EDIT_HINTS,
	isRecommendedModel,
	modelOptions,
} from "../ai-models-copy";

describe("isRecommendedModel", () => {
	it("matches the recommended name exactly, and ignoring a :latest tag on either side", () => {
		expect(isRecommendedModel("clef-flash", "clef-flash")).toBe(true);
		expect(isRecommendedModel("clef-flash:latest", "clef-flash")).toBe(true);
		expect(isRecommendedModel("clef-flash", "clef-flash:latest")).toBe(true);
	});

	it("does not match another name, another tag, or a job with no recommendation", () => {
		expect(isRecommendedModel("clef-flash-2", "clef-flash")).toBe(false);
		expect(isRecommendedModel("clef-flash:7b", "clef-flash")).toBe(false);
		expect(isRecommendedModel("clef-flash", null)).toBe(false);
	});
});

describe("modelOptions", () => {
	it("puts the recommended model first, using the connection's own spelling of it", () => {
		expect(
			modelOptions(["llama3", "clef-flash:latest", "qwen"], "clef-flash")
		).toEqual(["clef-flash:latest", "llama3", "qwen"]);
	});

	it("adds the recommended model when the connection does not list it, without repeats", () => {
		expect(modelOptions(["a", "a", "b"], "z")).toEqual(["z", "a", "b"]);
	});

	it("keeps the connection's order when nothing is recommended", () => {
		expect(modelOptions(["b", "a"], null)).toEqual(["b", "a"]);
	});
});

describe("EDIT_HINTS", () => {
	it("mentions an address only for the types that have one, and removing the key only where it may be removed", () => {
		for (const type of MODEL_CONNECTION_TYPES) {
			const hint = EDIT_HINTS[type];
			const hasAddress = type === "OLLAMA" || type === "OPENAI_COMPATIBLE";
			expect(hint.includes("address")).toBe(hasAddress);
			expect(hint.includes("remove the key")).toBe(hasAddress);
		}
	});
});
