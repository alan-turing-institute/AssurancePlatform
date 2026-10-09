import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../assistant/generate-ruleset";

const MANIFEST = `version: "9.9"
date: 2026-01-01
steward: secretsteward
families:
  TREE:
    file: rules/TREE.yaml
    name: Structure
    defect: "the graph itself"
  RETIRED:
    file: rules/RETIRED.yaml
    name: Retired
    defect: none
active_count: 3
`;

interface RuleOverrides {
	[key: string]: unknown;
}

function ruleYaml(id: string, over: RuleOverrides = {}): string {
	const base: Record<string, unknown> = {
		id,
		applies_to: ["GOAL"],
		scope: "element",
		title: `Title of ${id}`,
		severity: "warning",
		mechanism: "judgement",
		mode: ["review"],
		question: false,
		statement: `Statement of ${id}.`,
		rationale: "RATIONALE_MARKER why",
		sources: [{ std: "GSN v3", ref: "SOURCES_MARKER" }],
		lineage: "LINEAGE_MARKER",
		steward: "STEWARD_MARKER",
		secret_note: "SECRET_NOTE_MARKER",
		ackable: false,
		fix: `Fix for ${id}.`,
		apply: { look_for: "look here", not_when: "never" },
		...over,
	};
	const lines = [`- id: ${base.id}`];
	for (const [k, v] of Object.entries(base)) {
		if (k !== "id") {
			lines.push(`  ${k}: ${JSON.stringify(v)}`);
		}
	}
	return `${lines.join("\n")}\n`;
}

const QUX_OR_ZED = /qux|zed/i;

let root: string;
let out: string;

function fixture(
	rules: string[],
	retired = "- id: S07\n  title: gone\n  status: retired\n  note: RETIRED_MARKER\n"
) {
	mkdirSync(join(root, "rules"), { recursive: true });
	writeFileSync(join(root, "ruleset.yaml"), MANIFEST);
	writeFileSync(join(root, "rules", "TREE.yaml"), rules.join("\n"));
	writeFileSync(join(root, "rules", "RETIRED.yaml"), retired);
}

function run(): { code: number | undefined } {
	process.exitCode = undefined;
	main(["node", "gen", root, "--out", out]);
	const code = process.exitCode as number | undefined;
	process.exitCode = undefined;
	return { code };
}

function read(name: string): string {
	return readFileSync(join(out, name), "utf8");
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "ruleset-fixture-"));
	out = mkdtempSync(join(tmpdir(), "ruleset-out-"));
	vi.spyOn(console, "log").mockImplementation(() => undefined);
	vi.spyOn(console, "warn").mockImplementation(() => undefined);
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	vi.stubEnv("RULESET_NAME_CHECK", "zed|qux");
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	process.exitCode = undefined;
});

describe("generate-ruleset allow-list", () => {
	it("keeps only allow-listed fields and never emits planted extras", () => {
		fixture([ruleYaml("TREE01"), ruleYaml("TREE02")]);
		expect(run().code).toBeUndefined();
		const all = [read("ruleset-data.ts"), read("judgement-prompt.ts")].join(
			"\n"
		);
		for (const marker of [
			"RATIONALE_MARKER",
			"SOURCES_MARKER",
			"LINEAGE_MARKER",
			"STEWARD_MARKER",
			"SECRET_NOTE_MARKER",
			"secretsteward",
			"RETIRED_MARKER",
		]) {
			expect(all).not.toContain(marker);
		}
		for (const kept of [
			"Title of TREE01",
			"Statement of TREE02.",
			"Fix for TREE01.",
			"look here",
		]) {
			expect(all).toContain(kept);
		}
		expect(read("ruleset-data.ts")).toContain("9.9");
	});

	it("skips RETIRED.yaml", () => {
		fixture([ruleYaml("TREE01")]);
		run();
		expect(read("ruleset-data.ts")).not.toContain('"S07"');
		expect(read("ruleset-dropped.md")).not.toContain("S07");
	});

	it("lists each dropped field name per rule in ruleset-dropped.md", () => {
		fixture([ruleYaml("TREE01")]);
		run();
		const dropped = read("ruleset-dropped.md");
		const row = dropped.split("\n").find((l) => l.startsWith("| TREE01"));
		expect(row).toBeDefined();
		for (const f of [
			"rationale",
			"sources",
			"lineage",
			"steward",
			"secret_note",
		]) {
			expect(row).toContain(f);
		}
		expect(dropped).not.toContain("RATIONALE_MARKER");
	});
});

describe("generate-ruleset name check", () => {
	it("silently drops a name found only in a non-allow-listed field", () => {
		fixture([ruleYaml("TREE01", { rationale: "zed decided this" })]);
		expect(run().code).toBeUndefined();
		expect(read("ruleset-data.ts")).not.toContain("zed");
		expect(read("judgement-prompt.ts")).toContain("TREE01");
	});

	it.each([
		"statement",
		"apply",
	])("reports a name in %s and excludes that rule from the judgement prompt", (field) => {
		const over =
			field === "statement"
				? { statement: "As QUX required." }
				: { apply: { look_for: "what Zed wanted", not_when: "never" } };
		fixture([ruleYaml("TREE01", over), ruleYaml("TREE02")]);
		expect(run().code).toBeUndefined();
		const warned = vi
			.mocked(console.warn)
			.mock.calls.map((c) => c.join(" "))
			.join("\n");
		expect(warned).toContain("TREE01");
		const prompt = read("judgement-prompt.ts");
		expect(prompt).not.toContain("Title of TREE01");
		expect(prompt).toContain("Title of TREE02");
		expect(read("ruleset-data.ts")).not.toMatch(QUX_OR_ZED);
	});

	it("exits non-zero when a name is in a field that reaches ruleset-data.ts", () => {
		fixture([ruleYaml("TREE01", { title: "Guided by Zed" })]);
		expect(run().code).toBe(1);
	});

	it("exits non-zero for a name in fix", () => {
		fixture([ruleYaml("TREE01", { fix: "Ask qux." })]);
		expect(run().code).toBe(1);
	});

	it("matches whole words only: a trailing letter does not trip the check", () => {
		fixture([ruleYaml("TREE01", { title: "Zedland walks the tree" })]);
		expect(run().code).toBeUndefined();
		expect(read("ruleset-data.ts")).toContain("Zedland");
	});

	it("matches whole words only: a leading letter does not trip the check", () => {
		fixture([ruleYaml("TREE01", { title: "Evidence is unquxed" })]);
		expect(run().code).toBeUndefined();
	});

	it("matches case-insensitively: QUX trips the check", () => {
		fixture([ruleYaml("TREE01", { title: "QUX walkthrough" })]);
		expect(run().code).toBe(1);
	});
});

describe("generate-ruleset inputs", () => {
	it("prints a usage line and exits 2 without a ruleset directory", () => {
		process.exitCode = undefined;
		main(["node", "gen"]);
		expect(process.exitCode).toBe(2);
		process.exitCode = undefined;
		expect(vi.mocked(console.error).mock.calls.join("\n")).toContain("Usage:");
	});

	it.each([
		undefined,
		"",
		"   ",
	])("fails closed when RULESET_NAME_CHECK is %j, writing nothing", (value) => {
		vi.stubEnv("RULESET_NAME_CHECK", value);
		fixture([ruleYaml("TREE01")]);
		expect(run().code).toBe(1);
		expect(vi.mocked(console.error).mock.calls.join("\n")).toContain(
			"RULESET_NAME_CHECK"
		);
		expect(() => read("ruleset-data.ts")).toThrow();
	});
});
