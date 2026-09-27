#!/usr/bin/env -S pnpm exec tsx
/**
 * check-pages.ts — load a set of pages in a real browser and report whether
 * each one is fit to ship: HTTP status, page/console errors, layout shift,
 * accessibility violations and placeholder text.
 *
 * GET navigations only. Never clicks a button or submits a form, so --all
 * cannot change data.
 *
 * Usage:
 *   pnpm exec tsx scripts/check-pages.ts --base-url <url> <path> [<path> ...]
 *   pnpm exec tsx scripts/check-pages.ts --base-url <url> --all
 *
 * Options:
 *   --base-url <url>        required
 *   --all                   check every page route under app/ (page.tsx,
 *                           excluding API routes), filling dynamic segments
 *                           from the database DATABASE_URL points at
 *   --storage-state <file>  reuse an existing signed-in session instead of
 *                           logging in as the seed user
 *   --only <list>           comma-separated subset of status,errors,
 *                           placeholders,a11y,cls. Only the listed checks
 *                           can fail a page (via failReasons/pass); every
 *                           check still runs and its result is still on
 *                           PageResult (axe, cls, placeholderHits, ...).
 *                           Default: all five can fail.
 *   --json <file>           also write the full result array as JSON
 *   --cls-budget <n>        cumulative layout shift budget (default 0.1)
 *   --baseline <file>       known-problems baseline, keyed by route template
 *                           (default: .a11y-baseline.json at the repo root,
 *                           if present)
 *   --no-baseline           ignore any baseline file; every violation and
 *                           any layout shift over --cls-budget fails
 *   --write-baseline        after the run, (re)write the baseline file (the
 *                           one named by --baseline, or the default path)
 *                           from this run's results
 *
 * A page fails an accessibility check only on a *new* problem: a rule whose
 * serious+critical node count exceeds the baseline's count for that route,
 * or a rule the baseline does not mention at all. A route absent from the
 * baseline is treated as having zero known violations. Layout shift fails
 * only past max(--cls-budget, baseline cls + 0.02). With --no-baseline (or
 * no baseline file and no route entry), every route is treated as having no
 * known problems, so any violation or any shift over budget fails.
 *
 * Sign-in (when --storage-state is not given) uses SEED_USER_PASSWORD and
 * the same form flow as e2e/helpers/auth.ts, signing in as seed user
 * "chris". Never writes typed values anywhere: no traces, no screenshots,
 * no HTML reports.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type BrowserContext, chromium, type Page } from "@playwright/test";
import { Client } from "pg";
import { signIn } from "../e2e/helpers/auth";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO_ROOT, "app");
const AXE_SCRIPT_PATH = require.resolve("axe-core/axe.min.js");
const DEFAULT_BASELINE_PATH = path.join(REPO_ROOT, ".a11y-baseline.json");

/**
 * A page fails if its visible text contains any of these, matched whole-word
 * (case-sensitive) where the pattern is alphanumeric, and as a literal
 * substring otherwise. Code samples (<pre>/<code>) are excluded before
 * matching, so a docs page showing "TODO" in an example snippet does not
 * trip this. Tune only with evidence of a real false positive.
 */
export const PLACEHOLDER_PATTERNS = [
	"Lorem ipsum",
	"TODO",
	"TBD",
	"PLACEHOLDER",
	"undefined",
	"NaN",
	"[object Object]",
];

/** The five checks a page result can fail on; --only picks a subset. */
export const CHECK_CATEGORIES = [
	"status",
	"errors",
	"placeholders",
	"a11y",
	"cls",
] as const;

export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

interface Args {
	all: boolean;
	baselinePath?: string;
	baseUrl: string;
	clsBudget: number;
	jsonOut?: string;
	noBaseline: boolean;
	only?: Set<CheckCategory>;
	paths: string[];
	storageState?: string;
	writeBaseline: boolean;
}

function requireValue(argv: string[], i: number, flag: string): string {
	const v = argv[i];
	if (v === undefined) {
		throw new Error(`${flag} requires a value`);
	}
	return v;
}

