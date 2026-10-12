import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { type AddressInfo, isIP, type LookupFunction } from "node:net";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { isBlockedAddress } from "@/lib/models/address-checks";
import type { GuardedFetchOptions } from "@/lib/models/guarded-fetch";

/**
 * Shared pieces for the adversarial tests of the bring-your-own-models change:
 * local servers that count what reaches them, a stub for DNS, a log capture,
 * and a wrapper for the network guard that keeps every test off the internet.
 */

// ============================================
// Local servers
// ============================================

export interface Hit {
	body: string;
	headers: IncomingMessage["headers"];
	method: string;
	/** Path and query. */
	url: string;
}

export type Handler = (
	hit: Hit,
	response: ServerResponse,
	request: IncomingMessage
) => void;

export interface CountingServer {
	close(): Promise<void>;
	/** How many TCP connections were opened to the server. */
	readonly connections: number;
	handler: Handler;
	readonly hits: Hit[];
	readonly origin: string;
	readonly port: number;
}

/** A server on 127.0.0.1 that records every request and every connection. */
export async function startServer(
	handler: Handler = (_hit, response) => {
		response.writeHead(404);
		response.end();
	}
): Promise<CountingServer> {
	const hits: Hit[] = [];
	const state = { connections: 0, handler };
	const sockets = new Set<import("node:net").Socket>();
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const hit: Hit = {
				method: req.method ?? "",
				url: req.url ?? "",
				headers: req.headers,
				body: Buffer.concat(chunks).toString("utf8"),
			};
			hits.push(hit);
			state.handler(hit, res, req);
		});
	});
	server.on("connection", (socket) => {
		state.connections += 1;
		sockets.add(socket);
		socket.on("close", () => sockets.delete(socket));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = (server.address() as AddressInfo).port;
	return {
		origin: `http://127.0.0.1:${port}`,
		port,
		hits,
		get connections() {
			return state.connections;
		},
		get handler() {
			return state.handler;
		},
		set handler(next: Handler) {
			state.handler = next;
		},
		close: () => {
			for (const socket of sockets) {
				socket.destroy();
			}
			server.closeAllConnections();
			return new Promise<void>((resolve) => server.close(() => resolve()));
		},
	};
}

export function json(
	response: ServerResponse,
	body: unknown,
	status = 200,
	headers: Record<string, string> = {}
): void {
	response.writeHead(status, {
		"content-type": "application/json",
		...headers,
	});
	response.end(JSON.stringify(body));
}

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls until `done` is true, or fails after `ms` milliseconds. */
export async function until(done: () => boolean, ms = 3000): Promise<void> {
	const end = Date.now() + ms;
	while (!done()) {
		if (Date.now() > end) {
			throw new Error("Timed out waiting for a condition");
		}
		await sleep(10);
	}
}

/** A promise that is settled from outside, to hold a server's answer back. */
export function gate(): { open(): void; opened: Promise<void> } {
	let open: () => void = () => undefined;
	const opened = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { open, opened };
}

/**
 * The unit test setup replaces the global `fetch` with a mock server. Tests
 * that talk to the local servers above through the global `fetch` call this
 * first (in `beforeAll`) to get the real one back.
 */
export async function releaseMockedNetwork(): Promise<void> {
	const { server } = await import("@/src/__tests__/mocks/server");
	server.close();
}

// ============================================
// DNS
// ============================================

/** A resolver that answers every name with the given addresses, in order. */
export function lookupReturning(...addresses: string[]): LookupFunction {
	const answer = addresses.map((address) => ({
		address,
		family: address.includes(":") ? 6 : 4,
	}));
	const lookup = (
		_hostname: string,
		options: { all?: boolean },
		callback: (...args: unknown[]) => void
	) => {
		if (options.all) {
			callback(null, answer);
		} else {
			callback(null, answer[0]?.address, answer[0]?.family);
		}
	};
	return lookup as unknown as LookupFunction;
}

/** A resolver that records the names it is asked for. */
export function countingLookup(inner: LookupFunction): {
	calls: string[];
	lookup: LookupFunction;
} {
	const calls: string[] = [];
	const lookup = ((hostname: string, options: unknown, callback: unknown) => {
		calls.push(hostname);
		(inner as (...args: unknown[]) => void)(hostname, options, callback);
	}) as unknown as LookupFunction;
	return { calls, lookup };
}

// ============================================
// Logs
// ============================================

export interface LogCapture {
	readonly entries: LogEntry[];
	stop(): void;
	/** Every entry as one string, for searching. */
	text(): string;
}

/** Captures every log entry, whatever its level, until `stop` is called. */
export function captureLogs(
	stubEnv: (name: string, value: string) => void
): LogCapture {
	const entries: LogEntry[] = [];
	stubEnv("LOG_LEVEL", "debug");
	setLogSink((entry) => entries.push(entry));
	return {
		entries,
		text: () => JSON.stringify(entries),
		stop: () => resetLogSink(),
	};
}

// ============================================
// Internet guard for route-level tests
// ============================================

interface HarnessState {
	/** Names the stand-in resolver knows; every other name does not resolve. */
	dns: Map<string, string[]>;
	/** Requests the wrapper refused because they would have left the machine. */
	leaks: string[];
	/** Where the fixed provider addresses are sent. */
	providerOrigin: string | null;
	requests: string[];
}

const FIXED_HOSTS = ["openrouter.ai", "api.anthropic.com"];

export const harness: HarnessState = {
	dns: new Map(),
	leaks: [],
	providerOrigin: null,
	requests: [],
};

export function resetHarness(): void {
	harness.dns = new Map();
	harness.leaks = [];
	harness.providerOrigin = null;
	harness.requests = [];
}

const stubResolver = ((
	hostname: string,
	options: { all?: boolean },
	callback: (...args: unknown[]) => void
) => {
	const found = harness.dns.get(hostname);
	if (!found) {
		callback(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
		return;
	}
	const answer = found.map((address) => ({
		address,
		family: address.includes(":") ? 6 : 4,
	}));
	if (options.all) {
		callback(null, answer);
	} else {
		callback(null, answer[0]?.address, answer[0]?.family);
	}
}) as unknown as LookupFunction;

/** Throws when a test caused a request that would have left the machine. */
export function assertNoLeaks(): void {
	if (harness.leaks.length > 0) {
		throw new Error(
			`Requests would have left the machine: ${harness.leaks.join(", ")}`
		);
	}
}

function hostOf(url: URL): string {
	return url.hostname.replace(/^\[|\]$/g, "");
}

/**
 * Wraps the real `guardedFetch` for tests that go through a route. The fixed
 * provider addresses (OpenRouter, Anthropic) are rewritten to a local stub,
 * names resolve only through `harness.dns`, and a request that would leave the
 * machine is turned into an error that names a test leak. Everything else
 * reaches the real guard, so its refusals are the real ones.
 */
export function wrapGuardedFetch<
	T extends {
		guardedFetch: (
			input: RequestInfo | URL,
			init?: RequestInit,
			options?: GuardedFetchOptions
		) => Promise<Response>;
	},
>(actual: T): T {
	const guardedFetch = (
		input: RequestInfo | URL,
		init?: RequestInit,
		options: GuardedFetchOptions = {}
	): Promise<Response> => {
		let text = typeof input === "string" ? input : String(input);
		harness.requests.push(text);
		if (URL.canParse(text)) {
			const url = new URL(text);
			if (FIXED_HOSTS.includes(url.hostname) && harness.providerOrigin) {
				text = `${harness.providerOrigin}${url.pathname}${url.search}`;
			} else if (
				url.protocol === "https:" &&
				!(isIP(hostOf(url)) !== 0 && isBlockedAddress(hostOf(url))) &&
				!harness.dns.has(url.hostname)
			) {
				harness.leaks.push(text);
				return Promise.reject(
					new Error("TEST LEAK: a request would leave the machine")
				);
			}
		}
		return actual.guardedFetch(text, init, {
			...options,
			lookup: options.lookup ?? stubResolver,
		});
	};
	return { ...actual, guardedFetch };
}

// ============================================
// Catalogue and embedding fixtures
// ============================================

export const SPEC_DIMENSIONS = 4;
export const QUERY_PREFIX = "Instruct: test query\nQuery:";
export const SPEC_MODEL_ID = "catalogue-model";
const PROBES = [
	{ text: "A model must be fair across groups", vector: [1, 0, 0, 0] },
	{ text: "The system must resist adversarial inputs", vector: [0, 1, 0, 0] },
	{ text: "Explanations must be faithful", vector: [0, 0, 1, 0] },
];

export interface SpecFixture {
	dataVersion: string;
	dimensions: number;
	documentFormat: string;
	modelId: string;
	probes: { text: string; vector: number[] }[];
	queryPrefix: string;
}

export function makeSpec(overrides: Partial<SpecFixture> = {}): SpecFixture {
	return {
		modelId: SPEC_MODEL_ID,
		dimensions: SPEC_DIMENSIONS,
		queryPrefix: QUERY_PREFIX,
		documentFormat: "title: {name} | text: {content}",
		dataVersion: "1",
		probes: PROBES.map((probe) => ({ ...probe, vector: [...probe.vector] })),
		...overrides,
	};
}

/** The vector the catalogue's model gives for an input: exact for a probe, a fixed unit vector otherwise. */
export function exactEmbedding(spec: SpecFixture): (input: string) => number[] {
	return (input) => {
		for (const probe of spec.probes) {
			if (input === `${spec.queryPrefix}${probe.text}`) {
				return [...probe.vector];
			}
		}
		return [0.5, 0.5, 0.5, 0.5];
	};
}

/** The body of an OpenAI-style embeddings answer. */
export function embeddingsBody(vectors: number[][]) {
	return {
		object: "list",
		data: vectors.map((embedding, index) => ({
			object: "embedding",
			index,
			embedding,
		})),
		model: "stub",
		usage: { prompt_tokens: 1, total_tokens: 1 },
	};
}

/** The inputs of an embeddings request. */
export function embeddingInputs(hit: Hit): string[] {
	const parsed = JSON.parse(hit.body) as { input: string | string[] };
	return Array.isArray(parsed.input) ? parsed.input : [parsed.input];
}

/** Answers an embeddings request with `embed` applied to each input. */
export function answerEmbeddings(embed: (input: string) => number[]): Handler {
	return (hit, response) => {
		json(response, embeddingsBody(embeddingInputs(hit).map(embed)));
	};
}

/** Writes an OpenAI-style streamed chat answer. */
export function streamChat(response: ServerResponse, text: string): void {
	response.writeHead(200, {
		"content-type": "text/event-stream",
		"cache-control": "no-cache",
	});
	const chunk = (delta: object, finish: string | null) =>
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 1,
			model: "stub",
			choices: [{ index: 0, delta, finish_reason: finish }],
		})}\n\n`;
	response.write(chunk({ role: "assistant", content: text }, null));
	response.write(
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 1,
			model: "stub",
			choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		})}\n\n`
	);
	response.end("data: [DONE]\n\n");
}

