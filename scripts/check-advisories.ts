#!/usr/bin/env -S pnpm exec tsx
/**
 * check-advisories.ts — fail when `pnpm audit` reports a high or critical
 * advisory that is not in .advisory-baseline.json, or when a baseline entry
 * has expired. It audits twice, once for everything and once with --prod, so
 * a "dev" entry cannot accept the same advisory when it reaches production.
 *
 * Usage:
 *   pnpm exec tsx scripts/check-advisories.ts [--baseline <file>]
 *
 * Needs the network (the audit queries the registry), so it runs in CI on
 * pull requests and is not part of the pre-push hook. A baseline entry is
 *   { ghsa, package, severity, scope: "prod" | "dev", reason, owner, expires }
 * with `expires` as YYYY-MM-DD and `owner` naming who renews the entry. An
 * advisory reported at a higher severity than its entry records fails until
 * the entry is re-accepted. An entry no longer reported by the audit is a
 * warning, not a failure, so the file can be pruned in its own change.
 *
 * Fails closed: output that is missing, is not JSON or lacks an `advisories`
 * object is an error, never a pass.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASELINE = path.join(__dirname, "..", ".advisory-baseline.json");
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AUDIT_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface BaselineEntry {
	expires: string;
	ghsa: string;
	owner: string;
	package: string;
	reason: string;
	scope: "prod" | "dev";
	severity: string;
}

export interface Advisory {
	ghsa: string;
	package: string;
	severity: string;
}

export interface Evaluation {
	failures: string[];
	warnings: string[];
}

const SEVERITY_RANK: Record<string, number> = { high: 1, critical: 2 };

export class AdvisoryCheckError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the high and critical advisories out of `pnpm audit --json` output. */
export function parseAuditOutput(text: string): Advisory[] {
	if (text.trim() === "") {
		throw new AdvisoryCheckError("The audit produced no output.");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new AdvisoryCheckError("The audit output is not valid JSON.");
	}
	if (!(isRecord(parsed) && isRecord(parsed.advisories))) {
		throw new AdvisoryCheckError(
			"The audit output has no advisories object, so it cannot be trusted."
		);
	}
	const found: Advisory[] = [];
	for (const raw of Object.values(parsed.advisories)) {
		if (!isRecord(raw)) {
			throw new AdvisoryCheckError("The audit output holds a malformed entry.");
		}
		const ghsa = raw.github_advisory_id;
		const severity = raw.severity;
		const name = raw.module_name;
		if (
			typeof ghsa !== "string" ||
			typeof severity !== "string" ||
			typeof name !== "string"
		) {
			throw new AdvisoryCheckError(
				"The audit output holds an entry without an id, severity or package."
			);
		}
		if (BLOCKING_SEVERITIES.has(severity)) {
			found.push({ ghsa, package: name, severity });
		}
	}
	return mergeReports(found);
}

const REQUIRED_KEYS = [
	"ghsa",
	"package",
	"severity",
	"scope",
	"reason",
	"owner",
	"expires",
] as const;

function validateEntry(entry: unknown, index: number): BaselineEntry {
	if (!isRecord(entry)) {
		throw new AdvisoryCheckError(`Baseline entry ${index} is not an object.`);
	}
	for (const key of REQUIRED_KEYS) {
		const value = entry[key];
		if (typeof value !== "string" || value.trim() === "") {
			throw new AdvisoryCheckError(
				`Baseline entry ${index} needs a non-empty "${key}".`
			);
		}
	}
	const scope = entry.scope as string;
	const expires = entry.expires as string;
	if (scope !== "prod" && scope !== "dev") {
		throw new AdvisoryCheckError(
			`Baseline entry ${index} has a scope other than prod or dev.`
		);
	}
	if (!DATE_PATTERN.test(expires) || Number.isNaN(Date.parse(expires))) {
		throw new AdvisoryCheckError(
			`Baseline entry ${index} needs "expires" as YYYY-MM-DD.`
		);
	}
	return entry as unknown as BaselineEntry;
}

/** Checks the baseline file's shape; any malformed entry is an error. */
export function parseBaseline(text: string): BaselineEntry[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new AdvisoryCheckError("The advisory baseline is not valid JSON.");
	}
	if (!Array.isArray(parsed)) {
		throw new AdvisoryCheckError("The advisory baseline must be an array.");
	}
	return parsed.map(validateEntry);
}

function rank(severity: string): number {
	return SEVERITY_RANK[severity] ?? 0;
}

