import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rankCandidates } from "@/lib/models/clef";
import type { ModelConnectionAccess } from "@/lib/models/connection-types";
import {
	type CountingServer,
	captureLogs,
	json,
	type LogCapture,
	rankingAnswer,
	sleep,
	startServer,
} from "@/src/__tests__/utils/model-adversarial-kit";

const KEY = "sk-rank-SECRET-9921";

let target: CountingServer;
let logs: LogCapture;

beforeEach(async () => {
	target = await startServer();
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", target.origin);
	logs = captureLogs((name, value) => vi.stubEnv(name, value));
});

afterEach(async () => {
	logs.stop();
	vi.unstubAllEnvs();
	await target.close();
});

function connection(
	type: ModelConnectionAccess["type"] = "OLLAMA",
	apiKey: string | null = KEY
): ModelConnectionAccess {
	return { type, baseUrl: target.origin, apiKey };
}

interface Candidate {
	goals: string[];
	id: string;
	name: string;
	summary: string;
	tags?: string[];
}

function candidates(count: number, goalsChars = 20): Candidate[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `t${index}`,
		name: `Technique ${index}`,
		summary: `Summary ${index}`,
		goals: ["g".repeat(goalsChars)],
	}));
}

function rank(
	list: Candidate[],
	overrides: Partial<Parameters<typeof rankCandidates<Candidate>>[0]> = {}
) {
	return rankCandidates({
		candidates: list,
		claim: "The model is robust to noise",
		connection: connection(),
		deadline: Date.now() + 5000,
		model: "clef-flash",
		...overrides,
	});
}

/** Candidates big enough that every one of them needs its own request. */
const BIG = 5000;

describe("rankCandidates: where and how it asks", () => {
	it("posts to the Ollama ranking path with the job's model and no key header when there is no key", async () => {
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.5)
			);
		await rank(candidates(2), { connection: connection("OLLAMA", null) });
		expect(target.hits).toHaveLength(1);
		expect(target.hits[0]?.method).toBe("POST");
		expect(target.hits[0]?.url).toBe("/v1/systemone");
		expect(target.hits[0]?.headers.authorization).toBeUndefined();
		expect(JSON.parse(target.hits[0]?.body ?? "{}").model).toBe("clef-flash");
	});

	it("posts to the OpenRouter ranking path with a bearer key and both answers described for every question", async () => {
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.5)
			);
		await rank(candidates(3), {
			connection: connection("OPENROUTER"),
			model: "cloudflare/clef-flash",
		});
		const [hit] = target.hits;
		expect(hit?.url).toBe("/api/alpha/decisions");
		expect(hit?.headers.authorization).toBe(`Bearer ${KEY}`);
		const body = JSON.parse(hit?.body ?? "{}");
		expect(body.model).toBe("cloudflare/clef-flash");
		for (const question of Object.values(body.questions) as {
			criteria: Record<string, string>;
		}[]) {
			expect(question.criteria.true).toBeTruthy();
			expect(question.criteria.false).toBeTruthy();
		}
	});

	it.each([
		"OPENAI_COMPATIBLE",
		"ANTHROPIC",
	] as const)("does not ask a %s connection at all", async (type) => {
		const result = await rank(candidates(2), { connection: connection(type) });
		expect(result).toBeNull();
		expect(target.hits).toHaveLength(0);
		expect(target.connections).toBe(0);
	});

	it("sends only the id, name, summary and goals of a candidate, never other fields or tags", async () => {
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.5)
			);
		const extra = candidates(1).map((candidate) => ({
			...candidate,
			tags: ["tag-should-not-travel"],
			secretField: "field-should-not-travel",
			result: { nested: "nested-should-not-travel" },
		}));
		await rank(extra);
		const sent = target.hits[0]?.body ?? "";
		expect(sent).not.toContain("should-not-travel");
		const state = JSON.parse(sent).state;
		expect(Object.keys(state.candidates[0]).sort()).toEqual([
			"goals",
			"id",
			"name",
			"summary",
		]);
	});

	it("shortens a long summary", async () => {
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.5)
			);
		await rank([
			{ id: "a", name: "A", summary: "s".repeat(5000), goals: ["g"] },
		]);
		const state = JSON.parse(target.hits[0]?.body ?? "{}").state;
		expect(state.candidates[0].summary.length).toBeLessThanOrEqual(200);
	});

	it("makes no request for no candidates, and none once the deadline has passed", async () => {
		expect(await rank([])).toEqual([]);
		expect(await rank(candidates(2), { deadline: Date.now() - 1 })).toBeNull();
		expect(await rank(candidates(2), { deadline: Date.now() })).toBeNull();
		expect(target.hits).toHaveLength(0);
	});
});