/** The shape the techniques service answers a tool call with. */
export function serviceAnswer(
	results: Record<string, unknown>[],
	semanticUsed: boolean
) {
	return {
		jsonrpc: "2.0",
		id: "1",
		result: { structuredContent: { semanticUsed, results } },
	};
}

export function serviceResult(
	index: number,
	overrides: Record<string, unknown> = {}
) {
	return {
		slug: `technique-${index}`,
		name: `Technique ${index}`,
		score: 1 - index / 100,
		retrievalScore: 1 - index / 100,
		goals: [`Goal ${index}`],
		url: `https://example.org/techniques/${index}`,
		summary: `Summary of technique ${index}`,
		tags: [`tag-${index}`],
		...overrides,
	};
}

/** Answers every question of a ranking request with `score(candidateIndex)`. */
export function rankingAnswer(
	hit: Hit,
	score: (candidateId: string) => number
) {
	const body = JSON.parse(hit.body) as {
		questions: Record<string, { instructions: string }>;
		state: { candidates: { id: string }[] };
	};
	const answers: Record<string, unknown> = {};
	for (const key of Object.keys(body.questions)) {
		const index = Number(key.slice(1)) - 1;
		const id = body.state.candidates[index]?.id ?? "";
		answers[key] = { type: "noul", noul: score(id) };
	}
	return { answers };
}
