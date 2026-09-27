import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type Baseline,
	buildFailReasons,
	buildRouteRegex,
	compareToBaseline,
	describeRedirect,
	findPageFiles,
	matchPlaceholders,
	matchRouteTemplate,
	parseArgs,
	resolveBaselinePath,
	resolveParam,
	serializeBaseline,
	signInFailureMessage,
	summarizeAxeViolations,
	toRouteTemplate,
} from "../check-pages";

const BASELINE_FILENAME_RE = /\.a11y-baseline\.json$/;

// ============================================
// parseArgs
// ============================================

describe("parseArgs", () => {
	it("parses a base URL and explicit paths, applying defaults", () => {
		const args = parseArgs([
			"--base-url",
			"http://localhost:3000",
			"/discover",
		]);
		expect(args).toMatchObject({
			baseUrl: "http://localhost:3000",
			paths: ["/discover"],
			all: false,
			clsBudget: 0.1,
			noBaseline: false,
			writeBaseline: false,
		});
	});

	it("accepts --all in place of explicit paths", () => {
		const args = parseArgs(["--base-url", "http://localhost:3000", "--all"]);
		expect(args.all).toBe(true);
		expect(args.paths).toEqual([]);
	});

	it("parses --storage-state, --json, --cls-budget, --baseline, --no-baseline and --write-baseline", () => {
		const args = parseArgs([
			"--base-url",
			"http://localhost:3000",
			"--all",
			"--storage-state",
			"state.json",
			"--json",
			"out.json",
			"--cls-budget",
			"0.2",
			"--baseline",
			"custom-baseline.json",
			"--no-baseline",
			"--write-baseline",
		]);
		expect(args.storageState).toBe("state.json");
		expect(args.jsonOut).toBe("out.json");
		expect(args.clsBudget).toBe(0.2);
		expect(args.baselinePath).toBe("custom-baseline.json");
		expect(args.noBaseline).toBe(true);
		expect(args.writeBaseline).toBe(true);
	});

	it("throws when --base-url is missing", () => {
		expect(() => parseArgs(["/discover"])).toThrow("--base-url is required");
	});

	it("throws when neither --all nor a path is given", () => {
		expect(() => parseArgs(["--base-url", "http://localhost:3000"])).toThrow(
			"provide --all or at least one path"
		);
	});

	it("throws on an unknown flag", () => {
		expect(() =>
			parseArgs(["--base-url", "http://localhost:3000", "--bogus"])
		).toThrow("unknown flag: --bogus");
	});

	it("throws when --cls-budget is not a number", () => {
		expect(() =>
			parseArgs([
				"--base-url",
				"http://localhost:3000",
				"--all",
				"--cls-budget",
				"nope",
			])
		).toThrow("--cls-budget must be a number");
	});

	it("throws when a flag requiring a value is given none", () => {
		expect(() => parseArgs(["--base-url"])).toThrow(
			"--base-url requires a value"
		);
	});
});

// ============================================
// toRouteTemplate
// ============================================

describe("toRouteTemplate", () => {
	const appDir = path.join(
		path.resolve(import.meta.dirname, ".."),
		"..",
		"app"
	);
	const file = (...rel: string[]) => path.join(appDir, ...rel);

	it("keeps a static route unchanged", () => {
		expect(toRouteTemplate(file("dashboard", "page.tsx"))).toEqual({
			template: "/dashboard",
			params: [],
		});
	});

	it("drops a route group from the URL", () => {
		expect(toRouteTemplate(file("(app)", "dashboard", "page.tsx"))).toEqual({
			template: "/dashboard",
			params: [],
		});
	});

	it("turns a dynamic segment into a named placeholder", () => {
		expect(toRouteTemplate(file("case", "[caseId]", "page.tsx"))).toEqual({
			template: "/case/{caseId}",
			params: ["caseId"],
		});
	});

	it("turns a catch-all segment into a named placeholder", () => {
		expect(toRouteTemplate(file("docs", "[...slug]", "page.tsx"))).toEqual({
			template: "/docs/{slug}",
			params: ["slug"],
		});
	});

	it("resolves an optional catch-all to its parent path", () => {
		expect(toRouteTemplate(file("docs", "[[...slug]]", "page.tsx"))).toEqual({
			template: "/docs",
			params: [],
		});
	});

	it("resolves the app root to /", () => {
		expect(toRouteTemplate(file("page.tsx"))).toEqual({
			template: "/",
			params: [],
		});
	});
});

