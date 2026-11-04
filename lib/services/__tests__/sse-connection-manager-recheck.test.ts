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
	it("re-checks every connection on a case, and none on another case", () => {
		const world = twoByTwo();

		sseConnectionManager.recheckConnections({ caseId: world.caseA });

		expect(world.aliceOnA).toHaveBeenCalledTimes(1);
		expect(world.bobOnA).toHaveBeenCalledTimes(1);
		expect(world.aliceOnB).not.toHaveBeenCalled();
		expect(world.bobOnB).not.toHaveBeenCalled();
	});

	it("re-checks every connection of a user, on every case, and none of anyone else's", () => {
		const world = twoByTwo();

		sseConnectionManager.recheckConnections({ userId: world.alice });

		expect(world.aliceOnA).toHaveBeenCalledTimes(1);
		expect(world.aliceOnB).toHaveBeenCalledTimes(1);
		expect(world.bobOnA).not.toHaveBeenCalled();
		expect(world.bobOnB).not.toHaveBeenCalled();
	});

	it("re-checks only the connections of one user on one case when given both", () => {
		const world = twoByTwo();

		sseConnectionManager.recheckConnections({
			caseId: world.caseB,
			userId: world.bob,
		});

		expect(world.bobOnB).toHaveBeenCalledTimes(1);
		expect(world.aliceOnA).not.toHaveBeenCalled();
		expect(world.bobOnA).not.toHaveBeenCalled();
		expect(world.aliceOnB).not.toHaveBeenCalled();
	});

	it("re-checks each of a user's several connections to a case", () => {
		const caseId = freshCase();
		const first = connect(caseId, "tab-1", "carol");
		const second = connect(caseId, "tab-2", "carol");

		sseConnectionManager.recheckConnections({ caseId, userId: "carol" });

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("ignores a case or user it has no connection for", () => {
		const world = twoByTwo();

		expect(() => {
			sseConnectionManager.recheckConnections({ caseId: freshCase() });
			sseConnectionManager.recheckConnections({ userId: "nobody" });
			sseConnectionManager.recheckConnections({
				caseId: world.caseA,
				userId: "nobody",
			});
			sseConnectionManager.recheckConnections({
				caseId: freshCase(),
				userId: world.alice,
			});
		}).not.toThrow();

		for (const recheck of [
			world.aliceOnA,
			world.bobOnA,
			world.aliceOnB,
			world.bobOnB,
		]) {
			expect(recheck).not.toHaveBeenCalled();
		}
	});

	it("never re-checks every connection: a filter that names neither a case nor a user matches nothing", () => {
		const world = twoByTwo();

		sseConnectionManager.recheckConnections({} as RecheckFilter);
		sseConnectionManager.recheckConnections({
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

	it("skips a connection that was added without a re-check", () => {
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

		expect(() =>
			sseConnectionManager.recheckConnections({ caseId })
		).not.toThrow();

		expect(other).toHaveBeenCalledTimes(1);
	});

	it("does not re-check a connection that has been removed", () => {
		const caseId = freshCase();
		const gone = connect(caseId, "gone", "erin");
		const kept = connect(caseId, "kept", "erin");
		sseConnectionManager.removeConnection(caseId, "gone");

		sseConnectionManager.recheckConnections({ caseId });

		expect(gone).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledTimes(1);
	});

	it("returns without waiting for a re-check to finish", () => {
		const caseId = freshCase();
		const recheck = vi.fn(() => new Promise<void>(() => undefined));
		sseConnectionManager.addConnection(
			caseId,
			"slow",
			{
				enqueue: vi.fn(),
			} as unknown as ReadableStreamDefaultController<Uint8Array>,
			"frank",
			undefined,
			recheck
		);

		sseConnectionManager.recheckConnections({ caseId });

		expect(recheck).toHaveBeenCalledTimes(1);
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

		expect(() =>
			sseConnectionManager.recheckConnections({ caseId })
		).not.toThrow();
		await Promise.resolve();

		expect(throwing).toHaveBeenCalledTimes(1);
		expect(rejecting).toHaveBeenCalledTimes(1);
		expect(healthy).toHaveBeenCalledTimes(1);
	});
});
