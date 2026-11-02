import { describe, expect, it, vi } from "vitest";
import { sseConnectionManager } from "../sse-connection-manager";

/** A stand-in for the stream of one open editor, whose writes can be made to fail. */
function openConnection(options: { failing?: boolean } = {}) {
	return {
		enqueue: () => {
			if (options.failing) {
				throw new TypeError("The stream is closed");
			}
		},
	} as unknown as ReadableStreamDefaultController<Uint8Array>;
}

describe("removing a connection", () => {
	it("runs its cleanup once, however many times it is removed", () => {
		const onRemove = vi.fn();
		sseConnectionManager.addConnection(
			"case-once",
			"a",
			openConnection(),
			"user-1",
			onRemove
		);

		sseConnectionManager.removeConnection("case-once", "a");
		sseConnectionManager.removeConnection("case-once", "a");

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount("case-once")).toBe(0);
	});

	it("runs the cleanup of the connection removed, not of its neighbours", () => {
		const removed = vi.fn();
		const kept = vi.fn();
		sseConnectionManager.addConnection(
			"case-neighbours",
			"a",
			openConnection(),
			"user-1",
			removed
		);
		sseConnectionManager.addConnection(
			"case-neighbours",
			"b",
			openConnection(),
			"user-2",
			kept
		);

		sseConnectionManager.removeConnection("case-neighbours", "a");

		expect(removed).toHaveBeenCalledTimes(1);
		expect(kept).not.toHaveBeenCalled();
		expect(sseConnectionManager.getConnectionCount("case-neighbours")).toBe(1);
	});

	it("runs the cleanup when a broadcast to the connection fails", () => {
		const onRemove = vi.fn();
		sseConnectionManager.addConnection(
			"case-broadcast",
			"a",
			openConnection({ failing: true }),
			"user-1",
			onRemove
		);

		sseConnectionManager.broadcast({
			type: "case:updated",
			caseId: "case-broadcast",
			payload: {},
			timestamp: new Date().toISOString(),
		});

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount("case-broadcast")).toBe(0);
	});

	it("runs the cleanup when a heartbeat to the connection fails", () => {
		const onRemove = vi.fn();
		sseConnectionManager.addConnection(
			"case-heartbeat",
			"a",
			openConnection({ failing: true }),
			"user-1",
			onRemove
		);

		sseConnectionManager.sendHeartbeat("case-heartbeat");

		expect(onRemove).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount("case-heartbeat")).toBe(0);
	});
});
