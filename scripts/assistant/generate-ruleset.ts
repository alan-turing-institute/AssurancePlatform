/**
 * Generates the assistant's lint ruleset from the assurance-case catalogue.
 *
 * Run with: npx tsx scripts/assistant/generate-ruleset.ts [rulesetDir] [--out dir]
 *
 * Reads `ruleset.yaml` and `rules/*.yaml` (skipping `RETIRED.yaml`), keeps only
 * an allow-list of fields per rule, runs a name check over what is kept, and
 * writes three files into lib/plugins/assistant/linter/:
 *
 * - ruleset-data.ts       typed data the structural checker consumes
 * - judgement-prompt.ts   the judgement rules as prompt text
 * - ruleset-dropped.md    per rule, the source fields that were left out
 *
 * Everything not on the allow-list (provenance, rationale, sources, examples,
 * authorship and similar) never reaches the repo. The name check fails the run
 * when a kept field mentions a name on the deny list.
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const DEFAULT_RULESET_DIR =
	"/home/chris/Repositories/.claude/skills/assurance-case/ruleset";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT_DIR = resolve(HERE, "../../lib/plugins/assistant/linter");

const RULE_FIELDS = [
	"id",
	"title",
	"applies_to",
	"scope",
	"severity",
	"mechanism",
	"mode",
	"statement",
	"apply",
	"fix",
	"question_text",
	"ackable",
] as const;
const APPLY_FIELDS = ["look_for", "not_when", "wording"] as const;
const FAMILY_FIELDS = ["name", "defect"] as const;

const NAME_CHECK =
	/\b(nausicaa|funes|chris|cid|quill|toulmin|darter|bluebird|ruled|ruling|dstl|bae)\b/gi;

type Obj = Record<string, unknown>;

export interface NameHit {
	field: string;
	match: string;
	ruleId: string;
}

export interface GeneratedRule {
	ackable: boolean;
	applies_to: string[];
	apply?: { look_for: string; not_when: string; wording?: string };
	fix?: string;
	id: string;
	mechanism: "structural" | "judgement";
	mode: string[];
	question_text?: string;
	scope: "case" | "element";
	severity: "error" | "warning" | "style";
	statement?: string;
	title: string;
}

interface FamilyData {
	defect: string;
	name: string;
	prefix: string;
}

export interface GeneratedOutputs {
	data: string;
	dropped: string;
	droppedFieldCount: number;
	hits: NameHit[];
	judgementExcluded: string[];
	prompt: string;
	ruleCount: number;
	scrubbed: NameHit[];
	version: string;
}

function isObj(v: unknown): v is Obj {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readYaml(path: string): unknown {
	return parse(readFileSync(path, "utf8"));
}

function str(v: unknown, where: string): string {
	if (typeof v !== "string") {
		throw new Error(`generate-ruleset: expected a string at ${where}`);
	}
	return v.trim();
}

function pickApply(
	raw: unknown,
	where: string,
	dropped: string[]
): GeneratedRule["apply"] {
	if (!isObj(raw)) {
		return undefined;
	}
	for (const name of Object.keys(raw)) {
		if (!(APPLY_FIELDS as readonly string[]).includes(name)) {
			dropped.push(`apply.${name}`);
		}
	}
	const out: NonNullable<GeneratedRule["apply"]> = {
		look_for: str(raw.look_for, `${where}.apply.look_for`),
		not_when: str(raw.not_when, `${where}.apply.not_when`),
	};
	if (typeof raw.wording === "string") {
		out.wording = raw.wording.trim();
	}
	return out;
}

function pickRule(entry: Obj, where: string, dropped: string[]): GeneratedRule {
	for (const name of Object.keys(entry)) {
		if (!(RULE_FIELDS as readonly string[]).includes(name)) {
			dropped.push(name);
		}
	}
	const rule: GeneratedRule = {
		id: str(entry.id, `${where}.id`),
		title: str(entry.title, `${where}.title`),
		applies_to: (entry.applies_to as string[]) ?? [],
		scope: entry.scope as GeneratedRule["scope"],
		severity: entry.severity as GeneratedRule["severity"],
		mechanism: entry.mechanism as GeneratedRule["mechanism"],
		mode: (entry.mode as string[]) ?? [],
		statement: str(entry.statement, `${where}.statement`),
		ackable: entry.ackable === true,
	};
	const apply = pickApply(entry.apply, where, dropped);
	if (apply) {
		rule.apply = apply;
	}
	if (typeof entry.fix === "string") {
		rule.fix = entry.fix.trim();
	}
	if (typeof entry.question_text === "string") {
		rule.question_text = entry.question_text.trim();
	}
	return rule;
}

function textOf(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (Array.isArray(value)) {
		return value.flatMap(textOf);
	}
	if (isObj(value)) {
		return Object.values(value).flatMap(textOf);
	}
	return [];
}

function findHits(rules: GeneratedRule[]): NameHit[] {
	const hits: NameHit[] = [];
	for (const rule of rules) {
		for (const [field, value] of Object.entries(rule)) {
			for (const text of textOf(value)) {
				for (const m of text.matchAll(NAME_CHECK)) {
					hits.push({ ruleId: rule.id, field, match: m[0] });
				}
			}
		}
	}
	return hits;
}

function familyHits(families: FamilyData[]): NameHit[] {
	const hits: NameHit[] = [];
	for (const f of families) {
		for (const text of [f.name, f.defect]) {
			for (const m of text.matchAll(NAME_CHECK)) {
				hits.push({
					ruleId: `family ${f.prefix}`,
					field: "name/defect",
					match: m[0],
				});
			}
		}
	}
	return hits;
}

/** A judgement rule the model applies to the case itself. */
function isJudgementRule(r: GeneratedRule): boolean {
	return (
		r.mechanism === "judgement" &&
		r.mode.includes("review") &&
		r.question_text === undefined
	);
}

