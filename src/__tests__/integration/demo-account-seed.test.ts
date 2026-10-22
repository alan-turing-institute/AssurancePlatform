import argon2 from "argon2";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	hashApiTokenSecret,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import { decryptToken, isEncrypted } from "@/lib/auth/token-encryption";
import { recommendedModel } from "@/lib/models/recommended";
import prisma from "@/lib/prisma";
import { validateImportData } from "@/lib/services/case-import-service";
import { isPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { TOUR_IDS } from "@/lib/tours";
import {
	DEMO_CASE_ID,
	DEMO_FIXTURES,
	DEMO_INTEGRATION_NAME,
	DEMO_PIPELINE_SCOPES,
	DEMO_USERNAME,
	type DemoAccountValues,
	readDemoAccountValues,
	seedDemoAccount,
} from "../../../prisma/seed/demo-account-seed";
import {
	makeSecrets,
	runDemoEntryPoint,
	validEnv,
} from "../utils/demo-account-kit";
import {
	committedFixtureText,
	elementIdsIn,
	SHOWCASE_FIXTURES,
} from "../utils/demo-fixture-files";

const VALUES: DemoAccountValues = {
	password: "Demo-account-test-1!", // pragma: allowlist secret
	openRouterKey: "test-openrouter-key",
	pipelineToken: `teap_${"a1B2c3D4e5".repeat(4)}-_x`,
};

const BLUEBIRD_FILE = "bluebird-demo-case.json";

async function countRows() {
	return {
		users: await prisma.user.count(),
		cases: await prisma.assuranceCase.count(),
		elements: await prisma.assuranceElement.count(),
		connections: await prisma.userModelConnection.count(),
		integrations: await prisma.integration.count(),
		tokens: await prisma.apiToken.count(),
		grants: await prisma.casePermission.count(),
		pluginStates: await prisma.pluginState.count(),
	};
}

describe("seedDemoAccount", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	function useTestEncryptionKey() {
		vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
	}

	it("builds the demo account, its case, model connection and pipeline integration", async () => {
		useTestEncryptionKey();

		const result = await seedDemoAccount(VALUES);
		expect(result).toEqual({
			status: "created",
			caseId: DEMO_CASE_ID,
			showcaseCases: SHOWCASE_FIXTURES,
		});

		const user = await prisma.user.findUniqueOrThrow({
			where: { username: DEMO_USERNAME },
		});
		expect(user.email).toBe("demo@example.com");
		expect(user.authProvider).toBe("LOCAL");
		expect(user.emailVerified).toBe(true);
		expect(user.hasSeenMigrationNotice).toBe(true);
		expect(user.completedTours).toEqual([...TOUR_IDS]);
		expect(user.passwordAlgorithm).toBe("argon2id");
		expect(await argon2.verify(user.passwordHash ?? "", VALUES.password)).toBe(
			true
		);

		expect(await isPluginEnabledForUser("tea.health", user.id)).toBe(true);
		expect(await isPluginEnabledForUser("tea.assistant", user.id)).toBe(true);

		const connections = await prisma.userModelConnection.findMany({
			where: { userId: user.id },
		});
		expect(connections).toHaveLength(1);
		const [connection] = connections;
		expect(connection?.type).toBe("OPENROUTER");
		expect(connection?.label).toBe("OpenRouter");
		expect(isEncrypted(connection?.apiKeyEncrypted ?? "")).toBe(true);
		expect(decryptToken(connection?.apiKeyEncrypted ?? "")).toBe(
			VALUES.openRouterKey
		);
		const roles = await prisma.userModelRoles.findUniqueOrThrow({
			where: { userId: user.id },
		});
		expect(roles).toMatchObject({
			chatConnectionId: connection?.id,
			chatModel: recommendedModel("OPENROUTER", "chat"),
			decisionConnectionId: connection?.id,
			decisionModel: recommendedModel("OPENROUTER", "ranking"),
			embeddingConnectionId: connection?.id,
			embeddingModel: recommendedModel("OPENROUTER", "search"),
			embeddingVerifiedAt: null,
		});

		const integration = await prisma.integration.findUniqueOrThrow({
			where: { name: DEMO_INTEGRATION_NAME },
			include: { tokens: true },
		});
		expect(integration.ownerId).toBe(user.id);
		expect([...integration.scopes].sort()).toEqual(
			[...DEMO_PIPELINE_SCOPES].sort()
		);
		expect(integration.tokens).toHaveLength(1);
		expect(integration.tokens[0]).toMatchObject({
			tokenHash: hashApiTokenSecret(VALUES.pipelineToken),
			tokenPrefix: tokenDisplayPrefix(VALUES.pipelineToken),
			expiresAt: null,
			revokedAt: null,
		});
		const grant = await prisma.casePermission.findUniqueOrThrow({
			where: {
				caseId_userId: {
					caseId: DEMO_CASE_ID,
					userId: integration.systemUserId,
				},
			},
		});
		expect(grant.permission).toBe("EDIT");

		const demoCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: DEMO_CASE_ID },
		});
		expect(demoCase.createdById).toBe(user.id);
		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: DEMO_CASE_ID },
		});
		expect(elements.map((element) => element.id).sort()).toEqual(
			elementIdsIn(committedFixtureText(BLUEBIRD_FILE))
		);

		expect(await prisma.pluginHealthCheckCatalogue.count()).toBe(0);
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
		expect(await prisma.pluginHealthEvidence.count()).toBe(0);
	});

	it("changes nothing on a second run", async () => {
		useTestEncryptionKey();
		await seedDemoAccount(VALUES);
		const before = await countRows();
		const userBefore = await prisma.user.findUniqueOrThrow({
			where: { username: DEMO_USERNAME },
		});

		const second = await seedDemoAccount(VALUES);

		expect(second).toEqual({ status: "exists" });
		expect(await countRows()).toEqual(before);
		const userAfter = await prisma.user.findUniqueOrThrow({
			where: { username: DEMO_USERNAME },
		});
		expect(userAfter).toEqual(userBefore);
	});
});