/** Parses --only's comma-separated value, rejecting anything not in CHECK_CATEGORIES. */
export function parseOnly(value: string): Set<CheckCategory> {
	const categories = value.split(",").map((s) => s.trim());
	const result = new Set<CheckCategory>();
	for (const category of categories) {
		if (!(CHECK_CATEGORIES as readonly string[]).includes(category)) {
			throw new Error(
				`--only: unknown check "${category}" (expected one of ${CHECK_CATEGORIES.join(", ")})`
			);
		}
		result.add(category as CheckCategory);
	}
	return result;
}

export function parseArgs(argv: string[]): Args {
	const args: Args = {
		baseUrl: "",
		all: false,
		paths: [],
		clsBudget: 0.1,
		noBaseline: false,
		writeBaseline: false,
	};
	let i = 0;
	while (i < argv.length) {
		const a = argv[i];
		if (a === undefined) {
			break;
		}
		switch (a) {
			case "--base-url":
				i++;
				args.baseUrl = requireValue(argv, i, "--base-url");
				break;
			case "--all":
				args.all = true;
				break;
			case "--storage-state":
				i++;
				args.storageState = requireValue(argv, i, "--storage-state");
				break;
			case "--only":
				i++;
				args.only = parseOnly(requireValue(argv, i, "--only"));
				break;
			case "--json":
				i++;
				args.jsonOut = requireValue(argv, i, "--json");
				break;
			case "--cls-budget":
				i++;
				args.clsBudget = Number(requireValue(argv, i, "--cls-budget"));
				break;
			case "--baseline":
				i++;
				args.baselinePath = requireValue(argv, i, "--baseline");
				break;
			case "--no-baseline":
				args.noBaseline = true;
				break;
			case "--write-baseline":
				args.writeBaseline = true;
				break;
			default:
				if (a.startsWith("--")) {
					throw new Error(`unknown flag: ${a}`);
				}
				args.paths.push(a);
		}
		i++;
	}
	if (!args.baseUrl) {
		throw new Error("--base-url is required");
	}
	if (!(args.all || args.paths.length > 0)) {
		throw new Error("provide --all or at least one path");
	}
	if (!Number.isFinite(args.clsBudget)) {
		throw new Error("--cls-budget must be a number");
	}
	return args;
}

// ============================================
// Route discovery (--all) and route-template matching
// ============================================

export function findPageFiles(dir: string, acc: string[] = []): string[] {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith("_")) {
			continue; // Next.js private folder — not a route
		}
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			findPageFiles(full, acc);
		} else if (entry.name === "page.tsx" || entry.name === "page.ts") {
			acc.push(full);
		}
	}
	return acc;
}

const ROUTE_GROUP_RE = /^\(.+\)$/;
const OPTIONAL_CATCHALL_RE = /^\[\[\.\.\.(.+)\]\]$/;
const CATCHALL_RE = /^\[\.\.\.(.+)\]$/;
const DYNAMIC_SEGMENT_RE = /^\[(.+)\]$/;

interface RouteTemplate {
	/** dynamic segment names appearing in `template`, in order */
	params: string[];
	/** e.g. "/discover/{slug}" */
	template: string;
}

export function toRouteTemplate(filePath: string): RouteTemplate {
	const rel = path.relative(APP_DIR, path.dirname(filePath)).split(path.sep);
	const params: string[] = [];
	const outSegments: string[] = [];
	for (const seg of rel) {
		if (seg === ".") {
			continue;
		}
		if (ROUTE_GROUP_RE.test(seg)) {
			continue; // route group — not part of the URL
		}
		const optionalCatchAll = seg.match(OPTIONAL_CATCHALL_RE);
		if (optionalCatchAll) {
			continue; // resolves to the parent path with no extra segment
		}
		const catchAll = seg.match(CATCHALL_RE);
		if (catchAll?.[1]) {
			params.push(catchAll[1]);
			outSegments.push(`{${catchAll[1]}}`);
			continue;
		}
		const dynamic = seg.match(DYNAMIC_SEGMENT_RE);
		if (dynamic?.[1]) {
			params.push(dynamic[1]);
			outSegments.push(`{${dynamic[1]}}`);
			continue;
		}
		outSegments.push(seg);
	}
	return { template: `/${outSegments.join("/")}`, params };
}

