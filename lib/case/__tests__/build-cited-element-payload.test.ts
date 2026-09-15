import { describe, expect, it } from "vitest";
import { buildCitedElementPayload } from "../build-cited-element-payload";

describe("buildCitedElementPayload (ADR 0005 D7)", () => {
	it("builds an away-goal payload with citedElementId, no moduleEmbedType", () => {
		const payload = buildCitedElementPayload({
			kind: "away-goal",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "cited-case-1",
			citedElementId: "cited-goal-1",
			name: "",
			description: "Cites a goal in another case",
		});

		expect(payload).toMatchObject({
			description: "Cites a goal in another case",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "cited-case-1",
			citedElementId: "cited-goal-1",
		});
		expect(payload).not.toHaveProperty("moduleEmbedType");
	});

	it("builds a module payload with moduleEmbedType defaulting to COPY, no citedElementId", () => {
		const payload = buildCitedElementPayload({
			kind: "module",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "referenced-case-1",
			name: "",
			description: "References another case",
		});

		expect(payload).toMatchObject({
			description: "References another case",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "referenced-case-1",
			moduleEmbedType: "COPY",
		});
		expect(payload).not.toHaveProperty("citedElementId");
	});

	it("trims a blank/whitespace name to undefined so the server auto-generates the identifier", () => {
		const payload = buildCitedElementPayload({
			kind: "module",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "referenced-case-1",
			name: "   ",
			description: "",
		});

		expect(payload.name).toBeUndefined();
	});

	it("keeps an explicit, trimmed name override", () => {
		const payload = buildCitedElementPayload({
			kind: "away-goal",
			parentId: "goal-1",
			assuranceCaseId: "case-1",
			moduleReferenceId: "cited-case-1",
			citedElementId: "cited-goal-1",
			name: "  AG2  ",
			description: "",
		});

		expect(payload.name).toBe("AG2");
	});
});
