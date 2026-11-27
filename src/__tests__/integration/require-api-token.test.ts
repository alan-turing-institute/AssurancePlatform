import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
	generateApiTokenSecret,
	hashApiTokenSecret,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { AppError } from "@/lib/errors";
import { RATE_LIMIT_CONFIGS } from "@/lib/services/rate-limit-service";
import {
	createTestApiToken,
	createTestIntegrationWithSystemUser,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * `requireApiToken` is the bearer-token check on a machine request: which
 * principal comes back for a good token, and which error a bad one gets.
 */

const FAILURE_MESSAGE = "Invalid or expired token";
const ADDRESS = "203.0.113.7";

function requestWith(authorization?: string): NextRequest {
	const headers: Record<string, string> = { "x-client-ip": ADDRESS };
	if (authorization !== undefined) {
		headers.authorization = authorization;
	}
	return new NextRequest("http://localhost/api/machine/whoami", { headers });
}

/** An active integration holding the given scopes, with one live token. */
async function integrationWithToken(scopes: string[] = ["case:read"]) {
	const owner = await createTestUser();
	const { integration, systemUser } = await createTestIntegrationWithSystemUser(
		owner.id,
		{ scopes }
	);
	const secret = generateApiTokenSecret();
	await createTestApiToken(integration.id, {
		tokenHash: hashApiTokenSecret(secret),
		tokenPrefix: tokenDisplayPrefix(secret),
	});
	return { integration, systemUser, secret };
}

async function refusal(
	request: NextRequest,
	scope?: Parameters<typeof requireApiToken>[1]
): Promise<AppError | undefined> {
	const outcome = await requireApiToken(request, scope).catch(
		(thrown: unknown) => thrown
	);
	return outcome instanceof AppError ? outcome : undefined;
}

describe("requireApiToken: a good token", () => {
	it("returns the principal for the integration the token belongs to", async () => {
		const { integration, systemUser, secret } = await integrationWithToken([
			"case:read",
		]);

		const principal = await requireApiToken(requestWith(`Bearer ${secret}`));

		expect(principal).toStrictEqual({
			integrationId: integration.id,
			integrationName: integration.name,
			scopes: ["case:read"],
			systemUserId: systemUser.id,
			tokenPrefix: tokenDisplayPrefix(secret),
		});
	});

	it("ignores spaces around the token", async () => {
		const { integration, secret } = await integrationWithToken();

		const principal = await requireApiToken(
			requestWith(`Bearer   ${secret}  `)
		);

		expect(principal.integrationId).toBe(integration.id);
	});

	it("accepts a token whose integration holds the required scope", async () => {
		const { integration, secret } = await integrationWithToken(["case:read"]);

		const principal = await requireApiToken(
			requestWith(`Bearer ${secret}`),
			"case:read"
		);

		expect(principal.integrationId).toBe(integration.id);
	});
});

describe("requireApiToken: a refused token", () => {
	async function refusedHeaders(): Promise<(string | undefined)[]> {
		const { secret } = await integrationWithToken();
		return [
			undefined,
			"Basic dXNlcjpwYXNz",
			"Bearer",
			"Bearer    ",
			`bearer ${secret}`,
			`Token ${secret}`,
			`Bearer ${generateApiTokenSecret()}`,
		];
	}

	it("sends the same unauthorised error for every kind of bad header", async () => {
		const errors = await Promise.all(
			(await refusedHeaders()).map((header) => refusal(requestWith(header)))
		);

		for (const error of errors) {
			expect(error).toBeInstanceOf(AppError);
			expect(error?.code).toBe("UNAUTHORISED");
			expect(error?.statusCode).toBe(401);
			expect(error?.message).toBe(FAILURE_MESSAGE);
		}
	});

	it("refuses a token whose integration lacks the required scope, with the same error", async () => {
		const { secret } = await integrationWithToken(["case:read"]);

		const error = await refusal(
			requestWith(`Bearer ${secret}`),
			"health:checks:write"
		);

		expect(error?.code).toBe("UNAUTHORISED");
		expect(error?.message).toBe(FAILURE_MESSAGE);
	});
});

describe("requireApiToken: too many failed attempts", () => {
	it("sends a rate-limited error with status 429 once an address is over its limit", async () => {
		const maxAttempts = RATE_LIMIT_CONFIGS.machineAuth.limits[0].maxAttempts;
		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			const error = await refusal(requestWith("Bearer"));
			expect(error?.code).toBe("UNAUTHORISED");
		}

		const blocked = await refusal(requestWith("Bearer"));

		expect(blocked?.code).toBe("RATE_LIMITED");
		expect(blocked?.statusCode).toBe(429);
		expect(blocked?.message).not.toBe(FAILURE_MESSAGE);
		expect(blocked?.message).not.toBe("");
	});

	it("refuses a good token from an address that is over its limit", async () => {
		const { secret } = await integrationWithToken();
		const maxAttempts = RATE_LIMIT_CONFIGS.machineAuth.limits[0].maxAttempts;
		for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
			await refusal(requestWith("Bearer"));
		}

		const blocked = await refusal(requestWith(`Bearer ${secret}`));

		expect(blocked?.code).toBe("RATE_LIMITED");
	});
});