const REGEX_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;

/** Turns a route template like "/discover/{slug}" into a regex matching any filled path. */
export function buildRouteRegex(template: string): RegExp {
	const pattern = template
		.split("/")
		.map((seg) =>
			seg.startsWith("{") && seg.endsWith("}")
				? "[^/]+"
				: seg.replace(REGEX_ESCAPE_RE, "\\$&")
		)
		.join("/");
	return new RegExp(`^${pattern}$`);
}

/**
 * Finds which known route template a filled path belongs to, so an
 * explicitly-listed path (not just --all) can be looked up in the
 * baseline. Static templates are tried before dynamic ones, so
 * "/discover/new" prefers a literal "/discover/new" page over a sibling
 * "/discover/{slug}". Falls back to the bare pathname (its own "template")
 * when nothing matches, which the baseline then treats as unbaselined.
 */
export function matchRouteTemplate(
	routePath: string,
	templates: string[]
): string {
	const pathname = routePath.split("?")[0] ?? routePath;
	const ordered = [...templates].sort(
		(a, b) => Number(a.includes("{")) - Number(b.includes("{"))
	);
	for (const template of ordered) {
		if (buildRouteRegex(template).test(pathname)) {
			return template;
		}
	}
	return pathname;
}

function getKnownRouteTemplates(): string[] {
	return findPageFiles(APP_DIR)
		.filter((f) => !f.split(path.sep).includes("api"))
		.map((f) => toRouteTemplate(f).template);
}

interface ParamResolution {
	reason?: string;
	value?: string;
}

/** Seed-data lookups for the dynamic segments this app currently defines. */
export async function resolveParam(
	client: Client | null,
	name: string
): Promise<ParamResolution> {
	if (!client) {
		return {
			reason: "DATABASE_URL not set — cannot resolve dynamic route parameters",
		};
	}
	switch (name) {
		case "caseId": {
			const r = await client.query(
				`SELECT ac.id FROM assurance_cases ac
				 JOIN users u ON u.id = ac.created_by_id
				 WHERE u.username = 'chris' AND ac.deleted_at IS NULL
				 ORDER BY ac.created_at ASC LIMIT 1`
			);
			return r.rows[0]
				? { value: r.rows[0].id }
				: { reason: "no seed case owned by chris" };
		}
		case "slug": {
			const r = await client.query(
				`SELECT slug FROM published_assurance_cases
				 WHERE is_current = true ORDER BY created_at DESC LIMIT 1`
			);
			return r.rows[0]
				? { value: r.rows[0].slug }
				: { reason: "no currently-published seed case" };
		}
		case "id": {
			const r = await client.query(
				`SELECT tm.team_id AS id FROM team_members tm
				 JOIN users u ON u.id = tm.user_id
				 WHERE u.username = 'chris' LIMIT 1`
			);
			return r.rows[0]
				? { value: r.rows[0].id }
				: { reason: "seed user chris is not a member of any seed team" };
		}
		case "token": {
			const r = await client.query(
				`SELECT invite_token FROM case_invites
				 WHERE accepted_at IS NULL AND invite_expires_at > now()
				 ORDER BY created_at DESC LIMIT 1`
			);
			return r.rows[0]
				? { value: r.rows[0].invite_token }
				: { reason: "no pending seed case invite" };
		}
		default:
			return {
				reason: `no seed lookup defined for dynamic parameter "${name}"`,
			};
	}
}

interface SkippedRoute {
	path: string;
	reason: string;
}

/** Fills every dynamic segment in one route template, caching each param's DB lookup across routes. */
export async function resolveFilledPath(
	template: string,
	params: string[],
	cache: Map<string, ParamResolution>,
	client: Client | null
): Promise<{ filled?: string; skipReason?: string }> {
	let filled = template;
	for (const param of params) {
		if (!cache.has(param)) {
			cache.set(param, await resolveParam(client, param));
		}
		const resolution = cache.get(param) as ParamResolution;
		if (resolution.value === undefined) {
			return {
				skipReason: resolution.reason ?? `could not resolve {${param}}`,
			};
		}
		filled = filled.replace(`{${param}}`, resolution.value);
	}
	return { filled };
}

