import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { embeddingCheckId } from "@/lib/models/embedding-check";
import type { TechniquesModelAccess } from "@/lib/plugins/assistant/techniques-models";
import { createTechniquesTool } from "@/lib/plugins/assistant/techniques-tool";
import type {
	ConnectionForUse,
	JobAssignment,
	ModelRoles,
} from "@/lib/services/model-connection-service";
import {
	type CountingServer,
	embeddingInputs,
	embeddingsBody,
	exactEmbedding,
	type Hit,
	json,
	makeSpec,
	QUERY_PREFIX,
	rankingAnswer,
	releaseMockedNetwork,
	type SpecFixture,
	serviceAnswer,
	serviceResult,
	sleep,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const KEY = "sk-tool-SECRET-7788";
const CLAIM =
	"The classifier keeps its accuracy when the input distribution drifts by a realistic amount.";

interface ToolResult {
	error?: string;
	rankingReason?: string;
	rankingUsed?: boolean;
	results?: {
		goals: string[];
		name: string;
		ranked: boolean;
		score: number;
		slug: string;
	}[];
	searchReason?: string;
	searchUsed?: boolean;
}

interface Behaviour {
	embed: (hit: Hit, response: import("node:http").ServerResponse) => void;
	rank: (hit: Hit, response: import("node:http").ServerResponse) => void;
	resultCount: number;
	semanticUsed: boolean;
	service: (hit: Hit, response: import("node:http").ServerResponse) => void;
}

let spec: SpecFixture;
let target: CountingServer;
let behaviour: Behaviour;

const paths = {
	embeddings: "/v1/embeddings",
	ranking: "/v1/systemone",
	service: "/mcp",
	spec: "/embedding-spec",
};

function hitsOn(path: string): Hit[] {
	return target.hits.filter((hit) => hit.url === path);
}

function defaultBehaviour(): Behaviour {
	const embed = exactEmbedding(spec);
	return {
		resultCount: 7,
		semanticUsed: true,
		embed: (hit, response) =>
			json(response, embeddingsBody(embeddingInputs(hit).map(embed))),
		rank: (hit, response) =>
			json(
				response,
				rankingAnswer(hit, (id) => 1 - Number(id.replace(/\D/g, "")) / 10)
			),
		service: (_hit, response) =>
			json(
				response,
				serviceAnswer(
					Array.from({ length: behaviour.resultCount }, (_, index) =>
						serviceResult(index)
					),
					behaviour.semanticUsed
				)
			),
	};
}

beforeAll(releaseMockedNetwork);

beforeEach(async () => {
	spec = makeSpec();
	behaviour = defaultBehaviour();
	target = await startServer((hit, response) => {
		if (hit.url === paths.spec) {
			json(response, spec);
		} else if (hit.url === paths.embeddings) {
			behaviour.embed(hit, response);
		} else if (hit.url === paths.ranking) {
			behaviour.rank(hit, response);
		} else if (hit.url === paths.service) {
			behaviour.service(hit, response);
		} else {
			json(response, {}, 404);
		}
	});
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
	vi.stubEnv("TECHNIQUES_MCP_URL", `${target.origin}${paths.service}`);
	vi.stubEnv("ASSISTANT_RANKING_CANDIDATES", "8");
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await target.close();
});

function connection(
	id: string,
	origin = target.origin,
	apiKey: string | null = KEY,
	type: ConnectionForUse["type"] = "OLLAMA"
): ConnectionForUse {
	return { id, label: id, type, baseUrl: origin, apiKey };
}

function job(connectionId: string, model = "m"): JobAssignment {
	return { connectionId, model };
}

function currentCheck(): ModelRoles["searchCheck"] {
	return {
		verifiedFor: embeddingCheckId(spec),
		verifiedAt: new Date(),
	};
}

function access(
	roles: Partial<ModelRoles> | null,
	connections: ConnectionForUse[] = [connection("c1")]
): TechniquesModelAccess {
	return {
		roles: () =>
			Promise.resolve(
				roles === null
					? null
					: {
							chat: null,
							ranking: null,
							search: null,
							searchCheck: null,
							...roles,
						}
			),
		connection: (id) =>
			Promise.resolve(connections.find((entry) => entry.id === id) ?? null),
	};
}

async function run(
	models: TechniquesModelAccess,
	options: { abortSignal?: AbortSignal; replyDeadline?: number } = {}
): Promise<ToolResult> {
	const tool = createTechniquesTool(
		null,
		options.replyDeadline ?? Date.now() + 120_000,
		models
	);
	const execute = tool.execute as unknown as (
		input: { claimText?: string },
		context: {
			abortSignal?: AbortSignal;
			messages: never[];
			toolCallId: string;
		}
	) => Promise<ToolResult>;
	return await execute(
		{ claimText: CLAIM },
		{ toolCallId: "t", messages: [], abortSignal: options.abortSignal }
	);
}

function serviceArguments() {
	const [hit] = hitsOn(paths.service);
	return JSON.parse(hit?.body ?? "{}").params.arguments as {
		claim: string;
		queryEmbedding?: { model: string; vector: number[] };
	};
}

describe("technique lookup: the embedding step", () => {
	it("makes no embedding call when search is off", async () => {
		const result = await run(access({ search: null }));
		expect(hitsOn(paths.embeddings)).toHaveLength(0);
		expect(hitsOn(paths.spec)).toHaveLength(0);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("not set up");
		expect(result.results).toHaveLength(5);
		expect(serviceArguments().queryEmbedding).toBeUndefined();
	});

	it("makes no embedding call when search has no passed check", async () => {
		const result = await run(access({ search: job("c1"), searchCheck: null }));
		expect(hitsOn(paths.embeddings)).toHaveLength(0);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("check not passed");
		expect(result.results).toHaveLength(5);
		expect(serviceArguments().queryEmbedding).toBeUndefined();
	});

	it.each([
		[
			"a catalogue model that has since changed",
			() => ({
				verifiedFor: embeddingCheckId(makeSpec({ modelId: "an-older-model" })),
			}),
		],
		[
			"test sentences that have since changed",
			() => {
				const older = makeSpec();
				older.probes[0] = { ...older.probes[0]!, text: "An older sentence" };
				return { verifiedFor: embeddingCheckId(older) };
			},
		],
		["an empty record", () => ({ verifiedFor: "" })],
		["the id of another catalogue", () => ({ verifiedFor: "x#y" })],
	])("makes no embedding call when the passed check is for %s", async (_label, make) => {
		const result = await run(
			access({
				search: job("c1"),
				searchCheck: { ...make(), verifiedAt: new Date() },
			})
		);
		expect(hitsOn(paths.embeddings)).toHaveLength(0);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("check not passed");
		expect(result.results).toHaveLength(5);
		expect(serviceArguments().queryEmbedding).toBeUndefined();
	});

	it("embeds the claim behind the catalogue's prefix and gives the service the vector and the catalogue's model id", async () => {
		const result = await run(
			access({ search: job("c1", "embed-m"), searchCheck: currentCheck() })
		);
		const [embedHit] = hitsOn(paths.embeddings);
		expect(embeddingInputs(embedHit!)).toEqual([`${QUERY_PREFIX}${CLAIM}`]);
		expect(JSON.parse(embedHit?.body ?? "{}").model).toBe("embed-m");
		expect(embedHit?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(serviceArguments().queryEmbedding).toEqual({
			model: spec.modelId,
			vector: [0.5, 0.5, 0.5, 0.5],
		});
		expect(serviceArguments().claim).toBe(CLAIM);
		expect(result.searchUsed).toBe(true);
		expect(result.searchReason).toBeUndefined();
	});

	it("says search was not used when the service did not use the vector it was sent", async () => {
		behaviour.semanticUsed = false;
		const result = await run(
			access({ search: job("c1"), searchCheck: currentCheck() })
		);
		expect(hitsOn(paths.embeddings)).toHaveLength(1);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("unavailable");
		expect(result.results).toHaveLength(5);
	});

	it("does not send a vector of the wrong length, and says search was not used", async () => {
		behaviour.embed = (hit, response) =>
			json(
				response,
				embeddingsBody(embeddingInputs(hit).map(() => [1, 2, 3, 4, 5]))
			);
		const result = await run(
			access({ search: job("c1"), searchCheck: currentCheck() })
		);
		expect(serviceArguments().queryEmbedding).toBeUndefined();
		expect(result.searchUsed).toBe(false);
		expect(result.results).toHaveLength(5);
	});

	it.each([
		[
			"a server error",
			(_hit: Hit, response: import("node:http").ServerResponse) =>
				json(response, { error: "x" }, 500),
		],
		[
			"a dropped connection",
			(_hit: Hit, response: import("node:http").ServerResponse) => {
				response.socket?.destroy();
			},
		],
		[
			"an answer that is not a list of vectors",
			(_hit: Hit, response: import("node:http").ServerResponse) =>
				json(response, { data: [{ embedding: "abc" }] }),
		],
		[
			"a vector with a missing number",
			(_hit: Hit, response: import("node:http").ServerResponse) =>
				json(response, { data: [{ embedding: [0.1, null, 0.3, 0.4] }] }),
		],
	])("still answers, without search, after %s", async (_label, embed) => {
		behaviour.embed = embed;
		const result = await run(
			access({ search: job("c1"), searchCheck: currentCheck() })
		);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("unavailable");
		expect(result.results).toHaveLength(5);
		expect(serviceArguments().queryEmbedding).toBeUndefined();
	});

	it("still answers, without search, when the catalogue spec cannot be read", async () => {
		const original = target.handler;
		target.handler = (hit, response, request) => {
			if (hit.url === paths.spec) {
				json(response, { error: "gone" }, 500);
				return;
			}
			original(hit, response, request);
		};
		const result = await run(
			access({ search: job("c1"), searchCheck: currentCheck() })
		);
		expect(hitsOn(paths.embeddings)).toHaveLength(0);
		expect(result.searchUsed).toBe(false);
		expect(result.results).toHaveLength(5);
	});

	it("still answers, without search or ranking, when the user's jobs cannot be read", async () => {
		const result = await run(access(null));
		expect(result.searchUsed).toBe(false);
		expect(result.rankingUsed).toBe(false);
		expect(result.results).toHaveLength(5);
		expect(hitsOn(paths.embeddings)).toHaveLength(0);
		expect(hitsOn(paths.ranking)).toHaveLength(0);
	});

	it("still answers when reading a connection throws", async () => {
		const models: TechniquesModelAccess = {
			roles: () =>
				Promise.resolve({
					chat: null,
					ranking: job("c1"),
					search: job("c1"),
					searchCheck: currentCheck(),
				}),
			connection: () => Promise.reject(new Error(`boom ${KEY}`)),
		};
		const result = await run(models);
		expect(result.results).toHaveLength(5);
		expect(result.searchUsed).toBe(false);
		expect(result.rankingUsed).toBe(false);
		expect(JSON.stringify(result)).not.toContain(KEY);
	});
});

describe("technique lookup: the ranking step", () => {
	it("ranks the first candidates, and the rest follow unranked in the service's order", async () => {
		vi.stubEnv("ASSISTANT_RANKING_CANDIDATES", "3");
		// Scores favour the later candidates: t2 > t1 > t0.
		behaviour.rank = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, (id) => Number(id.replace(/\D/g, "")) / 10 + 0.1)
			);
		const result = await run(access({ ranking: job("c1", "clef-flash") }));
		expect(result.rankingUsed).toBe(true);
		expect(result.results?.map((entry) => entry.slug)).toEqual([
			"technique-2",
			"technique-1",
			"technique-0",
			"technique-3",
			"technique-4",
		]);
		expect(result.results?.map((entry) => entry.ranked)).toEqual([
			true,
			true,
			true,
			false,
			false,
		]);
		expect(JSON.parse(hitsOn(paths.ranking)[0]?.body ?? "{}").model).toBe(
			"clef-flash"
		);
	});

	it("makes no ranking call when ranking is off", async () => {
		const result = await run(access({ ranking: null }));
		expect(hitsOn(paths.ranking)).toHaveLength(0);
		expect(result.rankingUsed).toBe(false);
		expect(result.rankingReason).toBe("not set up");
		expect(result.results?.map((entry) => entry.slug)).toEqual(
			["0", "1", "2", "3", "4"].map((n) => `technique-${n}`)
		);
	});

	it("keeps the service's order, and marks nothing ranked, when the ranking server fails", async () => {
		behaviour.rank = (_hit, response) => json(response, { error: "x" }, 500);
		const result = await run(access({ ranking: job("c1") }));
		expect(result.rankingUsed).toBe(false);
		expect(result.rankingReason).toBe("unavailable");
		expect(result.results?.map((entry) => entry.slug)).toEqual(
			["0", "1", "2", "3", "4"].map((n) => `technique-${n}`)
		);
		expect(result.results?.some((entry) => entry.ranked)).toBe(false);
	});

	it("never returns a ranking of only some candidates when one batch fails", async () => {
		// Big goal lists put each candidate in its own request.
		behaviour.service = (_hit, response) =>
			json(
				response,
				serviceAnswer(
					Array.from({ length: 6 }, (_, index) =>
						serviceResult(index, {
							goals: Array.from({ length: 20 }, () => "g".repeat(200)),
						})
					),
					false
				)
			);
		// Scores would reverse the order, so any partial use would show.
		behaviour.rank = (hit, response) => {
			if (hit.body.includes('"id":"technique-3"')) {
				json(response, { error: "x" }, 500);
				return;
			}
			json(
				response,
				rankingAnswer(hit, (id) => Number(id.replace(/\D/g, "")) / 10)
			);
		};
		const result = await run(access({ ranking: job("c1") }));
		expect(hitsOn(paths.ranking).length).toBeGreaterThan(1);
		expect(result.rankingUsed).toBe(false);
		expect(result.rankingReason).toBe("unavailable");
		expect(result.results?.map((entry) => entry.slug)).toEqual(
			["0", "1", "2", "3", "4"].map((n) => `technique-${n}`)
		);
		expect(result.results?.some((entry) => entry.ranked)).toBe(false);
	});

	it("asks nothing of a ranking job whose connection cannot rank", async () => {
		const result = await run(
			access({ ranking: job("c1") }, [
				connection("c1", target.origin, KEY, "OPENAI_COMPATIBLE"),
			])
		);
		expect(hitsOn(paths.ranking)).toHaveLength(0);
		expect(result.rankingUsed).toBe(false);
		expect(result.results).toHaveLength(5);
	});

	it("keeps each job's key with its own connection", async () => {
		const other = await startServer((hit, response) => {
			if (hit.url === paths.ranking) {
				json(
					response,
					rankingAnswer(hit, () => 0.5)
				);
				return;
			}
			json(response, {}, 404);
		});
		vi.stubEnv(
			"TEA_MODELS_LOCAL_ADDRESSES",
			`${target.origin},${other.origin}`
		);
		try {
			const result = await run(
				access(
					{
						search: job("search-conn"),
						ranking: job("rank-conn"),
						searchCheck: currentCheck(),
					},
					[
						connection("search-conn", target.origin, "KEY-FOR-SEARCH"),
						connection("rank-conn", other.origin, "KEY-FOR-RANKING"),
					]
				)
			);
			expect(result.searchUsed).toBe(true);
			expect(result.rankingUsed).toBe(true);
			const searchSide = JSON.stringify(target.hits);
			expect(searchSide).toContain("KEY-FOR-SEARCH");
			expect(searchSide).not.toContain("KEY-FOR-RANKING");
			const rankingSide = JSON.stringify(other.hits);
			expect(rankingSide).toContain("KEY-FOR-RANKING");
			expect(rankingSide).not.toContain("KEY-FOR-SEARCH");
			expect(hitsOn(paths.embeddings)).toHaveLength(1);
			expect(other.hits.every((hit) => hit.url === paths.ranking)).toBe(true);
		} finally {
			await other.close();
		}
	});

	it("does not put the key or the address into what it returns", async () => {
		behaviour.rank = (_hit, response) => json(response, { error: "x" }, 500);
		const result = await run(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			})
		);
		const text = JSON.stringify(result);
		expect(text).not.toContain(KEY);
		expect(text).not.toContain(String(target.port));
	});
});

