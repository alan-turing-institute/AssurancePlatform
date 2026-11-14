import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";
import { sseConnectionManager } from "../sse-connection-manager";

let nextCase = 0;

/** A case id no other test in this file uses. */
function freshCase(): string {
	nextCase += 1;
	return `live-update-case-${nextCase}`;
}

/** A stand-in for a stream controller whose writes can be made to fail. */
function fakeController() {
	const writes: string[] = [];
	let broken = false;
	const decoder = new TextDecoder();
	const controller = {
		enqueue: vi.fn((chunk: Uint8Array) => {
			if (broken) {
				throw new TypeError("Invalid state: Controller is already closed");
			}
			writes.push(decoder.decode(chunk));
		}),
		close: vi.fn(),
	} as unknown as ReadableStreamDefaultController<Uint8Array>;
	return {
		controller,
		writes,
		breakWrites: () => {
			broken = true;
		},
	};
}

interface Connected {
	breakWrites: () => void;
	id: string;
	onRemove: ReturnType<typeof vi.fn>;
	recheck: ReturnType<typeof vi.fn>;
	writes: string[];
}

function connect(
	caseId: string,
	connectionId: string,
	userId = "user-a",
	recheck: () => void | Promise<void> = () => undefined
): Connected {
	const stub = fakeController();
	const onRemove = vi.fn();
	const recheckMock = vi.fn(recheck);
	sseConnectionManager.addConnection(
		caseId,
		connectionId,
		stub.controller,
		userId,
		onRemove,
		recheckMock
	);
	return {
		id: connectionId,
		writes: stub.writes,
		breakWrites: stub.breakWrites,
		onRemove,
		recheck: recheckMock,
	};
}

function broadcastTo(caseId: string): void {
	sseConnectionManager.broadcast({
		type: "case:updated",
		caseId,
		payload: {},
		timestamp: new Date().toISOString(),
	});
}

