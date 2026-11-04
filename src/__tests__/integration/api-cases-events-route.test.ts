import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
	emitSSEEvent,
	sseConnectionManager,
} from "@/lib/services/sse-connection-manager";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/sse-heartbeat";
import { mockAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * GET /api/cases/[id]/events: what ends a stream, and what a heartbeat does
 * to the one it keeps. Only the interval timers are faked, so a heartbeat is
 * reached by advancing the clock while the database answers in real time.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// Wraps the real access check so a test can make one call fail or stall;
// every other call runs the real check against the database.
vi.mock("@/lib/permissions", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/permissions")>();
	return { ...actual, canAccessCase: vi.fn(actual.canAccessCase) };
});

// Each stream's heartbeat period is random. These tests reach a heartbeat by
// advancing the clock by exactly one period, so it is pinned to the interval.
vi.mock("@/lib/sse-heartbeat", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/sse-heartbeat")>();
	return {
		...actual,
		heartbeatPeriodMs: vi.fn(() => actual.HEARTBEAT_INTERVAL_MS),
	};
});

const HEARTBEAT_MS = HEARTBEAT_INTERVAL_MS;
const CLOSING_EVENT = "event: stream:closed";
const decoder = new TextDecoder();

interface OpenedStream {
	abort: AbortController;
	chunks: string[];
	ended: boolean;
	reader: ReadableStreamDefaultReader<Uint8Array>;
	text(): string;
}

const opened: OpenedStream[] = [];
let logged: LogEntry[] = [];
let timersBeforeOpening = 0;

async function drain(stream: OpenedStream) {
	try {
		for (;;) {
			const { done, value } = await stream.reader.read();
			if (done) {
				break;
			}
			stream.chunks.push(decoder.decode(value));
		}
	} catch {
		// A stream that errors has ended as well.
	}
	stream.ended = true;
}

async function openStream(caseId: string, userId: string) {
	await mockAuth(userId);
	const { GET } = await import("@/app/api/cases/[id]/events/route");
	const abort = new AbortController();
	const response = await GET(
		new Request(`http://localhost:3000/api/cases/${caseId}/events`, {
			signal: abort.signal,
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
	if (!response.body) {
		throw new Error(`The stream did not open: ${response.status}`);
	}
	const stream: OpenedStream = {
		abort,
		chunks: [],
		ended: false,
		reader: response.body.getReader(),
		text: () => stream.chunks.join(""),
	};
	opened.push(stream);
	drain(stream);
	// The access check made on opening is not one of a heartbeat's.
	vi.mocked(canAccessCase).mockClear();
	return stream;
}

function heartbeatsIn(stream: OpenedStream) {
	return stream.text().split(": heartbeat").length - 1;
}

/** Waits, in real time, for something the server does asynchronously. */
async function until(condition: () => boolean) {
	const deadline = Date.now() + 5000;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error("Timed out waiting for the stream");
		}
		await new Promise((resolve) => setImmediate(resolve));
	}
}

/** Lets the continuations of a finished access check run. */
async function afterChecks() {
	const results = vi.mocked(canAccessCase).mock.results;
	await Promise.allSettled(results.map((result) => result.value));
	await new Promise((resolve) => setImmediate(resolve));
}

/** Advances one heartbeat and waits for the access checks it starts to finish. */
async function beat(expectedChecks: number) {
	const callsBefore = vi.mocked(canAccessCase).mock.calls.length;
	await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
	await until(
		() =>
			vi.mocked(canAccessCase).mock.calls.length >= callsBefore + expectedChecks
	);
	await afterChecks();
}

async function caseWithViewer() {
	const owner = await createTestUser();
	const viewer = await createTestUser();
	const assuranceCase = await createTestCase(owner.id);
	const permission = await createTestPermission(
		assuranceCase.id,
		viewer.id,
		owner.id,
		"VIEW"
	);
	return { owner, viewer, assuranceCase, permission };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	timersBeforeOpening = vi.getTimerCount();
	logged = [];
	vi.stubEnv("LOG_LEVEL", "debug");
	setLogSink((entry) => logged.push(entry));
});

