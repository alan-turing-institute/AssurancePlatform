import { describe, expect, it, vi } from "vitest";
import {
	type RecheckFilter,
	sseConnectionManager,
} from "../sse-connection-manager";

let nextCase = 0;

/** A case id no other test in this file uses. */
function freshCase(): string {
	nextCase += 1;
	return `recheck-case-${nextCase}`;
}

/** Registers a connection whose re-check is a spy, and returns the spy. */
function connect(caseId: string, connectionId: string, userId: string) {
	const recheck = vi.fn();
	sseConnectionManager.addConnection(
		caseId,
		connectionId,
		{
			enqueue: vi.fn(),
		} as unknown as ReadableStreamDefaultController<Uint8Array>,
		userId,
		undefined,
		recheck
	);
	return recheck;
}

/** Two cases, each with two users, and one connection for every pair. */
function twoByTwo() {
	const [caseA, caseB] = [freshCase(), freshCase()] as const;
	const [alice, bob] = [`alice-${caseA}`, `bob-${caseA}`] as const;
	return {
		caseA,
		caseB,
		alice,
		bob,
		aliceOnA: connect(caseA, "alice-a", alice),
		bobOnA: connect(caseA, "bob-a", bob),
		aliceOnB: connect(caseB, "alice-b", alice),
		bobOnB: connect(caseB, "bob-b", bob),
	};
}

describe("sseConnectionManager re-checks", () => {
	it("re-checks every connection on a case, and none on another case", async () => {
		const world = twoByTwo();

		await sseConnectionManager.recheckConnections({ caseId: world.caseA });

		expect(world.aliceOnA).toHaveBeenCalledTimes(1);
		expect(world.bobOnA).toHaveBeenCalledTimes(1);
		expect(world.aliceOnB).not.toHaveBeenCalled();
		expect(world.bobOnB).not.toHaveBeenCalled();
	});

	it("re-checks every connection of a user, on every case, and none of anyone else's", async () => {
		const world = twoByTwo();

		await sseConnectionManager.recheckConnections({ userId: world.alice });

		expect(world.aliceOnA).toHaveBeenCalledTimes(1);
		expect(world.aliceOnB).toHaveBeenCalledTimes(1);
		expect(world.bobOnA).not.toHaveBeenCalled();
		expect(world.bobOnB).not.toHaveBeenCalled();
	});

	it("re-checks only the connections of one user on one case when given both", async () => {
		const world = twoByTwo();

		await sseConnectionManager.recheckConnections({
			caseId: world.caseB,
			userId: world.bob,
		});

		expect(world.bobOnB).toHaveBeenCalledTimes(1);
		expect(world.aliceOnA).not.toHaveBeenCalled();
		expect(world.bobOnA).not.toHaveBeenCalled();
		expect(world.aliceOnB).not.toHaveBeenCalled();
	});

	it("re-checks each of a user's several connections to a case", async () => {
		const caseId = freshCase();
		const first = connect(caseId, "tab-1", "carol");
		const second = connect(caseId, "tab-2", "carol");

		await sseConnectionManager.recheckConnections({ caseId, userId: "carol" });

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("ignores a case or user it has no connection for", async () => {
		const world = twoByTwo();

		await sseConnectionManager.recheckConnections({ caseId: freshCase() });
		await sseConnectionManager.recheckConnections({ userId: "nobody" });
		await sseConnectionManager.recheckConnections({
			caseId: world.caseA,
			userId: "nobody",
		});
		await sseConnectionManager.recheckConnections({
			caseId: freshCase(),
			userId: world.alice,
		});

		for (const recheck of [
			world.aliceOnA,
			world.bobOnA,
			world.aliceOnB,
			world.bobOnB,
		]) {
			expect(recheck).not.toHaveBeenCalled();
		}
	});

	it("never re-checks every connection: a filter that names neither a case nor a user matches nothing", async () => {
		const world = twoByTwo();

		await sseConnectionManager.recheckConnections({} as RecheckFilter);
		await sseConnectionManager.recheckConnections({
			caseId: "",
			userId: "",
		} as RecheckFilter);

		for (const recheck of [
			world.aliceOnA,
			world.bobOnA,
			world.aliceOnB,
			world.bobOnB,
		]) {
			expect(recheck).not.toHaveBeenCalled();
		}
	});

	it("skips a connection that was added without a re-check", async () => {
		const caseId = freshCase();
		sseConnectionManager.addConnection(
			caseId,
			"plain",
			{
				enqueue: vi.fn(),
			} as unknown as ReadableStreamDefaultController<Uint8Array>,
			"dave"
		);
		const other = connect(caseId, "other", "dave");

		await sseConnectionManager.recheckConnections({ caseId });

		expect(other).toHaveBeenCalledTimes(1);
	});

	it("does not re-check a connection that has been removed", async () => {
		const caseId = freshCase();
		const gone = connect(caseId, "gone", "erin");
		const kept = connect(caseId, "kept", "erin");
		sseConnectionManager.removeConnection(caseId, "gone");

		await sseConnectionManager.recheckConnections({ caseId });

		expect(gone).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledTimes(1);
	});

	it("starts every re-check at once and settles only when all have finished", async () => {
		const caseId = freshCase();
		const slow = Promise.withResolvers<void>();
		const slowRecheck = vi.fn(() => slow.promise);
		sseConnectionManager.addConnection(
			caseId,
			"slow",
			{
				enqueue: vi.fn(),
			} as unknown as ReadableStreamDefaultController<Uint8Array>,
			"frank",
			undefined,
			slowRecheck
		);
		const quick = connect(caseId, "quick", "frank");
		let settled = false;

		const pending = sseConnectionManager
			.recheckConnections({ caseId })
			.then(() => {
				settled = true;
			});
		await Promise.resolve();

		expect(slowRecheck).toHaveBeenCalledTimes(1);
		expect(quick).toHaveBeenCalledTimes(1);
		expect(settled).toBe(false);

		slow.resolve();
		await pending;
		expect(settled).toBe(true);
	});

	it("still re-checks the other connections when one re-check throws or rejects", async () => {
		const caseId = freshCase();
		const throwing = vi.fn(() => {
			throw new Error("synchronous failure");
		});
		const rejecting = vi.fn(() => Promise.reject(new Error("late failure")));
		const healthy = connect(caseId, "healthy", "gina");
		for (const [id, recheck] of [
			["throwing", throwing],
			["rejecting", rejecting],
		] as const) {
			sseConnectionManager.addConnection(
				caseId,
				id,
				{
					enqueue: vi.fn(),
				} as unknown as ReadableStreamDefaultController<Uint8Array>,
				"gina",
				undefined,
				recheck
			);
		}

		await expect(
			sseConnectionManager.recheckConnections({ caseId })
		).resolves.toBeUndefined();

		expect(throwing).toHaveBeenCalledTimes(1);
		expect(rejecting).toHaveBeenCalledTimes(1);
		expect(healthy).toHaveBeenCalledTimes(1);
	});
});
