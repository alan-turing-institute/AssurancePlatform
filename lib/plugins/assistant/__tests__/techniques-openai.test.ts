import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	type ModelServer,
	sendJson,
	startModelServer,
} from "@/lib/models/__tests__/model-server";
import type { ModelConnectionType } from "@/lib/models/connection-types";
import {
	type EmbeddingSpec,
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import type { TechniquesModelAccess } from "@/lib/plugins/assistant/techniques-models";
import { createTechniquesTool } from "@/lib/plugins/assistant/techniques-tool";
import type { ModelRoles } from "@/lib/services/model-connection-service";

/**
 * The techniques lookup embeds the claim through the search job and ranks the
 * candidates through the ranking job. An OpenAI connection can do neither, so
 * even if a stored job pointed at one the lookup must carry on without it and
 * send nothing to it.
 */

vi.mock("@/lib/models/embedding-check", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/models/embedding-check")>()),
	fetchEmbeddingSpec: vi.fn(),
}));

const CLAIM = "The model is robust to noise in its input data, tested widely.";
const KEY = "sk-test-secret-key";
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
const PASSED = { verifiedAt: new Date(), verifiedFor: embeddingCheckId(SPEC) };
const SEARCH_JOB = { connectionId: "c-search", model: "embed-model" };
const RANKING_JOB = { connectionId: "c-rank", model: "ranking-model" };

interface Out {
	rankingReason?: string;
	rankingUsed: boolean;
	results: { slug: string }[];
	searchReason?: string;
	searchUsed: boolean;
}

let server: ModelServer;

beforeAll(async () => {
	server = await startModelServer((_request, response) =>
		sendJson(response, { error: "no" }, 500)
	);
});

afterAll(() => server.close());

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

let urlCounter = 1000;

beforeEach(() => {
	server.requests.length = 0;
	// A fresh address for each test, so the cached spec is never carried over.
	urlCounter += 1;
	vi.stubEnv("TECHNIQUES_MCP_URL", `http://techniques.test/${urlCounter}/mcp`);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
	vi.stubGlobal("fetch", fetchMock);
	fetchMock.mockReset();
	fetchMock.mockResolvedValue({
		ok: true,
		json: async () => ({
			result: {
				structuredContent: {
					semanticUsed: false,
					results: Array.from({ length: 10 }, (_, i) => technique(i)),
				},
			},
		}),
	});
	vi.mocked(fetchEmbeddingSpec).mockResolvedValue(SPEC);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

/** Search and ranking both set, on a connection of `type` that answers at the local server. */
function modelsOn(type: ModelConnectionType): TechniquesModelAccess {
	const roles: ModelRoles = {
		chat: null,
		ranking: RANKING_JOB,
		search: SEARCH_JOB,
		searchCheck: PASSED,
	};
	return {
		roles: () => Promise.resolve(roles),
		connection: (id: string) =>
			Promise.resolve({
				id,
				label: id,
				type,
				baseUrl: server.origin,
				apiKey: KEY,
			}),
	};
}

async function lookUp(models: TechniquesModelAccess): Promise<Out> {
	const out = await createTechniquesTool(null, undefined, models).execute?.(
		{ claimText: CLAIM },
		options
	);
	return out as unknown as Out;
}

describe("a stored search or ranking job that points at an OpenAI connection", () => {
	it("sends nothing to the connection, and the lookup carries on without those steps", async () => {
		const out = await lookUp(modelsOn("OPENAI"));

		expect(server.requests).toEqual([]);
		expect(out).toMatchObject({
			searchUsed: false,
			searchReason: "unavailable",
			rankingUsed: false,
			rankingReason: "unavailable",
		});
		expect(out.results.length).toBeGreaterThan(0);
	});

	it("is the connection's type that stops the calls: the same jobs on an Ollama connection do reach the server", async () => {
		await lookUp(modelsOn("OLLAMA"));

		const paths = server.requests.map((request) => request.url);
		expect(paths).toContain("/v1/embeddings");
	});
});