function deferred() {
	let resolve!: () => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

let logs: ReturnType<typeof captureLogs>;

beforeEach(() => {
	logs = captureLogs();
});

afterEach(() => {
	logs.restore();
});

function recipientsLogged(): unknown[] {
	return logs.entries
		.filter((entry) => entry.msg === "SSE broadcast event")
		.map((entry) => entry.recipients);
}

describe("the recipients a broadcast reports", () => {
	it("equals the number of connections written to when every write succeeds", () => {
		const caseId = freshCase();
		const connections = ["a", "b", "c"].map((id) => connect(caseId, id));

		broadcastTo(caseId);

		expect(recipientsLogged()).toEqual([3]);
		for (const connection of connections) {
			expect(connection.writes).toHaveLength(1);
		}
	});

	it("counts a dead connection once, not twice", () => {
		const caseId = freshCase();
		const live = [connect(caseId, "a"), connect(caseId, "b")];
		const dead = connect(caseId, "c");
		dead.breakWrites();

		broadcastTo(caseId);

		expect(recipientsLogged()).toEqual([2]);
		expect(live.map((connection) => connection.writes.length)).toEqual([1, 1]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(2);
		expect(dead.onRemove).toHaveBeenCalledTimes(1);
	});

	it("is exactly the live count with several dead connections among many", () => {
		const caseId = freshCase();
		const connections = ["a", "b", "c", "d", "e"].map((id) =>
			connect(caseId, id)
		);
		connections[1]?.breakWrites();
		connections[3]?.breakWrites();

		broadcastTo(caseId);

		expect(recipientsLogged()).toEqual([3]);
	});

	it("is zero, never negative, when every connection is dead", () => {
		const caseId = freshCase();
		for (const id of ["a", "b", "c"]) {
			connect(caseId, id).breakWrites();
		}

		broadcastTo(caseId);

		expect(recipientsLogged()).toEqual([0]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});

	it("falls to the new live count once a dead connection has been removed", () => {
		const caseId = freshCase();
		connect(caseId, "a");
		connect(caseId, "b");
		connect(caseId, "c").breakWrites();

		broadcastTo(caseId);
		broadcastTo(caseId);

		expect(recipientsLogged()).toEqual([2, 2]);
	});
});

describe("a heartbeat to one connection", () => {
	it("writes one comment line to that connection and nothing to the others", () => {
		const caseId = freshCase();
		const target = connect(caseId, "a");
		const others = [connect(caseId, "b"), connect(caseId, "c")];

		sseConnectionManager.sendHeartbeat(caseId, "a");

		expect(target.writes).toEqual([": heartbeat\n\n"]);
		for (const other of others) {
			expect(other.writes).toEqual([]);
		}
	});

	it("is not written to a connection of another case that reuses the connection id", () => {
		const first = freshCase();
		const second = freshCase();
		const onFirst = connect(first, "shared-id");
		const onSecond = connect(second, "shared-id");

		sseConnectionManager.sendHeartbeat(first, "shared-id");

		expect(onFirst.writes).toHaveLength(1);
		expect(onSecond.writes).toHaveLength(0);
	});

	it("does nothing, and does not throw, for a connection or case that is not registered", () => {
		const caseId = freshCase();
		const only = connect(caseId, "a");

		expect(() =>
			sseConnectionManager.sendHeartbeat(caseId, "missing")
		).not.toThrow();
		expect(() =>
			sseConnectionManager.sendHeartbeat("no-such-case", "a")
		).not.toThrow();
		expect(only.writes).toEqual([]);
	});

	it("removes only the connection whose write failed, running its removal callback once", () => {
		const caseId = freshCase();
		const failing = connect(caseId, "a");
		const healthy = connect(caseId, "b");
		failing.breakWrites();

		sseConnectionManager.sendHeartbeat(caseId, "a");
		sseConnectionManager.sendHeartbeat(caseId, "a");

		expect(failing.onRemove).toHaveBeenCalledTimes(1);
		expect(healthy.onRemove).not.toHaveBeenCalled();
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);

		sseConnectionManager.sendHeartbeat(caseId, "b");
		expect(healthy.writes).toEqual([": heartbeat\n\n"]);
	});

	it("costs one write per call however many connections the case has", () => {
		const caseId = freshCase();
		const connections = Array.from({ length: 25 }, (_, index) =>
			connect(caseId, `c-${index}`)
		);

		for (const connection of connections) {
			sseConnectionManager.sendHeartbeat(caseId, connection.id);
		}

		for (const connection of connections) {
			expect(connection.writes).toHaveLength(1);
		}
	});
});

describe("recheckConnections", () => {
	it("checks every connection on a case when given only the case", async () => {
		const caseId = freshCase();
		const otherCase = freshCase();
		const alice = connect(caseId, "a1", "alice");
		const bob = connect(caseId, "b1", "bob");
		const elsewhere = connect(otherCase, "a2", "alice");

		await sseConnectionManager.recheckConnections({ caseId });

		expect(alice.recheck).toHaveBeenCalledTimes(1);
		expect(bob.recheck).toHaveBeenCalledTimes(1);
		expect(elsewhere.recheck).not.toHaveBeenCalled();
	});

	it("checks one user's connections on every case when given only the user", async () => {
		const caseA = freshCase();
		const caseB = freshCase();
		const aliceA = connect(caseA, "a1", "alice");
		const aliceB = connect(caseB, "a2", "alice");
		const bobA = connect(caseA, "b1", "bob");

		await sseConnectionManager.recheckConnections({ userId: "alice" });

		expect(aliceA.recheck).toHaveBeenCalledTimes(1);
		expect(aliceB.recheck).toHaveBeenCalledTimes(1);
		expect(bobA.recheck).not.toHaveBeenCalled();
	});

	it("checks only that user's connections on that case when given both", async () => {
		const caseA = freshCase();
		const caseB = freshCase();
		const aliceTab1 = connect(caseA, "a1", "alice");
		const aliceTab2 = connect(caseA, "a2", "alice");
		const aliceB = connect(caseB, "a3", "alice");
		const bobA = connect(caseA, "b1", "bob");

		await sseConnectionManager.recheckConnections({
			caseId: caseA,
			userId: "alice",
		});

		expect(aliceTab1.recheck).toHaveBeenCalledTimes(1);
		expect(aliceTab2.recheck).toHaveBeenCalledTimes(1);
		expect(aliceB.recheck).not.toHaveBeenCalled();
		expect(bobA.recheck).not.toHaveBeenCalled();
	});

	it("ignores a case or user it holds no connection for", async () => {
		const caseId = freshCase();
		const alice = connect(caseId, "a1", "alice");

		await sseConnectionManager.recheckConnections({ caseId: "no-such-case" });
		await sseConnectionManager.recheckConnections({ userId: "nobody" });
		await sseConnectionManager.recheckConnections({
			caseId,
			userId: "nobody",
		});
		await sseConnectionManager.recheckConnections({
			caseId: "no-such-case",
			userId: "alice",
		});

		expect(alice.recheck).not.toHaveBeenCalled();
	});

	it("refuses a filter that names neither a case nor a user, whatever shape it takes", async () => {
		const caseId = freshCase();
		const alice = connect(caseId, "a1", "alice");
		const bob = connect(freshCase(), "b1", "bob");
		const refused = [
			{},
			{ caseId: undefined, userId: undefined },
			{ caseId: "", userId: "" },
			{ caseId: null, userId: null },
		] as never[];

		for (const filter of refused) {
			await expect(
				sseConnectionManager.recheckConnections(filter)
			).resolves.toBeUndefined();
		}

		expect(alice.recheck).not.toHaveBeenCalled();
		expect(bob.recheck).not.toHaveBeenCalled();
		expect(alice.onRemove).not.toHaveBeenCalled();
	});

	it("does not settle until every check it started has finished", async () => {
		const caseId = freshCase();
		const slow = deferred();
		const fast = connect(caseId, "a1", "alice");
		const held = connect(caseId, "a2", "alice", () => slow.promise);
		let settled = false;

		const call = sseConnectionManager
			.recheckConnections({ caseId })
			.then(() => {
				settled = true;
			});
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(fast.recheck).toHaveBeenCalledTimes(1);
		expect(held.recheck).toHaveBeenCalledTimes(1);
		expect(settled).toBe(false);

		slow.resolve();
		await call;
		expect(settled).toBe(true);
	});

	it("starts the checks together rather than one after another", async () => {
		const caseId = freshCase();
		const gate = deferred();
		const first = connect(caseId, "a1", "alice", () => gate.promise);
		const second = connect(caseId, "a2", "bob", () => gate.promise);

		const call = sseConnectionManager.recheckConnections({ caseId });
		await new Promise<void>((resolve) => setImmediate(resolve));

		expect(first.recheck).toHaveBeenCalledTimes(1);
		expect(second.recheck).toHaveBeenCalledTimes(1);
		gate.resolve();
		await call;
	});

	it("resolves, and still checks the others, when a check rejects or throws", async () => {
		const caseId = freshCase();
		const rejecting = connect(caseId, "a1", "alice", () =>
			Promise.reject(new Error("database down"))
		);
		const throwing = connect(caseId, "a2", "alice", () => {
			throw new Error("synchronous failure");
		});
		const healthy = connect(caseId, "a3", "alice");

		await expect(
			sseConnectionManager.recheckConnections({ caseId })
		).resolves.toBeUndefined();

		expect(rejecting.recheck).toHaveBeenCalledTimes(1);
		expect(throwing.recheck).toHaveBeenCalledTimes(1);
		expect(healthy.recheck).toHaveBeenCalledTimes(1);
	});

	it("skips connections registered without a check, and still checks the rest", async () => {
		const caseId = freshCase();
		const stub = fakeController();
		sseConnectionManager.addConnection(
			caseId,
			"plain",
			stub.controller,
			"alice"
		);
		const other = connect(caseId, "with-check", "alice");

		await expect(
			sseConnectionManager.recheckConnections({ caseId })
		).resolves.toBeUndefined();

		expect(other.recheck).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(2);
	});

	it("still checks every matching connection when a check removes its own connection", async () => {
		const caseId = freshCase();
		const checked: string[] = [];
		for (const id of ["a1", "a2", "a3"]) {
			connect(caseId, id, "alice", () => {
				checked.push(id);
				sseConnectionManager.removeConnection(caseId, id);
			});
		}

		await sseConnectionManager.recheckConnections({
			caseId,
			userId: "alice",
		});

		expect(checked.sort()).toEqual(["a1", "a2", "a3"]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});

	it("does not write anything to the connections it checks", async () => {
		const caseId = freshCase();
		const alice = connect(caseId, "a1", "alice");

		await sseConnectionManager.recheckConnections({ caseId });

		expect(alice.writes).toEqual([]);
	});
});