function ruleBlock(r: GeneratedRule): string {
	const lines = [
		`${r.id} (${r.severity}) ${r.title}`,
		`Applies to: ${r.applies_to.join(", ")}${r.scope === "case" ? " (report once per case)" : ""}`,
		`Rule: ${r.statement ?? ""}`,
	];
	if (r.apply) {
		lines.push(`Look for: ${r.apply.look_for}`);
		lines.push(`Not when: ${r.apply.not_when}`);
		if (r.apply.wording) {
			lines.push(`Wording: ${r.apply.wording}`);
		}
	}
	if (r.fix) {
		lines.push(`Fix: ${r.fix}`);
	}
	return lines.join("\n");
}

function promptText(rules: GeneratedRule[]): string {
	return [
		"Judgement rules. Apply each rule below to the elements of the open case whose type is in its 'Applies to' list. Report a finding only when the rule clearly applies, and say nothing about rules that do not.",
		...rules.map(ruleBlock),
	].join("\n\n");
}

function header(version: string, date: string): string {
	return `// GENERATED by scripts/assistant/generate-ruleset.ts from ruleset v${version} on ${date}; do not edit`;
}

function readFamilies(
	manifest: Obj,
	droppedByRule: Map<string, string[]>
): FamilyData[] {
	const familiesRaw = isObj(manifest.families) ? manifest.families : {};
	const families: FamilyData[] = [];
	for (const [prefix, def] of Object.entries(familiesRaw)) {
		if (prefix === "RETIRED" || !isObj(def)) {
			continue;
		}
		const extra = Object.keys(def).filter(
			(k) => !(FAMILY_FIELDS as readonly string[]).includes(k)
		);
		if (extra.length > 0) {
			droppedByRule.set(`family ${prefix}`, extra);
		}
		families.push({
			prefix,
			name: str(def.name, `families.${prefix}.name`),
			defect: str(def.defect, `families.${prefix}.defect`),
		});
	}
	return families;
}

