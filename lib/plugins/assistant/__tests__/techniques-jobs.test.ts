// biome-ignore-all lint/performance/useTopLevelRegex: inline patterns keep each assertion readable
import { MockEmbeddingModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { embeddingModelFor } from "@/lib/models/adapters";
import { type RankableCandidate, rankCandidates } from "@/lib/models/clef";
import {
	type EmbeddingSpec,
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import {
	rankingCandidateCount,
	type TechniquesModelAccess,
} from "@/lib/plugins/assistant/techniques-models";
import {
	createTechniquesTool,
	techniquesPrompt,
} from "@/lib/plugins/assistant/techniques-tool";
import type { ModelRoles } from "@/lib/services/model-connection-service";

vi.mock("@/lib/models/adapters", () => ({ embeddingModelFor: vi.fn() }));
vi.mock("@/lib/models/clef", () => ({ rankCandidates: vi.fn() }));
vi.mock("@/lib/models/embedding-check", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/embedding-check")>()),
	fetchEmbeddingSpec: vi.fn(),
}));

const CLAIM = "The model is robust to noise in its input data, tested widely.";
const UNREACHABLE = { error: "The techniques service is not reachable." };
const options = { toolCallId: "t", messages: [] };
const fetchMock = vi.fn();

const SPEC: EmbeddingSpec = {
	modelId: "catalogue/model",
	dimensions: 3,
	queryPrefix: "query: ",
	documentFormat: "doc",
	dataVersion: "v1",
	probes: [
		{ text: "first probe", vector: [1, 0, 0] },
		{ text: "second probe", vector: [0, 1, 0] },
	],
};
const SEARCH_JOB = { connectionId: "c-search", model: "embed-model" };
const RANKING_JOB = { connectionId: "c-rank", model: "ranking-model" };
const PASSED = { verifiedAt: new Date(), verifiedFor: embeddingCheckId(SPEC) };
const VECTOR = [0.1, 0.2, 0.3];

interface Out {
	rankingReason?: string;
	rankingUsed: boolean;
	results: { ranked: boolean; score: number; slug: string }[];
	searchReason?: string;
	searchUsed: boolean;
}

function technique(i: number) {
	return {
		slug: `t-${i}`,
		name: `Technique ${i}`,
		score: 0.5 - i / 100,
		retrievalScore: 0.4,
		goals: ["Explainability"],
		url: `https://example.org/t-${i}`,
		summary: `Summary ${i}`,
		tags: ["tea:tag/a"],
	};
}

function serviceReplies(count = 10, semanticUsed = true) {
	fetchMock.mockResolvedValue({
		ok: true,
		json: async () => ({
			result: {
				structuredContent: {
					semanticUsed,
					results: Array.from({ length: count }, (_, i) => technique(i)),
				},
			},
		}),
	});
}

function modelsWith(roles: Partial<ModelRoles> = {}): TechniquesModelAccess {
	return {
		roles: () =>
			Promise.resolve({
				chat: null,
				ranking: null,
				search: null,
				searchCheck: null,
				...roles,
			}),
		connection: vi.fn((id: string) =>
			Promise.resolve({
				id,
				label: id,
				type: "OLLAMA" as const,
				baseUrl: "http://models.test",
				apiKey: null,
			})
		),
	};
}

const SEARCH_ON = { search: SEARCH_JOB, searchCheck: PASSED };

async function run(
	models: TechniquesModelAccess,
	extra: { abortSignal?: AbortSignal; replyDeadline?: number } = {}
): Promise<Out> {
	const out = await createTechniquesTool(
		null,
		extra.replyDeadline,
		models
	).execute?.(
		{ claimText: CLAIM },
		{ ...options, abortSignal: extra.abortSignal }
	);
	return out as unknown as Out;
}

function sentArguments() {
	return JSON.parse(fetchMock.mock.calls[0]?.[1].body).params.arguments;
}

let embeddingModel: MockEmbeddingModelV3;