describe("rankCandidates: the answer is used whole or not at all", () => {
	it("orders by probability, best first, and keeps the search order for equal scores", async () => {
		const scores: Record<string, number> = {
			t0: 0.2,
			t1: 0.9,
			t2: 0.2,
			t3: 0.9,
			t4: 0.5,
		};
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, (id) => scores[id] ?? 0)
			);
		const ranked = await rank(candidates(5));
		expect(ranked?.map((entry) => entry.candidate.id)).toEqual([
			"t1",
			"t3",
			"t4",
			"t0",
			"t2",
		]);
		expect(ranked?.map((entry) => entry.score)).toEqual([
			0.9, 0.9, 0.5, 0.2, 0.2,
		]);
		expect(ranked?.every((entry) => entry.ranked === true)).toBe(true);
	});

	it("keeps each candidate's own score when the list is split across requests", async () => {
		const scores = (id: string) => (Number(id.slice(1)) % 7) / 10;
		target.handler = (hit, response) =>
			json(response, rankingAnswer(hit, scores));
		const list = candidates(6, BIG);
		const ranked = await rank(list);
		expect(target.hits.length).toBeGreaterThan(1);
		expect(ranked).toHaveLength(6);
		for (const entry of ranked ?? []) {
			expect(entry.score).toBe(scores(entry.candidate.id));
		}
		const sorted = [...(ranked ?? [])].map((entry) => entry.score);
		expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
	});

	it("returns nothing when one of several requests fails, however many others succeeded", async () => {
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.7)
			);
		expect(await rank(candidates(3, BIG))).toHaveLength(3);
		expect(target.hits).toHaveLength(3);

		for (const failing of [0, 1, 2]) {
			target.handler = (hit, response) => {
				if (hit.body.includes(`"id":"t${failing}"`)) {
					json(response, { error: "nope" }, 500);
					return;
				}
				json(
					response,
					rankingAnswer(hit, () => 0.7)
				);
			};
			const result = await rank(candidates(3, BIG));
			expect(result === null).toBe(true);
			await sleep(100);
		}
	});

	it("returns nothing when one request answers fewer questions than it asked", async () => {
		target.handler = (hit, response) => {
			const full = rankingAnswer(hit, () => 0.7);
			if (hit.body.includes('"id":"t1"')) {
				json(response, {
					answers: Object.fromEntries(
						Object.entries(full.answers).filter(([key]) => key !== "c1")
					),
				});
				return;
			}
			json(response, full);
		};
		expect(await rank(candidates(3, BIG))).toBeNull();
	});

	const unusable: [string, unknown][] = [
		["a probability above one", { type: "noul", noul: 1.0001 }],
		["a negative probability", { type: "noul", noul: -0.1 }],
		["a probability sent as text", { type: "noul", noul: "0.5" }],
		["a null probability", { type: "noul", noul: null }],
		["no probability", { type: "noul" }],
		["another kind of answer", { type: "yesno", yes: true }],
		["a bare number", 0.9],
		["null", null],
	];

	it.each(unusable)("returns nothing for %s", async (_label, answer) => {
		target.handler = (_hit, response) =>
			json(response, {
				answers: { c1: answer, c2: { type: "noul", noul: 0.5 } },
			});
		expect(await rank(candidates(2))).toBeNull();
	});

	it.each([
		["not JSON", "<html>oops</html>"],
		["JSON without answers", JSON.stringify({ result: "ok" })],
		["answers that are not an object", JSON.stringify({ answers: [0.5, 0.5] })],
		["an empty body", ""],
	])("returns nothing when the answer is %s", async (_label, body) => {
		target.handler = (_hit, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(body);
		};
		expect(await rank(candidates(2))).toBeNull();
	});

	it("returns nothing for a server error, a redirect, and an oversized answer", async () => {
		target.handler = (_hit, response) => json(response, {}, 503);
		expect(await rank(candidates(1))).toBeNull();

		target.handler = (_hit, response) => {
			response.writeHead(302, { location: "http://169.254.169.254/" });
			response.end();
		};
		expect(await rank(candidates(1))).toBeNull();

		target.handler = (_hit, response) => {
			response.writeHead(200, { "content-type": "application/json" });
			response.end(
				JSON.stringify({
					answers: { c1: { type: "noul", noul: 0.5 } },
					pad: "x".repeat(400_000),
				})
			);
		};
		expect(await rank(candidates(1))).toBeNull();
	});
});

