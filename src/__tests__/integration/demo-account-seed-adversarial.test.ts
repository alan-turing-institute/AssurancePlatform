import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashApiTokenSecret } from "@/lib/auth/api-token-service";
import { authenticateWithPrisma } from "@/lib/auth/config";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { SCOPES } from "@/lib/auth/scopes";
import { canAccessCase } from "@/lib/permissions";
import { resolveChatModel } from "@/lib/plugins/assistant/model-config";
import prisma from "@/lib/prisma";
import { validateApiToken } from "@/lib/services/integration-registry-service";
import {
	getRoles,
	listConnections,
} from "@/lib/services/model-connection-service";
import { isPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { TOUR_IDS } from "@/lib/tours";
import {
	DEMO_FIXTURES,
	type DemoAccountValues,
	seedDemoAccount,
} from "@/prisma/seed/demo-account-seed";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	allSecretValues,
	countRows,
	DEMO_CASE_ID,
	DEMO_SCOPES,
	type DemoSecrets,
	findLeak,
	fixtureClaimId,
	fixtureElementIds,
	fixtureElements,
	fixtureEvidenceCount,
	healthTableNames,
	makeSecrets,
	runDemoEntryPoint,
	runDevSeed,
	snapshotDatabase,
	validEnv,
} from "../utils/demo-account-kit";
import {
	importMachineRoute,
	machinePost,
	wireRecord,
} from "../utils/health-adversarial-kit";
import {
	callCaseChecks,
	callCriteriaPut,
	callMachineClaimCriteria,
	callPublishChecks,
	itemSettings,
	saveBody,
} from "../utils/health-criteria-kit";
import {
	createTestApiToken,
	createTestIntegrationWithSystemUser,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The shared demo account, built from five values: what the seed creates,
 * what it leaves alone, and what the entry point prints. Everything is
 * checked through the services and routes the application itself uses.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

beforeEach(async () => {
	await mockNoAuth();
});

/** The listed fixtures other than Bluebird. */
const SHOWCASE_FIXTURES = DEMO_FIXTURES.filter(
	(fixture) => fixture.caseId !== DEMO_CASE_ID
);

function valuesOf(secrets: DemoSecrets): DemoAccountValues {
	return {
		password: secrets.password,
		openRouterKey: secrets.openRouterKey,
		pipelineToken: secrets.pipelineToken,
	};
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const CREDENTIALS = /\/\/[^@]*@/;

/** The database address with a user and password the server does not know. */
function withCredentials(url: string): string {
	return url.replace(CREDENTIALS, "//Leak_User7:Wr0ngPwdQq@");
}

/** The database address with a database name the server does not have. */
function withDatabase(url: string): string {
	const changed = new URL(url);
	changed.pathname = "/leak_db_missing";
	return changed.toString();
}

let addressCounter = 0;
/** A client address no other call in this run has used, so failed attempts never trip the throttle. */
function freshAddress(): string {
	addressCounter += 1;
	return `198.51.100.${addressCounter % 250}`;
}

function bearer(token: string) {
	return new NextRequest("http://localhost:3000/api/machine/whoami", {
		headers: { authorization: `Bearer ${token}` },
	});
}

/** Seeds the account in this process and returns what the tests look at. */
async function seeded(secrets: DemoSecrets = makeSecrets()) {
	const result = await seedDemoAccount(valuesOf(secrets));
	const user = await prisma.user.findUniqueOrThrow({
		where: { username: "demo" },
	});
	const integration = await prisma.integration.findFirstOrThrow({
		where: { ownerId: user.id },
	});
	return { result, secrets, user, integration };
}

describe("the demo account the seed creates", () => {
	it("reports the fixed case id and the user can log in by username or by email, and only with exactly the password", async () => {
		const { result, secrets, user } = await seeded();

		expect(result).toEqual({
			status: "created",
			caseId: DEMO_CASE_ID,
			showcaseCases: SHOWCASE_FIXTURES,
		});
		expect(await authenticateWithPrisma("demo", secrets.password)).toEqual({
			id: user.id,
			name: "demo",
			email: "demo@example.com",
		});
		expect(
			await authenticateWithPrisma("demo@example.com", secrets.password)
		).toMatchObject({ id: user.id });
		expect(await authenticateWithPrisma("demo", `${secrets.password}x`)).toBe(
			null
		);
		expect(await authenticateWithPrisma("demo", `${secrets.password}\n`)).toBe(
			null
		);
		expect(await authenticateWithPrisma("demo", secrets.pipelineToken)).toBe(
			null
		);
		expect(await authenticateWithPrisma("demo", secrets.openRouterKey)).toBe(
			null
		);
	});

	it("is an ordinary verified local user whose tours and migration notice are already out of the way", async () => {
		const { user } = await seeded();

		expect(user).toMatchObject({
			username: "demo",
			email: "demo@example.com",
			authProvider: "LOCAL",
			emailVerified: true,
			isSystemUser: false,
			passwordAlgorithm: "argon2id",
			hasSeenMigrationNotice: true,
		});
		expect([...user.completedTours].sort()).toEqual([...TOUR_IDS].sort());
		expect(await prisma.user.count({ where: { isSystemUser: false } })).toBe(1);
	});

	it("turns on tea.health and tea.assistant for the user and switches nothing off", async () => {
		const { user } = await seeded();

		expect(await isPluginEnabledForUser("tea.health", user.id)).toBe(true);
		expect(await isPluginEnabledForUser("tea.assistant", user.id)).toBe(true);
		const states = await prisma.pluginState.findMany({
			where: { scopeId: user.id },
		});
		expect(states.length).toBeGreaterThanOrEqual(2);
		expect(states.every((state) => state.enabled)).toBe(true);
	});

	it("owns the Bluebird case under the fixed id, with exactly the fixture's element ids and names", async () => {
		const { user } = await seeded();

		const found = await prisma.assuranceCase.findMany();
		expect(found).toHaveLength(DEMO_FIXTURES.length);
		expect(found.find((row) => row.id === DEMO_CASE_ID)).toMatchObject({
			id: "c557f324-f2a8-41cd-87c5-6a662fefff9f",
			createdById: user.id,
			name: "Bluebird Demo Assurance Case",
		});
		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: DEMO_CASE_ID },
			select: { id: true, name: true },
		});
		expect(new Map(stored.map((row) => [row.id, row.name]))).toEqual(
			fixtureElements()
		);
		expect(
			await canAccessCase({ userId: user.id, caseId: DEMO_CASE_ID }, "ADMIN")
		).toBe(true);
	});

	it("has one OpenRouter connection whose chat model resolves for the assistant with the decrypted key", async () => {
		const { secrets, user } = await seeded();

		const connections = await listConnections(user.id);
		expect(connections).toHaveProperty("data");
		const list = "data" in connections ? connections.data : [];
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ type: "OPENROUTER", hasKey: true });
		const chat = await resolveChatModel(user.id);
		expect("error" in chat).toBe(false);
		expect("secrets" in chat ? chat.secrets.apiKey : null).toBe(
			secrets.openRouterKey
		);
		const stored = await prisma.userModelConnection.findMany({
			where: { userId: user.id },
		});
		expect(stored).toHaveLength(1);
		expect(stored[0]?.apiKeyEncrypted).not.toBeNull();
		expect(stored[0]?.apiKeyEncrypted).not.toContain(secrets.openRouterKey);
	});

	it("points the chat, ranking and search jobs at that connection with a model each", async () => {
		const { user } = await seeded();

		const roles = await getRoles(user.id);
		const connection = await prisma.userModelConnection.findFirstOrThrow({
			where: { userId: user.id },
		});
		const jobs = "data" in roles ? roles.data : null;
		expect(jobs?.chat?.connectionId).toBe(connection.id);
		expect(jobs?.ranking?.connectionId).toBe(connection.id);
		expect(jobs?.search?.connectionId).toBe(connection.id);
		expect(jobs?.chat?.model).toBeTruthy();
		expect(jobs?.ranking?.model).toBeTruthy();
		expect(jobs?.search?.model).toBeTruthy();
	});

	it("registers one integration owned by the user, with exactly the three pipeline scopes", async () => {
		const { user, integration } = await seeded();

		expect(await prisma.integration.count()).toBe(1);
		expect(integration.ownerId).toBe(user.id);
		expect(integration.status).toBe("ACTIVE");
		expect([...integration.scopes].sort()).toEqual([...DEMO_SCOPES].sort());
		const systemUser = await prisma.user.findUniqueOrThrow({
			where: { id: integration.systemUserId },
		});
		expect(systemUser.isSystemUser).toBe(true);
	});

	it("authenticates the supplied token through the real validation for each of its scopes and for no other", async () => {
		const { secrets, integration } = await seeded();

		for (const scope of DEMO_SCOPES) {
			const principal = await requireApiToken(
				bearer(secrets.pipelineToken),
				scope as (typeof SCOPES)[number]
			);
			expect(principal.integrationId).toBe(integration.id);
		}
		const anyScope = await validateApiToken({
			token: secrets.pipelineToken,
			ipAddress: freshAddress(),
		});
		expect(
			"data" in anyScope ? [...anyScope.data.scopes].sort() : null
		).toEqual([...DEMO_SCOPES].sort());
		for (const scope of SCOPES.filter((name) => !DEMO_SCOPES.includes(name))) {
			const refused = await validateApiToken({
				token: secrets.pipelineToken,
				scope,
				ipAddress: freshAddress(),
			});
			expect(refused).toEqual({ error: "Invalid or expired token" });
		}
		const other = await validateApiToken({
			token: `${secrets.pipelineToken}x`,
			ipAddress: freshAddress(),
		});
		expect("error" in other).toBe(true);
	});

	it("stores only a hash of the token, with no expiry and no revocation", async () => {
		const { secrets, integration } = await seeded();

		const rows = await prisma.apiToken.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			integrationId: integration.id,
			tokenPrefix: secrets.pipelineToken.slice(0, 12),
			expiresAt: null,
			revokedAt: null,
		});
		expect(rows[0]?.tokenHash).toMatch(SHA256_HEX);
		expect(rows[0]?.tokenHash).not.toBe(secrets.pipelineToken);
		const plain = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
			"SELECT count(*) AS count FROM api_tokens WHERE token_hash = $1",
			secrets.pipelineToken
		);
		expect(Number(plain[0]?.count)).toBe(0);
	});

	it("gives the integration's system user EDIT on the case, not ADMIN, and nothing anywhere else", async () => {
		const { integration } = await seeded();

		const grants = await prisma.casePermission.findMany({
			where: { userId: integration.systemUserId },
		});
		expect(grants).toHaveLength(1);
		expect(grants[0]).toMatchObject({
			caseId: DEMO_CASE_ID,
			permission: "EDIT",
		});
		expect(
			await canAccessCase(
				{ userId: integration.systemUserId, caseId: DEMO_CASE_ID },
				"EDIT"
			)
		).toBe(true);
		expect(
			await canAccessCase(
				{ userId: integration.systemUserId, caseId: DEMO_CASE_ID },
				"ADMIN"
			)
		).toBe(false);
	});

	it("creates no check list, accepted check or evidence result, and no evidence item the fixtures do not hold", async () => {
		await seeded();

		const tables = await healthTableNames();
		expect(tables).toContain("plugin_health_check_catalogues");
		expect(tables).toContain("plugin_health_criteria");
		expect(tables).toContain("plugin_health_evidence");
		expect(await countRows(tables)).toBe(0);
		expect(await prisma.pluginData.count()).toBe(0);
		expect(
			await prisma.assuranceElement.count({
				where: { elementType: "EVIDENCE" },
			})
		).toBe(fixtureEvidenceCount(DEMO_FIXTURES.map((fixture) => fixture.file)));
	});

	it("lets the pipeline publish checks with the shared token, offers them for the case's claims, and takes the claim's accepted settings and a result back", async () => {
		const { secrets, user, integration } = await seeded();
		const claimId = fixtureClaimId("P1");
		await mockAuth(user.id, user.username, user.email);

		const before = await callCaseChecks(DEMO_CASE_ID);
		expect(before.status).toBe(200);
		expect(await before.json()).toEqual([]);

		const published = await callPublishChecks(
			buildHealthCheckList(),
			secrets.pipelineToken
		);
		expect(published.status).toBe(200);
		expect(await published.json()).toMatchObject({ checks: 3 });

		const offered = await callCaseChecks(DEMO_CASE_ID);
		expect(offered.status).toBe(200);
		const lists = await offered.json();
		expect(lists).toHaveLength(1);
		expect(lists[0].integration.id).toBe(integration.id);
		expect(
			lists[0].checks.map((check: { name: string }) => check.name)
		).toContain(ITEM_CHECK_NAME);

		const accepted = await callCriteriaPut(
			claimId,
			saveBody(integration.id, itemSettings(), true)
		);
		expect(accepted.status).toBe(200);

		const read = await callMachineClaimCriteria(claimId, secrets.pipelineToken);
		expect(read.status).toBe(200);
		const item = await read.json();
		expect(item.check.name).toBe(ITEM_CHECK_NAME);

		const { POST } = await importMachineRoute();
		const posted = await POST(
			machinePost(
				claimId,
				wireRecord(claimId, "populationPass", {
					check: item.check,
					rule: item.rule,
					reduction: item.reduction,
					aggregation: item.aggregation,
					window: item.window,
					valid_for: item.valid_for,
				}),
				secrets.pipelineToken
			),
			{ params: Promise.resolve({ id: claimId }) }
		);
		expect(posted.status).toBe(201);
	});
});

