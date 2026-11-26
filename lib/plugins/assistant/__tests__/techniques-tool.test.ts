import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankCandidates } from "@/lib/models/clef";
import type { TechniquesModelAccess } from "@/lib/plugins/assistant/techniques-models";
import {
	createTechniquesTool,
	techniquesConfigured,
	techniquesPrompt,
} from "@/lib/plugins/assistant/techniques-tool";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";

vi.mock("@/lib/models/clef", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/clef")>()),
	rankCandidates: vi.fn(),
}));
vi.mock("@/lib/services/case-export-service", () => ({ exportCase: vi.fn() }));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: vi.fn(),
}));

const URL_ = "http://techniques.test/mcp";
const options = { toolCallId: "t", messages: [] };
const SOME_TEXT = /\S/;
const fetchMock = vi.fn();

const RESULT = {
	slug: "shap",
	name: "SHAP",
	score: 0.91,
	retrievalScore: 0.8,
	goals: ["Explainability"],
	url: "https://example.org/shap",
	extra: "ignored",
};

function reply(body: unknown, ok = true) {
	fetchMock.mockResolvedValue({ ok, json: async () => body });
}

beforeEach(() => {
	vi.stubEnv("TECHNIQUES_MCP_URL", URL_);
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
	vi.mocked(rankCandidates).mockReset();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("suggest_techniques", () => {
	it("posts a stateless JSON-RPC tools/call and returns the parsed results", async () => {
		reply({
			result: {
				structuredContent: { rankingAvailable: true, results: [RESULT] },
			},
		});

		const out = await createTechniquesTool(null).execute?.(
			{ claimText: "robust" },
			options
		);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(URL_);
		expect(init.headers).toEqual({
			"Content-Type": "application/json",
			Accept: "application/json",
		});
		expect(JSON.parse(String(init.body))).toMatchObject({
			jsonrpc: "2.0",
			method: "tools/call",
			params: {
				name: "suggest_techniques_for_claim",
				arguments: { claim: "robust" },
			},
		});
		expect(out).toEqual({
			searchUsed: false,
			searchReason: "not set up",
			rankingUsed: false,
			rankingReason: "not set up",
			results: [
				{
					slug: "shap",
					name: "SHAP",
					score: 0.91,
					retrievalScore: 0.8,
					ranked: false,
					goals: ["Explainability"],
					url: "https://example.org/shap",
				},
			],
		});
	});

	it("defaults the claim to the selected element's text", async () => {
		reply({
			result: { structuredContent: { rankingAvailable: false, results: [] } },
		});

		await createTechniquesTool({
			label: "P1",
			type: "PROPERTY_CLAIM",
			text: "selected text",
		}).execute?.({}, options);

		expect(
			JSON.parse(fetchMock.mock.calls[0]?.[1].body).params.arguments.claim
		).toBe("selected text");
	});

	it("returns an error, not a throw, when the call times out", async () => {
		vi.useFakeTimers();
		fetchMock.mockImplementation(
			(_u: string, init: RequestInit) =>
				new Promise((_res, rej) =>
					init.signal?.addEventListener("abort", () => rej(new Error("abort")))
				)
		);

		const pending = createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			options
		);
		await vi.advanceTimersByTimeAsync(10_000);

		expect(await pending).toEqual({
			error: "The techniques service is not reachable.",
		});
	});

	it("returns an error for a malformed response", async () => {
		reply({ result: { structuredContent: { results: "nope" } } });

		const out = await createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			options
		);

		expect(out).toEqual({ error: "The techniques service is not reachable." });
	});

	it("is not registered, and the prompt says so, when the URL is unset", () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "");

		expect(createCaseTools("u", "c")).not.toHaveProperty("suggest_techniques");
		expect(techniquesPrompt()).toContain("unavailable");
	});

	it("counts a URL that is not http or https as unset", () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "ftp://techniques.test/mcp");

		expect(createCaseTools("u", "c")).not.toHaveProperty("suggest_techniques");
		expect(techniquesPrompt()).toContain("unavailable");
	});

	it("does not follow redirects", async () => {
		reply({
			result: { structuredContent: { rankingAvailable: false, results: [] } },
		});

		await createTechniquesTool(null).execute?.({ claimText: "x" }, options);

		expect(fetchMock.mock.calls[0]?.[1].redirect).toBe("error");
	});
});

function sentClaim(): string {
	return JSON.parse(fetchMock.mock.calls[0]?.[1].body).params.arguments.claim;
}

const EMPTY_REPLY = {
	result: { structuredContent: { rankingAvailable: false, results: [] } },
};

