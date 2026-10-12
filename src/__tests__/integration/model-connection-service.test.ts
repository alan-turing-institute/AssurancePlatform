import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenEncryptionUnavailableError } from "@/lib/auth/token-encryption";
import prisma from "@/lib/prisma";
import {
	type CreateConnectionInput,
	clearEmbeddingCheck,
	createConnection,
	createConnectionWithJobs,
	deleteConnection,
	getConnectionForUse,
	getConnectionWithStoredState,
	getRoles,
	listConnections,
	MAX_CONNECTIONS_PER_USER,
	type ModelServiceErrorCode,
	recordEmbeddingCheck,
	type StoredConnectionState,
	setRoles,
	updateConnection,
} from "@/lib/services/model-connection-service";
import { captureLogs } from "../helpers/capture-logs";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { createTestUser } from "../utils/prisma-factories";

const SECRET = "sk-test-secret-value-123";
const ENVELOPE = /^v\d+:/;
const OLLAMA_URL = "http://localhost:11434";

afterEach(() => {
	vi.unstubAllEnvs();
});

/** Asserts a refusal whose message contains `text`. */
function expectRefused(
	result: { data?: unknown; error?: string },
	text: string
): void {
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.data).toBeUndefined();
	// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
	expect(result.error).toContain(text);
}

/** An OpenRouter connection with a key, unless overridden. */
function add(userId: string, overrides: Partial<CreateConnectionInput> = {}) {
	return createConnection(userId, {
		label: "Router",
		type: "OPENROUTER",
		apiKey: SECRET,
		...overrides,
	});
}

/** An Ollama connection at `baseUrl`, with no key. */
function addOllama(userId: string, baseUrl = OLLAMA_URL) {
	return add(userId, {
		label: "Local",
		type: "OLLAMA",
		baseUrl,
		apiKey: null,
	});
}

