import { beforeAll, describe, expect, it, vi } from "vitest";

// The documentation plug-in only wraps the config; the headers under test
// belong to the config itself, so the wrapper is replaced by the identity.
vi.mock("fumadocs-mdx/next", () => ({
	createMDX: () => (config: unknown) => config,
}));

interface HeaderRule {
	headers: { key: string; value: string }[];
	source: string;
}

interface LoadedConfig {
	headers?: () => Promise<HeaderRule[]>;
}

interface Policy {
	directives: Map<string, string[]>;
	repeated: string[];
}

/** Sources Next.js reads as "every path". */
const CATCH_ALL_SOURCES = ["/:path*", "/(.*)", "/:path(.*)", "/:slug*"];

const CONTENT_SECURITY_POLICY = "content-security-policy";
const WHITESPACE = /\s+/;
const SCHEME_ONLY_SOURCE = /^[a-z]+:$/;

let rules: HeaderRule[] = [];
let headersIsAFunction = false;

beforeAll(async () => {
	const configPath = "../../next.config.mjs";
	const loaded = (await import(/* @vite-ignore */ configPath)) as {
		default: LoadedConfig;
	};
	headersIsAFunction = typeof loaded.default.headers === "function";
	rules = (await loaded.default.headers?.()) ?? [];
});

function policyHeaders(rule: HeaderRule) {
	return rule.headers.filter(
		(header) => header.key.toLowerCase() === CONTENT_SECURITY_POLICY
	);
}

/** Every policy value that would be sent for a request to every path. */
function policiesForAllPaths(): string[] {
	return rules
		.filter((rule) => CATCH_ALL_SOURCES.includes(rule.source))
		.flatMap((rule) => policyHeaders(rule).map((header) => header.value));
}

function parsePolicy(policy: string): Policy {
	const directives = new Map<string, string[]>();
	const repeated: string[] = [];
	for (const part of policy.split(";")) {
		const [name, ...sources] = part.trim().split(WHITESPACE);
		if (name) {
			if (directives.has(name)) {
				repeated.push(name);
			}
			directives.set(name, sources);
		}
	}
	return { directives, repeated };
}

function theSentPolicy(): Policy {
	return parsePolicy(policiesForAllPaths()[0] ?? "");
}

describe("next.config headers", () => {
	it("defines headers() and returns rules", () => {
		expect(headersIsAFunction).toBe(true);
		expect(rules.length).toBeGreaterThan(0);
	});

	it("sends exactly one Content-Security-Policy to every path", () => {
		expect(policiesForAllPaths()).toHaveLength(1);
	});

	it("does not send a second policy to any narrower path", () => {
		const allPolicies = rules.flatMap(policyHeaders);

		expect(allPolicies).toHaveLength(1);
	});

	it("names each directive once", () => {
		expect(theSentPolicy().repeated).toEqual([]);
	});

	it("forbids plug-in content and base address changes", () => {
		const { directives } = theSentPolicy();

		expect(directives.get("object-src")).toEqual(["'none'"]);
		expect(directives.get("base-uri")).toEqual(["'self'"]);
	});

	it("lets forms post only to this site and the two sign-in providers", () => {
		const { directives } = theSentPolicy();

		expect([...(directives.get("form-action") ?? [])].sort()).toEqual(
			["'self'", "https://accounts.google.com", "https://github.com"].sort()
		);
	});

	it("lets no other site frame the app", () => {
		const { directives } = theSentPolicy();

		expect(directives.get("frame-ancestors")).toEqual(["'none'"]);
	});

	it("does not widen any rule with a wildcard or a scheme-only source", () => {
		const { directives } = theSentPolicy();
		const sources = [
			"object-src",
			"base-uri",
			"form-action",
			"frame-ancestors",
		].flatMap((name) => directives.get(name) ?? []);

		expect(sources.length).toBeGreaterThan(0);
		expect(sources).not.toContain("*");
		expect(sources.filter((source) => SCHEME_ONLY_SOURCE.test(source))).toEqual(
			[]
		);
	});
});