describe("suggest_techniques claim text", () => {
	const element = (text: string) => ({
		label: "P1",
		type: "PROPERTY_CLAIM",
		text,
	});

	it("cuts a 5000-character selected description to 2000 characters and still returns a result", async () => {
		reply({
			result: {
				structuredContent: { rankingAvailable: true, results: [RESULT] },
			},
		});

		const out = await createTechniquesTool(element("a".repeat(5000))).execute?.(
			{},
			options
		);

		expect(sentClaim()).toHaveLength(2000);
		expect(out).toHaveProperty("results");
		expect(out).not.toHaveProperty("error");
	});

	it("bounds claimText in the input schema", () => {
		const schema = createTechniquesTool(null).inputSchema as {
			safeParse: (value: unknown) => { success: boolean };
		};

		expect(schema.safeParse({ claimText: "a".repeat(2000) }).success).toBe(
			true
		);
		expect(schema.safeParse({ claimText: "a".repeat(2001) }).success).toBe(
			false
		);
	});

	it("uses the selected element's text when the supplied claim is under 40 characters", async () => {
		reply(EMPTY_REPLY);
		const real =
			"The model is robust to noise in its input data, tested widely.";

		await createTechniquesTool(element(real)).execute?.(
			{ claimText: "This claim" },
			options
		);

		expect(sentClaim()).toBe(real);
	});

	it("keeps a supplied claim of 40 characters or more even when an element is selected", async () => {
		reply(EMPTY_REPLY);
		const typed = "x".repeat(40);

		await createTechniquesTool(element("selected text")).execute?.(
			{ claimText: typed },
			options
		);

		expect(sentClaim()).toBe(typed);
	});

	it("returns an error saying the element has no text, not the placeholder, when the selected element's text is empty", async () => {
		const out = await createTechniquesTool(element("")).execute?.(
			{ claimText: "This claim" },
			options
		);

		expect(out).toEqual({ error: "The selected element has no text." });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns the same error when the selected element's text is only whitespace and nothing is supplied", async () => {
		const out = await createTechniquesTool(element("  \n ")).execute?.(
			{},
			options
		);

		expect(out).toEqual({ error: "The selected element has no text." });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps a short supplied claim when no element is selected", async () => {
		reply(EMPTY_REPLY);

		await createTechniquesTool(null).execute?.(
			{ claimText: "robust" },
			options
		);

		expect(sentClaim()).toBe("robust");
	});

	it("tells the model, in the tool and the prompt, to omit claimText when an element is selected", () => {
		const tool = createTechniquesTool(null);

		expect(tool.description).toContain("omit claimText");
		expect(tool.description).toContain("typed the claim in the chat");
		expect(techniquesPrompt()).toContain(
			"When an element is selected, call the tool without claimText"
		);
	});
});

describe("suggest_techniques: the model the service reports", () => {
	it.each([
		["a model id", "qwen3-embedding-4b"],
		["null, when no vectors are loaded", null],
		["nothing", undefined],
	])("accepts an embeddingModel of %s", async (_label, embeddingModel) => {
		reply({
			result: {
				structuredContent: {
					embeddingModel,
					rankingModel: null,
					rankingAvailable: false,
					semanticUsed: false,
					results: [RESULT],
				},
			},
		});

		const out = await createTechniquesTool(null).execute?.(
			{ claimText: "robust" },
			options
		);

		expect(out).toMatchObject({ results: [{ slug: "shap" }] });
	});
});