function embedsAs(vector: number[]) {
	embeddingModel = new MockEmbeddingModelV3({
		doEmbed: ({ values }) =>
			Promise.resolve({
				embeddings: values.map(() => vector),
				usage: { tokens: 1 },
				warnings: [],
			}),
	});
	vi.mocked(embeddingModelFor).mockReturnValue(embeddingModel);
}

/** A model call that ends only when the signal it was given aborts. */
function whenAborted(signal: AbortSignal | undefined): Promise<never> {
	return new Promise((_resolve, reject) => {
		signal?.addEventListener("abort", () => reject(new Error("aborted")));
	});
}

function embeddingHangs() {
	embeddingModel = new MockEmbeddingModelV3({
		doEmbed: ({ abortSignal }) => whenAborted(abortSignal),
	});
	vi.mocked(embeddingModelFor).mockReturnValue(embeddingModel);
}

/** Ranks the candidates in reverse, with falling probabilities from 0.9. */
function rankingReverses() {
	vi.mocked(rankCandidates).mockImplementation((async ({
		candidates,
	}: {
		candidates: readonly RankableCandidate[];
	}) =>
		[...candidates].reverse().map((candidate, index) => ({
			candidate,
			ranked: true,
			score: (9 - index) / 10,
		}))) as never);
}

/** A ranking that returns null once the signal it was given aborts, as the real one does. */
function rankingHangs() {
	vi.mocked(rankCandidates).mockImplementation(
		(async ({ signal }: { signal?: AbortSignal }) =>
			new Promise((resolve) => {
				signal?.addEventListener("abort", () => resolve(null));
			})) as never
	);
}

let urlCounter = 0;