describe("when the user demo already exists", () => {
	it("changes nothing, whatever new values it is given, and the first values keep working", async () => {
		const first = await seeded();
		const before = await snapshotDatabase();
		const second = makeSecrets();

		const result = await seedDemoAccount(valuesOf(second));

		expect(result).toEqual({ status: "exists" });
		expect(await snapshotDatabase()).toEqual(before);
		expect(
			await authenticateWithPrisma("demo", first.secrets.password)
		).not.toBe(null);
		expect(await authenticateWithPrisma("demo", second.password)).toBe(null);
		expect(
			"data" in
				(await validateApiToken({
					token: first.secrets.pipelineToken,
					ipAddress: freshAddress(),
				}))
		).toBe(true);
		expect(
			"error" in
				(await validateApiToken({
					token: second.pipelineToken,
					ipAddress: freshAddress(),
				}))
		).toBe(true);
	});

	it("changes nothing when the existing demo user is someone else's account", async () => {
		await createTestUser({ username: "demo", email: "someone@example.org" });
		const before = await snapshotDatabase();

		const result = await seedDemoAccount(valuesOf(makeSecrets()));

		expect(result).toEqual({ status: "exists" });
		expect(await snapshotDatabase()).toEqual(before);
		expect(await prisma.assuranceCase.count()).toBe(0);
		expect(await prisma.integration.count()).toBe(0);
		expect(await prisma.userModelConnection.count()).toBe(0);
		expect(await prisma.pluginState.count()).toBe(0);
	});

	it("comes back with the same case id, claim ids and token after the data is wiped and the seed runs again", async () => {
		const secrets = makeSecrets();
		await seeded(secrets);
		await prisma.$executeRawUnsafe(
			"TRUNCATE TABLE users, assurance_cases, integrations, api_tokens, plugin_state CASCADE"
		);
		expect(await prisma.assuranceCase.count()).toBe(0);

		const again = await seeded(secrets);

		expect(again.result).toEqual({
			status: "created",
			caseId: DEMO_CASE_ID,
			showcaseCases: SHOWCASE_FIXTURES,
		});
		for (const { file, caseId } of DEMO_FIXTURES) {
			const stored = await prisma.assuranceElement.findMany({
				where: { caseId },
				select: { id: true },
			});
			expect(stored.map((row) => row.id).sort()).toEqual(
				fixtureElementIds(file)
			);
		}
		expect(
			"data" in
				(await validateApiToken({
					token: secrets.pipelineToken,
					ipAddress: freshAddress(),
				}))
		).toBe(true);
		expect(await authenticateWithPrisma("demo", secrets.password)).not.toBe(
			null
		);
	});
});

