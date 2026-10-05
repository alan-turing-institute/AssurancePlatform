import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allTours } from "../index";

const SOURCE_FILE = /\.(ts|tsx)$/;
const ROOT = join(import.meta.dirname, "..", "..", "..");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			return entry === "__tests__" ? [] : sourceFiles(path);
		}
		return SOURCE_FILE.test(entry) ? [path] : [];
	});
}

const SOURCE = [
	...sourceFiles(join(ROOT, "components")),
	join(ROOT, "config", "index.ts"),
]
	.map((file) => readFileSync(file, "utf8"))
	.join("\n");

const SELECTOR_ID = /\[data-tour='([^']+)'\]/;

describe("tour anchors", () => {
	const targets = allTours.flatMap((tour) =>
		tour.steps.flatMap((step) => {
			const id = step.selector?.match(SELECTOR_ID)?.[1];
			return id ? [{ tour: tour.tour, id }] : [];
		})
	);

	it("has targets to check", () => {
		expect(targets.length).toBeGreaterThan(0);
	});

	it.each(targets)("$tour step target $id exists in the components", ({
		id,
	}) => {
		const literal = new RegExp(`["'\`]${id}["'\`]`);
		expect(SOURCE).toMatch(literal);
	});
});
