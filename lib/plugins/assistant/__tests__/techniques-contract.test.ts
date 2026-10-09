// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTechniquesTool,
	techniquesConfigured,
	techniquesPrompt,
} from "../techniques-tool";

const URL_OK = "https://techniques.example/mcp";
const UNREACHABLE = { error: "The techniques service is not reachable." };

function technique(i: number, extra: Record<string, unknown> = {}) {
	return {
		slug: `t-${i}`,
		name: `Technique ${i}`,
		score: 1 - i / 100,
		retrievalScore: 0.5,
		goals: ["Explainability", "Fairness"],
		url: `https://techniques.example/t-${i}`,
		...extra,
	};
}

function mcpBody(results: unknown[], extra: Record<string, unknown> = {}) {
	return {
		jsonrpc: "2.0",
		id: "x",
		result: {
			content: [{ type: "text", text: "ignored" }],
			structuredContent: { rankingAvailable: true, results, ...extra },
		},
	};
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function run(
	input: { claimText?: string },
	selection: { label: string; text: string; type: string } | null = null
) {
	const t = createTechniquesTool(selection);
	return (await t.execute?.(input, {
		toolCallId: "c1",
		messages: [],
	})) as unknown;
}

const fetchMock = vi.fn();

interface Call {
	init: { body: string; headers: unknown; method: string; signal: AbortSignal };
	url: string;
}

function firstCall(): Call {
	const [url, init] = fetchMock.mock.calls[0] as [string, Call["init"]];
	return { url, init };
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
	vi.stubEnv("TECHNIQUES_MCP_URL", URL_OK);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("suggest_techniques request", () => {
	it("posts one JSON-RPC tools/call with only the two content headers", async () => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run({ claimText: "The model is fair" });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const { url, init } = firstCall();
		expect(url).toBe(URL_OK);
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({
			"Content-Type": "application/json",
			Accept: "application/json",
		});
		const body = JSON.parse(init.body);
		expect(body.jsonrpc).toBe("2.0");
		expect(body.method).toBe("tools/call");
		expect(body.id).toBeDefined();
		expect(body.params).toEqual({
			name: "suggest_techniques_for_claim",
			arguments: { claim: "The model is fair" },
		});
	});

	it("uses the selected element's text when no claimText is given", async () => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run(
			{},
			{ label: "P1", type: "PROPERTY_CLAIM", text: "Selected text" }
		);
		expect(JSON.parse(firstCall().init.body).params.arguments).toEqual({
			claim: "Selected text",
		});
	});

	it("prefers an explicit claimText over the selection", async () => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run(
			{ claimText: "An explicit claim typed by the user in the chat." },
			{ label: "P1", type: "PROPERTY_CLAIM", text: "Selected text" }
		);
		expect(JSON.parse(firstCall().init.body).params.arguments.claim).toBe(
			"An explicit claim typed by the user in the chat."
		);
	});

	it("gives an error and makes no request when there is no claim at all", async () => {
		const out = (await run({})) as { error?: string };
		expect(out.error).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("hands fetch an abort signal", async () => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run({ claimText: "c" });
		expect(firstCall().init.signal).toBeInstanceOf(AbortSignal);
	});
});

describe("suggest_techniques result", () => {
	it("returns the top five of more, in order, with rankingAvailable", async () => {
		const many = Array.from({ length: 8 }, (_, i) => technique(i));
		fetchMock.mockResolvedValue(jsonResponse(mcpBody(many)));
		const out = (await run({ claimText: "c" })) as {
			rankingAvailable: boolean;
			results: { slug: string }[];
		};
		expect(out.rankingAvailable).toBe(true);
		expect(out.results.map((r) => r.slug)).toEqual([
			"t-0",
			"t-1",
			"t-2",
			"t-3",
			"t-4",
		]);
	});

	it("returns fewer than five when fewer come back", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(mcpBody([technique(1), technique(2)]))
		);
		const out = (await run({ claimText: "c" })) as { results: unknown[] };
		expect(out.results).toHaveLength(2);
	});

	it("keeps slug, name, score, retrievalScore, goals and url", async () => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		const out = (await run({ claimText: "c" })) as { results: unknown[] };
		expect(out.results[0]).toMatchObject({
			slug: "t-1",
			name: "Technique 1",
			score: 0.99,
			retrievalScore: 0.5,
			goals: ["Explainability", "Fairness"],
			url: "https://techniques.example/t-1",
		});
	});

	it("tolerates extra fields on the envelope, the content and each result", async () => {
		const body = mcpBody(
			[technique(1, { extra: { deep: 1 }, description: "d" })],
			{
				somethingNew: true,
			}
		);
		(body as Record<string, unknown>).unexpected = 1;
		fetchMock.mockResolvedValue(jsonResponse(body));
		const out = (await run({ claimText: "c" })) as {
			results: { slug: string }[];
		};
		expect(out.results[0]?.slug).toBe("t-1");
	});

	it("reports rankingAvailable false as given", async () => {
		fetchMock.mockResolvedValue(
			jsonResponse(mcpBody([technique(1)], { rankingAvailable: false }))
		);
		const out = (await run({ claimText: "c" })) as {
			rankingAvailable: boolean;
		};
		expect(out.rankingAvailable).toBe(false);
	});
});