describe("suggest_techniques failure paths", () => {
	it("returns the distinct no-claim error without calling the service", async () => {
		const out = await createTechniquesTool(null).execute?.({}, options);

		expect(out).toEqual({
			error: "No claim text was given and no element is selected.",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns not reachable when the body is not JSON", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => Promise.reject(new SyntaxError("Unexpected token")),
		});

		const out = await createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			options
		);

		expect(out).toEqual({ error: "The techniques service is not reachable." });
	});

	it("reads an answer just under 1 MiB, and returns not reachable for one over it", async () => {
		const answer = (bytes: number) =>
			JSON.stringify({
				result: {
					structuredContent: {
						results: [
							{ ...RESULT, url: `https://example.org/${"x".repeat(bytes)}` },
						],
					},
				},
			});
		const overhead = answer(0).length;
		const run = () =>
			createTechniquesTool(null).execute?.({ claimText: "x" }, options);

		fetchMock.mockResolvedValue(new Response(answer(1024 * 1024 - overhead)));
		expect(await run()).toMatchObject({ results: [{ slug: "shap" }] });

		fetchMock.mockResolvedValue(
			new Response(answer(1024 * 1024 - overhead + 1))
		);
		expect(await run()).toEqual({
			error: "The techniques service is not reachable.",
		});
	});

	it("aborts the request at ASSISTANT_TECHNIQUES_TIMEOUT_MS when that is under ten seconds", async () => {
		vi.stubEnv("ASSISTANT_TECHNIQUES_TIMEOUT_MS", "5000");
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		fetchMock.mockImplementation((_u: string, init: RequestInit) => {
			signal = init.signal ?? undefined;
			return new Promise((_res, rej) =>
				init.signal?.addEventListener("abort", () => rej(new Error("abort")))
			);
		});

		const pending = createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			options
		);
		await vi.advanceTimersByTimeAsync(4999);
		expect(signal?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(signal?.aborted).toBe(true);
		expect(await pending).toEqual({
			error: "The techniques service is not reachable.",
		});
	});

	it("cuts oversized fields and goals instead of rejecting the response", async () => {
		reply({
			result: {
				structuredContent: {
					rankingAvailable: true,
					results: [
						{
							...RESULT,
							name: "n".repeat(900),
							goals: Array.from({ length: 30 }, () => "g".repeat(400)),
						},
					],
				},
			},
		});

		const out = (await createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			options
		)) as unknown as { results: (typeof RESULT)[] };

		const [first] = out.results;
		expect(first?.name).toHaveLength(500);
		expect(first?.goals).toHaveLength(20);
		expect(first?.goals.every((g) => g.length === 200)).toBe(true);
	});
});

/** A fetch that never answers; returns a reader for the signal it was given. */
function hangingFetch() {
	let signal: AbortSignal | undefined;
	fetchMock.mockImplementation((_u: string, init: RequestInit) => {
		signal = init.signal ?? undefined;
		return new Promise((_res, rej) =>
			init.signal?.addEventListener("abort", () => rej(new Error("abort")))
		);
	});
	return () => signal;
}

