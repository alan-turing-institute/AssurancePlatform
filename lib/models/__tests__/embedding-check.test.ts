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
import type {
	ModelConnectionAccess,
	ModelConnectionType,
} from "../connection-types";
import {
	checkEmbedding,
	EMBEDDING_CHECK_THRESHOLD,
	type EmbeddingSpec,
	fetchEmbeddingSpec,
} from "../embedding-check";
import {
	type ModelServer,
	type Responder,
	sendJson,
	startModelServer,
} from "./model-server";

const KEY = "sk-test-secret-key";
const PREFIX = "task: search result | query: ";

let server: ModelServer;

const SPEC: EmbeddingSpec = {
	modelId: "catalogue-model",
	dimensions: 4,
	queryPrefix: PREFIX,
	documentFormat: "title. summary",
	dataVersion: "1",
	probes: [
		{ text: "explain the model", vector: [1, 0, 0, 0] },
		{ text: "check the fairness of the outputs", vector: [0, 1, 0, 0] },
		{ text: "a long probe sentence", vector: [0, 0, 1, 0] },
	],
};

/**
 * Embeds the probe sentences with `vectorFor(probe index)`. The server finds
 * the probe by the sentence after the query prefix.
 */
function embedding(vectorFor: (index: number) => number[]): Responder {
	return (request, response) => {
		const { input } = JSON.parse(request.body) as { input: string[] };
		sendJson(response, {
			object: "list",
			model: "m",
			data: input.map((text, position) => {
				const probe = SPEC.probes.findIndex((candidate) =>
					text.endsWith(candidate.text)
				);
				return {
					object: "embedding",
					index: position,
					embedding: vectorFor(probe),
				};
			}),
			usage: { prompt_tokens: 1, total_tokens: 1 },
		});
	};
}

/** A vector at the given cosine similarity from the probe's own, in a plane that holds both. */
function atCosine(index: number, similarity: number): number[] {
	const published = SPEC.probes[index]?.vector ?? [];
	const orthogonal = published.map((_value, position) =>
		position === (index + 1) % published.length ? 1 : 0
	);
	const sine = Math.sqrt(1 - similarity * similarity);
	return published.map(
		(value, position) => value * similarity + (orthogonal[position] ?? 0) * sine
	);
}

function connection(
	type: ModelConnectionType,
	overrides: Partial<ModelConnectionAccess> = {}
): ModelConnectionAccess {
	return { type, baseUrl: server.origin, apiKey: KEY, ...overrides };
}

const check = (overrides: Partial<Parameters<typeof checkEmbedding>[0]> = {}) =>
	checkEmbedding({
		connection: connection("OLLAMA"),
		model: "the-search-model",
		spec: SPEC,
		...overrides,
	});

beforeAll(async () => {
	server = await startModelServer();
});

afterAll(() => server.close());

