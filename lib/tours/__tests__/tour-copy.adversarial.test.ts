import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allTours, getTour, TOUR_IDS } from "../index.ts";

const TS_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\./;
const SELECTOR = /^\[data-tour='([^']+)'\]$/;

const ROOT = path.resolve(import.meta.dirname, "../../..");
const AMERICAN = [
	"color",
	"organize",
	"organization",
	"customize",
	"analyze",
	"behavior",
	"center",
	"favorite",
	"recognize",
	"license ",
	"canceled",
];

function sourceFiles(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === "__tests__" || name === "node_modules") {
			continue;
		}
		const full = path.join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...sourceFiles(full));
		} else if (TS_FILE.test(name) && !TEST_FILE.test(name)) {
			out.push(full);
		}
	}
	return out;
}

describe("tour registry and copy (adversarial)", () => {
	it("registers exactly the three ids, each resolvable and matching its tour", () => {
		expect([...TOUR_IDS].sort()).toEqual([
			"case-canvas",
			"dashboard",
			"demo-case",
		]);
		expect(allTours.map((t) => t.tour).sort()).toEqual([...TOUR_IDS].sort());
		for (const id of TOUR_IDS) {
			expect(getTour(id)?.tour).toBe(id);
		}
		expect(getTour("nonexistent")).toBeUndefined();
	});

	it.each(
		allTours.map((t) => [t.tour, t] as const)
	)("%s has at most 8 steps and house-style copy", (_id, tour) => {
		expect(tour.steps.length).toBeGreaterThan(0);
		expect(tour.steps.length).toBeLessThanOrEqual(8);
		for (const s of tour.steps) {
			const text = `${s.title} ${s.content}`;
			expect(s.icon).toBeUndefined();
			expect(text).not.toContain("!");
			expect(text.toLowerCase()).not.toContain("congratulations");
			for (const word of AMERICAN) {
				expect(text.toLowerCase()).not.toContain(word);
			}
			expect(s.title).toBeTruthy();
			expect(String(s.content).length).toBeGreaterThan(0);
		}
	});

	it("every targeted selector resolves to a data-tour literal in the components or config", () => {
		const files = [
			...sourceFiles(path.join(ROOT, "components")),
			...sourceFiles(path.join(ROOT, "app")),
			path.join(ROOT, "config/index.ts"),
		];
		const corpus = files.map((f) => readFileSync(f, "utf8")).join("\n");

		for (const tour of allTours) {
			for (const s of tour.steps) {
				if (!s.selector) {
					continue;
				}
				const match = SELECTOR.exec(s.selector);
				expect(match, `${tour.tour}: ${s.selector}`).not.toBeNull();
				const id = (match as RegExpExecArray)[1];
				expect(
					new RegExp(`["'\`]${id}["'\`]`).test(corpus),
					`${tour.tour}: no anchor literal for ${id}`
				).toBe(true);
			}
		}
	});
});
