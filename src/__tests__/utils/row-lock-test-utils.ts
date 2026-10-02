/**
 * Forces a genuine Postgres row-lock wait inside a test, so a guard that
 * only fires under real concurrency (an `updateMany`/`deleteMany` matching
 * zero rows because another transaction committed first) can be reached
 * deterministically — no mocked Prisma client, no `Promise.all` race whose
 * outcome depends on scheduling.
 */

import { prisma } from "@/lib/prisma";

// Derived from `prisma.$transaction`'s own callback parameter — same pattern
// as `publish-service.ts` and `slug-service.ts` (kept local rather than
// imported: `Prisma.TransactionClient` does not structurally match this
// project's `.$extends()`-wrapped client from `lib/prisma.ts`).
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
export type TestTransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

export interface HeldRowLock {
	/**
	 * Signals the holder to commit, and resolves once it actually has —
	 * or rejects with the holder transaction's own error, if it failed.
	 */
	release: () => Promise<void>;
}

const LOCK_WAIT_POLL_INTERVAL_MS = 10;
const LOCK_WAIT_TIMEOUT_MS = 5000;

/**
 * Polls the test database until another backend is blocked waiting for a
 * row lock — proof that a racing call has reached its guarded write and is
 * blocked behind `holdRowLock`'s held lock, rather than still running an
 * earlier, non-blocking read. Use this in place of a fixed delay before
 * releasing the lock: a delay only guesses how long the racing call's
 * earlier steps take, and guesses wrong under load. With
 * `minimumWaiters` above one it waits until that many backends are
 * blocked, which fixes the order they queue in.
 */
export async function waitForLockWait(
	timeoutMs = LOCK_WAIT_TIMEOUT_MS,
	minimumWaiters = 1
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const rows = await prisma.$queryRaw<[{ count: bigint }]>`
			SELECT count(*) AS count
			FROM pg_stat_activity
			WHERE datname = current_database()
				AND wait_event_type = 'Lock'
				AND pid <> pg_backend_pid()
		`;
		if (Number(rows[0]?.count ?? 0) >= minimumWaiters) {
			return;
		}
		if (Date.now() >= deadline) {
			throw new Error(
				`waitForLockWait: timed out after ${timeoutMs}ms waiting for another backend to block on a row lock`
			);
		}
		await new Promise((resolve) =>
			setTimeout(resolve, LOCK_WAIT_POLL_INTERVAL_MS)
		);
	}
}

/**
 * Opens a transaction, runs `mutate` inside it (typically a write that
 * takes a row lock), then blocks the transaction open — holding that lock —
 * until `release()` is called. Any other transaction that needs the same
 * row for a write (an `updateMany`/`deleteMany` on it) blocks until
 * `release()` lets this one commit, then re-evaluates its own `where`
 * clause against whatever `mutate` just committed.
 */
export async function holdRowLock(
	mutate: (tx: TestTransactionClient) => Promise<void>
): Promise<HeldRowLock> {
	let resolveAcquired: () => void = () => {
		/* replaced synchronously below */
	};
	const acquired = new Promise<void>((resolve) => {
		resolveAcquired = resolve;
	});

	let resolveReleaseSignal: () => void = () => {
		/* replaced synchronously below */
	};
	const releaseSignal = new Promise<void>((resolve) => {
		resolveReleaseSignal = resolve;
	});

	let resolveCommitted: () => void = () => {
		/* replaced synchronously below */
	};
	let rejectCommitted: (error: unknown) => void = () => {
		/* replaced synchronously below */
	};
	const committed = new Promise<void>((resolve, reject) => {
		resolveCommitted = resolve;
		rejectCommitted = reject;
	});

	prisma
		.$transaction(async (tx) => {
			await mutate(tx);
			resolveAcquired();
			await releaseSignal;
		})
		.then(
			() => resolveCommitted(),
			(error) => rejectCommitted(error)
		);

	await acquired;

	return {
		release: async () => {
			resolveReleaseSignal();
			await committed;
		},
	};
}