export async function discoverAllPaths(): Promise<{
	toCheck: string[];
	skipped: SkippedRoute[];
}> {
	const files = findPageFiles(APP_DIR).filter(
		(f) => !f.split(path.sep).includes("api")
	);
	const dbUrl = process.env.DATABASE_URL;
	const client = dbUrl ? new Client({ connectionString: dbUrl }) : null;
	if (client) {
		await client.connect();
	}
	const cache = new Map<string, ParamResolution>();
	const toCheck: string[] = [];
	const skipped: SkippedRoute[] = [];
	try {
		for (const file of files) {
			const { template, params } = toRouteTemplate(file);
			if (params.length === 0) {
				toCheck.push(template);
				continue;
			}
			const { filled, skipReason } = await resolveFilledPath(
				template,
				params,
				cache,
				client
			);
			if (skipReason) {
				skipped.push({ path: template, reason: skipReason });
			} else if (filled) {
				toCheck.push(filled);
			}
		}
	} finally {
		if (client) {
			await client.end();
		}
	}
	return { toCheck, skipped };
}

// ============================================
// Known-problems baseline
// ============================================

export interface BaselineEntry {
	cls: number;
	violations: Record<string, number>;
}

export type Baseline = Record<string, BaselineEntry>;

export interface BaselineDelta {
	clsBudgetUsed: number;
	clsExceeded: boolean;
	increasedRules: Array<{
		baselineCount: number;
		currentCount: number;
		id: string;
	}>;
	newRules: string[];
}

/**
 * Compares one page's current axe rule counts and CLS to its baseline
 * entry. A route with no entry is treated as zero known violations and the
 * plain budget — the same result --no-baseline gives for every route.
 */
export function compareToBaseline(
	current: { cls: number; violations: Record<string, number> },
	baselineEntry: BaselineEntry | undefined,
	clsBudget: number
): BaselineDelta {
	const baselineViolations = baselineEntry?.violations ?? {};
	const newRules: string[] = [];
	const increasedRules: BaselineDelta["increasedRules"] = [];
	for (const [ruleId, count] of Object.entries(current.violations)) {
		if (!(ruleId in baselineViolations)) {
			newRules.push(ruleId);
			continue;
		}
		const baselineCount = baselineViolations[ruleId] as number;
		if (count > baselineCount) {
			increasedRules.push({ id: ruleId, baselineCount, currentCount: count });
		}
	}
	const clsBudgetUsed = baselineEntry
		? Math.max(clsBudget, baselineEntry.cls + 0.02)
		: clsBudget;
	return {
		newRules,
		increasedRules,
		clsBudgetUsed,
		clsExceeded: current.cls > clsBudgetUsed,
	};
}