describe("the entry point run as its own process", () => {
	it("builds the account from the environment, prints the case id and no secret, then changes nothing on a second run", async () => {
		const secrets = makeSecrets();
		const env = validEnv(secrets);

		const first = await runDemoEntryPoint(env);

		expect(first.code).toBe(0);
		expect(first.stdout).toContain(
			`demo account ready: case id=${DEMO_CASE_ID}`
		);
		for (const { file, caseId } of SHOWCASE_FIXTURES) {
			expect(first.stdout).toContain(
				`showcase case ready: case id=${caseId} file=${file}`
			);
		}
		expect(findLeak(first.output, allSecretValues(env))).toBeNull();
		const user = await prisma.user.findUniqueOrThrow({
			where: { username: "demo" },
		});
		expect(
			await authenticateWithPrisma("demo", secrets.password)
		).toMatchObject({ id: user.id });
		const chat = await resolveChatModel(user.id);
		expect("secrets" in chat ? chat.secrets.apiKey : null).toBe(
			secrets.openRouterKey
		);
		const before = await snapshotDatabase();

		const second = await runDemoEntryPoint(env);

		expect(second.code).toBe(0);
		expect(second.output).not.toContain("demo account ready");
		expect(second.output).not.toContain("showcase case ready");
		expect(findLeak(second.output, allSecretValues(env))).toBeNull();
		expect(await snapshotDatabase()).toEqual(before);
	}, 180_000);

	it("runs after the development seed, as the reseed does, and leaves that seed's own content alone", async () => {
		const seededByDev = await runDevSeed();
		expect(seededByDev.code).toBe(0);
		expect(
			await prisma.user.findUnique({ where: { username: "chris" } })
		).not.toBeNull();
		const devSnapshot = await snapshotDatabase();
		const devIntegrations = await prisma.integration.findMany();
		const devCatalogues = await prisma.pluginHealthCheckCatalogue.count();
		expect(devIntegrations).toHaveLength(1);
		expect(devCatalogues).toBe(1);
		const secrets = makeSecrets();

		const run = await runDemoEntryPoint(validEnv(secrets));

		expect(run.code).toBe(0);
		expect(run.stdout).toContain(`demo account ready: case id=${DEMO_CASE_ID}`);
		const after = await snapshotDatabase();
		expect(after.plugin_health_check_catalogues).toBe(
			devSnapshot.plugin_health_check_catalogues
		);
		expect(await prisma.pluginHealthCheckCatalogue.count()).toBe(devCatalogues);
		expect(await prisma.integration.count()).toBe(devIntegrations.length + 1);
		const demo = await prisma.user.findUniqueOrThrow({
			where: { username: "demo" },
		});
		const mine = await prisma.integration.findFirstOrThrow({
			where: { ownerId: demo.id },
		});
		expect(devIntegrations.map((row) => row.id)).not.toContain(mine.id);
		expect(await authenticateWithPrisma("demo", secrets.password)).not.toBe(
			null
		);
		await mockAuth(demo.id, demo.username, demo.email);
		const offered = await (await callCaseChecks(DEMO_CASE_ID)).json();
		expect(offered).toEqual([]);
	}, 240_000);

	it.each([
		"DATABASE_URL",
		"DEMO_ACCOUNT_PASSWORD",
		"DEMO_OPENROUTER_API_KEY",
		"DEMO_PIPELINE_TOKEN",
		"TOKEN_ENCRYPTION_KEY",
	])("exits non-zero and names %s when it is missing, and prints no value", async (name) => {
		const env = validEnv(makeSecrets(), { [name]: undefined });

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).toContain(name);
		expect(findLeak(run.output, allSecretValues(env))).toBeNull();
		expect(await prisma.user.count()).toBe(0);
	}, 60_000);

	it("names every missing value at once, and treats an empty value as missing", async () => {
		const env = validEnv(makeSecrets(), {
			DEMO_ACCOUNT_PASSWORD: "",
			DEMO_PIPELINE_TOKEN: undefined,
			DEMO_OPENROUTER_API_KEY: "",
		});

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).toContain("DEMO_ACCOUNT_PASSWORD");
		expect(run.output).toContain("DEMO_PIPELINE_TOKEN");
		expect(run.output).toContain("DEMO_OPENROUTER_API_KEY");
		expect(await prisma.user.count()).toBe(0);
	}, 60_000);

	it("exits non-zero with nothing written when every value is missing", async () => {
		const run = await runDemoEntryPoint({});

		expect(run.code).not.toBe(0);
		for (const name of [
			"DATABASE_URL",
			"DEMO_ACCOUNT_PASSWORD",
			"DEMO_OPENROUTER_API_KEY",
			"DEMO_PIPELINE_TOKEN",
			"TOKEN_ENCRYPTION_KEY",
		]) {
			expect(run.output).toContain(name);
		}
	}, 60_000);

	it("refuses a password that fails the registration policy, names it, prints nothing of it and writes nothing", async () => {
		const secrets = { ...makeSecrets(), password: "Qwe1!zz" };
		const env = validEnv(secrets);

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).toContain("DEMO_ACCOUNT_PASSWORD");
		expect(findLeak(run.output, allSecretValues(env))).toBeNull();
		expect(await prisma.user.count()).toBe(0);
	}, 60_000);

	it("refuses a token without the teap_ shape, names it, prints nothing of it and writes nothing", async () => {
		const secrets = { ...makeSecrets(), pipelineToken: "tea_Zk8Wq1LmXv9Ypb" };
		const env = validEnv(secrets);

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).toContain("DEMO_PIPELINE_TOKEN");
		expect(findLeak(run.output, allSecretValues(env))).toBeNull();
		expect(await prisma.user.count()).toBe(0);
	}, 60_000);

	it("fails without printing any value, prefix or hash when the demo email is already taken", async () => {
		await createTestUser({ username: "someone", email: "demo@example.com" });
		const secrets = makeSecrets();
		const env = validEnv(secrets);

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).not.toContain("demo account ready");
		expect(
			findLeak(run.output, [...allSecretValues(env), "$argon2"])
		).toBeNull();
	}, 90_000);

	it("fails without printing any value, prefix or hash when the token is already in use", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const secrets = makeSecrets();
		await createTestApiToken(integration.id, {
			tokenHash: hashApiTokenSecret(secrets.pipelineToken),
		});
		const env = validEnv(secrets);

		const run = await runDemoEntryPoint(env);

		expect(run.code).not.toBe(0);
		expect(run.output).not.toContain("demo account ready");
		expect(
			findLeak(run.output, [
				...allSecretValues(env),
				hashApiTokenSecret(secrets.pipelineToken),
				"$argon2",
			])
		).toBeNull();
	}, 90_000);

	it.each([
		[
			"a host that does not resolve",
			{
				DATABASE_URL:
					"postgresql://Leak_User7:Lk9PwdXyz@db-leak-host.invalid:5432/leak_db",
			},
			["Leak_User7", "Lk9PwdXyz", "db-leak-host.invalid", "leak_db"],
		],
		[
			"credentials the database refuses",
			{ DATABASE_URL: withCredentials(process.env.DATABASE_URL ?? "") },
			["Leak_User7", "Wr0ngPwdQq"],
		],
		[
			"a database name the server does not have",
			{ DATABASE_URL: withDatabase(process.env.DATABASE_URL ?? "") },
			["leak_db_missing"],
		],
		[
			"an encryption key that is not a key",
			{ TOKEN_ENCRYPTION_KEY: "NotAKey-Zq8wLmXvTp4" },
			[],
		],
	])(
		"fails with %s and prints no value, prefix or part of one",
		async (_label, overrides, parts) => {
			const env = validEnv(makeSecrets(), overrides);

			const run = await runDemoEntryPoint(env);

			expect(run.code).not.toBe(0);
			expect(findLeak(run.output, allSecretValues(env))).toBeNull();
			for (const part of parts) {
				expect(run.output).not.toContain(part);
			}
		},
		90_000
	);
});