describe("model connection service: keys", () => {
	it("returns no key from any read, only whether one is set", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));
		const local = expectSuccess(await addOllama(user.id));
		const updated = expectSuccess(
			await updateConnection(user.id, local.id, { apiKey: "another-secret" })
		);
		const roles = expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: router.id, model: "some/model" },
				ranking: null,
				search: { connectionId: local.id, model: "embed" },
			})
		);
		const listed = expectSuccess(await listConnections(user.id));
		const rolesRead = expectSuccess(await getRoles(user.id));

		const rows = await prisma.userModelConnection.findMany({
			where: { userId: user.id },
		});
		const everything = JSON.stringify([
			router,
			local,
			updated,
			roles,
			listed,
			rolesRead,
		]);
		expect(everything).not.toContain(SECRET);
		expect(everything).not.toContain("another-secret");
		for (const row of rows) {
			expect(row.apiKeyEncrypted).not.toBeNull();
			expect(everything).not.toContain(row.apiKeyEncrypted as string);
		}
		expect(Object.keys(listed[0] ?? {}).sort()).toEqual([
			"baseUrl",
			"hasKey",
			"id",
			"label",
			"type",
		]);
		expect(listed.map((c) => [c.label, c.hasKey])).toEqual([
			["Router", true],
			["Local", true],
		]);
	});

	it("stores the key as ciphertext and gives it back only to the server-side use path", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));
		const plain = expectSuccess(await addOllama(user.id));

		const row = await prisma.userModelConnection.findUniqueOrThrow({
			where: { id: router.id },
		});
		expect(row.apiKeyEncrypted).toMatch(ENVELOPE);
		expect(row.apiKeyEncrypted).not.toContain(SECRET);

		const used = expectSuccess(await getConnectionForUse(user.id, router.id));
		expect(used.apiKey).toBe(SECRET);

		expectSuccess(
			await updateConnection(user.id, router.id, { apiKey: "replacement" })
		);
		const replaced = expectSuccess(
			await getConnectionForUse(user.id, router.id)
		);
		expect(replaced.apiKey).toBe("replacement");

		expect(
			expectSuccess(await getConnectionForUse(user.id, plain.id)).apiKey
		).toBeNull();
		const removed = expectSuccess(
			await updateConnection(user.id, plain.id, { apiKey: null })
		);
		expect(removed.hasKey).toBe(false);
		expectRefused(
			await updateConnection(user.id, router.id, { apiKey: null }),
			"key is required"
		);
	});

	it("gives a clear error and stores nothing when the encryption key is missing", async () => {
		const user = await createTestUser();
		expectSuccess(await add(user.id));
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");

		await expect(add(user.id, { label: "Second" })).rejects.toThrow(
			TokenEncryptionUnavailableError
		);
		await expect(add(user.id, { label: "Second" })).rejects.toThrow(
			"TOKEN_ENCRYPTION_KEY is not set"
		);
		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(1);

		const [existing] = expectSuccess(await listConnections(user.id));
		await expect(
			getConnectionForUse(user.id, existing?.id ?? "")
		).rejects.toThrow(TokenEncryptionUnavailableError);
		await expect(
			updateConnection(user.id, existing?.id ?? "", { apiKey: "new" })
		).rejects.toThrow(TokenEncryptionUnavailableError);

		// A connection that needs no key does not need the encryption key.
		expectSuccess(await addOllama(user.id));
	});

	it("refuses a key with a control character in it, on create and on update, without echoing it", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));

		for (const bad of [
			"sk-leak\u0000tail",
			"sk-leak\r\nX-Injected: 1",
			"sk-leak\tinner",
			"sk-leak\u001ftail",
			"sk-leak\u007ftail",
		]) {
			const created = await add(user.id, { label: "Second", apiKey: bad });
			expectRefused(created, "control characters");
			expect(JSON.stringify(created)).not.toContain("sk-leak");

			const updated = await updateConnection(user.id, router.id, {
				apiKey: bad,
			});
			expectRefused(updated, "control characters");
			expect(JSON.stringify(updated)).not.toContain("sk-leak");
		}

		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(1);
		expect(
			expectSuccess(await getConnectionForUse(user.id, router.id)).apiKey
		).toBe(SECRET);
	});

	it("accepts only printable ASCII in a key, on create and on update, without echoing it", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));

		for (const bad of [
			"sk-leakĀtail",
			"sk-leakétail",
			"sk-leak☃tail",
			"sk-leak\u{1f511}tail",
			"sk-leak tail",
			"sk-leak tail",
			"sk-leak​tail",
		]) {
			const created = await add(user.id, { label: "Second", apiKey: bad });
			expectRefused(created, "printable ASCII");
			expect(JSON.stringify(created)).not.toContain("sk-leak");

			const updated = await updateConnection(user.id, router.id, {
				apiKey: bad,
			});
			expectRefused(updated, "printable ASCII");
			expect(JSON.stringify(updated)).not.toContain("sk-leak");
		}

		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(1);
		expect(
			expectSuccess(await getConnectionForUse(user.id, router.id)).apiKey
		).toBe(SECRET);

		// Every printable ASCII character is allowed, and the ends are still trimmed.
		const printable = Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) =>
			String.fromCodePoint(0x21 + i)
		).join("");
		const stored = expectSuccess(
			await add(user.id, { label: "Printable", apiKey: `  ${printable}\n` })
		);
		expect(
			expectSuccess(await getConnectionForUse(user.id, stored.id)).apiKey
		).toBe(printable);
	});

	it("does not log a key or its ciphertext when a write fails", async () => {
		const logs = captureLogs();
		try {
			const result = await add(randomUUID());
			expectError(result, "Failed to create the model connection");
			expect(logs.entries.length).toBeGreaterThan(0);
			const logged = JSON.stringify(logs.entries);
			expect(logged).not.toContain(SECRET);
			expect(logged).not.toContain("v1:");
		} finally {
			logs.restore();
		}
	});
});