// ============================================
// matchRouteTemplate / buildRouteRegex
// ============================================

describe("buildRouteRegex / matchRouteTemplate", () => {
	it("matches a filled dynamic path back to its template", () => {
		const templates = ["/discover", "/discover/{slug}"];
		expect(matchRouteTemplate("/discover/my-case", templates)).toBe(
			"/discover/{slug}"
		);
	});

	it("prefers a static template over a same-shaped dynamic one", () => {
		const templates = ["/discover/{slug}", "/discover/new"];
		expect(matchRouteTemplate("/discover/new", templates)).toBe(
			"/discover/new"
		);
	});

	it("falls back to the bare path when nothing matches", () => {
		expect(matchRouteTemplate("/nowhere", ["/discover"])).toBe("/nowhere");
	});

	it("does not let a dynamic segment cross a slash", () => {
		expect(buildRouteRegex("/case/{caseId}").test("/case/a/b")).toBe(false);
		expect(buildRouteRegex("/case/{caseId}").test("/case/abc")).toBe(true);
	});
});

// ============================================
// resolveParam
// ============================================

const NO_DATABASE_URL_RE = /DATABASE_URL/;
const NO_SEED_CASE_RE = /no seed case/;
const NO_SEED_LOOKUP_RE = /no seed lookup defined/;

function fakeClient(rows: Record<string, unknown>[]): Client {
	return { query: async () => ({ rows }) } as unknown as Client;
}

describe("resolveParam", () => {
	it("reports a reason when no database client is available", async () => {
		const result = await resolveParam(null, "caseId");
		expect(result.value).toBeUndefined();
		expect(result.reason).toMatch(NO_DATABASE_URL_RE);
	});

	it("resolves caseId from the first row returned", async () => {
		const result = await resolveParam(fakeClient([{ id: "case-1" }]), "caseId");
		expect(result).toEqual({ value: "case-1" });
	});

	it("reports a reason when caseId has no seed row", async () => {
		const result = await resolveParam(fakeClient([]), "caseId");
		expect(result.value).toBeUndefined();
		expect(result.reason).toMatch(NO_SEED_CASE_RE);
	});

	it("resolves slug, id and token from their respective columns", async () => {
		await expect(
			resolveParam(fakeClient([{ slug: "s1" }]), "slug")
		).resolves.toEqual({ value: "s1" });
		await expect(
			resolveParam(fakeClient([{ id: "team-1" }]), "id")
		).resolves.toEqual({ value: "team-1" });
		await expect(
			resolveParam(fakeClient([{ invite_token: "tok" }]), "token")
		).resolves.toEqual({ value: "tok" });
	});

	it("reports a reason for a parameter with no seed lookup defined", async () => {
		const result = await resolveParam(fakeClient([]), "somethingElse");
		expect(result.reason).toMatch(NO_SEED_LOOKUP_RE);
	});
});

// ============================================
// findPageFiles
// ============================================

describe("findPageFiles", () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-pages-test-"));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("finds page.tsx and page.ts, recursing into subdirectories", () => {
		fs.mkdirSync(path.join(dir, "dashboard"));
		fs.writeFileSync(path.join(dir, "dashboard", "page.tsx"), "");
		fs.mkdirSync(path.join(dir, "docs"));
		fs.writeFileSync(path.join(dir, "docs", "page.ts"), "");
		const found = findPageFiles(dir);
		expect(found.sort()).toEqual(
			[
				path.join(dir, "dashboard", "page.tsx"),
				path.join(dir, "docs", "page.ts"),
			].sort()
		);
	});

	it("skips Next.js private folders and unrelated files", () => {
		fs.mkdirSync(path.join(dir, "_components"));
		fs.writeFileSync(path.join(dir, "_components", "page.tsx"), "");
		fs.mkdirSync(path.join(dir, "dashboard"));
		fs.writeFileSync(path.join(dir, "dashboard", "layout.tsx"), "");
		expect(findPageFiles(dir)).toEqual([]);
	});
});

// ============================================
// compareToBaseline
// ============================================