describe("a secret with whitespace at either end is refused, never accepted and then silently broken", () => {
	const PADDINGS: [string, (value: string) => string][] = [
		["a trailing newline", (value) => `${value}\n`],
		["a trailing carriage return and newline", (value) => `${value}\r\n`],
		["a trailing space", (value) => `${value} `],
		["a trailing tab", (value) => `${value}\t`],
		["a leading space", (value) => ` ${value}`],
		["a leading newline", (value) => `\n${value}`],
	];
	const TARGETS: [
		string,
		"DEMO_ACCOUNT_PASSWORD" | "DEMO_OPENROUTER_API_KEY" | "DEMO_PIPELINE_TOKEN",
		keyof DemoSecrets,
	][] = [
		["password", "DEMO_ACCOUNT_PASSWORD", "password"],
		["model key", "DEMO_OPENROUTER_API_KEY", "openRouterKey"],
		["pipeline token", "DEMO_PIPELINE_TOKEN", "pipelineToken"],
	];

	async function readWith(name: string, value: string, secrets: DemoSecrets) {
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);
		return readDemoAccountValues(validEnv(secrets, { [name]: value }));
	}

	for (const [label, variable, key] of TARGETS) {
		it.each(
			PADDINGS
		)(`refuses the ${label} with %s, naming ${variable}`, async (_padding, pad) => {
			const secrets = makeSecrets();

			const read = await readWith(variable, pad(secrets[key]), secrets);

			expect("problems" in read).toBe(true);
			const text = "problems" in read ? read.problems.join("\n") : "";
			expect(text).toContain(variable);
			expect(findLeak(text, [secrets[key]])).toBeNull();
		});
	}

	it("accepts the same secrets without padding", async () => {
		const secrets = makeSecrets();
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);

		const read = readDemoAccountValues(validEnv(secrets));

		expect(read).toEqual({ values: valuesOf(secrets) });
	});

	it("accepts a password with a space inside it", async () => {
		const secrets = { ...makeSecrets(), password: "Zq9-green apple-tree!" };
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);

		const read = readDemoAccountValues(validEnv(secrets));

		expect(read).toEqual({ values: valuesOf(secrets) });
	});

	it("refuses a model key that is only whitespace, before anything is written", async () => {
		const secrets = makeSecrets();

		const read = await readWith("DEMO_OPENROUTER_API_KEY", "  \n", secrets);

		expect("problems" in read).toBe(true);
	});

	it.each([
		["password", "DEMO_ACCOUNT_PASSWORD", "password"],
		["pipeline token", "DEMO_PIPELINE_TOKEN", "pipelineToken"],
	] as const)(
		"exits non-zero and writes nothing when the %s ends in a newline",
		async (_label, variable, key) => {
			const secrets = makeSecrets();
			const env = validEnv(secrets, { [variable]: `${secrets[key]}\n` });

			const run = await runDemoEntryPoint(env);

			expect(run.code).not.toBe(0);
			expect(run.output).toContain(variable);
			expect(await prisma.user.count()).toBe(0);
			expect(await prisma.apiToken.count()).toBe(0);
		},
		90_000
	);
});

