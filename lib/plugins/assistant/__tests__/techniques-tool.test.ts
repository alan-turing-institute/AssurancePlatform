import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTechniquesTool,
	techniquesPrompt,
} from "@/lib/plugins/assistant/techniques-tool";
import { createCaseTools } from "@/lib/plugins/assistant/tools";

vi.mock("@/lib/services/case-export-service", () => ({ exportCase: vi.fn() }));

const URL_ = "http://techniques.test/mcp";
const options = { toolCallId: "t", messages: [] };
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
			rankingAvailable: true,
			results: [
				{
					slug: "shap",
					name: "SHAP",
					score: 0.91,
					retrievalScore: 0.8,
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
		await vi.advanceTimersByTimeAsync(20_000);

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
});
