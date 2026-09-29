import { describe, expect, it } from "vitest";
import {
	canBeChildOf,
	getCompatibleChildTypes,
	getCompatibleParentTypes,
} from "@/lib/element-compatibility";

describe("element-compatibility", () => {
	describe("canBeChildOf", () => {
		it("allows strategy under goal", () => {
			expect(canBeChildOf("strategy", "goal")).toBe(true);
		});

		it("allows strategy under property_claim", () => {
			expect(canBeChildOf("strategy", "property_claim")).toBe(true);
		});

		it("allows property_claim under strategy", () => {
			expect(canBeChildOf("property_claim", "strategy")).toBe(true);
		});

		it("allows property_claim under property_claim", () => {
			expect(canBeChildOf("property_claim", "property_claim")).toBe(true);
		});

		it("allows evidence under property_claim", () => {
			expect(canBeChildOf("evidence", "property_claim")).toBe(true);
		});

		it("rejects strategy under strategy", () => {
			expect(canBeChildOf("strategy", "strategy")).toBe(false);
		});

		it("rejects strategy under evidence", () => {
			expect(canBeChildOf("strategy", "evidence")).toBe(false);
		});

		it("handles Prisma UPPERCASE types", () => {
			expect(canBeChildOf("STRATEGY", "PROPERTY_CLAIM")).toBe(true);
		});

		it("handles React Flow types", () => {
			expect(canBeChildOf("strategy", "property")).toBe(true);
		});
	});

	describe("getCompatibleChildTypes", () => {
		it("returns strategy, property_claim, and evidence for property_claim", () => {
			const children = getCompatibleChildTypes("property_claim");
			expect(children).toContain("strategy");
			expect(children).toContain("property_claim");
			expect(children).toContain("evidence");
		});

		it("returns property_claim for strategy", () => {
			const children = getCompatibleChildTypes("strategy");
			expect(children).toContain("property_claim");
			expect(children).not.toContain("strategy");
		});
	});

	describe("getCompatibleParentTypes", () => {
		it("returns goal and property_claim as valid parents for strategy", () => {
			const parents = getCompatibleParentTypes("strategy");
			expect(parents).toContain("goal");
			expect(parents).toContain("property_claim");
		});

		it("returns goal, strategy, and property_claim as valid parents for property_claim", () => {
			const parents = getCompatibleParentTypes("property_claim");
			expect(parents).toContain("goal");
			expect(parents).toContain("strategy");
			expect(parents).toContain("property_claim");
		});
	});

	describe("away_goal / module (ADR 0005 D3 — same parents as property_claim)", () => {
		it("allows away_goal and module under goal, strategy, and property_claim", () => {
			for (const parent of ["goal", "strategy", "property_claim"]) {
				expect(canBeChildOf("away_goal", parent)).toBe(true);
				expect(canBeChildOf("module", parent)).toBe(true);
			}
		});

		it("is terminal — nothing may be placed under an away_goal or a module", () => {
			expect(canBeChildOf("property_claim", "away_goal")).toBe(false);
			expect(canBeChildOf("property_claim", "module")).toBe(false);
			expect(getCompatibleChildTypes("away_goal")).toEqual([]);
			expect(getCompatibleChildTypes("module")).toEqual([]);
		});

		it("normalises React Flow's awayGoal node type to the canonical away_goal", () => {
			expect(canBeChildOf("awayGoal", "goal")).toBe(true);
		});
	});
});
