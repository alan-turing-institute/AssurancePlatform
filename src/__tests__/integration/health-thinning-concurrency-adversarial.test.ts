import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	CUTOFF,
	captureLog,
	chainProblems,
	fillRandomly,
	HOUR,
	MINUTE,
	NOW,
	noteProblems,
	put,
	putRun,
	readRows,
	reinstate,
	SECOND,
	setupWorld,
	thin,
	unionLog,
	withdraw,
} from "../utils/health-thinning-adversarial-kit";
import {
	type TestTransactionClient,
	waitForLockWait,
} from "../utils/row-lock-test-utils";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const CRON_SECRET = "thinning-concurrency-secret";

beforeEach(async () => {
	await mockNoAuth();
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

interface HeldClaim {
	/** Commits the holding transaction, after running `work` inside it. */
	release: (
		work?: (tx: TestTransactionClient) => Promise<void>
	) => Promise<void>;
}

/** Holds the claim-row lock, as an append does, until released. */
async function holdClaimLock(claimId: string): Promise<HeldClaim> {
	let open: () => void = () => {
		/* replaced synchronously below */
	};
	const gate = new Promise<void>((resolve) => {
		open = resolve;
	});
	let ready: () => void = () => {
		/* replaced synchronously below */
	};
	const locked = new Promise<void>((resolve) => {
		ready = resolve;
	});
	let work: ((tx: TestTransactionClient) => Promise<void>) | undefined;
	const finished = prisma.$transaction(
		async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${claimId} FOR UPDATE`;
			ready();
			await gate;
			await work?.(tx);
		},
		{ timeout: 60_000, maxWait: 10_000 }
	);
	await locked;
	const held: HeldClaim = {
		release: async (after) => {
			work = after;
			open();
			await finished;
		},
	};
	heldLocks.push(held);
	return held;
}

/**
 * Holds a shared lock on one evidence row, until released: a delete of the row
 * has to wait for it, while a reference to the row from a new withdrawal does not.
 */
async function holdEvidenceRowShared(evidenceId: string): Promise<HeldClaim> {
	let open: () => void = () => {
		/* replaced synchronously below */
	};
	const gate = new Promise<void>((resolve) => {
		open = resolve;
	});
	let ready: () => void = () => {
		/* replaced synchronously below */
	};
	const locked = new Promise<void>((resolve) => {
		ready = resolve;
	});
	const finished = prisma.$transaction(
		async (tx) => {
			await tx.$queryRaw`SELECT id FROM plugin_health_evidence WHERE id = ${evidenceId} FOR SHARE`;
			ready();
			await gate;
		},
		{ timeout: 60_000, maxWait: 10_000 }
	);
	await locked;
	const held: HeldClaim = {
		release: async () => {
			open();
			await finished;
		},
	};
	heldLocks.push(held);
	return held;
}

// Anything a test starts and does not finish is finished after it, so one
// failed assertion does not leave a lock held for the tests that follow.
const heldLocks: HeldClaim[] = [];
const background: Promise<unknown>[] = [];

function track<T>(work: Promise<T>): Promise<T> {
	background.push(work.catch(() => undefined));
	return work;
}

afterEach(async () => {
	for (const held of heldLocks.splice(0)) {
		await held.release().catch(() => undefined);
	}
	await Promise.allSettled(background.splice(0));
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** "pending" if the promise has not settled after a while. */
async function settledWithin<T>(promise: Promise<T>, ms: number) {
	return await Promise.race([
		promise.then(() => "settled" as const),
		pause(ms).then(() => "pending" as const),
	]);
}

/** A claim with a run old enough to thin: ten identical results a minute apart. */
async function oldRun(
	world: Awaited<ReturnType<typeof setupWorld>>,
	claim = 0
) {
	return await putRun(world, claim, CUTOFF - 6 * HOUR, 10, MINUTE);
}

const surviving = async (claimId: string) =>
	(await readRows(claimId)).map((row) => row.recordId);

// ---------------------------------------------------------------------------
// Withdrawal and reinstatement take the claim-row lock
// ---------------------------------------------------------------------------

describe("withdrawing and reinstating a record", () => {
	it("wait for the claim-row lock that an append holds", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const held = await holdClaimLock(claimId);

		const withdrawing = track(withdraw(world, 0, ids[3] ?? ""));
		await waitForLockWait(4000);
		expect(await settledWithin(withdrawing, 300)).toBe("pending");
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
		await held.release();
		expect((await withdrawing).error).toBeUndefined();
		expect(await prisma.pluginHealthRevocation.count()).toBe(1);

		const second = await holdClaimLock(claimId);
		const reinstating = track(reinstate(world, 0, ids[3] ?? ""));
		await waitForLockWait(4000);
		expect(await settledWithin(reinstating, 300)).toBe("pending");
		await second.release();
		expect((await reinstating).error).toBeUndefined();
	});

	it("still report an unknown record, a repeated withdrawal and a reinstatement of an open record as before", async () => {
		const world = await setupWorld();
		const ids = await oldRun(world);
		expect((await withdraw(world, 0, ids[2] ?? "")).error).toBeUndefined();
		expect(await withdraw(world, 0, ids[2] ?? "")).toEqual({
			error: "This record is already revoked",
		});
		expect(await reinstate(world, 0, ids[4] ?? "")).toEqual({
			error: "This record is not revoked",
		});
		expect(
			await withdraw(world, 0, "00000000-0000-4000-8000-000000000000")
		).toEqual({
			error: "Record not found",
		});
		expect((await reinstate(world, 0, ids[2] ?? "")).error).toBeUndefined();
		expect((await withdraw(world, 0, ids[2] ?? "")).error).toBeUndefined();
	});

	it("let exactly one of two simultaneous withdrawals of the same record succeed", async () => {
		const world = await setupWorld();
		const ids = await oldRun(world);

		const results = await Promise.all([
			withdraw(world, 0, ids[4] ?? ""),
			withdraw(world, 0, ids[4] ?? ""),
			withdraw(world, 0, ids[4] ?? ""),
		]);

		expect(results.filter((result) => !result.error)).toHaveLength(1);
		expect(
			results.filter(
				(result) => result.error === "This record is already revoked"
			)
		).toHaveLength(2);
		expect(await prisma.pluginHealthRevocation.count()).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// A withdrawal and the job cannot lose each other
// ---------------------------------------------------------------------------

describe("a withdrawal racing the job", () => {
	it("that commits after the job has read the batch and before it writes loses neither the record nor the withdrawal", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const target = (await readRows(claimId))[3];
		const held = await holdClaimLock(claimId);

		const job = track(thin(NOW));
		// The job has read the batch and is waiting to write it.
		await waitForLockWait(4000);
		await held.release(async (tx) => {
			await tx.pluginHealthRevocation.create({
				data: {
					evidenceId: target?.id ?? "",
					cause: "EVIDENCE_DEFECT",
					reason: "withdrawn while the job waited",
					revokedById: world.owner.id,
				},
			});
		});
		await job;

		expect(await surviving(claimId)).toContain(ids[3]);
		expect(
			await prisma.pluginHealthRevocation.count({
				where: { evidenceId: target?.id },
			})
		).toBe(1);
		expect(await chainProblems(world)).toEqual([]);

		// The next call sees the withdrawal: the withdrawn record ends the run on
		// both sides, so only the middles of the two shorter runs go.
		await thin(NOW);
		expect(await surviving(claimId)).toEqual([
			ids[0],
			ids[2],
			ids[3],
			ids[4],
			ids[9],
		]);
	});

	it("that lands while the job waits to delete the record is not lost with it", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const target = (await readRows(claimId))[4];
		const held = await holdEvidenceRowShared(target?.id ?? "");

		// The job has decided, checked for withdrawals and now waits to delete.
		const job = track(thin(NOW));
		await waitForLockWait(4000);
		const withdrawing = track(withdraw(world, 0, ids[4] ?? ""));
		await pause(500);
		await held.release();
		const [withdrawn] = await Promise.all([withdrawing, job]);

		const row = (await readRows(claimId)).find(
			(candidate) => candidate.recordId === ids[4]
		);
		if (withdrawn.error) {
			expect(withdrawn.error).toBe("Record not found");
			expect(row).toBeUndefined();
		} else {
			// A withdrawal that was accepted must still be there with its record.
			expect(row?.everWithdrawn).toBe(true);
		}
		expect(await chainProblems(world)).toEqual([]);
	});

	it("is not applied to a batch when the claim's position moved after it was read", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await oldRun(world);
		const last = (await readRows(claimId)).at(-1);
		const held = await holdClaimLock(claimId);

		const job = track(thin(NOW));
		await waitForLockWait(4000);
		await held.release(async (tx) => {
			await tx.pluginHealthClaimState.update({
				where: { claimId },
				data: { thinnedThroughSequence: last?.seq },
			});
		});
		const result = await job;

		expect(result.recordsRemoved).toBe(0);
		expect((await surviving(claimId)).length).toBe(10);
	});

	it("queued ahead of the job's write keeps the record and the withdrawal", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const held = await holdClaimLock(claimId);

		const withdrawing = track(withdraw(world, 0, ids[5] ?? ""));
		await waitForLockWait(4000);
		const job = track(thin(NOW));
		await waitForLockWait(4000, 2);
		await held.release();
		const [withdrawn] = await Promise.all([withdrawing, job]);

		expect(withdrawn.error).toBeUndefined();
		expect(await surviving(claimId)).toContain(ids[5]);
		expect(
			await prisma.pluginHealthRevocation.count({
				where: { evidence: { recordId: ids[5] } },
			})
		).toBe(1);
		expect(await chainProblems(world)).toEqual([]);
	});

	it("queued behind the job's write is refused as unknown, not recorded against a record that has gone", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const held = await holdClaimLock(claimId);

		const job = track(thin(NOW));
		await waitForLockWait(4000);
		const withdrawing = track(withdraw(world, 0, ids[5] ?? ""));
		await waitForLockWait(4000, 2);
		await held.release();
		const [withdrawn] = await Promise.all([withdrawing, job]);

		const present = (await surviving(claimId)).includes(ids[5] ?? "");
		const revocations = await prisma.pluginHealthRevocation.count();
		if (withdrawn.error) {
			// The record was removed first.
			expect(withdrawn.error).toBe("Record not found");
			expect(present).toBe(false);
			expect(revocations).toBe(0);
		} else {
			// The withdrawal was first: it must have survived with its record.
			expect(present).toBe(true);
			expect(revocations).toBe(1);
		}
		expect(await chainProblems(world)).toEqual([]);
	});

	it("never loses a withdrawal however the two interleave, over many tries", async () => {
		const world = await setupWorld({ claims: 4 });
		const outcomes: Array<{ ok: boolean; present: boolean; revoked: number }> =
			[];
		for (let claim = 0; claim < 4; claim++) {
			const ids = await oldRun(world, claim);
			const target = ids[1 + claim] ?? "";
			const [result] = await Promise.all([
				withdraw(world, claim, target),
				thin(NOW),
			]);
			const claimId = world.claims[claim]?.id ?? "";
			outcomes.push({
				ok: !result.error,
				present: (await surviving(claimId)).includes(target),
				revoked: await prisma.pluginHealthRevocation.count({
					where: { evidence: { recordId: target } },
				}),
			});
		}
		for (const outcome of outcomes) {
			if (outcome.ok) {
				expect(outcome).toMatchObject({ present: true, revoked: 1 });
			} else {
				expect(outcome).toMatchObject({ present: false, revoked: 0 });
			}
		}
		expect(await chainProblems(world)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// One call at a time
// ---------------------------------------------------------------------------

describe("two calls at once", () => {
	it("return busy for the second, which does nothing, and leave the first to finish", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		const ids = await oldRun(world);
		const held = await holdClaimLock(claimId);

		const first = track(thin(NOW));
		await waitForLockWait(4000);
		const second = await thin(NOW);

		expect(second).toEqual({
			busy: true,
			claimsProcessed: 0,
			more: false,
			recordsRemoved: 0,
			runsRecorded: 0,
		});
		await held.release();
		const done = await first;
		expect(done).toMatchObject({
			busy: false,
			recordsRemoved: 8,
			runsRecorded: 1,
		});
		expect(await surviving(claimId)).toEqual([ids[0], ids[9]]);

		// The lock is not kept once the first call ends.
		expect(await thin(NOW)).toMatchObject({ busy: false, recordsRemoved: 0 });
	});

	it("tell a caller of the route that it is busy, with a normal answer", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await oldRun(world);
		const held = await holdClaimLock(claimId);
		const first = track(thin(NOW));
		await waitForLockWait(4000);

		const { POST } = await import(
			"@/app/api/cron/health-evidence-thinning/route"
		);
		const response = await POST(
			new Request("http://localhost:3000/api/cron/health-evidence-thinning", {
				method: "POST",
				headers: { authorization: `Bearer ${CRON_SECRET}` },
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			dryRun: false,
			busy: true,
			claimsProcessed: 0,
			recordsRemoved: 0,
			runsRecorded: 0,
			more: false,
		});
		await held.release();
		await first;
	});

	it("do not stop a trial run from being refused too", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await oldRun(world);
		const held = await holdClaimLock(claimId);
		const first = track(thin(NOW));
		await waitForLockWait(4000);

		const dry = await thin(NOW, { dryRun: true });

		expect(dry.busy).toBe(true);
		await held.release();
		await first;
	});
});

// ---------------------------------------------------------------------------
// Appends and locks held by others while a call runs
// ---------------------------------------------------------------------------

describe("while a call is writing", () => {
	it("a record appended in the meantime is chained to the kept tail and the list still verifies", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await oldRun(world);
		const tail = (await readRows(claimId)).at(-1);
		const held = await holdClaimLock(claimId);

		const job = track(thin(NOW));
		await waitForLockWait(4000);
		const appending = track(
			put(world, 0, {
				ts: Date.now() - SECOND,
				realClock: true,
			})
		);
		await waitForLockWait(4000, 2);
		await held.release();
		const [, appended] = await Promise.all([job, appending]);

		const rows = await readRows(claimId);
		const last = rows.at(-1);
		expect(last?.recordId).toBe(appended);
		expect(last?.prev).toBe(tail?.hash);
		expect(rows.some((row) => row.id === tail?.id)).toBe(true);
		expect(rows).toHaveLength(3);
		expect(await chainProblems(world)).toEqual([]);
	});

	it("a claim whose lock is held for a long time does not stop the call, the others are thinned, and the next call finishes it", async () => {
		const world = await setupWorld({ claims: 2 });
		await oldRun(world, 0);
		await oldRun(world, 1);
		const blocked = [...world.claims]
			.map((claim) => claim.id)
			.sort()[0] as string;
		const other = world.claims.find((claim) => claim.id !== blocked);
		const held = await holdClaimLock(blocked);

		const job = track(thin(NOW));
		await waitForLockWait(4000);
		await pause(6500);
		await held.release();
		const result = await job;

		// Whether the call gave up on the claim after a while or waited for it, it
		// finished, and the claim that was free was thinned.
		expect(result.busy).toBe(false);
		expect((await surviving(other?.id ?? "")).length).toBe(2);
		expect([2, 10]).toContain((await surviving(blocked)).length);

		await thin(NOW);
		expect((await surviving(blocked)).length).toBe(2);
		expect((await surviving(other?.id ?? "")).length).toBe(2);
		expect(await chainProblems(world)).toEqual([]);
	}, 30_000);

	it("a trial run does not wait for a claim lock and writes nothing", async () => {
		const world = await setupWorld();
		const claimId = world.claims[0]?.id ?? "";
		await oldRun(world);
		const held = await holdClaimLock(claimId);

		const dry = await thin(NOW, { dryRun: true });

		expect(dry).toMatchObject({ busy: false, recordsRemoved: 8 });
		await held.release();
		expect((await surviving(claimId)).length).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

describe("appends, withdrawals and calls running together", () => {
	it.each([
		1, 2,
	])("lose nothing and leave a log a verifier can walk (round %i)", async (round) => {
		const world = await setupWorld({ claims: 3, pipelines: 2 });
		await fillRandomly(world, 500 + round, {
			count: 90,
			start: CUTOFF - 40 * HOUR,
		});
		const everything = await captureLog(world);
		const errors: string[] = [];
		const withdrawn: { claim: number; id: string }[] = [];
		const appended: { claim: number; id: string }[] = [];

		const appender = async () => {
			for (let i = 0; i < 25; i++) {
				const claim = i % 3;
				try {
					const id = await put(world, claim, {
						ts: Date.now() - 1000,
						realClock: true,
						account: i % 2,
					});
					appended.push({ claim, id });
				} catch (error) {
					errors.push(`append: ${String(error)}`);
				}
			}
		};
		const withdrawer = async () => {
			for (let i = 0; i < 25; i++) {
				const claim = i % 3;
				const rows = (await readRows(world.claims[claim]?.id ?? "")).filter(
					(row) => !row.everWithdrawn && row.createdAt < CUTOFF
				);
				const pick = rows[(i * 7) % Math.max(rows.length, 1)];
				if (!pick) {
					continue;
				}
				const result = await withdraw(world, claim, pick.recordId);
				if (!result.error) {
					withdrawn.push({ claim, id: pick.recordId });
				} else if (result.error !== "Record not found") {
					errors.push(`withdraw: ${result.error}`);
				}
			}
		};
		const caller = async () => {
			for (let i = 0; i < 40; i++) {
				const result = await thin(NOW, {
					batchSize: 5 + (i % 4),
					timeBudgetMs: i % 2 ? 0 : 60_000,
				});
				if (result.busy) {
					errors.push("busy");
				}
			}
		};
		await Promise.all([appender(), withdrawer(), caller()]);

		expect(errors).toEqual([]);
		for (const { claim, id } of withdrawn) {
			const rows = await readRows(world.claims[claim]?.id ?? "");
			expect(
				rows.find((row) => row.recordId === id)?.everWithdrawn,
				`withdrawn record ${id}`
			).toBe(true);
		}
		for (const { claim, id } of appended) {
			const rows = await readRows(world.claims[claim]?.id ?? "");
			expect(
				rows.some((row) => row.recordId === id),
				`appended record ${id}`
			).toBe(true);
		}
		expect(await chainProblems(world)).toEqual([]);
		expect(
			await noteProblems(world, unionLog(everything, await captureLog(world)))
		).toEqual([]);
	}, 120_000);
});