/** Sorted keys and stable formatting, so a regenerated baseline diffs cleanly. */
export function serialiseBaseline(baseline: Baseline): string {
	const out: Baseline = {};
	for (const route of Object.keys(baseline).sort()) {
		const entry = baseline[route] as BaselineEntry;
		const violations: Record<string, number> = {};
		for (const rule of Object.keys(entry.violations).sort()) {
			violations[rule] = entry.violations[rule] as number;
		}
		out[route] = { violations, cls: entry.cls };
	}
	return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * Decides which baseline file (if any) a run should use. Pure given an
 * injectable existence check, so the file-resolution rules are testable
 * without touching the real filesystem.
 */
export function resolveBaselinePath(
	args: { baselinePath?: string; noBaseline: boolean },
	fileExists: (p: string) => boolean
): string | undefined {
	if (args.noBaseline) {
		return;
	}
	if (args.baselinePath) {
		if (!fileExists(args.baselinePath)) {
			throw new Error(`baseline file not found: ${args.baselinePath}`);
		}
		return args.baselinePath;
	}
	return fileExists(DEFAULT_BASELINE_PATH) ? DEFAULT_BASELINE_PATH : undefined;
}

function loadBaseline(args: Args): Baseline {
	const filePath = resolveBaselinePath(args, fs.existsSync);
	if (!filePath) {
		return {};
	}
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as Baseline;
}

/** Rounds to 4 decimal places, so a regenerated baseline does not churn on floating-point noise. */
export function roundCls(cls: number): number {
	return Math.round(cls * 1e4) / 1e4;
}

function writeBaselineFile(outPath: string, results: PageResult[]): void {
	const baseline: Baseline = {};
	for (const r of results) {
		baseline[r.routeTemplate] = {
			violations: r.axe.violations,
			cls: roundCls(r.cls),
		};
	}
	fs.writeFileSync(outPath, serialiseBaseline(baseline));
}

// ============================================
// Redirects
// ============================================

const LOGIN_PATH_RE = /^\/login(?:\/|$)/;

export interface RedirectInfo {
	failReason: string | null;
	redirectedTo: string | null;
}

/** Every check here assumes an authenticated session, so landing on the sign-in page is always a failure — whether that came from a real session dying or (as in a deliberate test) a signed-out storage state. */
export function describeRedirect(
	requestedPath: string,
	finalUrl: string | null
): RedirectInfo {
	if (!finalUrl) {
		return { redirectedTo: null, failReason: null };
	}
	let finalPathname: string;
	let finalPath: string;
	try {
		const u = new URL(finalUrl);
		finalPathname = u.pathname;
		finalPath = `${u.pathname}${u.search}`;
	} catch {
		return { redirectedTo: null, failReason: null };
	}
	const requestedPathname = requestedPath.split("?")[0] ?? requestedPath;
	const redirectedTo = finalPathname !== requestedPathname ? finalPath : null;
	const failReason = LOGIN_PATH_RE.test(finalPathname)
		? "redirected to sign-in"
		: null;
	return { redirectedTo, failReason };
}

// ============================================
// Per-page checks
// ============================================

function injectClsObserver() {
	(window as unknown as { __clsValue: number }).__clsValue = 0;
	try {
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries() as (PerformanceEntry & {
				hadRecentInput: boolean;
				value: number;
			})[]) {
				if (!entry.hadRecentInput) {
					(window as unknown as { __clsValue: number }).__clsValue +=
						entry.value;
				}
			}
		});
		observer.observe({ type: "layout-shift", buffered: true });
	} catch {
		// layout-shift not supported in this engine; cls stays 0
	}
}

interface AxeSummary {
	byImpact: Record<string, number>;
	topRules: string[];
	/** serious+critical node count per rule id — what the baseline compares against */
	violations: Record<string, number>;
}

interface AxeRunResults {
	violations: Array<{
		id: string;
		impact?: string;
		nodes: unknown[];
	}>;
}

/** Pure tally half of the axe check: turns raw violations into the summary the baseline compares against. */
export function summariseAxeViolations(
	violations: AxeRunResults["violations"]
): AxeSummary {
	const byImpact: Record<string, number> = {};
	const ruleCounts = new Map<string, number>();
	const seriousOrCritical: Record<string, number> = {};
	for (const violation of violations) {
		const impact = violation.impact ?? "unknown";
		byImpact[impact] = (byImpact[impact] ?? 0) + 1;
		ruleCounts.set(
			violation.id,
			(ruleCounts.get(violation.id) ?? 0) + violation.nodes.length
		);
		if (impact === "serious" || impact === "critical") {
			seriousOrCritical[violation.id] =
				(seriousOrCritical[violation.id] ?? 0) + violation.nodes.length;
		}
	}
	const topRules = [...ruleCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([id]) => id);
	return { byImpact, topRules, violations: seriousOrCritical };
}

