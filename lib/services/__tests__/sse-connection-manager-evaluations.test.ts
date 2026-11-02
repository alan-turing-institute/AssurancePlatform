import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A production build bundles server actions and route handlers separately,
 * and each bundle evaluates the connection manager module on its own. These
 * tests load the module several times over, as separate bundles do, and check
 * that every evaluation sees the same open connections.
 */

type ManagerModule = typeof import("@/lib/services/sse-connection-manager");

const sharedSlot = globalThis as unknown as { sseConnectionManager?: unknown };

/** One more evaluation of the module, as a separate bundle would make. */
async function evaluate(): Promise<ManagerModule> {
	vi.resetModules();
	return await import("@/lib/services/sse-connection-manager");
}

/** A stand-in for the stream of one open editor, recording what it is sent. */
function openConnection() {
	const received: string[] = [];
	const decoder = new TextDecoder();
	const controller = {
		enqueue: (chunk: Uint8Array) => {
			received.push(decoder.decode(chunk));
		},
	} as unknown as ReadableStreamDefaultController<Uint8Array>;
	return { controller, received };
}

beforeEach(() => {
	Reflect.deleteProperty(sharedSlot, "sseConnectionManager");
});

afterEach(() => {
	vi.unstubAllEnvs();
	Reflect.deleteProperty(sharedSlot, "sseConnectionManager");
});

describe.each(["production", "development", "test"])("in %s mode", (mode) => {
	beforeEach(() => {
		vi.stubEnv("NODE_ENV", mode);
	});

	it("gives every evaluation of the module the same connection manager", async () => {
		const first = await evaluate();
		const second = await evaluate();
		const third = await evaluate();

		expect(second.sseConnectionManager).toBe(first.sseConnectionManager);
		expect(third.sseConnectionManager).toBe(first.sseConnectionManager);
	});

	it("delivers an event emitted through one evaluation to a connection opened through another", async () => {
		const routeBundle = await evaluate();
		const actionBundle = await evaluate();
		const editor = openConnection();
		routeBundle.sseConnectionManager.addConnection(
			"case-1",
			"connection-1",
			editor.controller,
			"user-1"
		);

		actionBundle.emitSSEEvent("case:updated", "case-1", {
			action: "kind-changed",
			kind: "PATTERN",
			userId: "user-2",
		});

		expect(editor.received).toHaveLength(1);
		expect(editor.received[0]).toContain("event: case:updated");
		const data = JSON.parse(editor.received[0]?.split("\ndata: ")[1] ?? "{}");
		expect(data).toMatchObject({
			type: "case:updated",
			caseId: "case-1",
			userId: "user-2",
			payload: { action: "kind-changed", kind: "PATTERN" },
		});
	});

	it("delivers in both directions, whichever evaluation came first", async () => {
		const earlier = await evaluate();
		const later = await evaluate();
		const fromEarlier = openConnection();
		const fromLater = openConnection();
		earlier.sseConnectionManager.addConnection(
			"case-1",
			"a",
			fromEarlier.controller,
			"user-1"
		);
		later.sseConnectionManager.addConnection(
			"case-1",
			"b",
			fromLater.controller,
			"user-2"
		);

		earlier.emitSSEEvent("case:updated", "case-1", { n: 1 });
		later.emitSSEEvent("case:updated", "case-1", { n: 2 });

		expect(fromEarlier.received).toHaveLength(2);
		expect(fromLater.received).toHaveLength(2);
	});

	it("shows the same connection count and users to every evaluation, and lets any of them close a connection", async () => {
		const first = await evaluate();
		const second = await evaluate();
		first.sseConnectionManager.addConnection(
			"case-1",
			"a",
			openConnection().controller,
			"user-1"
		);
		second.sseConnectionManager.addConnection(
			"case-1",
			"b",
			openConnection().controller,
			"user-2"
		);

		expect(first.sseConnectionManager.getConnectionCount("case-1")).toBe(2);
		expect(second.sseConnectionManager.getConnectionCount("case-1")).toBe(2);
		expect(
			second.sseConnectionManager.getConnectedUsers("case-1").sort()
		).toEqual(["user-1", "user-2"]);

		second.sseConnectionManager.removeConnection("case-1", "a");

		expect(first.sseConnectionManager.getConnectionCount("case-1")).toBe(1);
	});

	it("keeps the events of one case away from the connections of another", async () => {
		const routeBundle = await evaluate();
		const actionBundle = await evaluate();
		const watchingOne = openConnection();
		const watchingTwo = openConnection();
		routeBundle.sseConnectionManager.addConnection(
			"case-1",
			"a",
			watchingOne.controller,
			"user-1"
		);
		routeBundle.sseConnectionManager.addConnection(
			"case-2",
			"b",
			watchingTwo.controller,
			"user-1"
		);

		actionBundle.emitSSEEvent("case:updated", "case-1", { n: 1 });

		expect(watchingOne.received).toHaveLength(1);
		expect(watchingTwo.received).toHaveLength(0);
	});

	it("does not replace the shared manager when a later evaluation loads", async () => {
		const first = await evaluate();
		const editor = openConnection();
		first.sseConnectionManager.addConnection(
			"case-1",
			"a",
			editor.controller,
			"user-1"
		);

		await evaluate();
		await evaluate();

		expect(sharedSlot.sseConnectionManager).toBe(first.sseConnectionManager);
		expect(first.sseConnectionManager.getConnectionCount("case-1")).toBe(1);
	});
});

describe("the shared slot", () => {
	it("holds the manager once the module has loaded in production", async () => {
		vi.stubEnv("NODE_ENV", "production");

		const loaded = await evaluate();

		expect(sharedSlot.sseConnectionManager).toBe(loaded.sseConnectionManager);
	});

	it("is reused when it already holds a manager before the module loads", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const loaded = await evaluate();
		const editor = openConnection();
		loaded.sseConnectionManager.addConnection(
			"case-1",
			"a",
			editor.controller,
			"user-1"
		);

		const reloaded = await evaluate();
		reloaded.emitSSEEvent("case:updated", "case-1", {});

		expect(reloaded.sseConnectionManager).toBe(loaded.sseConnectionManager);
		expect(editor.received).toHaveLength(1);
	});
});
