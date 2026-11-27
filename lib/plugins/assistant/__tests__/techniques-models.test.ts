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
	embedClaim,
	MIN_WAIT_MS,
	rankHead,
	rankingCandidateCount,
	type TechniquesModelAccess,
} from "@/lib/plugins/assistant/techniques-models";
import type { ConnectionForUse } from "@/lib/services/model-connection-service";

vi.mock("@/lib/models/adapters", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/adapters")>()),
	embeddingModelFor: vi.fn(),
}));
vi.mock("@/lib/models/clef", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/clef")>()),
	rankCandidates: vi.fn(),
}));
vi.mock("@/lib/models/embedding-check", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/embedding-check")>()),
	fetchEmbeddingSpec: vi.fn(),
}));

const NOW = new Date(2026, 5, 1, 12, 0, 0).getTime();
const SPEC: EmbeddingSpec = {
	modelId: "catalogue/model",
	dimensions: 3,
	queryPrefix: "query: ",
	documentFormat: "doc",
	dataVersion: "v1",
	probes: [{ text: "first probe", vector: [1, 0, 0] }],
};
const CONNECTION: ConnectionForUse = {
	id: "c1",
	label: "c1",
	type: "OLLAMA",
	baseUrl: "http://models.test",
	apiKey: null,
};
const JOB = { connectionId: "c1", model: "a-model" };
const CHECK = {
	verifiedAt: new Date(NOW),
	verifiedFor: embeddingCheckId(SPEC),
};
const CANDIDATE: RankableCandidate = {
	id: "t1",
	name: "T1",
	summary: "s",
	goals: [],
};

function accessGiving(connection: ConnectionForUse | null) {
	return {
		roles: () => Promise.resolve(null),
		connection: vi.fn(() => Promise.resolve(connection)),
	} satisfies TechniquesModelAccess;
}

function embedsAs(vector: number[]) {
	vi.mocked(embeddingModelFor).mockReturnValue(
		new MockEmbeddingModelV3({
			doEmbed: ({ values }) =>
				Promise.resolve({
					embeddings: values.map(() => vector),
					usage: { tokens: 1 },
					warnings: [],
				}),
		})
	);
}

function embed(
	overrides: { access?: TechniquesModelAccess; deadline?: number } = {}
) {
	return embedClaim({
		access: overrides.access ?? accessGiving(CONNECTION),
		check: CHECK,
		claim: "a claim",
		deadline: overrides.deadline ?? Date.now() + 60_000,
		job: JOB,
		signal: undefined,
	});
}

function rank(
	overrides: { deadline?: number; access?: TechniquesModelAccess } = {}
) {
	return rankHead({
		access: overrides.access ?? accessGiving(CONNECTION),
		candidates: [CANDIDATE],
		claim: "a claim",
		deadline: overrides.deadline ?? NOW + 60_000,
		job: JOB,
		signal: undefined,
	});
}

let urlCounter = 0;

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	urlCounter += 1;
	vi.stubEnv(
		"TECHNIQUES_MCP_URL",
		`http://techniques.test/models/${urlCounter}`
	);
	vi.mocked(fetchEmbeddingSpec).mockResolvedValue(SPEC);
	embedsAs([0.1, 0.2, 0.3]);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

describe("rankingCandidateCount", () => {
	it("ignores spaces around the number", () => {
		expect(rankingCandidateCount(" 5 ")).toBe(5);
		expect(rankingCandidateCount("\t20\n")).toBe(20);
	});
});

describe("embedClaim: the time it needs", () => {
	it("goes ahead with exactly the minimum wait left after the second kept for the service", async () => {
		const result = await embed({ deadline: NOW + 2 * MIN_WAIT_MS });

		expect(result).toStrictEqual({
			embedding: { model: "catalogue/model", vector: [0.1, 0.2, 0.3] },
		});
	});

	it("gives up, without a model call, with a millisecond less", async () => {
		const result = await embed({ deadline: NOW + 2 * MIN_WAIT_MS - 1 });

		expect(result).toStrictEqual({ reason: "timed out" });
		expect(fetchEmbeddingSpec).not.toHaveBeenCalled();
		expect(embeddingModelFor).not.toHaveBeenCalled();
	});
});

describe("embedClaim: what it will not send", () => {
	it.each([
		["a value that is not a number", [0.1, Number.NaN, 0.3]],
		["a value that is infinite", [0.1, 0.2, Number.POSITIVE_INFINITY]],
	])("sends no vector holding %s", async (_label, vector) => {
		embedsAs(vector);

		expect(await embed()).toStrictEqual({ reason: "check not passed" });
	});

	it("reports the search as unavailable, and builds no model, when the connection cannot be read", async () => {
		const result = await embed({ access: accessGiving(null) });

		expect(result).toStrictEqual({ reason: "unavailable" });
		expect(embeddingModelFor).not.toHaveBeenCalled();
	});
});

describe("embedClaim: keeping the catalogue spec", () => {
	it("reads it again only once ten minutes have passed", async () => {
		await embed();
		await vi.advanceTimersByTimeAsync(10 * 60_000 - 1);
		await embed();
		expect(fetchEmbeddingSpec).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1);
		await embed();

		expect(fetchEmbeddingSpec).toHaveBeenCalledTimes(2);
	});
});

describe("rankHead: the time it needs", () => {
	beforeEach(() => {
		vi.mocked(rankCandidates).mockResolvedValue([
			{ candidate: CANDIDATE, ranked: true, score: 0.9 },
		]);
	});

	it("ranks when exactly the minimum wait is left", async () => {
		const result = await rank({ deadline: NOW + MIN_WAIT_MS });

		expect(result).toStrictEqual({
			ranked: [{ candidate: CANDIDATE, ranked: true, score: 0.9 }],
		});
	});

	it("gives up, without calling the ranking model, with a millisecond less", async () => {
		const result = await rank({ deadline: NOW + MIN_WAIT_MS - 1 });

		expect(result).toStrictEqual({ reason: "timed out" });
		expect(rankCandidates).not.toHaveBeenCalled();
	});
});

describe("rankHead: why a ranking did not come back", () => {
	it("says unavailable when the ranking gave nothing while there was time left", async () => {
		vi.mocked(rankCandidates).mockResolvedValue(null);

		expect(await rank()).toStrictEqual({ reason: "unavailable" });
	});

	it.each([
		["at the moment its time ends", 0],
		["after its time has ended", 1],
	])("says timed out when the ranking gave nothing %s", async (_label, extra) => {
		vi.mocked(rankCandidates).mockImplementation((async (input: {
			deadline: number;
		}) => {
			vi.setSystemTime(input.deadline + extra);
			return await Promise.resolve(null);
		}) as never);

		expect(await rank({ deadline: NOW + 5000 })).toStrictEqual({
			reason: "timed out",
		});
	});

	it("says one millisecond before the end that it was unavailable", async () => {
		vi.mocked(rankCandidates).mockImplementation((async (input: {
			deadline: number;
		}) => {
			vi.setSystemTime(input.deadline - 1);
			return await Promise.resolve(null);
		}) as never);

		expect(await rank({ deadline: NOW + 5000 })).toStrictEqual({
			reason: "unavailable",
		});
	});

	it("says unavailable when the ranking throws", async () => {
		vi.mocked(rankCandidates).mockRejectedValue(new Error("down"));

		expect(await rank()).toStrictEqual({ reason: "unavailable" });
	});
});
