/**
 * Generates lib/schemas/json-schema-v1.0.json from CaseExportNestedSchema
 * (ADR 0004 D1 — the Zod schema is the single source of truth for the case
 * model; this file becomes a generated artifact, never hand-maintained).
 *
 * Run with: npx tsx scripts/generate-json-schema.ts
 * Also invoked by: pnpm schema:generate
 *
 * The drift test (lib/schemas/__tests__/json-schema-drift.test.ts) fails CI
 * if the committed file and a fresh run of this script disagree, so a
 * hand-edit or an un-regenerated Zod change is always caught.
 *
 * Target is draft-07, not Zod 4's own default (draft 2020-12), because the
 * JSON editor consumes this file through codemirror-json-schema ->
 * json-schema-library, which only ships draft-04/06/07 resolvers. Draft
 * 2020-12's $defs/prefixItems would still be valid JSON but would silently
 * break that consumer's $ref resolution, hover and completion.
 *
 * What does NOT survive the Zod -> JSON Schema conversion (documented here
 * because it is easy to rediscover as a bug): `.refine()` and `.transform()`
 * predicates have no JSON Schema equivalent and are dropped. Nothing in
 * CaseExportNestedSchema currently uses either, but lib/schemas more broadly
 * does (e.g. base.ts's trimming transforms) — if a refine/transform is ever
 * added to the case-export schemas, the shape it produces will still be
 * generated, but the extra check it enforces stays Zod-only and unenforced
 * by any JSON Schema consumer (including this editor). z.lazy recursion
 * (TreeNodeSchema) DOES survive, as a $ref into `definitions`.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CaseExportNestedSchema } from "../lib/schemas/case-export";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const BIOME_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "biome");

const OUTPUT_PATH = path.join(
	import.meta.dirname,
	"..",
	"lib",
	"schemas",
	"json-schema-v1.0.json"
);

const SCHEMA_ID = "https://tea-platform.org/schemas/case-export-v1.0.json";
const SCHEMA_TITLE = "TEA Platform Assurance Case Export Schema v1.0";

// zod's draft-07 generator names an extracted recursive definition
// `__schema0` — a positional placeholder; `.meta({ id })` on TreeNodeSchema
// does not rename it (verified by hand: the generator's "seen" map is keyed
// on the object z.lazy's getter resolves to, not the lazy wrapper the
// meta() call reaches). Renamed here to the human-readable "TreeNode" so
// the JSON Schema reads the way the Zod source does, and so the editor's
// hover/completion shows a real name.
const RECURSIVE_DEF_PLACEHOLDER_PATTERN = /__schema\d+/g;
const RECURSIVE_DEF_NAME = "TreeNode";

export function generateJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(CaseExportNestedSchema, {
		target: "draft-7",
	});

	const withStableDefName = JSON.parse(
		JSON.stringify(generated).replaceAll(
			RECURSIVE_DEF_PLACEHOLDER_PATTERN,
			RECURSIVE_DEF_NAME
		)
	);

	// $id/title are document-identity metadata, not derivable from a Zod
	// schema (Zod has no concept of "this document's canonical URI") — set
	// explicitly, ahead of the generated $schema/type/properties/etc.
	return {
		$schema: withStableDefName.$schema,
		$id: SCHEMA_ID,
		title: SCHEMA_TITLE,
		...withStableDefName,
	};
}

function main(): void {
	const schema = generateJsonSchema();
	const json = `${JSON.stringify(schema, null, 2)}\n`;
	writeFileSync(OUTPUT_PATH, json, "utf8");
	// `JSON.stringify` and the repo's Biome formatting rules disagree on how
	// to wrap short primitive arrays (e.g. `"required": [...]`) — format
	// through Biome itself so the committed file always passes `pnpm lint`
	// and never fights the drift test's byte-for-byte expectations.
	spawnSync(BIOME_BIN, ["format", "--write", OUTPUT_PATH], {
		cwd: REPO_ROOT,
	});
	console.log(`Wrote ${OUTPUT_PATH}`);
}

// ESM entry-point guard (no __dirname/require here — "module": "esnext" in
// tsconfig.json) — runs main() when invoked directly (tsx/pnpm) but not
// when json-schema-drift.test.ts imports generateJsonSchema().
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
