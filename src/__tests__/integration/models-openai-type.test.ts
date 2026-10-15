import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MODEL_CONNECTION_TYPES,
	type ModelConnectionType,
} from "@/lib/models/connection-types";
import prisma from "@/lib/prisma";
import {
	createConnection,
	createConnectionWithJobs,
	getConnectionForUse,
	listConnections,
	setRoles,
} from "@/lib/services/model-connection-service";
import {
	assertNoLeaks,
	type CountingServer,
	harness,
	json,
	resetHarness,
	startServer,
	streamChat,
} from "../utils/model-adversarial-kit";
import {
	addConnection,
	connectionRows,
	makeUser,
	type Routes,
	rolesRow,
	routes,
	signInAs,
} from "../utils/model-adversarial-routes";
import { createTestCase } from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/models/guarded-fetch", async (importOriginal) => {
	const { wrapGuardedFetch } = await import("../utils/model-adversarial-kit");
	return wrapGuardedFetch(
		await importOriginal<typeof import("@/lib/models/guarded-fetch")>()
	);
});

/**
 * An OpenAI connection through the real routes and service: the address is
 * always OpenAI's, the key is required and cannot be removed, only chat is
 * allowed, and a chat request carries the limit in the field OpenAI requires.
 * The fixed address is rewritten to a local stub by the test wrapper, so
 * nothing leaves the machine.
 */

const KEY = "sk-openai-SECRET-7734";
const NEW_KEY = "sk-openai-REPLACEMENT-9921";
const REPLY_TEXT = "Incorrect API key provided: sk-proj-LEAKED-IN-REPLY";
const FIXED_ADDRESS = "https://api.openai.com/v1";
const CHAT = "/v1/chat/completions";
const MODELS = "/v1/models";
const OPENAI_OUTPUT_LIMIT = 8192;
const PRISMA_DIR = path.resolve(import.meta.dirname, "../../../prisma");
/** Types that chat through the same route, with the path to add to the stub's address (Ollama adds its own). */
const OTHER_TYPES: readonly (readonly [ModelConnectionType, string])[] = [
	["OLLAMA", ""],
	["OPENAI_COMPATIBLE", "/v1"],
];
const SQL_COMMENT = /^--.*$/gm;
const ENUM_BLOCK = /enum ModelConnectionType \{([^}]*)\}/;

let server: CountingServer;
let trap: CountingServer;
let api: Routes;

beforeEach(async () => {
	resetHarness();
	server = await startServer((hit, response) => {
		if (hit.url === CHAT) {
			streamChat(response, "A fine answer.");
		} else if (hit.url === MODELS) {
			json(response, {
				object: "list",
				data: [{ id: "gpt-a" }, { id: "gpt-b" }],
			});
		} else {
			json(response, {}, 404);
		}
	});
	trap = await startServer((_hit, response) => json(response, {}));
	vi.stubEnv("TEA_MODELS_LOCAL_ADDRESSES", `${server.origin},${trap.origin}`);
	harness.providerOrigin = server.origin;
	api = await routes();
});

afterEach(async () => {
	vi.unstubAllEnvs();
	await server.close();
	await trap.close();
	assertNoLeaks();
});

async function userWithOpenAi(label = "My OpenAI") {
	const user = await makeUser();
	await signInAs(user);
	const created = await api.create({ label, type: "OPENAI", apiKey: KEY });
	if (created.status !== 201) {
		throw new Error(`could not add an OpenAI connection: ${created.text}`);
	}
	return { user, id: (created.json as { id: string }).id };
}

describe("adding an OpenAI connection", () => {
	it.each([
		["no key", {}],
		["an empty key", { apiKey: "" }],
		["a key of spaces", { apiKey: "   " }],
		["a null key", { apiKey: null }],
	])("is refused with %s, and nothing is stored", async (_name, extra) => {
		const user = await makeUser();
		await signInAs(user);

		const outcome = await api.create({
			label: "My OpenAI",
			type: "OPENAI",
			...extra,
		});

		expect(outcome.status).toBe(400);
		expect(await connectionRows(user.id)).toHaveLength(0);
	});

	it("is refused at the service as well when the key is missing or blank", async () => {
		const user = await makeUser();
		for (const apiKey of [undefined, null, "", "   "]) {
			expect(
				await createConnection(user.id, {
					label: "x",
					type: "OPENAI",
					apiKey,
				})
			).toMatchObject({ code: "VALIDATION" });
		}
		expect(await connectionRows(user.id)).toHaveLength(0);
	});

	it.each([
		"https://evil.example.com/v1",
		"http://169.254.169.254/latest",
		"http://127.0.0.1:9",
		"not an address",
	])("answers with the fixed address and stores none when %s is sent", async (sent) => {
		const user = await makeUser();
		await signInAs(user);

		const outcome = await api.create({
			label: "My OpenAI",
			type: "OPENAI",
			apiKey: KEY,
			baseUrl: sent,
		});

		expect(outcome.status).toBe(201);
		expect(outcome.json).toMatchObject({
			label: "My OpenAI",
			type: "OPENAI",
			baseUrl: FIXED_ADDRESS,
			hasKey: true,
		});
		expect(outcome.text).not.toContain(KEY);
		const [row] = await connectionRows(user.id);
		expect(row?.type).toBe("OPENAI");
		expect(row?.baseUrl).toBeNull();
		expect(row?.apiKeyEncrypted).toBeTruthy();
		expect(row?.apiKeyEncrypted).not.toContain(KEY);
	});

	it("does not accept a type written in lower case", async () => {
		const user = await makeUser();
		await signInAs(user);

		const outcome = await api.create({
			label: "x",
			type: "openai",
			apiKey: KEY,
		});

		expect(outcome.status).toBe(400);
		expect(await connectionRows(user.id)).toHaveLength(0);
	});
});