describe("technique lookup: time", () => {
	/** A reply that must be over 20 seconds from now, which leaves the lookup 5 seconds. */
	const replyDeadline = () => Date.now() + 20_000;
	const LOOKUP_MS = 5000;

	async function timed(
		models: TechniquesModelAccess,
		options: { abortSignal?: AbortSignal } = {}
	) {
		const started = Date.now();
		const result = await run(models, {
			replyDeadline: replyDeadline(),
			...options,
		});
		return { result, elapsed: Date.now() - started };
	}

	it("answers inside the lookup's time when the embedding server hangs", async () => {
		behaviour.embed = () => undefined;
		const { result, elapsed } = await timed(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			})
		);
		expect(elapsed).toBeLessThan(LOOKUP_MS + 1500);
		expect(result.searchUsed).toBe(false);
		expect(result.searchReason).toBe("timed out");
		expect(result.results?.length).toBeGreaterThan(0);
	}, 15_000);

	it("answers inside the lookup's time when the ranking server hangs", async () => {
		behaviour.rank = () => undefined;
		const { result, elapsed } = await timed(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			})
		);
		expect(elapsed).toBeLessThan(LOOKUP_MS + 1500);
		expect(result.searchUsed).toBe(true);
		expect(result.rankingUsed).toBe(false);
		expect(result.rankingReason).toBe("timed out");
		expect(result.results).toHaveLength(5);
		expect(result.results?.some((entry) => entry.ranked)).toBe(false);
	}, 15_000);

	it("says the service is unreachable, inside the lookup's time, when it hangs", async () => {
		behaviour.service = () => undefined;
		const { result, elapsed } = await timed(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			})
		);
		expect(elapsed).toBeLessThan(LOOKUP_MS + 1500);
		expect(result.error).toBeTruthy();
		expect(result.results).toBeUndefined();
	}, 15_000);

	it("answers inside the lookup's time when every server hangs", async () => {
		behaviour.embed = () => undefined;
		behaviour.rank = () => undefined;
		behaviour.service = () => undefined;
		const { result, elapsed } = await timed(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			})
		);
		expect(elapsed).toBeLessThan(LOOKUP_MS + 1500);
		expect(result.error).toBeTruthy();
	}, 15_000);

	it("spends nothing when too little of the reply is left", async () => {
		const result = await run(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			}),
			{ replyDeadline: Date.now() + 15_400 }
		);
		expect(result.error).toBeTruthy();
		expect(target.hits).toHaveLength(0);
	});

	it("stops when the reply is stopped, and does not go on to the service", async () => {
		behaviour.embed = () => undefined;
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 150);
		const started = Date.now();
		const result = await run(
			access({
				search: job("c1"),
				ranking: job("c1"),
				searchCheck: currentCheck(),
			}),
			{ abortSignal: controller.signal }
		);
		expect(Date.now() - started).toBeLessThan(2500);
		expect(result.error).toBeTruthy();
		await sleep(100);
		expect(hitsOn(paths.service)).toHaveLength(0);
		expect(hitsOn(paths.ranking)).toHaveLength(0);
	});
});