afterEach(async () => {
	for (const stream of opened.splice(0)) {
		await stream.reader.cancel().catch(() => undefined);
	}
	vi.clearAllTimers();
	vi.useRealTimers();
	resetLogSink();
	vi.unstubAllEnvs();
});

describe("a stream the client or the request ends", () => {
	it("is removed, with its heartbeat timer, when the client closes the stream", async () => {
		const owner = await createTestUser();
		const assuranceCase = await createTestCase(owner.id);
		const stream = await openStream(assuranceCase.id, owner.id);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(1);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening + 1);

		await stream.reader.cancel();

		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening);
	});

	it("is removed, with its heartbeat timer, when the request is aborted", async () => {
		const owner = await createTestUser();
		const assuranceCase = await createTestCase(owner.id);
		const stream = await openStream(assuranceCase.id, owner.id);

		stream.abort.abort();
		await until(() => stream.ended);

		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening);
	});

	it("leaves the other viewers' streams and timers alone", async () => {
		const { owner, viewer, assuranceCase } = await caseWithViewer();
		const first = await openStream(assuranceCase.id, owner.id);
		const second = await openStream(assuranceCase.id, viewer.id);

		await second.reader.cancel();
		emitSSEEvent("case:updated", assuranceCase.id, { action: "later" });
		await until(() => first.text().includes("event: case:updated"));

		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(1);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening + 1);
		expect(first.ended).toBe(false);
	});
});

describe("a heartbeat on a stream whose user may still view the case", () => {
	it("keeps every stream open and checks each connection once", async () => {
		const { owner, viewer, assuranceCase } = await caseWithViewer();
		const ownerStream = await openStream(assuranceCase.id, owner.id);
		const viewerStream = await openStream(assuranceCase.id, viewer.id);

		await beat(2);

		expect(vi.mocked(canAccessCase)).toHaveBeenCalledTimes(2);
		expect(vi.mocked(canAccessCase)).toHaveBeenCalledWith(
			{ userId: viewer.id, caseId: assuranceCase.id },
			"VIEW"
		);
		expect(ownerStream.ended).toBe(false);
		expect(viewerStream.ended).toBe(false);
		expect(heartbeatsIn(ownerStream)).toBe(1);
		expect(heartbeatsIn(viewerStream)).toBe(1);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(2);

		emitSSEEvent("case:updated", assuranceCase.id, { action: "later" });
		await until(
			() =>
				ownerStream.text().includes("event: case:updated") &&
				viewerStream.text().includes("event: case:updated")
		);
	});
});

describe("a heartbeat on a stream whose user has lost access", () => {
	it("closes that stream and sends it nothing more, while the others carry on", async () => {
		const { owner, viewer, assuranceCase, permission } = await caseWithViewer();
		const ownerStream = await openStream(assuranceCase.id, owner.id);
		const viewerStream = await openStream(assuranceCase.id, viewer.id);
		await prisma.casePermission.delete({ where: { id: permission.id } });

		await beat(2);
		await until(() => viewerStream.ended);

		expect(ownerStream.ended).toBe(false);
		expect(viewerStream.text()).toContain(CLOSING_EVENT);
		expect(ownerStream.text()).not.toContain(CLOSING_EVENT);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(1);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening + 1);

		emitSSEEvent("case:updated", assuranceCase.id, { action: "later" });
		await until(() => ownerStream.text().includes("event: case:updated"));
		expect(viewerStream.text()).not.toContain("event: case:updated");
	});

	it("closes every stream when the case is trashed", async () => {
		const { owner, viewer, assuranceCase } = await caseWithViewer();
		const ownerStream = await openStream(assuranceCase.id, owner.id);
		const viewerStream = await openStream(assuranceCase.id, viewer.id);
		await prisma.assuranceCase.update({
			where: { id: assuranceCase.id },
			data: { deletedAt: new Date() },
		});

		await beat(2);
		await until(() => ownerStream.ended && viewerStream.ended);

		expect(ownerStream.text()).toContain(CLOSING_EVENT);
		expect(viewerStream.text()).toContain(CLOSING_EVENT);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening);
	});

	it("closes every stream when the case is deleted", async () => {
		const { owner, viewer, assuranceCase } = await caseWithViewer();
		const ownerStream = await openStream(assuranceCase.id, owner.id);
		const viewerStream = await openStream(assuranceCase.id, viewer.id);
		await prisma.assuranceCase.delete({ where: { id: assuranceCase.id } });

		await beat(2);
		await until(() => ownerStream.ended && viewerStream.ended);

		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
		expect(vi.getTimerCount()).toBe(timersBeforeOpening);
	});
});

