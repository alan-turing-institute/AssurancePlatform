import { describe, expect, it, vi } from "vitest";
import { sseConnectionManager } from "../sse-connection-manager";

let nextCase = 0;

/** A case id no other test in this file uses. */
function freshCase(): string {
	nextCase += 1;
	return `removal-case-${nextCase}`;
}

/** A stand-in for a stream controller whose writes can be made to fail. */
function fakeController() {
	const writes: string[] = [];
	let broken = false;
	const decoder = new TextDecoder();
	const enqueue = vi.fn((chunk: Uint8Array) => {
		if (broken) {
			throw new TypeError("Invalid state: Controller is already closed");
		}
		writes.push(decoder.decode(chunk));
	});
	const controller = {
		enqueue,
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

/** Registers one connection and returns what the test needs to observe it. */
function connect(caseId: string, connectionId: string, userId = "user-a") {
	const stub = fakeController();
	const onRemove = vi.fn();
	sseConnectionManager.addConnection(
		caseId,
		connectionId,
		stub.controller,
		userId,
		onRemove
	);
	return { ...stub, onRemove };
}

function broadcastTo(caseId: string): void {
	sseConnectionManager.broadcast({
		type: "case:updated",
		caseId,
		payload: {},
		timestamp: new Date().toISOString(),
	});
}

describe("sseConnectionManager removal callback", () => {
	it("runs once however many times the connection is removed", () => {
		const caseId = freshCase();
		const a = connect(caseId, "a");

		sseConnectionManager.removeConnection(caseId, "a");
		sseConnectionManager.removeConnection(caseId, "a");
		sseConnectionManager.removeConnection(caseId, "a");

		expect(a.onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});

	it("runs only for the connection removed, and the others keep receiving", () => {
		const caseId = freshCase();
		const a = connect(caseId, "a");
		const b = connect(caseId, "b", "user-b");

		sseConnectionManager.removeConnection(caseId, "a");
		broadcastTo(caseId);

		expect(a.onRemove).toHaveBeenCalledTimes(1);
		expect(b.onRemove).not.toHaveBeenCalled();
		expect(a.writes).toHaveLength(0);
		expect(b.writes).toHaveLength(1);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual(["user-b"]);
	});

	it("does not run when the connection id is removed under another case", () => {
		const caseId = freshCase();
		const otherCase = freshCase();
		const a = connect(caseId, "a");

		sseConnectionManager.removeConnection(otherCase, "a");

		expect(a.onRemove).not.toHaveBeenCalled();
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);
	});

	it("ignores a connection or case it has never seen", () => {
		const caseId = freshCase();
		const a = connect(caseId, "a");

		expect(() => {
			sseConnectionManager.removeConnection(freshCase(), "ghost");
			sseConnectionManager.removeConnection(caseId, "ghost");
		}).not.toThrow();

		expect(a.onRemove).not.toHaveBeenCalled();
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);
	});

	it("is not run again when the callback itself removes the connection", () => {
		const caseId = freshCase();
		const onRemove = vi.fn(() => {
			sseConnectionManager.removeConnection(caseId, "a");
		});
		sseConnectionManager.addConnection(
			caseId,
			"a",
			fakeController().controller,
			"user-a",
			onRemove
		);

		sseConnectionManager.removeConnection(caseId, "a");

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});

	it("still lets a connection added without a callback be removed", () => {
		const caseId = freshCase();
		sseConnectionManager.addConnection(
			caseId,
			"a",
			fakeController().controller,
			"user-a"
		);

		expect(() =>
			sseConnectionManager.removeConnection(caseId, "a")
		).not.toThrow();
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});
});

describe("sseConnectionManager failed writes", () => {
	it("removes a connection whose write fails in a broadcast, runs its callback once and keeps the healthy one", () => {
		const caseId = freshCase();
		const dead = connect(caseId, "dead");
		const live = connect(caseId, "live", "user-b");
		dead.breakWrites();

		broadcastTo(caseId);

		expect(dead.onRemove).toHaveBeenCalledTimes(1);
		expect(live.onRemove).not.toHaveBeenCalled();
		expect(live.writes).toHaveLength(1);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual(["user-b"]);
	});

	it("removes a connection whose write fails in a heartbeat, runs its callback once and keeps the healthy one", () => {
		const caseId = freshCase();
		const dead = connect(caseId, "dead");
		const live = connect(caseId, "live", "user-b");
		dead.breakWrites();

		sseConnectionManager.sendHeartbeat(caseId);

		expect(dead.onRemove).toHaveBeenCalledTimes(1);
		expect(live.onRemove).not.toHaveBeenCalled();
		expect(live.writes).toEqual([": heartbeat\n\n"]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(1);
	});

	it("runs the callback once in total when a dead connection is met by a broadcast, a heartbeat and an explicit removal", () => {
		const caseId = freshCase();
		const dead = connect(caseId, "dead");
		const live = connect(caseId, "live", "user-b");
		dead.breakWrites();

		broadcastTo(caseId);
		sseConnectionManager.sendHeartbeat(caseId);
		broadcastTo(caseId);
		sseConnectionManager.removeConnection(caseId, "dead");

		expect(dead.onRemove).toHaveBeenCalledTimes(1);
		expect(live.onRemove).not.toHaveBeenCalled();
		expect(live.writes).toHaveLength(3);
	});

	it("removes every dead connection in one pass and leaves the case empty", () => {
		const caseId = freshCase();
		const stubs = ["a", "b", "c"].map((id) => connect(caseId, id));
		for (const stub of stubs) {
			stub.breakWrites();
		}

		broadcastTo(caseId);

		for (const stub of stubs) {
			expect(stub.onRemove).toHaveBeenCalledTimes(1);
		}
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual([]);

		// The case entry is gone, so a later heartbeat has nothing to write to.
		expect(() => sseConnectionManager.sendHeartbeat(caseId)).not.toThrow();
		for (const stub of stubs) {
			expect(stub.onRemove).toHaveBeenCalledTimes(1);
		}
	});
});

describe("sseConnectionManager open and close cycles", () => {
	it("runs every connection's callback exactly once across many cycles that end in different ways", () => {
		const caseId = freshCase();
		const endings = ["remove", "broadcast", "heartbeat", "remove-twice"];
		const stubs: ReturnType<typeof connect>[] = [];

		for (let i = 0; i < 120; i += 1) {
			const id = `c${i}`;
			const stub = connect(caseId, id, `user-${i % 5}`);
			stubs.push(stub);
			const ending = endings[i % endings.length];
			if (ending === "broadcast") {
				stub.breakWrites();
				broadcastTo(caseId);
			} else if (ending === "heartbeat") {
				stub.breakWrites();
				sseConnectionManager.sendHeartbeat(caseId);
			} else {
				sseConnectionManager.removeConnection(caseId, id);
				if (ending === "remove-twice") {
					sseConnectionManager.removeConnection(caseId, id);
				}
			}
			expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
		}

		expect(stubs).toHaveLength(120);
		for (const stub of stubs) {
			expect(stub.onRemove).toHaveBeenCalledTimes(1);
		}
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual([]);
	});

	it("counts the same user's several connections separately and releases them one at a time", () => {
		const caseId = freshCase();
		const first = connect(caseId, "tab-1", "user-a");
		const second = connect(caseId, "tab-2", "user-a");

		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(2);
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual(["user-a"]);

		sseConnectionManager.removeConnection(caseId, "tab-1");
		expect(first.onRemove).toHaveBeenCalledTimes(1);
		expect(second.onRemove).not.toHaveBeenCalled();
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual(["user-a"]);

		sseConnectionManager.removeConnection(caseId, "tab-2");
		expect(second.onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectedUsers(caseId)).toEqual([]);
	});
});
