import { readFileSync } from "node:fs";
import { join } from "node:path";
import argon2 from "argon2";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	hashApiTokenSecret,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import { decryptToken, isEncrypted } from "@/lib/auth/token-encryption";
import { recommendedModel } from "@/lib/models/recommended";
import prisma from "@/lib/prisma";
import { isPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { TOUR_IDS } from "@/lib/tours";
import {
	DEMO_CASE_ID,
	DEMO_INTEGRATION_NAME,
	DEMO_PIPELINE_SCOPES,
	DEMO_USERNAME,
	type DemoAccountValues,
	readDemoAccountValues,
	seedDemoAccount,
} from "../../../prisma/seed/demo-account-seed";

const VALUES: DemoAccountValues = {
	password: "Demo-account-test-1!", // pragma: allowlist secret
	openRouterKey: "test-openrouter-key",
	pipelineToken: "teap_test-pipeline-token",
};

interface FixtureNode {
	children: FixtureNode[];
	id: string;
}

function fixtureElementIds(): string[] {
	const fixture: { tree: FixtureNode } = JSON.parse(
		readFileSync(
			join(process.cwd(), "prisma/seed/fixtures/bluebird-demo-case.json"),
			"utf-8"
		)
	);
	const ids: string[] = [];
	const walk = (node: FixtureNode) => {
		ids.push(node.id);
		for (const child of node.children) {
			walk(child);
		}
	};
	walk(fixture.tree);
	return ids.sort();
}

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
		expect(result).toEqual({ status: "created", caseId: DEMO_CASE_ID });

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
			fixtureElementIds()
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

describe("readDemoAccountValues", () => {
	const complete = {
		DATABASE_URL: "postgresql://example/db",
		DEMO_ACCOUNT_PASSWORD: VALUES.password,
		DEMO_OPENROUTER_API_KEY: VALUES.openRouterKey,
		DEMO_PIPELINE_TOKEN: VALUES.pipelineToken,
		TOKEN_ENCRYPTION_KEY: "key-value-not-printed",
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
});
