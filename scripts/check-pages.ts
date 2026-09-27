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
 *   --json <file>           also write the full result array as JSON
 *   --cls-budget <n>        cumulative layout shift budget (default 0.1)
 *
 * Sign-in (when --storage-state is not given) uses SEED_USER_PASSWORD and
 * the same form flow as e2e/helpers/auth.ts, signing in as seed user
 * "chris". Never writes typed values anywhere: no traces, no screenshots,
 * no HTML reports.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, chromium, type Page } from "@playwright/test";
import { Client } from "pg";
import { signIn } from "../e2e/helpers/auth";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO_ROOT, "app");
const AXE_SCRIPT_PATH = require.resolve("axe-core/axe.min.js");

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

interface Args {
	all: boolean;
	baseUrl: string;
	clsBudget: number;
	jsonOut?: string;
	paths: string[];
	storageState?: string;
}

function requireValue(argv: string[], i: number, flag: string): string {
	const v = argv[i];
	if (v === undefined) {
		throw new Error(`${flag} requires a value`);
	}
	return v;
}

function parseArgs(argv: string[]): Args {
	const args: Args = { baseUrl: "", all: false, paths: [], clsBudget: 0.1 };
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
			case "--json":
				i++;
				args.jsonOut = requireValue(argv, i, "--json");
				break;
			case "--cls-budget":
				i++;
				args.clsBudget = Number(requireValue(argv, i, "--cls-budget"));
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
// Route discovery (--all)
// ============================================

function findPageFiles(dir: string, acc: string[] = []): string[] {
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

function toRouteTemplate(filePath: string): RouteTemplate {
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

interface ParamResolution {
	reason?: string;
	value?: string;
}

/** Seed-data lookups for the dynamic segments this app currently defines. */
async function resolveParam(
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

async function discoverAllPaths(): Promise<{
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
			let filled = template;
			let skipReason: string | undefined;
			for (const param of params) {
				if (!cache.has(param)) {
					cache.set(param, await resolveParam(client, param));
				}
				const resolution = cache.get(param) as ParamResolution;
				if (resolution.value === undefined) {
					skipReason = resolution.reason ?? `could not resolve {${param}}`;
					break;
				}
				filled = filled.replace(`{${param}}`, resolution.value);
			}
			if (skipReason) {
				skipped.push({ path: template, reason: skipReason });
			} else {
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
}

interface AxeRunResults {
	violations: Array<{
		id: string;
		impact?: string;
		nodes: unknown[];
	}>;
}

async function runAxe(page: Page): Promise<AxeSummary> {
	try {
		await page.addScriptTag({ path: AXE_SCRIPT_PATH });
		const results = await page.evaluate<AxeRunResults>(async () => {
			return await (
				window as unknown as { axe: { run: () => Promise<AxeRunResults> } }
			).axe.run();
		});
		const byImpact: Record<string, number> = {};
		const ruleCounts = new Map<string, number>();
		for (const violation of results.violations ?? []) {
			const impact = violation.impact ?? "unknown";
			byImpact[impact] = (byImpact[impact] ?? 0) + 1;
			ruleCounts.set(
				violation.id,
				(ruleCounts.get(violation.id) ?? 0) + violation.nodes.length
			);
		}
		const topRules = [...ruleCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([id]) => id);
		return { byImpact, topRules };
	} catch (err) {
		return {
			byImpact: { error: 1 },
			topRules: [
				`axe-injection-failed: ${err instanceof Error ? err.message : String(err)}`,
			],
		};
	}
}

const REGEX_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
const WORDY_PATTERN_RE = /^[\w\s]+$/;

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
	const hits: string[] = [];
	for (const pattern of PLACEHOLDER_PATTERNS) {
		const escaped = pattern.replace(REGEX_ESCAPE_RE, "\\$&");
		const isWordy = WORDY_PATTERN_RE.test(pattern);
		const re = isWordy ? new RegExp(`\\b${escaped}\\b`) : new RegExp(escaped);
		if (re.test(text)) {
			hits.push(pattern);
		}
	}
	return hits;
}

interface PageResult {
	axe: AxeSummary;
	cls: number;
	consoleErrors: string[];
	failReasons: string[];
	pageErrors: string[];
	pass: boolean;
	path: string;
	placeholderHits: string[];
	status: number | null;
}

async function checkPage(
	context: BrowserContext,
	routePath: string,
	clsBudget: number
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
	try {
		// "load", not "networkidle": a page holding an open SSE connection
		// (case canvas) never goes network-idle, and would time out here.
		const response = await page.goto(routePath, { waitUntil: "load" });
		status = response ? response.status() : null;
		await page.waitForTimeout(750); // let late layout shifts land before reading CLS
	} catch (err) {
		pageErrors.push(
			`navigation failed: ${err instanceof Error ? err.message : String(err)}`
		);
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

	const failReasons: string[] = [];
	if (status === null || status >= 400) {
		failReasons.push(`status ${status ?? "none"}`);
	}
	if (pageErrors.length > 0) {
		failReasons.push(`${pageErrors.length} page error(s)`);
	}
	if (cls > clsBudget) {
		failReasons.push(`cls ${cls.toFixed(3)} over budget ${clsBudget}`);
	}
	const seriousOrCritical =
		(axe.byImpact.critical ?? 0) + (axe.byImpact.serious ?? 0);
	if (seriousOrCritical > 0) {
		failReasons.push(`${seriousOrCritical} serious/critical axe violation(s)`);
	}
	if (placeholderHits.length > 0) {
		failReasons.push(`placeholder text: ${placeholderHits.join(", ")}`);
	}

	return {
		path: routePath,
		status,
		pageErrors,
		consoleErrors,
		cls,
		axe,
		placeholderHits,
		pass: failReasons.length === 0,
		failReasons,
	};
}

// ============================================
// Main
// ============================================

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

	const browser = await chromium.launch({ headless: true });
	// No trace, no video, no screenshots — this context never writes a typed
	// value anywhere, and nothing here uses the Playwright test runner, so no
	// HTML report is produced either.
	const context = args.storageState
		? await browser.newContext({
				baseURL: args.baseUrl,
				storageState: args.storageState,
			})
		: await browser.newContext({ baseURL: args.baseUrl });

	if (!args.storageState) {
		const password = process.env.SEED_USER_PASSWORD;
		if (!password) {
			await browser.close();
			throw new Error(
				"SEED_USER_PASSWORD is required unless --storage-state is given"
			);
		}
		const loginPage = await context.newPage();
		await signIn(loginPage, "chris", password);
		await loginPage.close();
	}

	await context.addInitScript(injectClsObserver);

	const results: PageResult[] = [];
	for (const routePath of toCheck) {
		const result = await checkPage(context, routePath, args.clsBudget);
		results.push(result);
		console.log(JSON.stringify(result));
	}

	await browser.close();

	for (const s of skipped) {
		console.log(
			JSON.stringify({ path: s.path, skipped: true, reason: s.reason })
		);
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

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