beforeEach(() => {
	server.requests.length = 0;
	server.respond = embedding((index) => SPEC.probes[index]?.vector ?? []);
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", server.origin);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("checkEmbedding", () => {
	it("passes when the connection's vectors match the published ones", async () => {
		const result = await check();

		expect(result.ok).toBe(true);
		expect(result.lowestCosine).toBeCloseTo(1, 10);
	});

	it("embeds every probe with the query prefix, as one request using the job's model", async () => {
		await check();

		expect(server.requests).toHaveLength(1);
		const request = server.requests[0];
		expect(request?.url).toBe("/v1/embeddings");
		expect(request?.headers.authorization).toBe(`Bearer ${KEY}`);
		const body = JSON.parse(request?.body ?? "{}") as {
			input: string[];
			model: string;
		};
		expect(body.model).toBe("the-search-model");
		expect(body.input).toEqual(
			SPEC.probes.map((probe) => `${PREFIX}${probe.text}`)
		);
	});

	it("passes when every similarity is above the threshold, and reports the lowest", async () => {
		server.respond = embedding((index) =>
			atCosine(index, index === 1 ? 0.99 : 0.999)
		);

		const result = await check();

		expect(result.ok).toBe(true);
		expect(result.lowestCosine).toBeCloseTo(0.99, 6);
	});

	it("fails when one probe's similarity is below the threshold", async () => {
		expect(EMBEDDING_CHECK_THRESHOLD).toBeGreaterThan(0.97);
		server.respond = embedding((index) =>
			atCosine(index, index === 2 ? 0.97 : 1)
		);

		const result = await check();

		expect(result.ok).toBe(false);
		expect(result.lowestCosine).toBeCloseTo(0.97, 6);
	});

	it("fails when the vectors have the wrong dimensions, whatever their direction", async () => {
		server.respond = embedding((index) => {
			const vector = SPEC.probes[index]?.vector ?? [];
			return [...vector, 0];
		});

		expect(await check()).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails when the vectors are shorter than published", async () => {
		server.respond = embedding((index) =>
			(SPEC.probes[index]?.vector ?? []).slice(0, 3)
		);
		expect(await check()).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails when a vector is all zeros", async () => {
		server.respond = embedding(() => [0, 0, 0, 0]);
		expect(await check()).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails when the server returns fewer vectors than probes", async () => {
		server.respond = (_request, response) =>
			sendJson(response, {
				object: "list",
				model: "m",
				data: [{ object: "embedding", index: 0, embedding: [1, 0, 0, 0] }],
				usage: { prompt_tokens: 1, total_tokens: 1 },
			});
		expect((await check()).ok).toBe(false);
	});

	it("fails without a similarity when the server errors", async () => {
		server.respond = (_request, response) =>
			sendJson(response, { error: { message: KEY } }, 500);
		expect(await check()).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails without a request when the guard refuses the address", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		expect(await check()).toEqual({ ok: false, lowestCosine: null });
		expect(server.requests).toEqual([]);
	});

	it("fails for a connection type that cannot embed", async () => {
		expect(await check({ connection: connection("ANTHROPIC") })).toEqual({
			ok: false,
			lowestCosine: null,
		});
		expect(server.requests).toEqual([]);
	});

	it("fails when the caller aborts", async () => {
		server.respond = () => undefined;
		const controller = new AbortController();
		const pending = check({ signal: controller.signal });
		await vi.waitFor(() => expect(server.requests).toHaveLength(1));
		controller.abort();
		expect(await pending).toEqual({ ok: false, lowestCosine: null });
	});

	it("returns only the verdict and the similarity, never the key", async () => {
		server.respond = (_request, response) =>
			sendJson(response, { error: KEY }, 401);
		const result = await check();
		expect(JSON.stringify(result)).not.toContain(KEY);
		expect(Object.keys(result).sort()).toEqual(["lowestCosine", "ok"]);
	});
});

describe("fetchEmbeddingSpec", () => {
	const fetchMock = vi.fn();

	/** What `fetch` resolves to for a body served with the given status. */
	function serveSpec(body: unknown, ok = true) {
		fetchMock.mockResolvedValue({ ok, json: async () => body });
	}

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		vi.stubEnv("TECHNIQUES_MCP_URL", "https://techniques.example.test/mcp");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("reads the spec from the service's origin with an ordinary request", async () => {
		serveSpec(SPEC);

		expect(await fetchEmbeddingSpec()).toEqual(SPEC);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://techniques.example.test/embedding-spec");
		expect(init.redirect).toBe("error");
	});

	it("gives the request five seconds", async () => {
		serveSpec(SPEC);
		const timeout = vi.spyOn(AbortSignal, "timeout");

		await fetchEmbeddingSpec();

		expect(timeout).toHaveBeenCalledWith(5000);
	});

	it.each([
		["unset", undefined],
		["empty", ""],
		["not a URL", "techniques"],
		["not http", "ftp://techniques.example.test/mcp"],
	])("returns null, with no request, when TECHNIQUES_MCP_URL is %s", async (_label, value) => {
		vi.stubEnv("TECHNIQUES_MCP_URL", value);
		expect(await fetchEmbeddingSpec()).toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns null for an error status", async () => {
		serveSpec({ error: "no" }, false);
		expect(await fetchEmbeddingSpec()).toBeNull();
	});

	it("returns null when the request fails, is redirected or times out", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));
		expect(await fetchEmbeddingSpec()).toBeNull();
	});

	it("returns null for a body that is not JSON", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: () => Promise.reject(new SyntaxError("Unexpected token")),
		});
		expect(await fetchEmbeddingSpec()).toBeNull();
	});

	it.each([
		["a missing field", { ...SPEC, probes: undefined }],
		["no probes", { ...SPEC, probes: [] }],
		["a missing model id", { ...SPEC, modelId: undefined }],
		["dimensions of zero", { ...SPEC, dimensions: 0 }],
		["dimensions that are not a whole number", { ...SPEC, dimensions: 4.5 }],
		[
			"a probe vector of another length",
			{ ...SPEC, probes: [{ text: "x", vector: [1, 0] }] },
		],
		[
			"a probe vector that is not numbers",
			{ ...SPEC, probes: [{ text: "x", vector: ["a", "b", "c", "d"] }] },
		],
		["a query prefix that is not text", { ...SPEC, queryPrefix: 7 }],
		["an array", [SPEC]],
	])("returns null for %s", async (_label, body) => {
		serveSpec(body);
		expect(await fetchEmbeddingSpec()).toBeNull();
	});
});
