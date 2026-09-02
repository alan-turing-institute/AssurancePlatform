import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Permanent, non-mutating proof that lint-rules/no-bare-zod-object.grit
 * actually fires, wired through the biome.json override scoped to
 * lib/schemas/** (TEA — Mutation-schema hardening, QA gap #5). Runs the
 * repo's own Biome binary against a throwaway probe file written under
 * lib/schemas/__tests__/ (so the override's includes glob covers it) and
 * deleted in a finally block — nothing is left behind on disk or in git.
 *
 * Deviation from the brief's first choice (spawning Biome with
 * --stdin-file-path and piping source on stdin): verified by hand that
 * Biome 2.4.6's stdin mode does not distinguish pass/fail here at all —
 * `biome check --stdin-file-path=...` (no --write) exits 1 for BOTH a
 * clean z.strictObject() probe and a bare z.object() probe, exits 0 with
 * --write for both regardless of unfixable plugin diagnostics, and never
 * prints the plugin's diagnostic text to stdout/stderr in either case —
 * only a generic "The contents aren't fixed. Use the --write flag..."
 * message. So neither the exit code nor the message text is usable via
 * stdin. Biome DOES report correctly (right exit code, right message)
 * against a real file path, which is what this test uses instead.
 */

const REPO_ROOT = process.cwd();
const BIOME_BIN = path.join(REPO_ROOT, "node_modules", ".bin", "biome");
const PROBE_DIR = path.join(REPO_ROOT, "lib", "schemas", "__tests__");

const BAD_PROBE_PATH = path.join(PROBE_DIR, "zod-object-lint-probe-bad.ts");
const GOOD_PROBE_PATH = path.join(PROBE_DIR, "zod-object-lint-probe-good.ts");

const BAD_SOURCE =
	'import { z } from "zod";\nexport const s = z.object({ a: z.string() });\n';
const GOOD_SOURCE =
	'import { z } from "zod";\nexport const s = z.strictObject({ a: z.string() });\n';

function runBiomeCheck(filePath: string): {
	status: number | null;
	error: Error | undefined;
	combinedOutput: string;
} {
	const result = spawnSync(BIOME_BIN, ["check", filePath], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	});
	return {
		status: result.status,
		error: result.error,
		combinedOutput: `${result.stdout ?? ""}${result.stderr ?? ""}`,
	};
}

function deleteProbe(filePath: string): void {
	if (existsSync(filePath)) {
		rmSync(filePath);
	}
}

afterEach(() => {
	// Belt-and-braces — each it() already cleans up in its own finally, but
	// a failed assertion between write and finally must not leave a probe
	// file behind for the next `pnpm lint`/test run to trip over.
	deleteProbe(BAD_PROBE_PATH);
	deleteProbe(GOOD_PROBE_PATH);
});

describe("lint-rules/no-bare-zod-object.grit — fires via the biome.json override", () => {
	it("flags a bare z.object() under lib/schemas/ with the plugin message and a non-zero exit", () => {
		mkdirSync(PROBE_DIR, { recursive: true });
		writeFileSync(BAD_PROBE_PATH, BAD_SOURCE);
		try {
			const { status, error, combinedOutput } = runBiomeCheck(BAD_PROBE_PATH);
			// A missing/unresolvable Biome binary makes spawnSync return
			// status: null with `error` set, rather than throwing — status
			// null would otherwise satisfy `not.toBe(0)` and pass this test
			// without Biome ever having run. Assert error is unset AND status
			// is a genuine positive exit code, not just "not zero".
			expect(error).toBeUndefined();
			expect(status).toBeGreaterThan(0);
			expect(combinedOutput).toContain("Bare z.object()");
		} finally {
			deleteProbe(BAD_PROBE_PATH);
		}
	});

	it("passes a z.strictObject() under lib/schemas/ with a clean, zero exit", () => {
		mkdirSync(PROBE_DIR, { recursive: true });
		writeFileSync(GOOD_PROBE_PATH, GOOD_SOURCE);
		try {
			const { status, error, combinedOutput } = runBiomeCheck(GOOD_PROBE_PATH);
			expect(error).toBeUndefined();
			expect(status).toBe(0);
			expect(combinedOutput).not.toContain("Bare z.object()");
		} finally {
			deleteProbe(GOOD_PROBE_PATH);
		}
	});
});