beforeEach(() => {
	vi.clearAllMocks();
	// A fresh address for each test, so the cached spec is never carried over.
	urlCounter += 1;
	vi.stubEnv("TECHNIQUES_MCP_URL", `http://techniques.test/${urlCounter}/mcp`);
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
	vi.mocked(fetchEmbeddingSpec).mockResolvedValue(SPEC);
	embedsAs(VECTOR);
	serviceReplies();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("suggest_techniques search job", () => {
	it("embeds the claim behind the catalogue's query prefix and sends the vector with the catalogue's model id", async () => {
		const out = await run(modelsWith(SEARCH_ON));

		expect(embeddingModel.doEmbedCalls[0]?.values).toEqual([`query: ${CLAIM}`]);
		expect(vi.mocked(embeddingModelFor).mock.calls[0]?.[1]).toBe("embed-model");
		expect(sentArguments()).toEqual({
			claim: CLAIM,
			queryEmbedding: { model: "catalogue/model", vector: VECTOR },
		});
		expect(out.searchUsed).toBe(true);
		expect(out.searchReason).toBeUndefined();
	});

	it("sends no vector and says search is not set up when there is no search job", async () => {
		const out = await run(modelsWith());

		expect(fetchEmbeddingSpec).not.toHaveBeenCalled();
		expect(embeddingModelFor).not.toHaveBeenCalled();
		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "not set up",
		});
	});

	it("makes no embedding call without a recorded search check", async () => {
		const out = await run(modelsWith({ search: SEARCH_JOB }));

		expect(embeddingModelFor).not.toHaveBeenCalled();
		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "check not passed",
		});
	});

	it.each([
		["model id", { ...SPEC, modelId: "older/model" }],
		[
			"test sentences",
			{ ...SPEC, probes: [{ text: "another probe", vector: [1, 0, 0] }] },
		],
	])("makes no embedding call when the check was passed for other catalogue %s", async (_name, passedFor) => {
		const stale = { ...PASSED, verifiedFor: embeddingCheckId(passedFor) };

		const out = await run(modelsWith({ ...SEARCH_ON, searchCheck: stale }));

		expect(embeddingModelFor).not.toHaveBeenCalled();
		expect(embeddingModel.doEmbedCalls).toHaveLength(0);
		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "check not passed",
		});
	});

	it("falls back to keyword search when the catalogue spec cannot be read", async () => {
		vi.mocked(fetchEmbeddingSpec).mockResolvedValue(null);

		const out = await run(modelsWith(SEARCH_ON));

		expect(embeddingModelFor).not.toHaveBeenCalled();
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "unavailable",
		});
		expect(out.results).toHaveLength(5);
	});

	it("falls back to keyword search when the embedding call fails", async () => {
		embeddingModel = new MockEmbeddingModelV3({
			doEmbed: () => Promise.reject(new Error("server down")),
		});
		vi.mocked(embeddingModelFor).mockReturnValue(embeddingModel);

		const out = await run(modelsWith(SEARCH_ON));

		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "unavailable",
		});
	});

	it("does not send a vector that is not the catalogue's length", async () => {
		embedsAs([0.1, 0.2]);

		const out = await run(modelsWith(SEARCH_ON));

		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "check not passed",
		});
	});

	it("says search was not used when the service did not use the vector it was sent", async () => {
		serviceReplies(3, false);

		const out = await run(modelsWith(SEARCH_ON));

		expect(sentArguments()).toHaveProperty("queryEmbedding");
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "unavailable",
		});
	});

	it("gives keyword search after ten seconds of embedding, then asks the service", async () => {
		vi.useFakeTimers();
		embeddingHangs();

		const pending = run(modelsWith(SEARCH_ON));
		await vi.advanceTimersByTimeAsync(9999);
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		const out = await pending;

		expect(sentArguments()).toEqual({ claim: CLAIM });
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "timed out",
		});
		expect(out.results).toHaveLength(5);
	});

	it("leaves a second for the service when the lookup has little time", async () => {
		vi.useFakeTimers();
		embeddingHangs();

		const pending = run(modelsWith(SEARCH_ON), {
			replyDeadline: Date.now() + 20_000,
		});
		await vi.advanceTimersByTimeAsync(3999);
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(await pending).toMatchObject({ searchReason: "timed out" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reads the catalogue spec once for ten minutes", async () => {
		vi.useFakeTimers();
		const models = modelsWith(SEARCH_ON);

		await run(models);
		await run(models);
		expect(fetchEmbeddingSpec).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		await run(models);

		expect(fetchEmbeddingSpec).toHaveBeenCalledTimes(2);
	});
});

