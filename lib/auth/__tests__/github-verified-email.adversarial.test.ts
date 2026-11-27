import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitHubEmailVerified } from "@/lib/auth/github-verified-email";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";

/**
 * The GitHub email-list check answers true only for an address listed with the
 * boolean true on `verified`, reads one page, and never puts the address, the
 * token or GitHub's answer into the log.
 */

const TOKEN = "gho_made_up_token_for_helper_tests";
const EMAIL = "person.one@example.test";
const MARKER = "made-up-answer-marker";

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

function stub(handler: Handler) {
	const stand = vi.fn((url: string | URL | Request, init?: RequestInit) =>
		handler(String(url), init)
	);
	vi.stubGlobal("fetch", stand);
	return stand;
}

function answer(body: unknown, init: ResponseInit = { status: 200 }) {
	return () => Promise.resolve(new Response(JSON.stringify(body), init));
}

function captureWarnings() {
	const entries: LogEntry[] = [];
	const previous = process.env.LOG_LEVEL;
	process.env.LOG_LEVEL = "debug";
	setLogSink((entry) => {
		entries.push(entry);
	});
	return {
		entries,
		restore() {
			resetLogSink();
			if (previous === undefined) {
				Reflect.deleteProperty(process.env, "LOG_LEVEL");
			} else {
				process.env.LOG_LEVEL = previous;
			}
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("what counts as verified", () => {
	it.each([
		["the same capitals", [{ email: EMAIL, verified: true }]],
		[
			"other capitals in the list",
			[{ email: "PERSON.One@Example.TEST", verified: true }],
		],
		[
			"the address listed twice, unverified first",
			[
				{ email: EMAIL, verified: false },
				{ email: EMAIL, verified: true },
			],
		],
		[
			"the address listed twice, verified first",
			[
				{ email: EMAIL, verified: true },
				{ email: EMAIL, verified: false },
			],
		],
		[
			"objects and other values before it",
			[null, 4, "x", [], { email: EMAIL, verified: true }],
		],
	])("answers true for %s", async (_label, list) => {
		stub(answer(list));

		expect(await isGitHubEmailVerified(TOKEN, EMAIL)).toBe(true);
	});

	it("matches an address given in other capitals against the list", async () => {
		stub(answer([{ email: EMAIL, verified: true }]));

		expect(await isGitHubEmailVerified(TOKEN, "PERSON.ONE@EXAMPLE.TEST")).toBe(
			true
		);
	});

	it.each([
		["the text true", "true"],
		["the number 1", 1],
		["null", null],
		["an object", {}],
		["a list", [true]],
		["missing", undefined],
	])("answers false when the verified mark is %s", async (_label, mark) => {
		stub(answer([{ email: EMAIL, verified: mark }]));

		expect(await isGitHubEmailVerified(TOKEN, EMAIL)).toBe(false);
	});

	it.each([
		["an address that only contains it", "xperson.one@example.test.evil"],
		["an address with a prefix added", "a.person.one@example.test"],
		["an address with a space added", " person.one@example.test"],
	])("answers false for %s", async (_label, listed) => {
		stub(answer([{ email: listed, verified: true }]));

		expect(await isGitHubEmailVerified(TOKEN, EMAIL)).toBe(false);
	});

	it("answers false when the address is on a later page than the first", async () => {
		stub((url) =>
			answer(
				new URL(url).searchParams.get("page") === "2"
					? [{ email: EMAIL, verified: true }]
					: [{ email: "other@example.test", verified: true }]
			)()
		);

		expect(await isGitHubEmailVerified(TOKEN, EMAIL)).toBe(false);
	});
});

describe("how the request is made", () => {
	it("sends the token in the header only, to GitHub, once, without following redirects", async () => {
		const stand = stub(answer([{ email: EMAIL, verified: true }]));

		await isGitHubEmailVerified(TOKEN, EMAIL);

		expect(stand).toHaveBeenCalledTimes(1);
		const [url, init] = stand.mock.calls[0] as [string, RequestInit];
		const address = new URL(String(url));
		expect(address.origin).toBe("https://api.github.com");
		expect(address.searchParams.get("per_page")).toBe("100");
		expect(String(url)).not.toContain(TOKEN);
		expect(String(url)).not.toContain(EMAIL);
		expect(JSON.stringify(init?.headers)).toContain(`Bearer ${TOKEN}`);
		expect(init?.redirect).toBe("manual");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it.each([
		["undefined", undefined],
		["empty", ""],
	])("asks nothing and answers false when the token is %s", async (_label, token) => {
		const stand = stub(answer([{ email: EMAIL, verified: true }]));

		expect(await isGitHubEmailVerified(token, EMAIL)).toBe(false);
		expect(stand).not.toHaveBeenCalled();
	});

	it("gives up when GitHub does not answer", async () => {
		stub(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason)
					);
				})
		);

		expect(await isGitHubEmailVerified(TOKEN, EMAIL)).toBe(false);
	}, 20_000);
});

describe("failures", () => {
	const FAILURES: [string, Handler][] = [
		[
			"a redirect",
			() =>
				Promise.resolve(Response.redirect("https://elsewhere.example/", 302)),
		],
		["a 401", answer({ message: MARKER }, { status: 401 })],
		["a 404", answer([{ email: EMAIL, verified: true }], { status: 404 })],
		["a 500", answer({ message: MARKER }, { status: 500 })],
		[
			"an object in place of a list",
			answer({ emails: [{ email: EMAIL, verified: true }], note: MARKER }),
		],
		[
			"text that is not JSON",
			() => Promise.resolve(new Response(`not json ${MARKER}`)),
		],
		[
			"an empty success",
			() => Promise.resolve(new Response(null, { status: 204 })),
		],
		["a network error", () => Promise.reject(new TypeError("fetch failed"))],
		[
			"a timeout",
			() => Promise.reject(new DOMException("timed out", "TimeoutError")),
		],
		[
			"an error that names the token",
			() => Promise.reject(new Error(`bad request for ${TOKEN} ${EMAIL}`)),
		],
	];

	it.each(
		FAILURES
	)("answers false and logs one warning for %s, with no address, token or answer", async (_label, handler) => {
		stub(handler);
		const logs = captureWarnings();
		let verified: boolean;
		try {
			verified = await isGitHubEmailVerified(TOKEN, EMAIL);
		} finally {
			logs.restore();
		}

		expect(verified).toBe(false);
		expect(logs.entries.filter((e) => e.level === "warn")).toHaveLength(1);
		const text = JSON.stringify(logs.entries);
		for (const secret of [EMAIL, TOKEN, MARKER]) {
			expect(text).not.toContain(secret);
		}
	});

	it("logs nothing when the address is verified", async () => {
		stub(answer([{ email: EMAIL, verified: true }]));
		const logs = captureWarnings();
		try {
			await isGitHubEmailVerified(TOKEN, EMAIL);
		} finally {
			logs.restore();
		}

		expect(JSON.stringify(logs.entries)).not.toContain(EMAIL);
		expect(logs.entries.filter((e) => e.level === "warn")).toHaveLength(0);
	});
});