describe("model connection service: connections", () => {
	it("refuses the eleventh connection, per user, even when requests arrive together", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
			expectSuccess(await addOllama(user.id, `http://host-${i}:11434`));
		}
		expectRefused(await addOllama(user.id), "at most 10");
		expectSuccess(await addOllama(other.id));

		const spare = await createTestUser();
		for (let i = 0; i < MAX_CONNECTIONS_PER_USER - 2; i++) {
			expectSuccess(await addOllama(spare.id, `http://host-${i}:11434`));
		}
		const together = await Promise.all(
			Array.from({ length: 5 }, (_, i) =>
				addOllama(spare.id, `http://racing-${i}:11434`)
			)
		);
		expect(together.filter((r) => "data" in r)).toHaveLength(2);
		expect(
			await prisma.userModelConnection.count({ where: { userId: spare.id } })
		).toBe(MAX_CONNECTIONS_PER_USER);
	});

	it("checks the shape of every value it stores", async () => {
		const user = await createTestUser();

		expectRefused(await add(user.id, { label: "  " }), "Label");
		expectRefused(await add(user.id, { label: "x".repeat(61) }), "Label");
		expectRefused(await add(user.id, { apiKey: "k".repeat(2049) }), "API key");
		expectRefused(await add(user.id, { apiKey: "   " }), "API key is required");
		expectRefused(await add(user.id, { apiKey: null }), "API key is required");
		expectRefused(
			await add(user.id, { type: "NOT_A_TYPE" as "OLLAMA" }),
			"Unknown connection type"
		);

		const ollama = (baseUrl: string | null) =>
			add(user.id, { type: "OLLAMA", baseUrl, apiKey: null });
		expectRefused(await ollama(null), "base URL is required");
		expectRefused(await ollama("ftp://host/models"), "http or https");
		expectRefused(await ollama("javascript:alert(1)"), "http or https");
		expectRefused(await ollama("not a url"), "http or https");
		expectRefused(await ollama(`https://host/${"a".repeat(500)}`), "500");
		expectRefused(await ollama("https://name:pass@host"), "user name");

		const created = expectSuccess(await ollama(" https://host.example/v1// "));
		expect(created.baseUrl).toBe("https://host.example/v1");

		expectRefused(
			await updateConnection(user.id, created.id, { baseUrl: "ftp://host" }),
			"http or https"
		);
		expectRefused(
			await updateConnection(user.id, created.id, { label: "" }),
			"Label"
		);
		expectRefused(
			await updateConnection(user.id, created.id, { apiKey: "" }),
			"API key"
		);
	});

	it("refuses a control character in a label, on create and on update", async () => {
		const user = await createTestUser();
		const created = expectSuccess(await addOllama(user.id));

		for (const label of ["a\u0000b", "a\tb", "a\nb", "a\u001bb", "a\u007fb"]) {
			expectRefused(await add(user.id, { label }), "control characters");
			expectRefused(
				await updateConnection(user.id, created.id, { label }),
				"control characters"
			);
		}
		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(1);
		expect(expectSuccess(await listConnections(user.id))[0]?.label).toBe(
			"Local"
		);
	});

	it("refuses a base URL with a query string or fragment, even an empty one", async () => {
		const user = await createTestUser();
		const ollama = (baseUrl: string) =>
			add(user.id, { type: "OLLAMA", baseUrl, apiKey: null });

		for (const bad of [
			"http://host:11434?",
			"http://host:11434#",
			"http://host:11434/v1/#",
			"http://host:11434/v1?x=1",
			"http://host:11434/v1#section",
		]) {
			expectRefused(await ollama(bad), "query string or fragment");
		}

		const created = expectSuccess(await ollama("http://host:11434/v1"));
		expectRefused(
			await updateConnection(user.id, created.id, {
				baseUrl: "http://host:11434/v1#",
			}),
			"query string or fragment"
		);
		expect(
			expectSuccess(await listConnections(user.id)).map((c) => c.baseUrl)
		).toEqual(["http://host:11434/v1"]);
	});

	it("stores no address for types whose address is fixed, and uses the fixed one", async () => {
		const user = await createTestUser();
		const router = expectSuccess(
			await add(user.id, { baseUrl: "http://attacker.example" })
		);
		const claude = expectSuccess(
			await add(user.id, { type: "ANTHROPIC", label: "Claude" })
		);

		const rows = await prisma.userModelConnection.findMany({
			where: { userId: user.id },
		});
		expect(rows.map((r) => r.baseUrl)).toEqual([null, null]);
		expect(router.baseUrl).toBe("https://openrouter.ai");
		expect(claude.baseUrl).toBe("https://api.anthropic.com");

		const moved = expectSuccess(
			await updateConnection(user.id, router.id, {
				baseUrl: "http://attacker.example",
			})
		);
		expect(moved.baseUrl).toBe("https://openrouter.ai");
		expect(
			expectSuccess(await getConnectionForUse(user.id, router.id)).baseUrl
		).toBe("https://openrouter.ai");
		expect(
			(
				await prisma.userModelConnection.findUniqueOrThrow({
					where: { id: router.id },
				})
			).baseUrl
		).toBeNull();
	});

	it("removes a user's connections and jobs with the user", async () => {
		const user = await createTestUser();
		const survivor = await createTestUser();
		const router = expectSuccess(await add(user.id));
		expectSuccess(await add(survivor.id));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: router.id, model: "m" },
				ranking: null,
				search: null,
			})
		);

		await prisma.user.delete({ where: { id: user.id } });

		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(0);
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
		expect(
			await prisma.userModelConnection.count({ where: { userId: survivor.id } })
		).toBe(1);
	});

	it("empties the jobs that used a connection when it is deleted", async () => {
		const user = await createTestUser();
		const doomed = expectSuccess(await addOllama(user.id));
		const kept = expectSuccess(await add(user.id));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: doomed.id, model: "chat-model" },
				ranking: { connectionId: doomed.id, model: "rank-model" },
				search: { connectionId: doomed.id, model: "embed-model" },
			})
		);
		expect(
			expectSuccess(
				await recordEmbeddingCheck(user.id, "catalogue-v1", {
					connectionId: doomed.id,
					model: "embed-model",
				})
			)
		).toBe(true);

		expectSuccess(await deleteConnection(user.id, doomed.id));

		const row = await prisma.userModelRoles.findUniqueOrThrow({
			where: { userId: user.id },
		});
		expect(row).toEqual({
			userId: user.id,
			chatConnectionId: null,
			chatModel: null,
			decisionConnectionId: null,
			decisionModel: null,
			embeddingConnectionId: null,
			embeddingModel: null,
			embeddingVerifiedFor: null,
			embeddingVerifiedAt: null,
		});
		expect(expectSuccess(await getRoles(user.id))).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		});
		expect(
			expectSuccess(await listConnections(user.id)).map((c) => c.id)
		).toEqual([kept.id]);

		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: kept.id, model: "m" },
				ranking: null,
				search: null,
			})
		);
		expectSuccess(await deleteConnection(user.id, kept.id));
		expect(expectSuccess(await getRoles(user.id)).chat).toBeNull();
	});
});

