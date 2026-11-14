import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelConnectionAccess } from "@/lib/models/connection-types";
import {
	checkEmbedding,
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import {
	answerEmbeddings,
	type CountingServer,
	embeddingInputs,
	embeddingsBody,
	exactEmbedding,
	json,
	makeSpec,
	QUERY_PREFIX,
	releaseMockedNetwork,
	SPEC_DIMENSIONS,
	sleep,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const KEY = "sk-embed-SECRET-3303";
let target: CountingServer;

beforeAll(releaseMockedNetwork);

beforeEach(async () => {
	target = await startServer();
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await target.close();
});

const connection = (): ModelConnectionAccess => ({
	type: "OLLAMA",
	baseUrl: target.origin,
	apiKey: KEY,
});

function check(spec = makeSpec()) {
	return checkEmbedding({ connection: connection(), model: "embed-m", spec });
}

/** A copy of each probe's vector, tilted towards the next axis so that its cosine with the original is `cosine`. */
function tilted(cosine: number) {
	const spec = makeSpec();
	const eps = Math.sqrt(1 / cosine ** 2 - 1);
	return spec.probes.map((probe, index) => {
		const vector = [...probe.vector];
		const own = probe.vector.indexOf(1);
		vector[(own + 1) % SPEC_DIMENSIONS] = eps;
		vector[own] = 1;
		return { text: probe.text, vector, index };
	});
}

describe("checkEmbedding: which vectors pass", () => {
	it("passes vectors that match the published ones", async () => {
		const spec = makeSpec();
		target.handler = answerEmbeddings(exactEmbedding(spec));
		const result = await check(spec);
		expect(result.ok).toBe(true);
		expect(result.lowestCosine).toBeGreaterThan(0.9999);
	});

	it("embeds each test sentence behind the catalogue's query prefix, with the key", async () => {
		const spec = makeSpec();
		target.handler = answerEmbeddings(exactEmbedding(spec));
		await check(spec);
		expect(target.hits).toHaveLength(1);
		expect(embeddingInputs(target.hits[0]!)).toEqual(
			spec.probes.map((probe) => `${QUERY_PREFIX}${probe.text}`)
		);
		expect(target.hits[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it("passes vectors of a different length scale, because only direction matters", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		target.handler = answerEmbeddings((input) =>
			exact(input).map((value) => value * 37)
		);
		expect((await check(spec)).ok).toBe(true);
	});

	it("fails vectors that agree only to about 0.99", async () => {
		const spec = makeSpec();
		const near = tilted(0.99);
		target.handler = (hit, response) => {
			const inputs = embeddingInputs(hit);
			json(
				response,
				embeddingsBody(
					inputs.map((input) => {
						const probe = near.find(
							(entry) => input === `${spec.queryPrefix}${entry.text}`
						);
						return probe ? probe.vector : [0, 0, 0, 1];
					})
				)
			);
		};
		const result = await check(spec);
		expect(result.lowestCosine).toBeCloseTo(0.99, 3);
		expect(result.ok).toBe(false);
	});

	it("passes vectors that agree to about 0.9995", async () => {
		const spec = makeSpec();
		const near = tilted(0.9995);
		target.handler = (hit, response) => {
			json(
				response,
				embeddingsBody(
					embeddingInputs(hit).map((input) => {
						const probe = near.find(
							(entry) => input === `${spec.queryPrefix}${entry.text}`
						);
						return probe ? probe.vector : [0, 0, 0, 1];
					})
				)
			);
		};
		expect((await check(spec)).ok).toBe(true);
	});

	it("fails vectors that agree only to about 0.9", async () => {
		const spec = makeSpec();
		const near = tilted(0.9);
		target.handler = (hit, response) => {
			json(
				response,
				embeddingsBody(
					embeddingInputs(hit).map((input) => {
						const probe = near.find(
							(entry) => input === `${spec.queryPrefix}${entry.text}`
						);
						return probe ? probe.vector : [0, 0, 0, 1];
					})
				)
			);
		};
		expect((await check(spec)).ok).toBe(false);
	});

	it("fails when a single probe is far off, even if the others match", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		const [, second] = spec.probes;
		target.handler = answerEmbeddings((input) =>
			input === `${spec.queryPrefix}${second?.text}`
				? [0, 0, 0, 1]
				: exact(input)
		);
		const result = await check(spec);
		expect(result.ok).toBe(false);
		expect(result.lowestCosine).toBeLessThan(0.5);
	});

	it("fails vectors that point the opposite way", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		target.handler = answerEmbeddings((input) =>
			exact(input).map((value) => -value)
		);
		const result = await check(spec);
		expect(result.ok).toBe(false);
		expect(result.lowestCosine).toBeLessThan(0);
	});

	it("fails an all-zero vector, which has no direction", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		target.handler = answerEmbeddings((input) =>
			input.endsWith(spec.probes[0]?.text ?? "?") ? [0, 0, 0, 0] : exact(input)
		);
		expect(await check(spec)).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails vectors of the wrong length even when they point the right way", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		target.handler = answerEmbeddings((input) => [...exact(input), 0, 0]);
		expect(await check(spec)).toEqual({ ok: false, lowestCosine: null });
		target.handler = answerEmbeddings((input) => exact(input).slice(0, 3));
		expect(await check(spec)).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails when the server answers with fewer vectors than sentences", async () => {
		const spec = makeSpec();
		const exact = exactEmbedding(spec);
		target.handler = (hit, response) => {
			const [first] = embeddingInputs(hit);
			json(response, embeddingsBody([exact(first ?? "")]));
		};
		const result = await check(spec);
		expect(result.ok).toBe(false);
	});

	it("fails, and does not throw, on a server error, an unreadable answer or no answer", async () => {
		target.handler = (_hit, response) => json(response, { error: "x" }, 500);
		expect(await check()).toEqual({ ok: false, lowestCosine: null });

		target.handler = (_hit, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end("not json at all");
		};
		expect(await check()).toEqual({ ok: false, lowestCosine: null });

		target.handler = (_hit, response) => json(response, { data: "nope" });
		expect(await check()).toEqual({ ok: false, lowestCosine: null });
	});

	it("fails when the caller aborts", async () => {
		target.handler = () => undefined;
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 100);
		const started = Date.now();
		const result = await checkEmbedding({
			connection: connection(),
			model: "m",
			spec: makeSpec(),
			signal: controller.signal,
		});
		expect(result).toEqual({ ok: false, lowestCosine: null });
		expect(Date.now() - started).toBeLessThan(3000);
	});
});

describe("checkEmbedding: the address guard applies", () => {
	it("reaches no server that is not on the operator's list", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const spec = makeSpec();
		target.handler = answerEmbeddings(exactEmbedding(spec));
		expect(await check(spec)).toEqual({ ok: false, lowestCosine: null });
		await sleep(30);
		expect(target.connections).toBe(0);
	});

	it("does not follow a redirect to a server that holds the right vectors", async () => {
		const spec = makeSpec();
		const second = await startServer(answerEmbeddings(exactEmbedding(spec)));
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`${target.origin},${second.origin}`
		);
		target.handler = (_hit, response) => {
			response.writeHead(307, { location: `${second.origin}/v1/embeddings` });
			response.end();
		};
		try {
			expect((await check(spec)).ok).toBe(false);
			expect(second.hits).toHaveLength(0);
		} finally {
			await second.close();
		}
	});
});

