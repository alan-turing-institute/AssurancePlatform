/**
 * Generates the assistant's lint ruleset from the assurance-case catalogue.
 *
 * Run with:
 *   RULESET_NAME_CHECK='<regex>' npx tsx scripts/assistant/generate-ruleset.ts <rulesetDir> [--out dir]
 *
 * The ruleset directory is a required argument. RULESET_NAME_CHECK is a
 * regular expression of names that must not appear in the output; it is
 * applied case-insensitively and word-bounded, and the run fails when it is
 * unset or empty.
 *
 * Reads `ruleset.yaml` and `rules/*.yaml` (skipping `RETIRED.yaml`), keeps only
 * an allow-list of fields per rule, runs a name check and an internal-reference
 * check over what is kept, and writes three files into
 * lib/plugins/assistant/linter/:
 *
 * - ruleset-data.ts       typed data the structural checker consumes
 * - judgement-prompt.ts   the judgement rules as prompt text
 * - ruleset-dropped.md    per rule, the source fields that were left out
 *
 * Everything not on the allow-list (provenance, rationale, sources, examples,
 * authorship and similar) never reaches the repo. The name check fails the run
 * when a kept field matches the pattern. The reference check fails the run when
 * a kept field contains a section sign or the words "spec", "ADR" or "issue",
 * apart from the exact substrings in REFERENCE_ALLOWED.
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

const NAME_CHECK_ENV = "RULESET_NAME_CHECK";

/** Matches a section sign, or the whole words spec, ADR and issue. */
const REFERENCE_CHECK = /§|\b(?:spec|ADR|issue)\b/gi;

/** Exact substrings the reference check lets through (a standard's section reference). */
const REFERENCE_ALLOWED: readonly string[] = ["GSN §1:6"];

const SCOPES = ["case", "element"] as const;
const SEVERITIES = ["error", "warning", "style"] as const;
const MECHANISMS = ["structural", "judgement"] as const;

type Obj = Record<string, unknown>;

export interface NameHit {
	field: string;
	match: string;
	ruleId: string;
}

export interface ReferenceHit {
	field: string;
	ruleId: string;
	text: string;
}

/** Compiles the name-check pattern: case-insensitive and word-bounded. */
export function buildNameCheck(pattern: string): RegExp {
	return new RegExp(`\\b(?:${pattern})\\b`, "gi");
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
	referenceHits: ReferenceHit[];
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
	} else if (raw.wording !== undefined && raw.wording !== null) {
		dropped.push("apply.wording (not a string)");
	}
	return out;
}

function oneOf<T extends string>(
	v: unknown,
	allowed: readonly T[],
	where: string
): T {
	if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
		throw new Error(
			`generate-ruleset: ${where} must be one of ${allowed.join(", ")}`
		);
	}
	return v as T;
}

function strList(v: unknown, where: string): string[] {
	if (!(Array.isArray(v) && v.every((x) => typeof x === "string"))) {
		throw new Error(`generate-ruleset: ${where} must be a list of strings`);
	}
	return v;
}

function optionalText(
	v: unknown,
	name: string,
	dropped: string[]
): string | undefined {
	if (typeof v === "string") {
		return v.trim();
	}
	if (v !== undefined && v !== null) {
		dropped.push(`${name} (not a string)`);
	}
	return undefined;
}

