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
	 *
	 * If `mutate` changed the row, every writer queued behind the lock wakes at
	 * once and re-checks the row against what the holder committed. Those that
	 * still match then compete for the new version of the row, so which of
	 * several queued writers goes first is not fixed by the order they queued
	 * in. A holder that only locks the row keeps the queue order on commit,
	 * because the first waiter proceeds while it still holds the row lock.
	 */
	release: () => Promise<void>;
	/**
	 * Signals the holder to roll back instead, so none of its writes land, and
	 * resolves once it has. Writers queued behind the lock take the row strictly
	 * in the order they queued, because the row they were waiting for is
	 * unchanged. Use this when the holder only needs to hold the lock, and the
	 * test depends on which queued writer goes first.
	 */
	rollback: () => Promise<void>;
}

/** Thrown inside the holder's transaction to make it roll back. */
class HolderRollback extends Error {}

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
 * until `release()` or `rollback()` is called. Any other transaction that
 * needs the same row for a write (an `updateMany`/`deleteMany` on it) blocks
 * until `release()` lets this one commit, then re-evaluates its own `where`
 * clause against whatever `mutate` just committed. With `rollback()` it
 * proceeds against the row as it was.
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

	let signalFinish: (commit: boolean) => void = () => {
		/* replaced synchronously below */
	};
	const finishSignal = new Promise<boolean>((resolve) => {
		signalFinish = resolve;
	});

	let resolveFinished: () => void = () => {
		/* replaced synchronously below */
	};
	let rejectFinished: (error: unknown) => void = () => {
		/* replaced synchronously below */
	};
	const finished = new Promise<void>((resolve, reject) => {
		resolveFinished = resolve;
		rejectFinished = reject;
	});

	prisma
		.$transaction(async (tx) => {
			await mutate(tx);
			resolveAcquired();
			if (!(await finishSignal)) {
				// A query on the transaction first, so one that Prisma already timed
				// out and rolled back rejects with its own timeout error instead of
				// being reported as a rollback that worked.
				await tx.$queryRaw`SELECT 1`;
				throw new HolderRollback();
			}
		})
		.then(
			() => resolveFinished(),
			(error) =>
				error instanceof HolderRollback
					? resolveFinished()
					: rejectFinished(error)
		);

	await acquired;

	return {
		release: async () => {
			signalFinish(true);
			await finished;
		},
		rollback: async () => {
			signalFinish(false);
			await finished;
		},
	};
}