describe("the address of an OpenAI connection", () => {
	it("is the fixed one even when the stored row holds another, in every read", async () => {
		const { user, id } = await userWithOpenAi();
		await prisma.userModelConnection.update({
			where: { id },
			data: { baseUrl: `${trap.origin}/elsewhere` },
		});

		const listed = await api.list();
		const summary = await listConnections(user.id);
		const forUse = await getConnectionForUse(user.id, id);

		const shown = (listed.json?.connections as { baseUrl: string }[])[0];
		expect(shown?.baseUrl).toBe(FIXED_ADDRESS);
		expect("data" in summary && summary.data[0]?.baseUrl).toBe(FIXED_ADDRESS);
		expect("data" in forUse && forUse.data.baseUrl).toBe(FIXED_ADDRESS);
		expect("data" in forUse && forUse.data.apiKey).toBe(KEY);
	});

	it("cannot be changed by an edit", async () => {
		const { user, id } = await userWithOpenAi();

		const onlyAddress = await api.patch(id, {
			baseUrl: "https://evil.example.com/v1",
		});
		const withLabel = await api.patch(id, {
			label: "Renamed",
			baseUrl: `${trap.origin}/elsewhere`,
		});

		expect(onlyAddress.status).toBe(200);
		expect(onlyAddress.json).toMatchObject({ baseUrl: FIXED_ADDRESS });
		expect(withLabel.status).toBe(200);
		expect(withLabel.json).toMatchObject({
			label: "Renamed",
			baseUrl: FIXED_ADDRESS,
		});
		const [row] = await connectionRows(user.id);
		expect(row?.baseUrl).toBeNull();
		expect(row?.label).toBe("Renamed");
	});

	it("is the only place a test, whatever the stored row holds, sends the key", async () => {
		const { id } = await userWithOpenAi();
		await prisma.userModelConnection.update({
			where: { id },
			data: { baseUrl: `${trap.origin}/elsewhere` },
		});

		const outcome = await api.test(id);

		expect(outcome.status).toBe(200);
		expect(harness.requests).toEqual([`${FIXED_ADDRESS}/models`]);
		expect(trap.hits).toEqual([]);
		expect(trap.connections).toBe(0);
	});
});

describe("the key of an OpenAI connection", () => {
	it("cannot be removed, and the stored key stays", async () => {
		const { user, id } = await userWithOpenAi();

		const outcome = await api.patch(id, { apiKey: null });

		expect(outcome.status).toBe(400);
		const [row] = await connectionRows(user.id);
		expect(row?.apiKeyEncrypted).toBeTruthy();
		const forUse = await getConnectionForUse(user.id, id);
		expect("data" in forUse && forUse.data.apiKey).toBe(KEY);
	});

	it("can be replaced, and the new key is the one used", async () => {
		const { user, id } = await userWithOpenAi();

		const outcome = await api.patch(id, { apiKey: NEW_KEY });

		expect(outcome.status).toBe(200);
		expect(outcome.json).toMatchObject({ hasKey: true });
		expect(outcome.text).not.toContain(NEW_KEY);
		const forUse = await getConnectionForUse(user.id, id);
		expect("data" in forUse && forUse.data.apiKey).toBe(NEW_KEY);
	});
});