describe("compareToBaseline", () => {
	it("treats a route with no baseline entry as zero known violations", () => {
		const delta = compareToBaseline(
			{ violations: { "color-contrast": 2 }, cls: 0.05 },
			undefined,
			0.1
		);
		expect(delta.newRules).toEqual(["color-contrast"]);
		expect(delta.increasedRules).toEqual([]);
		expect(delta.clsBudgetUsed).toBe(0.1);
		expect(delta.clsExceeded).toBe(false);
	});

	it("does not fail on a known violation whose count has not increased", () => {
		const delta = compareToBaseline(
			{ violations: { "color-contrast": 2 }, cls: 0 },
			{ violations: { "color-contrast": 2 }, cls: 0 },
			0.1
		);
		expect(delta.newRules).toEqual([]);
		expect(delta.increasedRules).toEqual([]);
	});

	it("flags a rule whose count increased over the baseline", () => {
		const delta = compareToBaseline(
			{ violations: { "color-contrast": 5 }, cls: 0 },
			{ violations: { "color-contrast": 2 }, cls: 0 },
			0.1
		);
		expect(delta.increasedRules).toEqual([
			{ id: "color-contrast", baselineCount: 2, currentCount: 5 },
		]);
	});

	it("flags a rule absent from the baseline even when other rules are known", () => {
		const delta = compareToBaseline(
			{ violations: { "color-contrast": 2, "image-alt": 1 }, cls: 0 },
			{ violations: { "color-contrast": 2 }, cls: 0 },
			0.1
		);
		expect(delta.newRules).toEqual(["image-alt"]);
	});

	it("allows CLS up to the baseline plus 0.02 over the plain budget", () => {
		const delta = compareToBaseline(
			{ violations: {}, cls: 0.14 },
			{ violations: {}, cls: 0.13 },
			0.1
		);
		expect(delta.clsBudgetUsed).toBeCloseTo(0.15);
		expect(delta.clsExceeded).toBe(false);
	});

	it("fails CLS once it exceeds the baseline plus 0.02", () => {
		const delta = compareToBaseline(
			{ violations: {}, cls: 0.16 },
			{ violations: {}, cls: 0.13 },
			0.1
		);
		expect(delta.clsExceeded).toBe(true);
	});
});

// ============================================
// serializeBaseline
// ============================================

describe("serializeBaseline", () => {
	it("sorts route keys and per-route rule keys", () => {
		const baseline: Baseline = {
			"/b": { violations: { z: 1, a: 2 }, cls: 0 },
			"/a": { violations: {}, cls: 0.1 },
		};
		const serialized = serializeBaseline(baseline);
		const routeOrder = [...serialized.matchAll(/"(\/[a-z]*)":/g)].map(
			(m) => m[1]
		);
		expect(routeOrder).toEqual(["/a", "/b"]);
		expect(serialized.indexOf('"a"')).toBeLessThan(serialized.indexOf('"z"'));
		expect(serialized.endsWith("\n")).toBe(true);
	});
});

// ============================================
// describeRedirect
// ============================================

describe("describeRedirect", () => {
	it("reports no redirect when the final URL matches the requested path", () => {
		expect(
			describeRedirect("/dashboard", "http://localhost:3000/dashboard")
		).toEqual({ redirectedTo: null, failReason: null });
	});

	it("fails a signed-in check that lands on the sign-in page", () => {
		const result = describeRedirect(
			"/dashboard",
			"http://localhost:3000/login?callbackUrl=%2Fdashboard"
		);
		expect(result.failReason).toBe("redirected to sign-in");
		expect(result.redirectedTo).toBe("/login?callbackUrl=%2Fdashboard");
	});

	it("reports a non-sign-in redirect without failing", () => {
		const result = describeRedirect(
			"/old-path",
			"http://localhost:3000/new-path"
		);
		expect(result).toEqual({ redirectedTo: "/new-path", failReason: null });
	});

	it("returns nulls when there is no final URL", () => {
		expect(describeRedirect("/dashboard", null)).toEqual({
			redirectedTo: null,
			failReason: null,
		});
	});
});

// ============================================
// matchPlaceholders
// ============================================

describe("matchPlaceholders", () => {
	it("matches a whole-word alphanumeric pattern", () => {
		expect(matchPlaceholders("this is a TODO for later")).toEqual(["TODO"]);
	});

	it("does not match a whole-word pattern inside a larger word", () => {
		expect(matchPlaceholders("TODOLIST")).toEqual([]);
	});

	it("matches a non-alphanumeric pattern as a literal substring", () => {
		expect(matchPlaceholders("value: [object Object] here")).toEqual([
			"[object Object]",
		]);
	});

	it("returns no hits on ordinary page text", () => {
		expect(matchPlaceholders("Welcome to your dashboard")).toEqual([]);
	});

	it("can report more than one distinct hit", () => {
		const hits = matchPlaceholders("Lorem ipsum dolor, TBD");
		expect(hits.sort()).toEqual(["Lorem ipsum", "TBD"]);
	});
});