describe("model connection service: the search check", () => {
	/** Records the check for the search job as `connectionId` and `model`. */
	async function record(userId: string, connectionId: string, model: string) {
		return expectSuccess(
			await recordEmbeddingCheck(userId, "catalogue-v1", {
				connectionId,
				model,
			})
		);
	}

	async function withSearchChecked() {
		const user = await createTestUser();
		const a = expectSuccess(await addOllama(user.id));
		const b = expectSuccess(await addOllama(user.id, "http://other:11434"));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: b.id, model: "chat" },
				ranking: null,
				search: { connectionId: a.id, model: "embed" },
			})
		);
		await record(user.id, a.id, "embed");
		return { user, a, b };
	}

	const checked = async (userId: string) =>
		expectSuccess(await getRoles(userId)).searchCheck?.verifiedFor ?? null;

	it("clears the check when the address or key of the search connection changes", async () => {
		const { user, a, b } = await withSearchChecked();
		expect(await checked(user.id)).toBe("catalogue-v1");

		// None of these move the address or key of the search connection.
		expectSuccess(await updateConnection(user.id, a.id, { label: "renamed" }));
		expectSuccess(
			await updateConnection(user.id, a.id, { baseUrl: `${OLLAMA_URL}/` })
		);
		expectSuccess(await updateConnection(user.id, b.id, { apiKey: "other" }));
		expectSuccess(
			await updateConnection(user.id, b.id, { baseUrl: "http://moved:1" })
		);
		expect(await checked(user.id)).toBe("catalogue-v1");

		expectSuccess(
			await updateConnection(user.id, a.id, { baseUrl: "http://moved:11434" })
		);
		expect(await checked(user.id)).toBeNull();
		const afterAddress = await prisma.userModelRoles.findUniqueOrThrow({
			where: { userId: user.id },
		});
		expect(afterAddress.embeddingVerifiedAt).toBeNull();

		expect(await record(user.id, a.id, "embed")).toBe(true);
		expectSuccess(await updateConnection(user.id, a.id, { apiKey: "new-key" }));
		expect(await checked(user.id)).toBeNull();
	});

	it("clears the check when the search job changes, and only then", async () => {
		const { user, a, b } = await withSearchChecked();
		const jobs = {
			chat: { connectionId: b.id, model: "chat" },
			ranking: null,
			search: { connectionId: a.id, model: "embed" },
		};

		expectSuccess(await setRoles(user.id, jobs));
		expectSuccess(
			await setRoles(user.id, {
				...jobs,
				chat: { connectionId: a.id, model: "other-chat" },
				ranking: { connectionId: a.id, model: "rank" },
			})
		);
		expect(await checked(user.id)).toBe("catalogue-v1");

		expectSuccess(
			await setRoles(user.id, {
				...jobs,
				search: { connectionId: a.id, model: "another-embed" },
			})
		);
		expect(await checked(user.id)).toBeNull();

		expect(await record(user.id, a.id, "another-embed")).toBe(true);
		expectSuccess(
			await setRoles(user.id, {
				...jobs,
				search: { connectionId: b.id, model: "another-embed" },
			})
		);
		expect(await checked(user.id)).toBeNull();

		expect(await record(user.id, b.id, "another-embed")).toBe(true);
		expectSuccess(await setRoles(user.id, { ...jobs, search: null }));
		expect(await checked(user.id)).toBeNull();
		expect(await record(user.id, b.id, "another-embed")).toBe(false);
	});

	it("records the check only while the search job is still the one that was checked", async () => {
		const { user, a, b } = await withSearchChecked();
		const jobs = (search: { connectionId: string; model: string }) => ({
			chat: null,
			ranking: null,
			search,
		});
		const sameConnection = { connectionId: a.id, model: "other-model" };
		const otherConnection = { connectionId: b.id, model: "embed" };
		expectSuccess(await setRoles(user.id, jobs(sameConnection)));
		expect(await checked(user.id)).toBeNull();

		// The check ran against a/embed, which is no longer the search job.
		expect(await record(user.id, a.id, "embed")).toBe(false);
		expect(await checked(user.id)).toBeNull();
		expectSuccess(await setRoles(user.id, jobs(otherConnection)));
		expect(await record(user.id, a.id, "other-model")).toBe(false);
		expect(await checked(user.id)).toBeNull();

		// Another user's search job is never marked.
		const bystander = await createTestUser();
		expect(await record(bystander.id, b.id, "embed")).toBe(false);
		expect(await record(user.id, b.id, "embed")).toBe(true);
		expect(await checked(user.id)).toBe("catalogue-v1");
	});

	it("records the check only while the connection's address and key are what they were when the check began", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));
		const local = expectSuccess(await addOllama(user.id));
		const job = (id: string) => ({ connectionId: id, model: "embed" });
		const pointSearchAt = async (id: string) =>
			expectSuccess(
				await setRoles(user.id, { chat: null, ranking: null, search: job(id) })
			);
		const began = async (id: string) =>
			expectSuccess(await getConnectionWithStoredState(user.id, id)).stored;
		const recordFor = async (id: string, stored: StoredConnectionState) =>
			expectSuccess(
				await recordEmbeddingCheck(user.id, "catalogue-v1", job(id), stored)
			);

		await pointSearchAt(local.id);
		const beforeEdit = await began(local.id);
		expectSuccess(
			await updateConnection(user.id, local.id, {
				baseUrl: "http://other:11434",
			})
		);
		await pointSearchAt(local.id);
		expect(await recordFor(local.id, beforeEdit)).toBe(false);
		expect(await recordFor(local.id, await began(local.id))).toBe(true);

		expectSuccess(await clearEmbeddingCheck(user.id));
		const beforeKey = await began(local.id);
		expectSuccess(
			await updateConnection(user.id, local.id, { apiKey: "a-new-key-1" })
		);
		expect(await recordFor(local.id, beforeKey)).toBe(false);

		// A new label changes neither the address nor the key.
		const beforeLabel = await began(local.id);
		expectSuccess(
			await updateConnection(user.id, local.id, { label: "Renamed" })
		);
		expect(await recordFor(local.id, beforeLabel)).toBe(true);

		// A connection whose address is fixed has none stored; its key still counts.
		await pointSearchAt(router.id);
		const routerBefore = await began(router.id);
		expect(routerBefore.baseUrl).toBeNull();
		expectSuccess(
			await updateConnection(user.id, router.id, { apiKey: "a-new-key-2" })
		);
		expect(await recordFor(router.id, routerBefore)).toBe(false);
	});

	it("can be recorded and cleared only through its own functions", async () => {
		const user = await createTestUser();
		expect(await record(user.id, randomUUID(), "embed")).toBe(false);
		expectError(
			await recordEmbeddingCheck(user.id, "", {
				connectionId: randomUUID(),
				model: "embed",
			}),
			"verifiedFor must not be empty"
		);
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);

		const a = expectSuccess(await addOllama(user.id));
		const roles = expectSuccess(
			await setRoles(user.id, {
				chat: null,
				ranking: null,
				search: { connectionId: a.id, model: "embed" },
			})
		);
		expect(roles.searchCheck).toBeNull();

		expect(await record(user.id, a.id, "embed")).toBe(true);
		const recorded = expectSuccess(await getRoles(user.id)).searchCheck;
		expect(recorded?.verifiedFor).toBe("catalogue-v1");
		expect(recorded?.verifiedAt).toBeInstanceOf(Date);

		expectSuccess(await clearEmbeddingCheck(user.id));
		expect(await checked(user.id)).toBeNull();
		expectSuccess(await clearEmbeddingCheck((await createTestUser()).id));
	});
});