describe("a token that does not have the teap_ shape or a password the policy refuses", () => {
	const BAD_TOKENS = [
		"tea_Zk8Wq1LmXv9Ypb",
		"teap_",
		"TEAP_Zk8Wq1LmXv9Ypb",
		"Bearer teap_Zk8Wq1LmXv9Ypb",
		"Zk8Wq1LmXv9Ypb",
		"teapZk8Wq1LmXv9Ypb",
	];
	const BAD_PASSWORDS = [
		"Qwe1!zz",
		"alllowercase1!",
		"NoDigitsHere!",
		"NoSpecial1234",
	];

	it.each(
		BAD_TOKENS
	)("refuses the token %j, naming DEMO_PIPELINE_TOKEN and not repeating it", async (token) => {
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);

		const read = readDemoAccountValues(
			validEnv({ ...makeSecrets(), pipelineToken: token })
		);

		expect("problems" in read).toBe(true);
		const text = "problems" in read ? read.problems.join("\n") : "";
		expect(text).toContain("DEMO_PIPELINE_TOKEN");
		expect(text).not.toContain(token);
	});

	it.each(
		BAD_PASSWORDS
	)("refuses the password %j, naming DEMO_ACCOUNT_PASSWORD and not repeating it", async (password) => {
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);

		const read = readDemoAccountValues(
			validEnv({ ...makeSecrets(), password })
		);

		expect("problems" in read).toBe(true);
		const text = "problems" in read ? read.problems.join("\n") : "";
		expect(text).toContain("DEMO_ACCOUNT_PASSWORD");
		expect(text).not.toContain(password);
	});

	it("reports every problem at once when several values are wrong", async () => {
		const { readDemoAccountValues } = await import(
			"@/prisma/seed/demo-account-seed"
		);

		const read = readDemoAccountValues(
			validEnv({ ...makeSecrets(), password: "weak", pipelineToken: "nope" })
		);

		const text = "problems" in read ? read.problems.join("\n") : "";
		expect(text).toContain("DEMO_ACCOUNT_PASSWORD");
		expect(text).toContain("DEMO_PIPELINE_TOKEN");
	});
});
