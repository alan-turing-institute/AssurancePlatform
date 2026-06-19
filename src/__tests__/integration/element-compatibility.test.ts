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
});