describe("rankCandidates: time", () => {
	it("gives up at the deadline when the server never answers", async () => {
		target.handler = () => undefined;
		const started = Date.now();
		const result = await rank(candidates(2), { deadline: Date.now() + 700 });
		expect(result).toBeNull();
		expect(Date.now() - started).toBeLessThan(2500);
	});

	it("does not wait for a hanging request once another has failed", async () => {
		let seen = 0;
		target.handler = (_hit, response) => {
			if (seen++ === 0) {
				json(response, {}, 500);
			}
		};
		const started = Date.now();
		const result = await rank(candidates(3, BIG), {
			deadline: Date.now() + 10_000,
		});
		expect(result).toBeNull();
		expect(Date.now() - started).toBeLessThan(3000);
	});

	it("stops when the caller aborts", async () => {
		target.handler = () => undefined;
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 100);
		const started = Date.now();
		const result = await rank(candidates(2), {
			deadline: Date.now() + 10_000,
			signal: controller.signal,
		});
		expect(result).toBeNull();
		expect(Date.now() - started).toBeLessThan(2500);
	});

	it("does not start when the caller has already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		target.handler = (hit, response) =>
			json(
				response,
				rankingAnswer(hit, () => 0.5)
			);
		const result = await rank(candidates(2), { signal: controller.signal });
		expect(result).toBeNull();
		await sleep(30);
		expect(target.hits).toHaveLength(0);
	});
});

describe("rankCandidates: nothing it logs or throws carries the key or the address", () => {
	it.each([
		[
			"an error that quotes the key and the address",
			(response: import("node:http").ServerResponse) =>
				json(response, { error: `bad key ${KEY} at ${target.origin}` }, 401),
		],
		[
			"a dropped connection",
			(response: import("node:http").ServerResponse) => {
				response.socket?.destroy();
			},
		],
		[
			"an answer that echoes the key",
			(response: import("node:http").ServerResponse) => {
				response.writeHead(200, { "content-type": "application/json" });
				response.end(JSON.stringify({ answers: `${KEY} ${target.origin}` }));
			},
		],
	])("after %s", async (_label, answer) => {
		target.handler = (_hit, response) => answer(response);
		const result = await rank(candidates(2));
		expect(result).toBeNull();
		const text = logs.text();
		expect(text).not.toContain(KEY);
		expect(text).not.toContain(String(target.port));
		expect(text).not.toContain("127.0.0.1");
	});

	it("logs nothing of the claim or the candidates", async () => {
		target.handler = (_hit, response) => json(response, {}, 500);
		await rank(
			[{ id: "a", name: "CANDIDATE-NAME", summary: "s", goals: ["g"] }],
			{ claim: "CLAIM-TEXT-THE-USER-TYPED" }
		);
		expect(logs.text()).not.toContain("CLAIM-TEXT-THE-USER-TYPED");
		expect(logs.text()).not.toContain("CANDIDATE-NAME");
	});

	it("refuses an address it may not reach and says so without naming it", async () => {
		vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", "");
		const result = await rank(candidates(2));
		expect(result).toBeNull();
		await sleep(30);
		expect(target.connections).toBe(0);
		expect(logs.text()).not.toContain(KEY);
		expect(logs.text()).not.toContain(String(target.port));
	});
});