async function runAxe(page: Page): Promise<AxeSummary> {
	try {
		await page.addScriptTag({ path: AXE_SCRIPT_PATH });
		const results = await page.evaluate<AxeRunResults>(async () => {
			return await (
				window as unknown as { axe: { run: () => Promise<AxeRunResults> } }
			).axe.run();
		});
		return summariseAxeViolations(results.violations ?? []);
	} catch (err) {
		return {
			byImpact: { error: 1 },
			topRules: [
				`axe-injection-failed: ${err instanceof Error ? err.message : String(err)}`,
			],
			violations: {},
		};
	}
}

const PLACEHOLDER_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const WORDY_PATTERN_RE = /^[\w\s]+$/;

/** Pure text-matching half of the placeholder check — no DOM access. */
export function matchPlaceholders(text: string): string[] {
	const hits: string[] = [];
	for (const pattern of PLACEHOLDER_PATTERNS) {
		const escaped = pattern.replace(PLACEHOLDER_ESCAPE_RE, "\\$&");
		const isWordy = WORDY_PATTERN_RE.test(pattern);
		const re = isWordy ? new RegExp(`\\b${escaped}\\b`) : new RegExp(escaped);
		if (re.test(text)) {
			hits.push(pattern);
		}
	}
	return hits;
}

async function findPlaceholders(page: Page): Promise<string[]> {
	// Walk the live, attached body rather than a detached clone: a detached
	// clone has no layout box, so `innerText` on it silently returns "" and
	// falls back to `textContent`, which — unlike `innerText` — also pulls in
	// the raw contents of <script> tags. Next.js embeds its React Server
	// Components payload as inline JSON containing the literal token
	// "$undefined", which a naive textContent scan matches as "undefined".
	const text = await page.evaluate(() => {
		const SKIP_TAGS = new Set(["PRE", "CODE", "SCRIPT", "STYLE"]);
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode(node: Node) {
					let el = node.parentElement;
					while (el) {
						if (SKIP_TAGS.has(el.tagName)) {
							return NodeFilter.FILTER_REJECT;
						}
						el = el.parentElement;
					}
					return NodeFilter.FILTER_ACCEPT;
				},
			}
		);
		let out = "";
		let node = walker.nextNode();
		while (node) {
			out += `${node.textContent ?? ""} `;
			node = walker.nextNode();
		}
		return out;
	});
	return matchPlaceholders(text);
}

export interface PageResult {
	axe: AxeSummary;
	baselineDelta: {
		clsBudgetUsed: number;
		increasedRules: BaselineDelta["increasedRules"];
		newRules: string[];
	};
	cls: number;
	consoleErrors: string[];
	failReasons: string[];
	finalUrl: string | null;
	pageErrors: string[];
	pass: boolean;
	path: string;
	placeholderHits: string[];
	redirectedTo: string | null;
	routeTemplate: string;
	status: number | null;
}

/**
 * Pure assembly of a page's failure reasons from its already-computed checks.
 * `only`, when given, restricts which categories can appear here at all —
 * the rest of a page's result (axe, cls, placeholderHits, ...) is unaffected,
 * so an excluded category's findings are still measured and reported there,
 * just not counted towards `pass`.
 */
export function buildFailReasons(input: {
	cls: number;
	delta: BaselineDelta;
	only?: Set<CheckCategory>;
	pageErrorCount: number;
	placeholderHits: string[];
	redirectFailReason: string | null;
	status: number | null;
}): string[] {
	const include = (category: CheckCategory) =>
		!input.only || input.only.has(category);
	const failReasons: string[] = [];
	if (include("status") && (input.status === null || input.status >= 400)) {
		failReasons.push(`status ${input.status ?? "none"}`);
	}
	if (include("errors") && input.pageErrorCount > 0) {
		failReasons.push(`${input.pageErrorCount} page error(s)`);
	}
	if (include("errors") && input.redirectFailReason) {
		failReasons.push(input.redirectFailReason);
	}
	if (include("cls") && input.delta.clsExceeded) {
		failReasons.push(
			`cls ${input.cls.toFixed(3)} over budget ${input.delta.clsBudgetUsed.toFixed(3)}`
		);
	}
	if (include("a11y") && input.delta.newRules.length > 0) {
		failReasons.push(
			`new accessibility rule(s): ${input.delta.newRules.join(", ")}`
		);
	}
	if (include("a11y") && input.delta.increasedRules.length > 0) {
		failReasons.push(
			`accessibility rule(s) increased: ${input.delta.increasedRules
				.map((r) => `${r.id} ${r.baselineCount}->${r.currentCount}`)
				.join(", ")}`
		);
	}
	if (include("placeholders") && input.placeholderHits.length > 0) {
		failReasons.push(`placeholder text: ${input.placeholderHits.join(", ")}`);
	}
	return failReasons;
}