describe("suggest_techniques ranking job", () => {
	const RANKING_ON = { ranking: RANKING_JOB };

	it("ranks the first eight results and puts them in the ranking's order", async () => {
		rankingReverses();

		const out = await run(modelsWith(RANKING_ON));

		const input = vi.mocked(rankCandidates).mock.calls[0]?.[0];
		expect(input?.candidates.map((c) => c.id)).toEqual(
			Array.from({ length: 8 }, (_, i) => `t-${i}`)
		);
		expect(input?.candidates[0]).toMatchObject({
			name: "Technique 0",
			summary: "Summary 0",
			goals: ["Explainability"],
		});
		expect(input).toMatchObject({ claim: CLAIM, model: "ranking-model" });
		expect(out.rankingUsed).toBe(true);
		expect(out.rankingReason).toBeUndefined();
		expect(out.results.map((r) => [r.slug, r.ranked, r.score])).toEqual([
			["t-7", true, 0.9],
			["t-6", true, 0.8],
			["t-5", true, 0.7],
			["t-4", true, 0.6],
			["t-3", true, 0.5],
		]);
	});

	it("keeps the results beyond the ranked ones in search order, unranked", async () => {
		vi.stubEnv("ASSISTANT_RANKING_CANDIDATES", "3");
		rankingReverses();

		const out = await run(modelsWith(RANKING_ON));

		expect(
			vi.mocked(rankCandidates).mock.calls[0]?.[0].candidates
		).toHaveLength(3);
		expect(out.results.map((r) => [r.slug, r.ranked])).toEqual([
			["t-2", true],
			["t-1", true],
			["t-0", true],
			["t-3", false],
			["t-4", false],
		]);
	});

	it("gives search order, within the reply limit, when the ranking answers null", async () => {
		vi.mocked(rankCandidates).mockResolvedValue(null);

		const out = await run(modelsWith(RANKING_ON));

		expect(out).toMatchObject({
			rankingUsed: false,
			rankingReason: "unavailable",
		});
		expect(out.results.map((r) => [r.slug, r.ranked])).toEqual(
			[0, 1, 2, 3, 4].map((i) => [`t-${i}`, false])
		);
	});

	it("gives search order after thirty seconds of ranking", async () => {
		vi.useFakeTimers();
		rankingHangs();

		const pending = run(modelsWith(RANKING_ON));
		await vi.advanceTimersByTimeAsync(29_999);
		let settled = false;
		pending.then(() => {
			settled = true;
		});
		await vi.advanceTimersByTimeAsync(0);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		const out = await pending;

		expect(out).toMatchObject({
			rankingUsed: false,
			rankingReason: "timed out",
		});
		expect(out.results.map((r) => r.slug)).toEqual([
			"t-0",
			"t-1",
			"t-2",
			"t-3",
			"t-4",
		]);
	});

	it("limits ranking to ASSISTANT_RANKING_TIMEOUT_MS", async () => {
		vi.stubEnv("ASSISTANT_RANKING_TIMEOUT_MS", "8000");
		vi.useFakeTimers();
		rankingHangs();

		const pending = run(modelsWith(RANKING_ON));
		await vi.advanceTimersByTimeAsync(8000);

		expect(await pending).toMatchObject({ rankingReason: "timed out" });
	});

	it("gives ranking only what is left of the lookup", async () => {
		vi.useFakeTimers();
		const start = Date.now();
		rankingReverses();

		await run(modelsWith(RANKING_ON), { replyDeadline: start + 40_000 });

		expect(vi.mocked(rankCandidates).mock.calls[0]?.[0].deadline).toBe(
			start + 25_000
		);
	});

	it("says ranking is not set up, and calls no ranking model, when there is no ranking job", async () => {
		const out = await run(modelsWith());

		expect(rankCandidates).not.toHaveBeenCalled();
		expect(out).toMatchObject({
			rankingUsed: false,
			rankingReason: "not set up",
		});
	});

	it("says ranking is unavailable when its connection cannot be read", async () => {
		const models = modelsWith(RANKING_ON);
		vi.mocked(models.connection).mockResolvedValue(null);

		const out = await run(models);

		expect(rankCandidates).not.toHaveBeenCalled();
		expect(out).toMatchObject({
			rankingUsed: false,
			rankingReason: "unavailable",
		});
	});
});

describe("suggest_techniques with the jobs off", () => {
	it("answers with search and ranking both off, saying neither was used", async () => {
		const out = await run(modelsWith());

		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "not set up",
			rankingUsed: false,
			rankingReason: "not set up",
		});
		expect(out.results.map((r) => r.slug)).toEqual([
			"t-0",
			"t-1",
			"t-2",
			"t-3",
			"t-4",
		]);
	});

	it("answers with search only when ranking is off, and with ranking only when search is off", async () => {
		rankingReverses();

		const searchOnly = await run(modelsWith(SEARCH_ON));
		const rankingOnly = await run(modelsWith({ ranking: RANKING_JOB }));

		expect(searchOnly).toMatchObject({
			searchUsed: true,
			rankingUsed: false,
			rankingReason: "not set up",
		});
		expect(rankingOnly).toMatchObject({
			searchUsed: false,
			searchReason: "not set up",
			rankingUsed: true,
		});
	});

	it("still answers, saying both were unavailable, when the user's jobs cannot be read", async () => {
		const models = { ...modelsWith(), roles: () => Promise.resolve(null) };

		const out = await run(models);

		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "unavailable",
			rankingUsed: false,
			rankingReason: "unavailable",
		});
		expect(out.results).toHaveLength(5);
	});

	it("still reports the service as unreachable when it fails", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		expect(await run(modelsWith(SEARCH_ON))).toEqual(UNREACHABLE);
	});
});