describe("model connection service: jobs", () => {
	it("gives each type only the jobs it can do", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));
		const local = expectSuccess(await addOllama(user.id));
		const compatible = expectSuccess(
			await add(user.id, {
				type: "OPENAI_COMPATIBLE",
				label: "Compatible",
				baseUrl: "https://llm.example/v1",
				apiKey: null,
			})
		);
		const claude = expectSuccess(
			await add(user.id, { type: "ANTHROPIC", label: "Claude" })
		);
		const pick = (c: { id: string }) => ({ connectionId: c.id, model: "m" });
		const none = { chat: null, ranking: null, search: null };

		expectRefused(
			await setRoles(user.id, { ...none, ranking: pick(claude) }),
			"cannot be used for ranking"
		);
		expectRefused(
			await setRoles(user.id, { ...none, search: pick(claude) }),
			"cannot be used for search"
		);
		expectRefused(
			await setRoles(user.id, { ...none, ranking: pick(compatible) }),
			"cannot be used for ranking"
		);
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);

		const saved = expectSuccess(
			await setRoles(user.id, {
				chat: pick(claude),
				ranking: pick(router),
				search: pick(compatible),
			})
		);
		expect(saved.chat?.connectionId).toBe(claude.id);
		expect(saved.ranking?.connectionId).toBe(router.id);
		expect(saved.search?.connectionId).toBe(compatible.id);
		expectSuccess(
			await setRoles(user.id, {
				chat: pick(local),
				ranking: pick(local),
				search: pick(router),
			})
		);
	});

	it("checks the model names it stores", async () => {
		const user = await createTestUser();
		const local = expectSuccess(await addOllama(user.id));
		const jobs = (model: string) => ({
			chat: { connectionId: local.id, model },
			ranking: null,
			search: null,
		});

		expectRefused(await setRoles(user.id, jobs("  ")), "Model name");
		expectRefused(await setRoles(user.id, jobs("m".repeat(201))), "Model name");
		const saved = expectSuccess(await setRoles(user.id, jobs(" llama3 ")));
		expect(saved.chat?.model).toBe("llama3");
	});
});