describe("the demo fixture list", () => {
	it.each(
		DEMO_FIXTURES.map((fixture) => fixture.file)
	)("parses %s with the import schema", async (file) => {
		const checked = await validateImportData(
			JSON.parse(committedFixtureText(file))
		);

		expect(checked.errors).toBeUndefined();
		expect(checked.isValid).toBe(true);
	});
});

describe("the entry point with a malformed encryption key", () => {
	it("exits non-zero naming TOKEN_ENCRYPTION_KEY and writes no row", async () => {
		const key = Buffer.alloc(16, 7).toString("base64");

		const run = await runDemoEntryPoint(
			validEnv(makeSecrets(), { TOKEN_ENCRYPTION_KEY: key })
		);

		expect(run.code).not.toBe(0);
		expect(run.output).toContain("TOKEN_ENCRYPTION_KEY");
		expect(run.output).not.toContain(key);
		expect(await countRows()).toEqual({
			users: 0,
			cases: 0,
			elements: 0,
			connections: 0,
			integrations: 0,
			tokens: 0,
			grants: 0,
			pluginStates: 0,
		});
	}, 60_000);
});

describe("readDemoAccountValues", () => {
	const complete = {
		DATABASE_URL: "postgresql://example/db",
		DEMO_ACCOUNT_PASSWORD: VALUES.password,
		DEMO_OPENROUTER_API_KEY: VALUES.openRouterKey,
		DEMO_PIPELINE_TOKEN: VALUES.pipelineToken,
		TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
	};

	it("returns the values when all five variables are set and conform", () => {
		expect(readDemoAccountValues(complete)).toEqual({ values: VALUES });
	});

	it("names every missing variable and none of the values that are set", () => {
		const result = readDemoAccountValues({
			...complete,
			DEMO_ACCOUNT_PASSWORD: "",
			DEMO_PIPELINE_TOKEN: undefined,
		});

		expect(result).toEqual({
			problems: [
				"Missing environment variables: DEMO_ACCOUNT_PASSWORD, DEMO_PIPELINE_TOKEN",
			],
		});
	});

	it("refuses a password that fails the password rules and a value that is not a token, without printing either", () => {
		const result = readDemoAccountValues({
			...complete,
			DEMO_ACCOUNT_PASSWORD: "weakpassword", // pragma: allowlist secret
			DEMO_PIPELINE_TOKEN: "not-a-token-value",
		});

		expect(result).toHaveProperty("problems");
		const text = JSON.stringify(result);
		expect(text).toContain("DEMO_ACCOUNT_PASSWORD");
		expect(text).toContain("DEMO_PIPELINE_TOKEN");
		expect(text).not.toContain("weakpassword");
		expect(text).not.toContain("not-a-token-value");
	});

	it.each([
		["too short", `teap_${"a".repeat(42)}`],
		["too long", `teap_${"a".repeat(44)}`],
		["holding a character outside base64url", `teap_${"a".repeat(42)}+`],
	])("refuses a token that is %s, naming DEMO_PIPELINE_TOKEN only", (_case, token) => {
		const result = readDemoAccountValues({
			...complete,
			DEMO_PIPELINE_TOKEN: token,
		});

		expect(result).toHaveProperty("problems");
		const text = JSON.stringify(result);
		expect(text).toContain("DEMO_PIPELINE_TOKEN");
		expect(text).not.toContain(token);
	});

	it.each([
		["16 bytes", Buffer.alloc(16, 7).toString("base64")],
		["33 bytes", Buffer.alloc(33, 7).toString("base64")],
		["text that is not a key", "not-a-key-value"],
	])("refuses an encryption key of %s, naming TOKEN_ENCRYPTION_KEY only", (_case, key) => {
		const result = readDemoAccountValues({
			...complete,
			TOKEN_ENCRYPTION_KEY: key,
		});

		expect(result).toHaveProperty("problems");
		const text = JSON.stringify(result);
		expect(text).toContain("TOKEN_ENCRYPTION_KEY");
		expect(text).not.toContain(key);
	});

	it.each([
		["DATABASE_URL", `${complete.DATABASE_URL}\n`],
		["TOKEN_ENCRYPTION_KEY", ` ${complete.TOKEN_ENCRYPTION_KEY}`],
		["DEMO_ACCOUNT_PASSWORD", "   "],
	])("refuses %s with whitespace at the end, the start, or all of it, without printing it", (name, value) => {
		const result = readDemoAccountValues({ ...complete, [name]: value });

		expect(result).toHaveProperty("problems");
		const text = JSON.stringify(result);
		expect(text).toContain(name);
		expect(text).not.toContain(value.trim() || "   ");
	});
});