describe("the jobs of an OpenAI connection", () => {
	it("takes the chat job", async () => {
		const { id } = await userWithOpenAi();

		const outcome = await api.setRoles({
			chat: { connectionId: id, model: "gpt-test" },
			ranking: null,
			search: null,
		});

		expect(outcome.status).toBe(200);
		expect((outcome.json?.roles as { chat: unknown }).chat).toEqual({
			connectionId: id,
			model: "gpt-test",
		});
	});

	it.each([
		["ranking", { ranking: true, search: false, chat: false }],
		["search", { ranking: false, search: true, chat: false }],
		["ranking and search", { ranking: true, search: true, chat: false }],
		["chat and ranking", { ranking: true, search: false, chat: true }],
		["chat and search", { ranking: false, search: true, chat: true }],
	])("is refused with a 400 for %s, saves none of it and calls no server", async (_name, jobs) => {
		const { user, id } = await userWithOpenAi();
		const job = { connectionId: id, model: "m" };

		const outcome = await api.setRoles({
			chat: jobs.chat ? job : null,
			ranking: jobs.ranking ? job : null,
			search: jobs.search ? job : null,
		});

		expect(outcome.status).toBe(400);
		expect(outcome.text).not.toContain(KEY);
		expect(await rolesRow(user.id)).toBeNull();
		expect(server.hits).toEqual([]);
		expect(harness.requests).toEqual([]);
	});

	it("is refused for ranking at the service as well", async () => {
		const { user, id } = await userWithOpenAi();

		const refused = await setRoles(user.id, {
			chat: null,
			ranking: { connectionId: id, model: "m" },
			search: null,
		});

		expect(refused).toMatchObject({ code: "JOB_NOT_SUPPORTED" });
		expect(await rolesRow(user.id)).toBeNull();
	});

	it("is added together with a chat model, but not with a ranking or search model, and a refusal stores nothing", async () => {
		const user = await makeUser();
		const input = { label: "x", type: "OPENAI", apiKey: KEY } as const;

		const added = await createConnectionWithJobs(user.id, input, {
			chat: "gpt-test",
		});
		expect("data" in added && added.data.roles.chat?.model).toBe("gpt-test");
		expect(await connectionRows(user.id)).toHaveLength(1);

		for (const models of [{ ranking: "m" }, { search: "m" }]) {
			const other = await makeUser();
			expect(
				await createConnectionWithJobs(other.id, input, models)
			).toMatchObject({ code: "JOB_NOT_SUPPORTED" });
			expect(await connectionRows(other.id)).toHaveLength(0);
			expect(await rolesRow(other.id)).toBeNull();
		}
	});

	it("is listed with the connection types as chat only at the fixed address, with no recommended model", async () => {
		const user = await makeUser();
		await signInAs(user);

		const outcome = await api.list();

		const types = outcome.json?.connectionTypes as {
			baseUrl: string | null;
			jobs: string[];
			keyRequired: boolean;
			type: string;
		}[];
		expect(types.map((entry) => entry.type)).toEqual([
			...MODEL_CONNECTION_TYPES,
		]);
		expect(types.find((entry) => entry.type === "OPENAI")).toEqual({
			type: "OPENAI",
			jobs: ["chat"],
			baseUrl: FIXED_ADDRESS,
			keyRequired: true,
		});
		expect(
			(outcome.json?.recommended as Record<string, unknown>).OPENAI
		).toEqual({ chat: null, ranking: null, search: null });
	});
});

