import { z } from "zod";
import type {
	ModelConnectionAccess,
	ModelJob,
} from "@/lib/models/connection-types";
import {
	GuardedFetchError,
	guardedFetch,
	NOT_REACHABLE_MESSAGE,
} from "@/lib/models/guarded-fetch";

/**
 * The Test button's work: checks that a connection's address answers and its
 * key is accepted, and lists the models the server offers for each job. Every
 * message is fixed text. None carries the key, the address or anything the
 * server sent back.
 */

export type ModelLists = Record<ModelJob, string[]>;

export interface ConnectionTestResult {
	message: string;
	models: ModelLists;
	ok: boolean;
}

const TEST_TIMEOUT_MS = 10_000;
/** OpenRouter's full model list is about 1 MB. */
const OPENROUTER_LIST_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_BYTES = 512 * 1024;
/** The most model names kept from one list. */
export const MAX_MODELS_PER_LIST = 2000;
/** Longer names are dropped; the connection service refuses to store one. */
export const MAX_MODEL_NAME_CHARS = 200;
const ANTHROPIC_VERSION = "2023-06-01";
/** Anthropic returns 20 models a page unless asked for more. */
const ANTHROPIC_PAGE_SIZE = 1000;
const TRAILING_SLASHES = /\/+$/;

const WORKS = "The connection works.";
const WORKS_WITHOUT_LIST =
	"The connection works, but a model list could not be read.";
const KEY_REFUSED = "The server did not accept the key.";
const UNREADABLE = "The server's answer could not be read.";
const UNREACHABLE = NOT_REACHABLE_MESSAGE;

type Fetched = { ok: true; text: string } | { message: string; ok: false };
type Listed = { ids: string[]; ok: true } | { message: string; ok: false };

const dataEntrySchema = z.looseObject({ id: z.string() });
const dataListSchema = z.looseObject({ data: z.array(z.unknown()) });
const tagsSchema = z.looseObject({
	models: z.array(z.unknown()),
});
const tagEntrySchema = z.looseObject({ name: z.string() });

function emptyLists(): ModelLists {
	return { chat: [], ranking: [], search: [] };
}

function failure(message: string): ConnectionTestResult {
	return { ok: false, message, models: emptyLists() };
}

/** A GET through the guard that returns the body text, or a fixed message saying why not. */
async function get(
	url: string,
	headers: Record<string, string>,
	maxBytes: number
): Promise<Fetched> {
	try {
		const response = await guardedFetch(
			url,
			{ method: "GET", headers: { accept: "application/json", ...headers } },
			{ timeoutMs: TEST_TIMEOUT_MS, maxBytes }
		);
		if (!response.ok) {
			await response.body?.cancel().catch(() => undefined);
			return {
				ok: false,
				message:
					response.status === 401 || response.status === 403
						? KEY_REFUSED
						: `The server answered with an error (HTTP ${response.status}).`,
			};
		}
		return { ok: true, text: await response.text() };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof GuardedFetchError ? error.message : UNREACHABLE,
		};
	}
}