describe("model connection service: model names", () => {
	it("refuses a control character in a model name, for every job, and saves nothing", async () => {
		const user = await createTestUser();
		const local = expectSuccess(await addOllama(user.id));

		for (const model of ["bad\u0000name", "bad\tname", "bad\nname"]) {
			for (const job of ["chat", "ranking", "search"] as const) {
				expectRefused(
					await setRoles(user.id, {
						chat: null,
						ranking: null,
						search: null,
						[job]: { connectionId: local.id, model },
					}),
					"control characters"
				);
			}
			expectRefused(
				await createConnectionWithJobs(
					user.id,
					{ label: "New", type: "OLLAMA", baseUrl: OLLAMA_URL },
					{ chat: model }
				),
				"control characters"
			);
		}
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(1);
	});
});

describe("model connection service: other users' connections", () => {
	it("treats another user's connection exactly like a missing one", async () => {
		const owner = await createTestUser();
		const intruder = await createTestUser();
		const theirs = expectSuccess(await add(owner.id));
		const theirClaude = expectSuccess(
			await add(owner.id, { type: "ANTHROPIC", label: "Claude" })
		);
		const missing = randomUUID();
		const none = { chat: null, ranking: null, search: null };

		expectSameError(
			await getConnectionForUse(intruder.id, theirs.id),
			await getConnectionForUse(intruder.id, missing)
		);
		expectSameError(
			await updateConnection(intruder.id, theirs.id, { label: "mine now" }),
			await updateConnection(intruder.id, missing, { label: "mine now" })
		);
		expectSameError(
			await updateConnection(intruder.id, theirs.id, { apiKey: "stolen" }),
			await updateConnection(intruder.id, missing, { apiKey: "stolen" })
		);
		expectSameError(
			await deleteConnection(intruder.id, theirs.id),
			await deleteConnection(intruder.id, missing)
		);
		const assign = (id: string, job: "chat" | "ranking" | "search") => ({
			...none,
			[job]: { connectionId: id, model: "m" },
		});
		for (const job of ["chat", "ranking", "search"] as const) {
			expectSameError(
				await setRoles(intruder.id, assign(theirs.id, job)),
				await setRoles(intruder.id, assign(missing, job))
			);
		}
		// Not even the type of a connection that is not theirs is revealed.
		expectSameError(
			await setRoles(intruder.id, assign(theirClaude.id, "search")),
			await setRoles(intruder.id, assign(missing, "search"))
		);

		expect(expectSuccess(await listConnections(intruder.id))).toEqual([]);
		expect(
			await prisma.userModelRoles.count({ where: { userId: intruder.id } })
		).toBe(0);
		const stillTheirs = await prisma.userModelConnection.findUniqueOrThrow({
			where: { id: theirs.id },
		});
		expect(stillTheirs.label).toBe("Router");
		expect(
			expectSuccess(await getConnectionForUse(owner.id, theirs.id)).apiKey
		).toBe(SECRET);
	});

	it("ignores a stored job that names another user's connection", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const theirs = expectSuccess(await add(owner.id));
		await prisma.userModelRoles.create({
			data: {
				userId: other.id,
				chatConnectionId: theirs.id,
				chatModel: "m",
				embeddingConnectionId: theirs.id,
				embeddingModel: "e",
				embeddingVerifiedFor: "catalogue-v1",
				embeddingVerifiedAt: new Date(),
			},
		});

		expect(expectSuccess(await getRoles(other.id))).toEqual({
			chat: null,
			ranking: null,
			search: null,
			searchCheck: null,
		});
	});
});