describe("suggest_techniques failure handling", () => {
	it.each([
		500, 404, 401, 503,
	])("answers unreachable for status %i, even with a valid body", async (status) => {
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)]), status));
		expect(await run({ claimText: "c" })).toEqual(UNREACHABLE);
	});

	it("answers unreachable when the network call rejects", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		expect(await run({ claimText: "c" })).toEqual(UNREACHABLE);
	});

	it("answers unreachable when the body is not JSON", async () => {
		fetchMock.mockResolvedValue(
			new Response("<html>oops</html>", { status: 200 })
		);
		expect(await run({ claimText: "c" })).toEqual(UNREACHABLE);
	});

	it.each([
		[
			"a JSON-RPC error",
			{ jsonrpc: "2.0", id: "x", error: { code: -1, message: "no" } },
		],
		[
			"no structuredContent",
			{ jsonrpc: "2.0", id: "x", result: { content: [] } },
		],
		["null", null],
		["an array", []],
		[
			"results not an array",
			{
				result: { structuredContent: { rankingAvailable: true, results: "x" } },
			},
		],
		[
			"rankingAvailable missing",
			{ result: { structuredContent: { results: [] } } },
		],
		["a result without a url", mcpBody([{ ...technique(1), url: undefined }])],
		["goals not strings", mcpBody([technique(1, { goals: [1, 2] })])],
		["score as a string", mcpBody([technique(1, { score: "high" })])],
	])("answers unreachable for a malformed body: %s", async (_name, body) => {
		fetchMock.mockResolvedValue(jsonResponse(body));
		expect(await run({ claimText: "c" })).toEqual(UNREACHABLE);
	});

	it("never throws, whatever fetch does", async () => {
		fetchMock.mockImplementation(() => {
			throw new Error("sync boom");
		});
		await expect(run({ claimText: "c" })).resolves.toEqual(UNREACHABLE);
	});

	it("aborts a hung request after 70 seconds by default and answers unreachable", async () => {
		vi.useFakeTimers();
		fetchMock.mockImplementation(
			(_url: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					init.signal.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError"))
					);
				})
		);
		let settled = false;
		const pending = run({ claimText: "c" }).then((r) => {
			settled = true;
			return r;
		});
		await vi.advanceTimersByTimeAsync(69_000);
		expect(settled).toBe(false);
		expect(firstCall().init.signal.aborted).toBe(false);
		await vi.advanceTimersByTimeAsync(1100);
		expect(await pending).toEqual(UNREACHABLE);
		expect(firstCall().init.signal.aborted).toBe(true);
	});

	it("clears its timer once the request completes", async () => {
		vi.useFakeTimers();
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run({ claimText: "c" });
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe("TECHNIQUES_MCP_URL gating", () => {
	it("is configured for a URL", () => {
		expect(techniquesConfigured()).toBe(true);
	});

	it.each([
		undefined,
		"",
		"not a url",
		"techniques.example/mcp",
	])("is not configured for %j, and the tool makes no request", async (value) => {
		if (value === undefined) {
			vi.stubEnv("TECHNIQUES_MCP_URL", undefined as unknown as string);
			// biome-ignore lint/performance/noDelete: unset the variable for real
			delete process.env.TECHNIQUES_MCP_URL;
		} else {
			vi.stubEnv("TECHNIQUES_MCP_URL", value);
		}
		expect(techniquesConfigured()).toBe(false);
		expect(await run({ claimText: "c" })).toEqual(UNREACHABLE);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("reads the variable at call time, not at import time", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "https://other.example/mcp");
		fetchMock.mockResolvedValue(jsonResponse(mcpBody([technique(1)])));
		await run({ claimText: "c" });
		expect(firstCall().url).toBe("https://other.example/mcp");
	});
});

describe("techniquesPrompt", () => {
	it("tells the model to recommend only from results and never invent when configured", () => {
		const p = techniquesPrompt();
		expect(p).toContain("suggest_techniques");
		expect(p).toMatch(/only from its results/i);
		expect(p).toMatch(/never invent/i);
		expect(p).not.toMatch(/unavailable in this deployment/i);
	});

	it("says suggestions are unavailable when not configured, without naming the tool as callable", () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "not a url");
		const p = techniquesPrompt();
		expect(p).toMatch(/unavailable/i);
		expect(p).toMatch(/do not invent/i);
		expect(p).not.toMatch(/only from its results/i);
	});
});