describe("embeddingCheckId", () => {
	it("is the same for the same model and sentences, whatever the vectors or data version", () => {
		const a = makeSpec({ dataVersion: "1" });
		const b = makeSpec({ dataVersion: "99" });
		b.probes[0] = { text: b.probes[0]?.text ?? "", vector: [9, 9, 9, 9] };
		expect(embeddingCheckId(a)).toBe(embeddingCheckId(b));
	});

	it("changes with the model, with a sentence, with their order and with their number", () => {
		const base = embeddingCheckId(makeSpec());
		expect(embeddingCheckId(makeSpec({ modelId: "other-model" }))).not.toBe(
			base
		);

		const edited = makeSpec();
		edited.probes[1] = { ...edited.probes[1]!, text: "A different sentence" };
		expect(embeddingCheckId(edited)).not.toBe(base);

		const swapped = makeSpec();
		swapped.probes.reverse();
		expect(embeddingCheckId(swapped)).not.toBe(base);

		const fewer = makeSpec();
		fewer.probes.pop();
		expect(embeddingCheckId(fewer)).not.toBe(base);
	});
});

describe("fetchEmbeddingSpec", () => {
	function serveSpec(body: unknown, status = 200) {
		target.handler = (hit, response) => {
			if (hit.url === "/embedding-spec") {
				json(response, body, status);
				return;
			}
			json(response, {}, 404);
		};
		vi.stubEnv("TECHNIQUES_MCP_URL", `${target.origin}/mcp`);
	}

	it("reads a valid spec from the origin of the service address", async () => {
		serveSpec(makeSpec());
		const spec = await fetchEmbeddingSpec();
		expect(spec?.modelId).toBe(makeSpec().modelId);
		expect(spec?.probes).toHaveLength(3);
	});

	it("gives nothing when the address is unset or not http(s)", async () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "");
		expect(await fetchEmbeddingSpec()).toBeNull();
		vi.stubEnv("TECHNIQUES_MCP_URL", "file:///etc/passwd");
		expect(await fetchEmbeddingSpec()).toBeNull();
		vi.stubEnv("TECHNIQUES_MCP_URL", "not a url");
		expect(await fetchEmbeddingSpec()).toBeNull();
		expect(target.hits).toHaveLength(0);
	});

	it.each([
		[
			"a probe vector of the wrong length",
			() => {
				const spec = makeSpec();
				spec.probes[1] = { ...spec.probes[1]!, vector: [1, 2] };
				return spec;
			},
		],
		["no probes", () => makeSpec({ probes: [] })],
		[
			"more probes than allowed",
			() =>
				makeSpec({
					probes: Array.from({ length: 33 }, (_, i) => ({
						text: `s${i}`,
						vector: [1, 0, 0, 0],
					})),
				}),
		],
		["an empty model id", () => makeSpec({ modelId: "" })],
		["dimensions of zero", () => makeSpec({ dimensions: 0 })],
		[
			"dimensions far beyond any model",
			() =>
				makeSpec({
					dimensions: 100_000,
					probes: [{ text: "s", vector: new Array(100_000).fill(0) }],
				}),
		],
		["a negative number of dimensions", () => makeSpec({ dimensions: -4 })],
		[
			"a vector holding text",
			() => ({
				...makeSpec(),
				probes: [{ text: "s", vector: ["a", "b", "c", "d"] }],
			}),
		],
		[
			"an empty sentence",
			() => makeSpec({ probes: [{ text: "", vector: [1, 0, 0, 0] }] }),
		],
	])("gives nothing for a spec with %s", async (_label, build) => {
		serveSpec(build());
		expect(await fetchEmbeddingSpec()).toBeNull();
	});

	it("gives nothing for a server error, an unreadable body, or a redirect that it does not follow", async () => {
		serveSpec(makeSpec(), 500);
		expect(await fetchEmbeddingSpec()).toBeNull();

		target.handler = (_hit, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end("{ nope");
		};
		expect(await fetchEmbeddingSpec()).toBeNull();

		const second = await startServer((_hit, response) =>
			json(response, makeSpec())
		);
		try {
			target.handler = (_hit, response) => {
				response.writeHead(302, {
					location: `${second.origin}/embedding-spec`,
				});
				response.end();
			};
			expect(await fetchEmbeddingSpec()).toBeNull();
			expect(second.hits).toHaveLength(0);
		} finally {
			await second.close();
		}
	});

	it("gives nothing, soon, when the service does not answer", async () => {
		target.handler = () => undefined;
		vi.stubEnv("TECHNIQUES_MCP_URL", `${target.origin}/mcp`);
		const started = Date.now();
		expect(await fetchEmbeddingSpec()).toBeNull();
		expect(Date.now() - started).toBeLessThan(8000);
	}, 12_000);

	it("gives nothing when the caller has aborted", async () => {
		serveSpec(makeSpec());
		const controller = new AbortController();
		controller.abort();
		expect(await fetchEmbeddingSpec(controller.signal)).toBeNull();
	});
});