describe("model connection service: error codes", () => {
	/** Asserts a refusal carrying `code`. */
	function expectCode(
		result: { data?: unknown; code?: ModelServiceErrorCode; error?: string },
		code: ModelServiceErrorCode
	): void {
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result.error).toBeDefined();
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result.code).toBe(code);
	}

	it("gives every refusal a code", async () => {
		const user = await createTestUser();
		const router = expectSuccess(await add(user.id));
		const claude = expectSuccess(
			await add(user.id, { type: "ANTHROPIC", label: "Claude" })
		);
		const missing = randomUUID();
		const none = { chat: null, ranking: null, search: null };

		expectCode(await add(user.id, { label: " " }), "VALIDATION");
		expectCode(await add(user.id, { apiKey: "k".repeat(2049) }), "VALIDATION");
		expectCode(await add(user.id, { apiKey: null }), "VALIDATION");
		expectCode(
			await add(user.id, { type: "NOT_A_TYPE" as "OLLAMA" }),
			"VALIDATION"
		);
		expectCode(await addOllama(user.id, "ftp://host"), "VALIDATION");
		expectCode(await addOllama(user.id, "http://host?x=1"), "VALIDATION");
		expectCode(
			await updateConnection(user.id, router.id, { apiKey: null }),
			"VALIDATION"
		);
		expectCode(
			await setRoles(user.id, {
				...none,
				chat: { connectionId: router.id, model: " " },
			}),
			"VALIDATION"
		);
		expectCode(
			await recordEmbeddingCheck(user.id, "", {
				connectionId: router.id,
				model: "m",
			}),
			"VALIDATION"
		);

		expectCode(await getConnectionForUse(user.id, missing), "NOT_FOUND");
		expectCode(
			await updateConnection(user.id, missing, { label: "x" }),
			"NOT_FOUND"
		);
		expectCode(await deleteConnection(user.id, missing), "NOT_FOUND");
		expectCode(
			await setRoles(user.id, {
				...none,
				chat: { connectionId: missing, model: "m" },
			}),
			"NOT_FOUND"
		);

		expectCode(
			await setRoles(user.id, {
				...none,
				search: { connectionId: claude.id, model: "m" },
			}),
			"JOB_NOT_SUPPORTED"
		);

		for (let i = 0; i < MAX_CONNECTIONS_PER_USER - 2; i++) {
			expectSuccess(await addOllama(user.id, `http://host-${i}:11434`));
		}
		expectCode(await addOllama(user.id), "LIMIT_REACHED");
	});

	it("gives an unexpected failure a message and no code", async () => {
		const result = await add(randomUUID());
		expectError(result, "Failed to create the model connection");
		expect(result).not.toHaveProperty("code");
	});
});

