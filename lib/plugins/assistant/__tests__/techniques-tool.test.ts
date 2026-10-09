import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTechniquesTool,
	techniquesPrompt,
} from "@/lib/plugins/assistant/techniques-tool";
import {
	buildSystemPrompt,
	createCaseTools,
} from "@/lib/plugins/assistant/tools";

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

	it("aborts the request at the 20 second limit", async () => {
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
		await vi.advanceTimersByTimeAsync(19_999);
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
							url: `https://example.org/${"u".repeat(900)}`,
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
		expect(first?.url).toHaveLength(500);
		expect(first?.goals).toHaveLength(20);
		expect(first?.goals.every((g) => g.length === 200)).toBe(true);
	});
});

describe("buildSystemPrompt", () => {
	it("names exactly the registered tools", () => {
		expect(buildSystemPrompt(["suggest_techniques", "read_case"])).toContain(
			"You have these read-only tools: suggest_techniques, read_case."
		);
	});
});