/** Names that are plausible model names, without repeats, at most `MAX_MODELS_PER_LIST`. */
function cleanNames(names: readonly string[]): string[] {
	const kept = new Set<string>();
	for (const raw of names) {
		const name = raw.trim();
		if (name.length > 0 && name.length <= MAX_MODEL_NAME_CHARS) {
			kept.add(name);
		}
		if (kept.size >= MAX_MODELS_PER_LIST) {
			break;
		}
	}
	return [...kept];
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/** The `id` of each entry of a `{ data: [...] }` list, which is the shape OpenRouter, Anthropic and OpenAI-style servers share. */
function idsFromDataList(text: string): string[] | null {
	const list = dataListSchema.safeParse(parseJson(text));
	if (!list.success) {
		return null;
	}
	const names: string[] = [];
	for (const entry of list.data.data) {
		const parsed = dataEntrySchema.safeParse(entry);
		if (parsed.success) {
			names.push(parsed.data.id);
		}
	}
	return cleanNames(names);
}

/** The `name` of each entry of Ollama's `{ models: [...] }` list. */
function namesFromTags(text: string): string[] | null {
	const list = tagsSchema.safeParse(parseJson(text));
	if (!list.success) {
		return null;
	}
	const names: string[] = [];
	for (const entry of list.data.models) {
		const parsed = tagEntrySchema.safeParse(entry);
		if (parsed.success) {
			names.push(parsed.data.name);
		}
	}
	return cleanNames(names);
}

async function listModels(
	url: string,
	headers: Record<string, string>,
	maxBytes: number,
	read: (text: string) => string[] | null
): Promise<Listed> {
	const fetched = await get(url, headers, maxBytes);
	if (!fetched.ok) {
		return fetched;
	}
	const ids = read(fetched.text);
	return ids ? { ok: true, ids } : { ok: false, message: UNREADABLE };
}

function bearer(connection: ModelConnectionAccess): Record<string, string> {
	return connection.apiKey
		? { authorization: `Bearer ${connection.apiKey}` }
		: {};
}

async function testOpenRouter(
	base: string,
	connection: ModelConnectionAccess
): Promise<ConnectionTestResult> {
	const headers = bearer(connection);
	const key = await get(`${base}/api/v1/key`, headers, DEFAULT_MAX_BYTES);
	if (!key.ok) {
		return failure(key.message);
	}
	const list = (path: string) =>
		listModels(
			`${base}${path}`,
			headers,
			OPENROUTER_LIST_MAX_BYTES,
			idsFromDataList
		);
	const [chat, ranking, search] = await Promise.all([
		list("/api/v1/models?supported_parameters=tools"),
		list("/api/v1/models?output_modalities=decisions"),
		list("/api/v1/embeddings/models"),
	]);
	const idsOf = (result: Listed) => (result.ok ? result.ids : []);
	return {
		ok: true,
		message: [chat, ranking, search].every((result) => result.ok)
			? WORKS
			: WORKS_WITHOUT_LIST,
		models: {
			chat: idsOf(chat),
			ranking: idsOf(ranking),
			search: idsOf(search),
		},
	};
}

/** A test whose one request is both the check and the model list. */
async function testByListing(
	url: string,
	headers: Record<string, string>,
	read: (text: string) => string[] | null,
	jobs: readonly ModelJob[]
): Promise<ConnectionTestResult> {
	const listed = await listModels(url, headers, DEFAULT_MAX_BYTES, read);
	if (!listed.ok) {
		return failure(listed.message);
	}
	const models = emptyLists();
	for (const job of jobs) {
		models[job] = [...listed.ids];
	}
	return { ok: true, message: WORKS, models };
}

/**
 * Checks the connection and lists its models. OpenRouter is asked to confirm
 * the key and then for its chat, ranking and embedding models separately. The
 * other types make one request, whose answer both proves the connection and
 * lists the models: Ollama's installed models for every job, an OpenAI-style
 * server's models for chat and search, Anthropic's and OpenAI's for chat. Each
 * request has a ten-second limit and a cap on the size of the answer. Never
 * throws.
 */
export async function testConnection(
	connection: ModelConnectionAccess
): Promise<ConnectionTestResult> {
	const base = connection.baseUrl.replace(TRAILING_SLASHES, "");
	switch (connection.type) {
		case "OPENROUTER":
			return await testOpenRouter(base, connection);
		case "OLLAMA":
			return await testByListing(
				`${base}/api/tags`,
				bearer(connection),
				namesFromTags,
				["chat", "ranking", "search"]
			);
		case "OPENAI_COMPATIBLE":
			return await testByListing(
				`${base}/models`,
				bearer(connection),
				idsFromDataList,
				["chat", "search"]
			);
		case "ANTHROPIC":
			return await testByListing(
				`${base}/v1/models?limit=${ANTHROPIC_PAGE_SIZE}`,
				{
					"anthropic-version": ANTHROPIC_VERSION,
					...(connection.apiKey ? { "x-api-key": connection.apiKey } : {}),
				},
				idsFromDataList,
				["chat"]
			);
		case "OPENAI":
			return await testByListing(
				`${base}/models`,
				bearer(connection),
				idsFromDataList,
				["chat"]
			);
		default:
			return failure(UNREACHABLE);
	}
}