describe("model connection service: a connection and its jobs together", () => {
	it("adds the connection and points the named jobs at it, leaving the others as they were", async () => {
		const user = await createTestUser();
		const local = expectSuccess(await addOllama(user.id));
		expectSuccess(
			await setRoles(user.id, {
				chat: { connectionId: local.id, model: "kept-chat" },
				ranking: { connectionId: local.id, model: "old-ranking" },
				search: { connectionId: local.id, model: "old-embed" },
			})
		);

		const { connection, roles } = expectSuccess(
			await createConnectionWithJobs(
				user.id,
				{ label: "Router", type: "OPENROUTER", apiKey: SECRET },
				{ ranking: " new-ranking ", search: "new-embed" }
			)
		);

		expect(connection).toMatchObject({ label: "Router", hasKey: true });
		expect(roles).toEqual({
			chat: { connectionId: local.id, model: "kept-chat" },
			ranking: { connectionId: connection.id, model: "new-ranking" },
			search: { connectionId: connection.id, model: "new-embed" },
			searchCheck: null,
		});
		expect(JSON.stringify([connection, roles])).not.toContain(SECRET);
	});

	it("clears a search check the new search job replaces, and keeps one it does not touch", async () => {
		const user = await createTestUser();
		const local = expectSuccess(await addOllama(user.id));
		expectSuccess(
			await setRoles(user.id, {
				chat: null,
				ranking: null,
				search: { connectionId: local.id, model: "embed" },
			})
		);
		expectSuccess(
			await recordEmbeddingCheck(user.id, "catalogue-v1", {
				connectionId: local.id,
				model: "embed",
			})
		);

		const untouched = expectSuccess(
			await createConnectionWithJobs(
				user.id,
				{ label: "One", type: "OPENROUTER", apiKey: SECRET },
				{ ranking: "r" }
			)
		);
		expect(untouched.roles.searchCheck?.verifiedFor).toBe("catalogue-v1");

		const replaced = expectSuccess(
			await createConnectionWithJobs(
				user.id,
				{ label: "Two", type: "OPENROUTER", apiKey: SECRET },
				{ search: "embed" }
			)
		);
		expect(replaced.roles.search?.connectionId).toBe(replaced.connection.id);
		expect(replaced.roles.searchCheck).toBeNull();
	});

	it("stores nothing when the connection or a job is refused", async () => {
		const user = await createTestUser();
		const attempt = (
			input: Partial<CreateConnectionInput>,
			models: Parameters<typeof createConnectionWithJobs>[2]
		) =>
			createConnectionWithJobs(
				user.id,
				{ label: "Router", type: "OPENROUTER", apiKey: SECRET, ...input },
				models
			);

		const unsupported = await attempt(
			{ type: "ANTHROPIC", label: "Claude" },
			{ chat: "c", ranking: "r" }
		);
		expectRefused(unsupported, "cannot be used for ranking");
		expect(unsupported).toMatchObject({ code: "JOB_NOT_SUPPORTED" });
		expectRefused(await attempt({}, { chat: " " }), "Model name");
		expectRefused(await attempt({ apiKey: "é" }, { chat: "c" }), "ASCII");

		expect(
			await prisma.userModelConnection.count({ where: { userId: user.id } })
		).toBe(0);
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
	});

	it("refuses an eleventh connection and leaves the jobs alone", async () => {
		const user = await createTestUser();
		for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
			expectSuccess(await addOllama(user.id, `http://host-${i}:11434`));
		}
		const refused = await createConnectionWithJobs(
			user.id,
			{ label: "Router", type: "OPENROUTER", apiKey: SECRET },
			{ chat: "c" }
		);
		expect(refused).toMatchObject({ code: "LIMIT_REACHED" });
		expect(
			await prisma.userModelRoles.count({ where: { userId: user.id } })
		).toBe(0);
	});
});