export async function checkPage(
	context: BrowserContext,
	routePath: string,
	clsBudget: number,
	baseline: Baseline,
	routeTemplate: string,
	only?: Set<CheckCategory>
): Promise<PageResult> {
	const page = await context.newPage();
	const pageErrors: string[] = [];
	const consoleErrors: string[] = [];
	page.on("pageerror", (err) => pageErrors.push(err.message));
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			consoleErrors.push(msg.text());
		}
	});

	let status: number | null = null;
	let finalUrl: string | null = null;
	try {
		// "load", not "networkidle": a page holding an open SSE connection
		// (case canvas) never goes network-idle, and would time out here.
		const response = await page.goto(routePath, { waitUntil: "load" });
		status = response ? response.status() : null;
		finalUrl = page.url();
		await page.waitForTimeout(750); // let late layout shifts land before reading CLS
	} catch (err) {
		pageErrors.push(
			`navigation failed: ${err instanceof Error ? err.message : String(err)}`
		);
		try {
			finalUrl = page.url();
		} catch {
			// page may already be gone
		}
	}

	let cls = 0;
	try {
		cls = await page.evaluate(
			() => (window as unknown as { __clsValue?: number }).__clsValue ?? 0
		);
	} catch {
		// page may have navigated away or crashed; already reported as a page error
	}

	const axe = await runAxe(page);
	const placeholderHits = await findPlaceholders(page);

	await page.close();

	const { redirectedTo, failReason: redirectFailReason } = describeRedirect(
		routePath,
		finalUrl
	);
	const delta = compareToBaseline(
		{ violations: axe.violations, cls },
		baseline[routeTemplate],
		clsBudget
	);
	const failReasons = buildFailReasons({
		status,
		pageErrorCount: pageErrors.length,
		redirectFailReason,
		cls,
		delta,
		placeholderHits,
		only,
	});

	return {
		path: routePath,
		routeTemplate,
		status,
		finalUrl,
		redirectedTo,
		pageErrors,
		consoleErrors,
		cls,
		axe,
		placeholderHits,
		pass: failReasons.length === 0,
		failReasons,
		baselineDelta: {
			newRules: delta.newRules,
			increasedRules: delta.increasedRules,
			clsBudgetUsed: delta.clsBudgetUsed,
		},
	};
}

function checkThrewResult(
	routePath: string,
	routeTemplate: string,
	clsBudget: number,
	err: unknown
): PageResult {
	return {
		path: routePath,
		routeTemplate,
		status: null,
		finalUrl: null,
		redirectedTo: null,
		pageErrors: [],
		consoleErrors: [],
		cls: 0,
		axe: { byImpact: {}, topRules: [], violations: {} },
		placeholderHits: [],
		pass: false,
		failReasons: [
			`check threw: ${err instanceof Error ? err.message : String(err)}`,
		],
		baselineDelta: {
			newRules: [],
			increasedRules: [],
			clsBudgetUsed: clsBudget,
		},
	};
}

// ============================================
// Main
// ============================================

/** One clear, consistent message for every sign-in failure path. */
export function signInFailureMessage(detail: string): string {
	return `sign-in failed: check SEED_USER_PASSWORD or --storage-state (${detail})`;
}

