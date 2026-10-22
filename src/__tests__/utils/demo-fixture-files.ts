import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { detectAndValidate } from "@/lib/schemas/version-detection";
import { flattenNestedToFlat } from "@/lib/transforms/nested-to-flat";
import {
	DEMO_CASE_ID,
	DEMO_FIXTURES,
	type DemoFixture,
} from "../../../prisma/seed/demo-account-seed";

/**
 * Case files for the demo-account seed tests, written to a temporary
 * directory and passed to the seed by absolute path: copies of the Bluebird
 * file under fresh element ids, and deliberately broken files.
 */

const FIXTURE_DIR = resolve(
	import.meta.dirname,
	"../../../prisma/seed/fixtures"
);
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

export interface TempFixture extends DemoFixture {
	elementIds: string[];
}

/** A new empty directory under the system temp directory. */
export function makeTempDir(): string {
	return mkdtempSync(join(tmpdir(), "demo-seed-fixtures-"));
}

/** The text of a file in `prisma/seed/fixtures/`. */
export function committedFixtureText(file: string): string {
	return readFileSync(join(FIXTURE_DIR, file), "utf-8");
}

/** The absolute path of a file in `prisma/seed/fixtures/`. */
export function committedFixturePath(file: string): string {
	return join(FIXTURE_DIR, file);
}

/** The listed fixtures other than Bluebird. */
export const SHOWCASE_FIXTURES = DEMO_FIXTURES.filter(
	(fixture) => fixture.caseId !== DEMO_CASE_ID
);

/**
 * The elements the import creates from a fixture's text, whether the text is a
 * nested tree or a flat element list.
 */
export function elementsIn(text: string) {
	const checked = detectAndValidate(JSON.parse(text));
	if (!checked.isValid) {
		throw new Error("the case file does not parse with the import schema");
	}
	const flat =
		checked.version === "nested"
			? flattenNestedToFlat(checked.data)
			: checked.data;
	return flat.elements;
}

/** The ids of the elements the import creates from a fixture's text, sorted. */
export function elementIdsIn(text: string): string[] {
	return elementsIn(text)
		.map((element) => element.id)
		.sort();
}

/** The case name inside a fixture's text. */
export function caseNameIn(text: string): string {
	return (JSON.parse(text) as { case: { name: string } }).case.name;
}

/**
 * The Bluebird file with every element id replaced by a new one, and the
 * case renamed to `name`.
 */
export function copyWithFreshIds(name: string): string {
	let text = committedFixtureText("bluebird-demo-case.json");
	for (const id of new Set(text.match(UUID))) {
		text = text.replaceAll(id, randomUUID());
	}
	const parsed = JSON.parse(text) as { case: { name: string } };
	parsed.case.name = name;
	return JSON.stringify(parsed, null, 2);
}

/** Writes `text` to `name` inside `dir` and returns the absolute path. */
export function writeText(dir: string, name: string, text: string): string {
	const path = join(dir, name);
	writeFileSync(path, text);
	return path;
}

/** A valid second case in `dir`: Bluebird's shape under fresh element ids and its own case id. */
export function writeShowcase(dir: string, name: string): TempFixture {
	const text = copyWithFreshIds(`Showcase ${name}`);
	return {
		file: writeText(dir, `${name}.json`, text),
		caseId: randomUUID(),
		elementIds: elementIdsIn(text),
	};
}

/** A path inside `dir` that is a directory, so reading it as a file fails. */
export function makeDirectoryNamed(dir: string, name: string): string {
	const path = join(dir, name);
	mkdirSync(path);
	return path;
}