describe("testing an OpenAI connection through the route", () => {
	it("lists the models for chat only, with the key sent to OpenAI's /models", async () => {
		const { id } = await userWithOpenAi();

		const outcome = await api.test(id);

		expect(outcome.status).toBe(200);
		expect(outcome.json).toEqual({
			ok: true,
			message: "The connection works.",
			models: { chat: ["gpt-a", "gpt-b"], ranking: [], search: [] },
		});
		expect(server.hits).toHaveLength(1);
		expect(server.hits[0]?.url).toBe(MODELS);
		expect(server.hits[0]?.method).toBe("GET");
		expect(server.hits[0]?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(outcome.text).not.toContain(KEY);
	});

	it("gives the fixed key-refused message, and neither the key nor OpenAI's reply, when the key is refused", async () => {
		server.handler = (_hit, response) =>
			json(response, { error: { message: `${REPLY_TEXT} ${KEY}` } }, 401);
		const { id } = await userWithOpenAi();

		const outcome = await api.test(id);

		expect(outcome.status).toBe(200);
		expect(outcome.json).toEqual({
			ok: false,
			message: "The server did not accept the key.",
			models: { chat: [], ranking: [], search: [] },
		});
		expect(outcome.text).not.toContain(KEY);
		expect(outcome.text).not.toContain("LEAKED-IN-REPLY");
	});
});

describe("a chat request on an OpenAI connection, through the assistant route", () => {
	function message(text: string) {
		return { id: "m1", role: "user", parts: [{ type: "text", text }] };
	}

	async function chatOn(userId: string, connectionId: string) {
		const saved = await setRoles(userId, {
			chat: { connectionId, model: "the-chat-model" },
			ranking: null,
			search: null,
		});
		if ("error" in saved) {
			throw new Error(saved.error);
		}
		const testCase = await createTestCase(userId);
		const { POST } = await import("@/app/api/cases/[id]/assistant/route");
		const response = await POST(
			new Request(`http://localhost:3000/api/cases/${testCase.id}/assistant`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ messages: [message("What does it claim?")] }),
			}),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		return { status: response.status, text: await response.text() };
	}

	function chatBodies() {
		return server.hits
			.filter((hit) => hit.url === CHAT)
			.map((hit) => JSON.parse(hit.body) as Record<string, unknown>);
	}

	it("streams the answer from OpenAI's address with max_completion_tokens at the route's limit and no max_tokens", async () => {
		const { user, id } = await userWithOpenAi();
		await prisma.userModelConnection.update({
			where: { id },
			data: { baseUrl: `${trap.origin}/elsewhere` },
		});

		const outcome = await chatOn(user.id, id);

		expect(outcome.status).toBe(200);
		expect(outcome.text).toContain("A fine answer.");
		expect(outcome.text).not.toContain(KEY);
		const [body] = chatBodies();
		expect(chatBodies()).toHaveLength(1);
		expect(body?.model).toBe("the-chat-model");
		expect(body?.stream).toBe(true);
		expect(body?.max_completion_tokens).toBe(OPENAI_OUTPUT_LIMIT);
		expect(body).not.toHaveProperty("max_tokens");
		expect(body).not.toHaveProperty("reasoning");
		expect(body).not.toHaveProperty("reasoning_effort");
		// Sampling settings are refused by OpenAI's reasoning models.
		for (const field of ["temperature", "top_p", "presence_penalty", "seed"]) {
			expect(body).not.toHaveProperty(field);
		}
		expect(Array.isArray(body?.tools)).toBe(true);
		const hit = server.hits.find((item) => item.url === CHAT);
		expect(hit?.headers.authorization).toBe(`Bearer ${KEY}`);
		expect(harness.requests).toEqual([`${FIXED_ADDRESS}/chat/completions`]);
		expect(trap.hits).toEqual([]);
	});

	it.each(
		OTHER_TYPES
	)("still sends max_tokens at the route's limit and no max_completion_tokens on a %s connection", async (type, path) => {
		const user = await makeUser();
		await signInAs(user);
		const connection = await addConnection(user.id, {
			type,
			baseUrl: `${server.origin}${path}`,
			apiKey: KEY,
		});

		const outcome = await chatOn(user.id, connection.id);

		expect(outcome.status).toBe(200);
		const [body] = chatBodies();
		expect(chatBodies()).toHaveLength(1);
		expect(body?.max_tokens).toBe(OPENAI_OUTPUT_LIMIT);
		expect(body).not.toHaveProperty("max_completion_tokens");
	});
});

describe("the database", () => {
	it("holds the connection types the code lists, in the same order", async () => {
		const rows = await prisma.$queryRaw<{ label: string }[]>`
			SELECT e.enumlabel AS label
			FROM pg_enum e
			JOIN pg_type t ON t.oid = e.enumtypid
			WHERE t.typname = 'ModelConnectionType'
			ORDER BY e.enumsortorder`;

		expect(rows.map((row) => row.label)).toEqual([...MODEL_CONNECTION_TYPES]);
	});

	it("declares the same connection types in the schema file", () => {
		const schema = readFileSync(path.join(PRISMA_DIR, "schema.prisma"), "utf8");
		const block = ENUM_BLOCK.exec(schema)?.[1] ?? "";
		const declared = block
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("//"));

		expect(declared).toEqual([...MODEL_CONNECTION_TYPES]);
	});

	it("adds the type in one migration that changes nothing else", () => {
		const folder = path.join(PRISMA_DIR, "migrations");
		const found = readdirSync(folder).filter((name) =>
			name.endsWith("_model_connection_type_openai")
		);
		expect(found).toHaveLength(1);

		const sql = readFileSync(
			path.join(folder, found[0] ?? "", "migration.sql"),
			"utf8"
		)
			.replace(SQL_COMMENT, "")
			.trim();

		expect(sql).toBe(`ALTER TYPE "ModelConnectionType" ADD VALUE 'OPENAI';`);
	});

	it("keeps a stored connection of an older type as it was", async () => {
		const user = await makeUser();
		const stored = await addConnection(user.id, {
			label: "Local",
			baseUrl: "http://localhost:11434",
			apiKey: KEY,
		});

		const [row] = await connectionRows(user.id);

		expect(row?.id).toBe(stored.id);
		expect(row?.type).toBe("OLLAMA");
		expect(row?.baseUrl).toBe("http://localhost:11434");
	});
});
