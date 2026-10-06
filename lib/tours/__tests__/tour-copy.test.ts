import type { Step } from "nextstepjs";
import { describe, expect, it } from "vitest";
import { allTours, TOUR_IDS } from "../index";

const AMERICAN_SPELLINGS =
	/\b(organi[sz]e|visuali[sz]e|colou?r|center|customi[sz]e|reali[sz]e)/i;
const CONGRATULATIONS = /congratulations/i;
const FRAMEWORK_NAMES = /\b(SAFE-D|Reflect-Act-Justify|Turing|Alan Turing)\b/i;

function text(step: Step): string {
	return `${step.title} ${step.content}`;
}

describe("tour copy", () => {
	it("registers one tour per stored tour id", () => {
		expect(allTours.map((t) => t.tour)).toEqual([...TOUR_IDS]);
	});

	it("has at most eight steps per tour", () => {
		for (const tour of allTours) {
			expect(tour.steps.length).toBeLessThanOrEqual(8);
		}
	});

	it("uses no exclamation marks and no congratulations", () => {
		for (const step of allTours.flatMap((t) => t.steps)) {
			expect(text(step)).not.toContain("!");
			expect(text(step)).not.toMatch(CONGRATULATIONS);
		}
	});

	it("uses British spelling", () => {
		for (const step of allTours.flatMap((t) => t.steps)) {
			expect(text(step)).not.toMatch(AMERICAN_SPELLINGS);
		}
	});

	it("names no framework or partner", () => {
		for (const step of allTours.flatMap((t) => t.steps)) {
			expect(text(step)).not.toMatch(FRAMEWORK_NAMES);
		}
	});

	it("carries no icon field", () => {
		for (const step of allTours.flatMap((t) => t.steps)) {
			expect(step).not.toHaveProperty("icon");
		}
	});
});