function pickRule(entry: Obj, where: string, dropped: string[]): GeneratedRule {
	for (const name of Object.keys(entry)) {
		if (!(RULE_FIELDS as readonly string[]).includes(name)) {
			dropped.push(name);
		}
	}
	if (
		entry.ackable !== undefined &&
		entry.ackable !== null &&
		typeof entry.ackable !== "boolean"
	) {
		throw new Error(`generate-ruleset: ${where}.ackable must be a boolean`);
	}
	const rule: GeneratedRule = {
		id: str(entry.id, `${where}.id`),
		title: str(entry.title, `${where}.title`),
		applies_to: strList(entry.applies_to ?? [], `${where}.applies_to`),
		scope: oneOf(entry.scope, SCOPES, `${where}.scope`),
		severity: oneOf(entry.severity, SEVERITIES, `${where}.severity`),
		mechanism: oneOf(entry.mechanism, MECHANISMS, `${where}.mechanism`),
		mode: strList(entry.mode ?? [], `${where}.mode`),
		statement: str(entry.statement, `${where}.statement`),
		ackable: entry.ackable === true,
	};
	const apply = pickApply(entry.apply, where, dropped);
	if (apply) {
		rule.apply = apply;
	}
	const fix = optionalText(entry.fix, "fix", dropped);
	if (fix !== undefined) {
		rule.fix = fix;
	}
	const questionText = optionalText(
		entry.question_text,
		"question_text",
		dropped
	);
	if (questionText !== undefined) {
		rule.question_text = questionText;
	}
	// A question rule is raised to the author, never applied by the model, so
	// the emitted question text must exist exactly when the source says so.
	if ((rule.question_text === undefined) !== (entry.question !== true)) {
		throw new Error(
			`generate-ruleset: ${rule.id} question_text does not agree with its question marker`
		);
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

function findHits(rules: GeneratedRule[], nameCheck: RegExp): NameHit[] {
	const hits: NameHit[] = [];
	for (const rule of rules) {
		for (const [field, value] of Object.entries(rule)) {
			for (const text of textOf(value)) {
				for (const m of text.matchAll(nameCheck)) {
					hits.push({ ruleId: rule.id, field, match: m[0] });
				}
			}
		}
	}
	return hits;
}

function familyHits(families: FamilyData[], nameCheck: RegExp): NameHit[] {
	const hits: NameHit[] = [];
	for (const f of families) {
		for (const text of [f.name, f.defect]) {
			for (const m of text.matchAll(nameCheck)) {
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

/** True when the text holds a reference that is not one of the allowed substrings. */
function hasInternalReference(text: string): boolean {
	let rest = text;
	for (const allowed of REFERENCE_ALLOWED) {
		rest = rest.split(allowed).join(" ");
	}
	return new RegExp(REFERENCE_CHECK.source, REFERENCE_CHECK.flags).test(rest);
}

function referenceHits(
	rules: GeneratedRule[],
	families: FamilyData[]
): ReferenceHit[] {
	const hits: ReferenceHit[] = [];
	for (const rule of rules) {
		for (const [field, value] of Object.entries(rule)) {
			for (const text of textOf(value)) {
				if (hasInternalReference(text)) {
					hits.push({ ruleId: rule.id, field, text });
				}
			}
		}
	}
	for (const f of families) {
		for (const text of [f.name, f.defect]) {
			if (hasInternalReference(text)) {
				hits.push({ ruleId: `family ${f.prefix}`, field: "name/defect", text });
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
	droppedByRule: Map<string, string[]>,
	nameCheck: RegExp
): NameHit[] {
	const scrubbed: NameHit[] = [];
	for (const rule of rules) {
		for (const field of ["statement", "apply"] as const) {
			const found = textOf(rule[field]).flatMap((text) =>
				[...text.matchAll(nameCheck)].map((m) => m[0])
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

/** The manifest's list of acknowledgeable rule ids; every id must name a rule. */
function readAckable(manifest: Obj, rules: GeneratedRule[]): void {
	const raw = manifest.ackable ?? [];
	if (!(Array.isArray(raw) && raw.every((x) => typeof x === "string"))) {
		throw new Error("generate-ruleset: ruleset.yaml ackable must be a list");
	}
	const listed = new Set<string>(raw);
	const known = new Set(rules.map((r) => r.id));
	for (const id of listed) {
		if (!known.has(id)) {
			throw new Error(
				`generate-ruleset: ${id} is listed as ackable but is not a rule`
			);
		}
	}
	for (const rule of rules) {
		if (rule.ackable !== listed.has(rule.id)) {
			throw new Error(
				`generate-ruleset: ${rule.id} ackable does not agree with the manifest's ackable list`
			);
		}
	}
}

export function generate(
	rulesetDir: string,
	nameCheck: RegExp
): GeneratedOutputs {
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
	readAckable(manifest, rules);

	const scrubbed = scrubProse(rules, droppedByRule, nameCheck);
	const scrubbedRules = new Set(scrubbed.map((h) => h.ruleId));
	const hits = [
		...findHits(rules, nameCheck),
		...familyHits(families, nameCheck),
	];
	const references = referenceHits(rules, families);
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
		referenceHits: references,
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

function parseArgs(args: string[]): {
	outDir: string;
	rulesetDir: string | undefined;
} {
	let outDir = DEFAULT_OUT_DIR;
	let rulesetDir: string | undefined;
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
	if (!rulesetDir) {
		console.error(
			`Usage: ${NAME_CHECK_ENV}='<regex>' tsx scripts/assistant/generate-ruleset.ts <rulesetDir> [--out dir]`
		);
		process.exitCode = 2;
		return;
	}
	const pattern = process.env[NAME_CHECK_ENV]?.trim();
	if (!pattern) {
		console.error(
			`generate-ruleset: the ${NAME_CHECK_ENV} environment variable is required (a regular expression of names that must not appear in the output).`
		);
		process.exitCode = 1;
		return;
	}
	if (!existsSync(join(rulesetDir, "ruleset.yaml"))) {
		throw new Error(`generate-ruleset: no ruleset.yaml in ${rulesetDir}`);
	}
	const out = generate(rulesetDir, buildNameCheck(pattern));
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
	}
	if (out.referenceHits.length > 0) {
		const lines = out.referenceHits.map(
			(h) => `  ${h.ruleId}.${h.field}: ${JSON.stringify(h.text)}`
		);
		console.error(
			`Internal reference hits (${out.referenceHits.length}):\n${lines.join("\n")}`
		);
		process.exitCode = 1;
	}
	if (process.exitCode === 1) {
		return;
	}
	writeOutputs(out, outDir);
	console.log(
		`ruleset v${out.version}: ${out.ruleCount} rules, ${out.droppedFieldCount} dropped fields, name check and reference check clean`
	);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	main(process.argv);
}