/** Attempts the form sign-in, returning the failure detail rather than throwing. */
async function trySignIn(page: Page, password: string): Promise<string | null> {
	try {
		await signIn(page, "chris", password);
		return null;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

/**
 * Signs in as the seed user unless a storage state was supplied. Reports its
 * own failure with one clear message and returns false rather than throwing,
 * so the caller can close the browser before exiting.
 */
async function ensureSignedIn(
	context: BrowserContext,
	storageState: string | undefined
): Promise<boolean> {
	if (storageState) {
		return true;
	}
	const password = process.env.SEED_USER_PASSWORD;
	if (!password) {
		console.error(signInFailureMessage("SEED_USER_PASSWORD is not set"));
		return false;
	}
	const loginPage = await context.newPage();
	const failure = await trySignIn(loginPage, password);
	if (failure) {
		console.error(signInFailureMessage(failure));
		return false;
	}
	await loginPage.close();
	return true;
}

/** Runs every page's check, isolating one page's exception as that page's failure. */
async function runChecks(
	context: BrowserContext,
	toCheck: string[],
	clsBudget: number,
	baseline: Baseline,
	only?: Set<CheckCategory>
): Promise<PageResult[]> {
	await context.addInitScript(injectClsObserver);
	const knownTemplates = getKnownRouteTemplates();
	const results: PageResult[] = [];
	for (const routePath of toCheck) {
		const routeTemplate = matchRouteTemplate(routePath, knownTemplates);
		let result: PageResult;
		try {
			result = await checkPage(
				context,
				routePath,
				clsBudget,
				baseline,
				routeTemplate,
				only
			);
		} catch (err) {
			result = checkThrewResult(routePath, routeTemplate, clsBudget, err);
		}
		results.push(result);
		console.log(JSON.stringify(result));
	}
	return results;
}

/** Prints skipped routes, optionally writes the baseline and JSON output, and sets the exit code. */
export function reportResults(
	results: PageResult[],
	skipped: SkippedRoute[],
	args: Args
): void {
	for (const s of skipped) {
		console.log(
			JSON.stringify({ path: s.path, skipped: true, reason: s.reason })
		);
	}

	if (args.writeBaseline) {
		writeBaselineFile(args.baselinePath ?? DEFAULT_BASELINE_PATH, results);
	}

	if (args.jsonOut) {
		fs.writeFileSync(
			args.jsonOut,
			JSON.stringify({ results, skipped }, null, 2)
		);
	}

	const passCount = results.filter((r) => r.pass).length;
	const failCount = results.length - passCount;
	console.log(
		`PAGES pass=${passCount} fail=${failCount} skipped=${skipped.length}`
	);
	if (results.some((r) => r.consoleErrors.length > 0)) {
		console.log(
			"(console errors are reported per-page above but do not fail a page)"
		);
	}

	process.exitCode = failCount > 0 ? 1 : 0;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	let toCheck: string[];
	const skipped: SkippedRoute[] = [];
	if (args.all) {
		const discovered = await discoverAllPaths();
		toCheck = discovered.toCheck;
		skipped.push(...discovered.skipped);
	} else {
		toCheck = args.paths;
	}

	const baseline = loadBaseline(args);

	const browser = await chromium.launch({ headless: true });
	// No trace, no video, no screenshots — this context never writes a typed
	// value anywhere, and nothing here uses the Playwright test runner, so no
	// HTML report is produced either.
	let results: PageResult[] = [];
	try {
		const context = args.storageState
			? await browser.newContext({
					baseURL: args.baseUrl,
					storageState: args.storageState,
				})
			: await browser.newContext({ baseURL: args.baseUrl });

		const signedIn = await ensureSignedIn(context, args.storageState);
		if (!signedIn) {
			process.exitCode = 1;
			return;
		}

		results = await runChecks(
			context,
			toCheck,
			args.clsBudget,
			baseline,
			args.only
		);
	} finally {
		await browser.close();
	}

	reportResults(results, skipped, args);
}

// ESM entry-point guard — runs main() when invoked directly (tsx/pnpm) but
// not when a unit test imports this module for its pure functions. Compares
// against a file URL built with pathToFileURL rather than a template string,
// since a path containing a space is not a valid URL when interpolated raw.
if (
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	main().catch((err) => {
		console.error(err);
		process.exitCode = 1;
	});
}