// ============================================
// resolveBaselinePath
// ============================================

describe("resolveBaselinePath", () => {
	it("returns undefined when --no-baseline is set, even with a path given", () => {
		expect(
			resolveBaselinePath(
				{ noBaseline: true, baselinePath: "custom.json" },
				() => true
			)
		).toBeUndefined();
	});

	it("uses an explicit --baseline path when it exists", () => {
		expect(
			resolveBaselinePath(
				{ noBaseline: false, baselinePath: "custom.json" },
				() => true
			)
		).toBe("custom.json");
	});

	it("throws when an explicit --baseline path does not exist", () => {
		expect(() =>
			resolveBaselinePath(
				{ noBaseline: false, baselinePath: "missing.json" },
				() => false
			)
		).toThrow("baseline file not found: missing.json");
	});

	it("falls back to the default path when it exists", () => {
		expect(resolveBaselinePath({ noBaseline: false }, () => true)).toMatch(
			BASELINE_FILENAME_RE
		);
	});

	it("returns undefined when nothing is given and the default is absent", () => {
		expect(
			resolveBaselinePath({ noBaseline: false }, () => false)
		).toBeUndefined();
	});
});

// ============================================
// summarizeAxeViolations
// ============================================

describe("summarizeAxeViolations", () => {
	it("counts serious+critical nodes per rule, ignoring lesser impacts", () => {
		const summary = summarizeAxeViolations([
			{ id: "color-contrast", impact: "serious", nodes: [1, 2] },
			{ id: "color-contrast", impact: "serious", nodes: [3] },
			{ id: "region", impact: "moderate", nodes: [1] },
		]);
		expect(summary.violations).toEqual({ "color-contrast": 3 });
		expect(summary.byImpact).toEqual({ serious: 2, moderate: 1 });
	});

	it("ranks topRules by total node count across all impacts", () => {
		const summary = summarizeAxeViolations([
			{ id: "a", impact: "minor", nodes: [1] },
			{ id: "b", impact: "critical", nodes: [1, 2, 3] },
		]);
		expect(summary.topRules[0]).toBe("b");
	});

	it("returns empty results for no violations", () => {
		expect(summarizeAxeViolations([])).toEqual({
			byImpact: {},
			topRules: [],
			violations: {},
		});
	});
});

// ============================================
// buildFailReasons
// ============================================

describe("buildFailReasons", () => {
	const noProblemsDelta = {
		newRules: [],
		increasedRules: [],
		clsBudgetUsed: 0.1,
		clsExceeded: false,
	};

	it("passes with no reasons when nothing is wrong", () => {
		expect(
			buildFailReasons({
				status: 200,
				pageErrorCount: 0,
				redirectFailReason: null,
				cls: 0,
				delta: noProblemsDelta,
				placeholderHits: [],
			})
		).toEqual([]);
	});

	it("reports a bad status, page errors, a redirect and placeholder text together", () => {
		const reasons = buildFailReasons({
			status: 500,
			pageErrorCount: 2,
			redirectFailReason: "redirected to sign-in",
			cls: 0,
			delta: noProblemsDelta,
			placeholderHits: ["TODO"],
		});
		expect(reasons).toEqual([
			"status 500",
			"2 page error(s)",
			"redirected to sign-in",
			"placeholder text: TODO",
		]);
	});

	it("reports a new and an increased accessibility rule", () => {
		const reasons = buildFailReasons({
			status: 200,
			pageErrorCount: 0,
			redirectFailReason: null,
			cls: 0,
			delta: {
				newRules: ["image-alt"],
				increasedRules: [
					{ id: "color-contrast", baselineCount: 2, currentCount: 5 },
				],
				clsBudgetUsed: 0.1,
				clsExceeded: false,
			},
			placeholderHits: [],
		});
		expect(reasons).toEqual([
			"new accessibility rule(s): image-alt",
			"accessibility rule(s) increased: color-contrast 2->5",
		]);
	});
});

// ============================================
// signInFailureMessage
// ============================================

describe("signInFailureMessage", () => {
	it("wraps the detail in a consistent, actionable message", () => {
		expect(signInFailureMessage("timed out")).toBe(
			"sign-in failed: check SEED_USER_PASSWORD or --storage-state (timed out)"
		);
	});
});