describe("a heartbeat whose access check does not finish cleanly", () => {
	it("keeps the stream and logs when the check fails, then checks again at the next heartbeat", async () => {
		const { viewer, assuranceCase, permission } = await caseWithViewer();
		const stream = await openStream(assuranceCase.id, viewer.id);
		vi.mocked(canAccessCase).mockRejectedValueOnce(
			new Error("connection reset")
		);

		await beat(1);

		expect(stream.ended).toBe(false);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(1);
		expect(
			logged.filter(
				(entry) =>
					entry.level === "warn" && String(entry.msg).includes("keeping stream")
			)
		).toHaveLength(1);

		await prisma.casePermission.delete({ where: { id: permission.id } });
		await beat(1);
		await until(() => stream.ended);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
	});

	it("still sends the heartbeat, and starts no second check, while one is running", async () => {
		const { viewer, assuranceCase } = await caseWithViewer();
		const stream = await openStream(assuranceCase.id, viewer.id);
		let finishCheck: (allowed: boolean) => void = () => undefined;
		vi.mocked(canAccessCase).mockImplementationOnce(
			() =>
				new Promise<boolean>((resolve) => {
					finishCheck = resolve;
				})
		);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => heartbeatsIn(stream) === 1);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => heartbeatsIn(stream) === 2);

		expect(vi.mocked(canAccessCase)).toHaveBeenCalledTimes(1);

		finishCheck(true);
		await afterChecks();
		await beat(1);

		expect(vi.mocked(canAccessCase)).toHaveBeenCalledTimes(2);
		expect(stream.ended).toBe(false);
	});
});

describe("a heartbeat whose access check never settles", () => {
	beforeEach(() => {
		// The check's time limit is a timeout, so the timeout functions are
		// faked as well. Nothing here reaches the database once the stream is open.
		vi.useRealTimers();
		vi.useFakeTimers({
			toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"],
		});
	});

	it("gives up on the check at the time limit, keeps the stream, and checks again at the next heartbeat", async () => {
		const { viewer, assuranceCase } = await caseWithViewer();
		const stream = await openStream(assuranceCase.id, viewer.id);
		const keepingOpen = () =>
			logged.filter(
				(entry) =>
					entry.level === "warn" && String(entry.msg).includes("keeping stream")
			);
		vi.mocked(canAccessCase)
			.mockImplementationOnce(() => new Promise<boolean>(() => undefined))
			.mockResolvedValueOnce(false);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		expect(vi.mocked(canAccessCase)).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(9999);
		expect(keepingOpen()).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1);
		expect(keepingOpen()).toHaveLength(1);
		expect(stream.ended).toBe(false);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(1);

		// The stalled check no longer blocks the next one, which finds access gone.
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 10_000);
		expect(vi.mocked(canAccessCase)).toHaveBeenCalledTimes(2);
		await until(() => stream.ended);
		expect(sseConnectionManager.getConnectionCount(assuranceCase.id)).toBe(0);
	});
});
