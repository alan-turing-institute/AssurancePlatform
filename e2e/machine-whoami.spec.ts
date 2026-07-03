/**
 * e2e smoke coverage for the machine-auth request path (ADR 0002 v2 §2.4,
 * the R1 closure): a real, DB-issued bearer token reaches
 * `/api/machine/whoami` end to end through the actual running Next.js
 * server + middleware, and a request with no token gets the API error
 * envelope rather than the session-auth redirect that would otherwise
 * catch every other `/api/*` route (see `middleware.ts`'s `api/machine`
 * matcher exemption, unit-tested at the regex level in
 * `src/__tests__/integration/machine-auth.test.ts`).
 *
 * This is a plain HTTP smoke test, not a UI journey, so it uses
 * Playwright's `request` fixture directly and skips the browser. No
 * session/storageState is needed either — the endpoint under test
 * authenticates via bearer token, not cookies (mirrors the
 * `case-studies-index.spec.ts` pattern for auth-agnostic specs).
 *
 * Seeding: registers a real `Integration` and issues a real token through
 * the actual service functions (`registerIntegration` / `issueToken`) —
 * not a raw DB insert — so this exercises genuine business logic, not a
 * fixture shortcut. This assumes the same DATABASE_URL (and friends)
 * `e2e/global-setup.ts` and `prisma/seed/dev-seed.ts` already require to
 * run this suite at all locally; see the file header note in
 * `e2e/global-setup.ts` for that precondition.
 */
import { expect, test } from "@playwright/test";
import prisma from "@/lib/prisma";
import {
	issueToken,
	registerIntegration,
} from "@/lib/services/integration-registry-service";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("/api/machine/whoami — e2e smoke (R1)", () => {
	let ownerId: string | undefined;
	let integrationId: string | undefined;
	let secret: string | undefined;
	let integrationName: string | undefined;

	test.beforeAll(async () => {
		const unique = `e2e-machine-whoami-${Date.now()}`;

		const owner = await prisma.user.create({
			data: {
				email: `${unique}@example.com`,
				username: unique,
				passwordHash: "not-a-real-hash",
				passwordAlgorithm: "argon2id",
				authProvider: "LOCAL",
				emailVerified: true,
			},
		});
		ownerId = owner.id;

		const registered = await registerIntegration(
			{ name: unique, ownerId: owner.id, scopes: ["case:read"] },
			owner.id
		);
		if ("error" in registered) {
			throw new Error(`Failed to seed test integration: ${registered.error}`);
		}
		integrationId = registered.data.integration.id;
		integrationName = registered.data.integration.name;

		const issued = await issueToken(integrationId, owner.id);
		if ("error" in issued) {
			throw new Error(`Failed to seed test token: ${issued.error}`);
		}
		secret = issued.data.secret;
	});

	test.afterAll(async () => {
		// Deleting the integration cascades its token(s); the owner user
		// cleans up last so nothing is left orphaned in a shared dev DB.
		if (integrationId) {
			await prisma.integration.deleteMany({ where: { id: integrationId } });
		}
		if (ownerId) {
			await prisma.user.deleteMany({ where: { id: ownerId } });
		}
	});

	test("a real seeded bearer token authenticates and returns the integration's identity", async ({
		request,
	}) => {
		if (!secret) {
			throw new Error("beforeAll did not seed a token");
		}

		const response = await request.get("/api/machine/whoami", {
			headers: { authorization: `Bearer ${secret}` },
		});

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body.name).toBe(integrationName);
		expect(body.scopes).toEqual(["case:read"]);
		expect(typeof body.tokenPrefix).toBe("string");
	});

	test("no token returns the JSON 401 envelope, NOT a redirect to /login", async ({
		request,
	}) => {
		const response = await request.get("/api/machine/whoami", {
			maxRedirects: 0,
		});

		// The API error envelope, not next-auth's 307-to-/login redirect —
		// the whole point of the middleware's `api/machine` exemption (R1).
		expect(response.status()).not.toBe(307);
		expect(response.status()).toBe(401);
		expect(response.headers().location).toBeUndefined();

		const body = await response.json();
		expect(body.code).toBe("UNAUTHORISED");
	});
});