describe("suggest_techniques Stop", () => {
	it("cancels the embedding and does not go on to the service", async () => {
		vi.useFakeTimers();
		embeddingHangs();
		const stop = new AbortController();

		const pending = run(modelsWith(SEARCH_ON), { abortSignal: stop.signal });
		await vi.advanceTimersByTimeAsync(100);
		expect(embeddingModel.doEmbedCalls[0]?.abortSignal?.aborted).toBe(false);
		stop.abort();

		expect(await pending).toEqual(UNREACHABLE);
		expect(embeddingModel.doEmbedCalls[0]?.abortSignal?.aborted).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("cancels the read of the catalogue spec", async () => {
		vi.useFakeTimers();
		let specSignal: AbortSignal | undefined;
		vi.mocked(fetchEmbeddingSpec).mockImplementation((signal) => {
			specSignal = signal;
			return new Promise((resolve) =>
				signal?.addEventListener("abort", () => resolve(null))
			);
		});
		const stop = new AbortController();

		const pending = run(modelsWith(SEARCH_ON), { abortSignal: stop.signal });
		await vi.advanceTimersByTimeAsync(100);
		stop.abort();

		expect(await pending).toEqual(UNREACHABLE);
		expect(specSignal?.aborted).toBe(true);
	});

	it("cancels the call to the service", async () => {
		vi.useFakeTimers();
		let signal: AbortSignal | undefined;
		fetchMock.mockImplementation((_url: string, init: RequestInit) => {
			signal = init.signal ?? undefined;
			return whenAborted(signal);
		});
		const stop = new AbortController();

		const pending = run(modelsWith(), { abortSignal: stop.signal });
		await vi.advanceTimersByTimeAsync(100);
		expect(signal?.aborted).toBe(false);
		stop.abort();

		expect(await pending).toEqual(UNREACHABLE);
		expect(signal?.aborted).toBe(true);
	});

	it("cancels the ranking", async () => {
		vi.useFakeTimers();
		rankingHangs();
		const stop = new AbortController();

		const pending = run(modelsWith({ ranking: RANKING_JOB }), {
			abortSignal: stop.signal,
		});
		await vi.advanceTimersByTimeAsync(100);
		const signal = vi.mocked(rankCandidates).mock.calls[0]?.[0].signal;
		expect(signal?.aborted).toBe(false);
		stop.abort();
		await pending;

		expect(signal?.aborted).toBe(true);
	});

	it("leaves no timer running once a lookup is over", async () => {
		vi.useFakeTimers();
		rankingReverses();

		await run(modelsWith({ ...SEARCH_ON, ranking: RANKING_JOB }));

		expect(vi.getTimerCount()).toBe(0);
	});
});

describe("rankingCandidateCount", () => {
	it("defaults to 8 when unset, empty or not a number", () => {
		expect(rankingCandidateCount(undefined)).toBe(8);
		expect(rankingCandidateCount("")).toBe(8);
		expect(rankingCandidateCount("many")).toBe(8);
		expect(rankingCandidateCount("2.5")).toBe(8);
	});

	it("uses an integer from 1 to 20 as given and clamps the rest into that range", () => {
		expect(rankingCandidateCount("12")).toBe(12);
		expect(rankingCandidateCount("0")).toBe(1);
		expect(rankingCandidateCount("99")).toBe(20);
	});
});

describe("techniquesPrompt", () => {
	it("asks the assistant to say when ranking or semantic search was not used", () => {
		expect(techniquesPrompt()).toMatch(/searchUsed or rankingUsed false/);
		expect(techniquesPrompt()).toMatch(
			/semantic search or ranking was not used, giving its searchReason or rankingReason/
		);
	});
});
