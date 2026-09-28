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
	/** Signals the holder to commit, and resolves once it actually has. */
	release: () => Promise<void>;
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
	const committed = new Promise<void>((resolve) => {
		resolveCommitted = resolve;
	});

	prisma
		.$transaction(async (tx) => {
			await mutate(tx);
			resolveAcquired();
			await releaseSignal;
		})
		.then(() => resolveCommitted());

	await acquired;

	return {
		release: async () => {
			resolveReleaseSignal();
			await committed;
		},
	};
}