/** Merges the reports of one advisory, keeping the highest severity. */
function mergeReports(...lists: Advisory[][]): Advisory[] {
	const merged = new Map<string, Advisory>();
	for (const advisory of lists.flat()) {
		const known = merged.get(advisory.ghsa);
		if (!known || rank(advisory.severity) > rank(known.severity)) {
			merged.set(advisory.ghsa, advisory);
		}
	}
	return [...merged.values()];
}

function checkEntry(
	advisory: Advisory,
	entry: BaselineEntry,
	reachesProduction: boolean,
	today: string
): string[] {
	const failures: string[] = [];
	const label = `${advisory.ghsa} (${advisory.package})`;
	if (entry.expires < today) {
		failures.push(
			`The baseline entry for ${label} expired on ${entry.expires}: fix it or renew the entry with a reason.`
		);
	}
	if (rank(advisory.severity) > rank(entry.severity)) {
		failures.push(
			`Advisory ${label} is now ${advisory.severity} but its baseline entry records ${entry.severity}: the entry must be re-accepted.`
		);
	}
	if (reachesProduction && entry.scope !== "prod") {
		failures.push(
			`Advisory ${label} is reported by the production audit but its baseline entry has scope "${entry.scope}": upgrade the package, or record a production entry with a reason.`
		);
	}
	return failures;
}

/**
 * Compares the reported advisories with the baseline as of `today`.
 * `production` holds the advisories that `pnpm audit --prod` reports; each one
 * needs an entry with scope "prod", because a "dev" entry only covers a
 * development-only copy of the package.
 */
export function evaluate(
	advisories: Advisory[],
	production: Advisory[],
	baseline: BaselineEntry[],
	today: string
): Evaluation {
	const failures: string[] = [];
	const warnings: string[] = [];
	const approved = new Map(baseline.map((entry) => [entry.ghsa, entry]));
	const inProduction = new Set(production.map((advisory) => advisory.ghsa));
	const reported = mergeReports(advisories, production);

	for (const advisory of reported) {
		const entry = approved.get(advisory.ghsa);
		if (entry) {
			failures.push(
				...checkEntry(advisory, entry, inProduction.has(advisory.ghsa), today)
			);
		} else {
			failures.push(
				`New ${advisory.severity} advisory ${advisory.ghsa} in ${advisory.package}: upgrade the package, or add a reasoned entry to .advisory-baseline.json.`
			);
		}
	}
	const seen = new Set(reported.map((advisory) => advisory.ghsa));
	for (const entry of baseline) {
		if (!seen.has(entry.ghsa)) {
			warnings.push(
				`Baseline entry ${entry.ghsa} (${entry.package}) is no longer reported: remove it.`
			);
		}
	}
	return { failures, warnings };
}

function runAudit(productionOnly: boolean): string {
	// `pnpm audit` exits non-zero when it finds anything, so the exit code says
	// nothing about whether the output is usable; the parser decides that.
	const args = productionOnly
		? ["audit", "--prod", "--json"]
		: ["audit", "--json"];
	const result = spawnSync("pnpm", args, {
		encoding: "utf8",
		maxBuffer: MAX_AUDIT_OUTPUT_BYTES,
	});
	if (result.error) {
		throw new AdvisoryCheckError(
			`Could not run pnpm audit: ${result.error.message}`
		);
	}
	return result.stdout;
}

/** Runs the check and returns the process exit code. */
export function run(
	argv: string[],
	readAudit: (productionOnly: boolean) => string,
	today: string
): number {
	const flag = argv.indexOf("--baseline");
	const baselinePath = flag === -1 ? DEFAULT_BASELINE : argv[flag + 1];
	try {
		if (!baselinePath) {
			throw new AdvisoryCheckError("--baseline needs a file path.");
		}
		const baseline = parseBaseline(fs.readFileSync(baselinePath, "utf8"));
		const advisories = parseAuditOutput(readAudit(false));
		const production = parseAuditOutput(readAudit(true));
		const { failures, warnings } = evaluate(
			advisories,
			production,
			baseline,
			today
		);
		for (const warning of warnings) {
			console.warn(`::warning::${warning}`);
		}
		for (const failure of failures) {
			console.error(`::error::${failure}`);
		}
		console.log(
			`${advisories.length} high or critical advisories reported (${production.length} in production), ${baseline.length} baselined, ${failures.length} failing.`
		);
		return failures.length === 0 ? 0 : 1;
	} catch (error) {
		console.error(
			`::error::${error instanceof Error ? error.message : String(error)}`
		);
		return 1;
	}
}

// Runs only when invoked directly, so a unit test can import the functions.
if (
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exitCode = run(
		process.argv.slice(2),
		runAudit,
		new Date().toISOString().slice(0, 10)
	);
}