describe("suggest_techniques wait inside the reply limit", () => {
	it("waits for the time left less the answer margin when that is shorter than the service's ten seconds", async () => {
		vi.useFakeTimers();
		const signalOf = hangingFetch();

		const pending = createTechniquesTool(null, Date.now() + 20_000).execute?.(
			{ claimText: "x" },
			options
		);
		await vi.advanceTimersByTimeAsync(4999);
		expect(signalOf()?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(signalOf()?.aborted).toBe(true);
		expect(await pending).toEqual({
			error: "The techniques service is not reachable.",
		});
	});

	it("waits at most ten seconds for the service, however much time the reply has left", async () => {
		vi.useFakeTimers();
		const signalOf = hangingFetch();

		const pending = createTechniquesTool(null, Date.now() + 600_000).execute?.(
			{ claimText: "x" },
			options
		);
		await vi.advanceTimersByTimeAsync(9999);
		expect(signalOf()?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(signalOf()?.aborted).toBe(true);
		expect(await pending).toEqual({
			error: "The techniques service is not reachable.",
		});
	});

	it("measures the time left when the tool is called, not when it was created", async () => {
		vi.useFakeTimers();
		const signalOf = hangingFetch();
		const tool = createTechniquesTool(null, Date.now() + 40_000);

		await vi.advanceTimersByTimeAsync(20_000);
		const pending = tool.execute?.({ claimText: "x" }, options);
		await vi.advanceTimersByTimeAsync(4999);
		expect(signalOf()?.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(signalOf()?.aborted).toBe(true);
		await pending;
	});

	it("does not call the service, and says so, when under a second would be left to wait", async () => {
		vi.useFakeTimers();

		const out = await createTechniquesTool(null, Date.now() + 10_000).execute?.(
			{ claimText: "x" },
			options
		);

		expect(out).toEqual({
			error: "There was not enough time left to ask the techniques service.",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("suggest_techniques cancellation", () => {
	it("aborts the request when the reply's signal aborts, before the timer", async () => {
		vi.useFakeTimers();
		const signalOf = hangingFetch();
		const reply = new AbortController();

		const pending = createTechniquesTool(null).execute?.(
			{ claimText: "x" },
			{ ...options, abortSignal: reply.signal }
		);
		await vi.advanceTimersByTimeAsync(1000);
		expect(signalOf()?.aborted).toBe(false);
		reply.abort();

		expect(signalOf()?.aborted).toBe(true);
		expect(await pending).toEqual({
			error: "The techniques service is not reachable.",
		});
	});
});

describe("suggest_techniques: which addresses count", () => {
	it.each([
		["http", "http://techniques.test:8080/mcp", true],
		["https", "https://techniques.test/mcp", true],
		[
			"a scheme that only starts with http",
			"httpx://techniques.test/mcp",
			false,
		],
		["a scheme that only ends with http", "xhttp://techniques.test/mcp", false],
	])("judges a service address by its scheme: %s", (_label, address, configured) => {
		vi.stubEnv("TECHNIQUES_MCP_URL", address);

		expect(techniquesConfigured()).toBe(configured);
	});

	it.each([
		["https", "https://example.org/a", "https://example.org/a"],
		["http", "http://example.org/a", undefined],
		[
			"a scheme that only starts with https",
			"httpsx://example.org/a",
			undefined,
		],
		["a scheme that only ends with https", "xhttps://example.org/a", undefined],
	])("a technique link with %s is kept only when it is https", async (_label, link, kept) => {
		reply({
			result: {
				structuredContent: { results: [{ ...RESULT, url: link }] },
			},
		});

		const out = (await createTechniquesTool(null).execute?.(
			{ claimText: "robust" },
			options
		)) as { results: { url?: string }[] };

		expect(out.results[0]?.url).toBe(kept);
	});
});

describe("suggest_techniques: models and ranking input", () => {
	const CONNECTION = {
		id: "c1",
		label: "c1",
		type: "OLLAMA" as const,
		baseUrl: "http://models.test",
		apiKey: null,
	};
	const RANKING_JOB = { connectionId: "c1", model: "ranker" };

	function rankingModels(): TechniquesModelAccess {
		return {
			roles: () =>
				Promise.resolve({
					chat: null,
					ranking: RANKING_JOB,
					search: null,
					searchCheck: null,
				}),
			connection: () => Promise.resolve(CONNECTION),
		};
	}

	it("answers that the service is not reachable when the user's jobs cannot even be asked for", async () => {
		reply(EMPTY_REPLY);
		const models: TechniquesModelAccess = {
			roles: () => Promise.reject(new Error("db down")),
			connection: () => Promise.resolve(null),
		};

		const out = await createTechniquesTool(null, undefined, models).execute?.(
			{ claimText: "robust" },
			options
		);

		expect(out).toStrictEqual({ error: expect.stringMatching(SOME_TEXT) });
	});

	it.each([
		["gives its summary", "A summary.", "A summary."],
		["has no summary and so gives an empty one", undefined, ""],
	])("sends a technique that %s to the ranking model", async (_label, summary, sent) => {
		vi.mocked(rankCandidates).mockResolvedValue(null);
		reply({
			result: { structuredContent: { results: [{ ...RESULT, summary }] } },
		});

		await createTechniquesTool(null, undefined, rankingModels()).execute?.(
			{ claimText: "robust" },
			options
		);

		expect(
			vi.mocked(rankCandidates).mock.calls[0]?.[0].candidates
		).toMatchObject([{ id: "shap", summary: sent }]);
	});
});

describe("suggest_techniques: the time left at the edge", () => {
	it.each([
		["a second", 16_000, true],
		["a millisecond under a second", 15_999, false],
	])("asks the service with %s left once the answer margin is kept back", async (_label, left, asked) => {
		vi.useFakeTimers();
		reply(EMPTY_REPLY);

		await createTechniquesTool(null, Date.now() + left).execute?.(
			{ claimText: "robust" },
			options
		);

		expect(fetchMock.mock.calls.length > 0).toBe(asked);
	});
});

describe("suggest_techniques: choosing the claim to send", () => {
	const element = (text: string) => ({ label: "P1", type: "CLAIM", text });
	const run = (text: string, claimText: string) =>
		createTechniquesTool(element(text)).execute?.({ claimText }, options);

	it("measures a supplied claim without the spaces around it", async () => {
		reply(EMPTY_REPLY);

		await run("selected text", `  ${"y".repeat(38)}  `);

		expect(sentClaim()).toBe("selected text");
	});

	it("sends a supplied claim without the spaces around it", async () => {
		reply(EMPTY_REPLY);

		await run("selected text", `  ${"y".repeat(40)}  `);

		expect(sentClaim()).toBe("y".repeat(40));
	});

	it("keeps a supplied claim of 40 characters, but not 39, when the selected element has no text", async () => {
		reply(EMPTY_REPLY);

		const refused = await run("", "z".repeat(39));
		expect(refused).toStrictEqual({ error: expect.stringMatching(SOME_TEXT) });
		expect(fetchMock).not.toHaveBeenCalled();

		const accepted = await run("", "z".repeat(40));
		expect(accepted).not.toHaveProperty("error");
		expect(sentClaim()).toBe("z".repeat(40));
	});
});

describe("buildSystemPrompt", () => {
	it("names exactly the registered tools", () => {
		expect(buildSystemPrompt(["suggest_techniques", "read_case"])).toContain(
			"You have these read-only tools: suggest_techniques, read_case."
		);
	});
});
