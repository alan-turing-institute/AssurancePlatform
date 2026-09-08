import { NextRequest } from "next/server";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

function statusRequest(caseId: string) {
	return new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`);
}

/**
 * Saturates the app's real Postgres connection pool — the same
 * `globalThis.pgPool` singleton `lib/prisma.ts` constructs (see that
 * module's comment) — by checking out every slot up to its configured `max`
 * and holding them for the duration of `fn`. This reproduces the exhaustion
 * shape from "TEA — Status endpoint can hang indefinitely": a request
 * arriving while every pool slot is already checked out.
 *
 * Clients are ALWAYS released in `finally`, even if `fn` throws or an
 * assertion inside it fails — a wedged pool here would starve every other
 * test in the suite run, not just this one.
 */
async function withSaturatedPool<T>(fn: () => Promise<T>): Promise<T> {
	// Importing `@/lib/prisma` forces the module — and therefore its pool —
	// to exist; it's the same singleton the route's Prisma calls go through.
	// (In practice it's already loaded by the factories above, but this
	// makes the dependency explicit rather than relying on import order.)
	await import("@/lib/prisma");
	const pool = (globalThis as unknown as { pgPool: Pool }).pgPool;
	const max = pool.options.max ?? 10;
	const clients: PoolClient[] = [];
	try {
		for (let i = 0; i < max; i++) {
			clients.push(await pool.connect());
		}
		return await fn();
	} finally {
		for (const client of clients) {
			client.release();
		}
	}
}

describe("GET /api/cases/[id]/status — pool-starvation regression", () => {
	// nanaki's QA (2026-08-20) exercised this against the app's real
	// singleton pool and found it cheap and reliable: pre-fix, an extra
	// query left unsettled past 120s; fixed, a loud rejection at ~5018ms.
	// This commits that regression check so future changes to `lib/prisma.ts`
	// or `lib/with-timeout.ts` can't silently reopen the hang.
	it("returns a fast structured error instead of hanging when the connection pool is fully saturated", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await mockAuth(user.id, user.username, user.email);

		await withSaturatedPool(async () => {
			const started = Date.now();
			const { GET } = await import("@/app/api/cases/[id]/status/route");
			const response = await GET(statusRequest(testCase.id), {
				params: Promise.resolve({ id: testCase.id }),
			});
			const elapsedMs = Date.now() - started;

			// The pool's own `connectionTimeoutMillis` (`lib/prisma.ts`, 5000ms)
			// fires long before the route's 15s `withTimeout` backstop, so this
			// settles in low single-digit seconds — nowhere near the 30s
			// integration test timeout the pre-fix hang would have exhausted.
			expect(elapsedMs).toBeLessThan(10_000);

			const body = await response.json();
			expect(response.status).toBeGreaterThanOrEqual(500);
			expect(typeof body.code).toBe("string");
		});
	});

	it("pool exhaustion surfaces as 503/DB_UNAVAILABLE — distinct from a generic 500 — not 504", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await mockAuth(user.id, user.username, user.email);

		await withSaturatedPool(async () => {
			const { GET } = await import("@/app/api/cases/[id]/status/route");
			const response = await GET(statusRequest(testCase.id), {
				params: Promise.resolve({ id: testCase.id }),
			});

			// Pool-acquisition contention throws pg's own plain
			// `Error('timeout exceeded when trying to connect')`. `handleError`
			// (`lib/errors.ts`) now recognises that message (and pg-pool's other
			// connection-timeout message) before falling through to the generic
			// INTERNAL branch, and maps it to the dedicated DB_UNAVAILABLE code
			// (503) — distinguishable in the API envelope and in logs (a
			// `db.pool.acquire_timeout` structured log line) from an unrelated
			// bug, which a generic 500/INTERNAL was not. See "TEA — Pool-timeout
			// errors indistinguishable from generic 500s". The route's
			// 504/GATEWAY_TIMEOUT path remains a *different* backstop that only
			// fires when `withTimeout` itself elapses (slow-but-not-erroring
			// work) — pool exhaustion never reaches it because the pool errors
			// out first, well inside the 15s budget.
			expect(response.status).toBe(503);
			const body = await response.json();
			expect(body.code).toBe("DB_UNAVAILABLE");
		});
	});
});