function readRules(
	rulesetDir: string,
	droppedByRule: Map<string, string[]>
): GeneratedRule[] {
	const rules: GeneratedRule[] = [];
	const files = readdirSync(join(rulesetDir, "rules"))
		.filter((f) => f.endsWith(".yaml") && f !== "RETIRED.yaml")
		.sort();
	for (const file of files) {
		const parsed = readYaml(join(rulesetDir, "rules", file));
		if (!Array.isArray(parsed)) {
			throw new Error(`generate-ruleset: rules/${file} is not a list`);
		}
		for (const [i, entry] of parsed.entries()) {
			if (!isObj(entry)) {
				throw new Error(
					`generate-ruleset: rules/${file}[${i}] is not a mapping`
				);
			}
			const dropped: string[] = [];
			const rule = pickRule(entry, `rules/${file}[${i}]`, dropped);
			rules.push(rule);
			droppedByRule.set(rule.id, dropped.sort());
		}
	}
	return rules.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Prose fields (statement, apply) that mention a denied name are removed from
 * the generated data, and the rule leaves the judgement prompt. Nothing the
 * checker reads is prose, so the structural checks are unaffected.
 */
function scrubProse(
	rules: GeneratedRule[],
	droppedByRule: Map<string, string[]>
): NameHit[] {
	const scrubbed: NameHit[] = [];
	for (const rule of rules) {
		for (const field of ["statement", "apply"] as const) {
			const found = textOf(rule[field]).flatMap((text) =>
				[...text.matchAll(NAME_CHECK)].map((m) => m[0])
			);
			if (found.length === 0) {
				continue;
			}
			for (const match of found) {
				scrubbed.push({ ruleId: rule.id, field, match });
			}
			delete rule[field];
			droppedByRule.get(rule.id)?.push(`${field} (name check)`);
		}
	}
	return scrubbed;
}

function droppedMarkdown(
	version: string,
	manifestDropped: string[],
	droppedByRule: Map<string, string[]>
): { count: number; text: string } {
	let count = 0;
	const lines = [
		"<!-- GENERATED by scripts/assistant/generate-ruleset.ts; do not edit -->",
		"",
		`# Fields dropped from ruleset v${version}`,
		"",
		`Each row lists the source fields that were left out of the generated files. Rule fields kept: ${RULE_FIELDS.join(", ")}.`,
		"",
		`Manifest fields dropped: ${manifestDropped.join(", ") || "none"}.`,
		"",
		"| Rule | Dropped fields |",
		"|---|---|",
	];
	const rows = [...droppedByRule].sort(([a], [b]) => a.localeCompare(b));
	for (const [id, fields] of rows) {
		count += fields.length;
		lines.push(`| ${id} | ${fields.join(", ") || "none"} |`);
	}
	lines.push("");
	return { count, text: lines.join("\n") };
}

export function generate(rulesetDir: string): GeneratedOutputs {
	const manifest = readYaml(join(rulesetDir, "ruleset.yaml"));
	if (!isObj(manifest)) {
		throw new Error("generate-ruleset: ruleset.yaml is not a mapping");
	}
	const version = str(manifest.version, "ruleset.yaml.version");
	const date = str(String(manifest.date), "ruleset.yaml.date");
	const droppedByRule = new Map<string, string[]>();
	const manifestDropped = Object.keys(manifest).filter(
		(k) => !["version", "date", "families"].includes(k)
	);
	const families = readFamilies(manifest, droppedByRule);
	const rules = readRules(rulesetDir, droppedByRule);

	const scrubbed = scrubProse(rules, droppedByRule);
	const scrubbedRules = new Set(scrubbed.map((h) => h.ruleId));
	const hits = [...findHits(rules), ...familyHits(families)];
	const judgementRules = rules.filter(isJudgementRule);
	const judgementIncluded = judgementRules.filter(
		(r) => !scrubbedRules.has(r.id)
	);
	const judgementExcluded = judgementRules
		.filter((r) => scrubbedRules.has(r.id))
		.map((r) => r.id);

	const body = JSON.stringify({ version, date, families, rules }, null, "\t");
	const data = `${header(version, date)}
import type { RulesetData } from "./ruleset-types";

export const RULESET_DATA: RulesetData = ${body};
`;
	const ids = JSON.stringify(judgementIncluded.map((r) => r.id));
	const prompt = `${header(version, date)}

export const JUDGEMENT_RULE_IDS: readonly string[] = ${ids};

export const JUDGEMENT_PROMPT: string = ${JSON.stringify(promptText(judgementIncluded))};
`;
	const dropped = droppedMarkdown(version, manifestDropped, droppedByRule);

	return {
		data,
		prompt,
		dropped: dropped.text,
		hits,
		scrubbed,
		judgementExcluded,
		ruleCount: rules.length,
		droppedFieldCount: dropped.count,
		version,
	};
}

export function writeOutputs(out: GeneratedOutputs, outDir: string): void {
	mkdirSync(outDir, { recursive: true });
	writeFileSync(join(outDir, "ruleset-data.ts"), out.data);
	writeFileSync(join(outDir, "judgement-prompt.ts"), out.prompt);
	writeFileSync(join(outDir, "ruleset-dropped.md"), out.dropped);
}

function parseArgs(args: string[]): { outDir: string; rulesetDir: string } {
	let outDir = DEFAULT_OUT_DIR;
	let rulesetDir = DEFAULT_RULESET_DIR;
	let expectOut = false;
	for (const arg of args) {
		if (arg === "--out") {
			expectOut = true;
		} else if (expectOut) {
			outDir = resolve(arg);
			expectOut = false;
		} else {
			rulesetDir = resolve(arg);
		}
	}
	return { outDir, rulesetDir };
}

export function main(argv: string[]): void {
	const { outDir, rulesetDir } = parseArgs(argv.slice(2));
	if (!existsSync(join(rulesetDir, "ruleset.yaml"))) {
		throw new Error(`generate-ruleset: no ruleset.yaml in ${rulesetDir}`);
	}
	const out = generate(rulesetDir);
	for (const h of out.scrubbed) {
		console.warn(
			`Name check: ${h.ruleId}.${h.field} mentions "${h.match}"; field omitted`
		);
	}
	if (out.judgementExcluded.length > 0) {
		console.warn(
			`Judgement rules excluded from the prompt: ${out.judgementExcluded.join(", ")}`
		);
	}
	if (out.hits.length > 0) {
		const lines = out.hits.map((h) => `  ${h.ruleId}.${h.field}: "${h.match}"`);
		console.error(`Name check hits (${out.hits.length}):\n${lines.join("\n")}`);
		process.exitCode = 1;
		return;
	}
	writeOutputs(out, outDir);
	console.log(
		`ruleset v${out.version}: ${out.ruleCount} rules, ${out.droppedFieldCount} dropped fields, name check clean`
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main(process.argv);
}
