import { randomUUID } from "node:crypto";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { GET } from "@/app/api/cases/[id]/events/route";
import { canAccessCase } from "@/lib/permissions";
import {
	revokeTeamPermission,
	revokeUserPermission,
} from "@/lib/services/case-permission-service";
import { purgeCase, softDeleteCase } from "@/lib/services/case-trash-service";
import {
	emitSSEEvent,
	sseConnectionManager,
} from "@/lib/services/sse-connection-manager";
import { leaveTeam, removeMember } from "@/lib/services/team-member-service";
import { deleteTeam } from "@/lib/services/team-service";
import type { User } from "@/src/generated/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// Every call still reaches the real permission logic and the real database;
// the wrapper only records calls and lets a test hold back or fail one answer.
vi.mock("@/lib/permissions", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/permissions")>();
	return { ...actual, canAccessCase: vi.fn(actual.canAccessCase) };
});

const HEARTBEAT_MS = 30_000;
const ACCESS_LOG = /access lost|keeping stream open/;
const KEEPING_OPEN = /keeping stream open/;
const EVENT_LINE = /^event: (.+)$/gm;
const canAccess = vi.mocked(canAccessCase);

// ---------------------------------------------------------------------------
// Timers: only the interval timers are faked, so the database driver and the
// polling helpers below keep real time.
// ---------------------------------------------------------------------------

let setIntervalSpy: MockInstance<typeof globalThis.setInterval>;
let clearIntervalSpy: MockInstance<typeof globalThis.clearInterval>;
let enqueueSpy: { mockRestore: () => void } | null = null;
let baselineTimers = 0;
let logs: ReturnType<typeof captureLogs>;
const opened: Viewer[] = [];
// Errors thrown from an abort listener surface as uncaught exceptions.
const uncaught: unknown[] = [];
const recordUncaught = (error: unknown) => {
	uncaught.push(error);
};

beforeEach(() => {
	uncaught.length = 0;
	process.on("uncaughtException", recordUncaught);
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	setIntervalSpy = vi.spyOn(globalThis, "setInterval");
	clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
	baselineTimers = vi.getTimerCount();
	canAccess.mockReset();
	logs = captureLogs();
});

afterEach(async () => {
	for (const viewer of opened.splice(0)) {
		await viewer.cancel();
	}
	process.off("uncaughtException", recordUncaught);
	enqueueSpy?.mockRestore();
	enqueueSpy = null;
	logs.restore();
	setIntervalSpy.mockRestore();
	clearIntervalSpy.mockRestore();
	vi.clearAllTimers();
	vi.useRealTimers();
	await mockNoAuth();
});

/** Heartbeat timers that are still pending. */
function liveTimers(): number {
	return vi.getTimerCount() - baselineTimers;
}

/** How many times each heartbeat timer ever started has been cleared. */
function clearCounts(): number[] {
	const started = setIntervalSpy.mock.calls.flatMap((call, index) => {
		const result = setIntervalSpy.mock.results[index];
		return call[1] === HEARTBEAT_MS && result ? [result.value] : [];
	});
	return started.map(
		(id) => clearIntervalSpy.mock.calls.filter((call) => call[0] === id).length
	);
}

function startedTimers(): number {
	return clearCounts().length;
}

// ---------------------------------------------------------------------------
// Streams
// ---------------------------------------------------------------------------

interface Viewer {
	abort: () => void;
	cancel: () => Promise<void>;
	chunks: string[];
	isClosed: () => boolean;
	userId: string;
}

interface OpenOptions {
	preAborted?: boolean;
}

async function openStream(
	userId: string,
	caseId: string,
	options: OpenOptions = {}
): Promise<Viewer> {
	const abortController = new AbortController();
	const signal = options.preAborted
		? AbortSignal.abort()
		: abortController.signal;
	const request = new Request(
		`http://localhost:3000/api/cases/${caseId}/events`,
		{
			signal,
		}
	);
	await mockAuth(userId);
	const response = await GET(request, {
		params: Promise.resolve({ id: caseId }),
	});
	if (response.status !== 200 || !response.body) {
		throw new Error(`Expected an open stream, got ${response.status}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let closed = false;
	const pump = async () => {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				closed = true;
				return;
			}
			chunks.push(decoder.decode(value));
		}
	};
	pump().catch(() => {
		closed = true;
	});

	const viewer: Viewer = {
		userId,
		chunks,
		isClosed: () => closed,
		abort: () => abortController.abort(),
		cancel: () => reader.cancel().catch(() => undefined),
	};
	opened.push(viewer);
	return viewer;
}

const heartbeatsSeen = (viewer: Viewer): number =>
	viewer.chunks.filter((chunk) => chunk === ": heartbeat\n\n").length;

const eventsSeen = (viewer: Viewer): string[] =>
	viewer.chunks.flatMap((chunk) =>
		[...chunk.matchAll(EVENT_LINE)].flatMap((match) =>
			match[1] ? [match[1]] : []
		)
	);

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function flushAll(): Promise<void> {
	for (let i = 0; i < 4; i += 1) {
		await flush();
	}
}

async function until(condition: () => boolean, what: string): Promise<void> {
	const deadline = Date.now() + 5000;
	while (!condition()) {
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for ${what}`);
		}
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
	}
}

function settledChecks(): number {
	return canAccess.mock.settledResults.filter(
		(result) => result.type !== "incomplete"
	).length;
}

/**
 * Lets one heartbeat fall due and waits for `checks` access checks to finish.
 * Several streams on one case each have their own timer, so each runs a check.
 */
async function passHeartbeat(checks = 1): Promise<void> {
	const before = settledChecks();
	await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
	await until(() => settledChecks() >= before + checks, "the access checks");
	await flushAll();
}

type Check = ReturnType<typeof deferred<boolean>>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Makes every later write to any stream controller fail, as a closed one does. */
function breakStreamWrites(): void {
	enqueueSpy = vi
		.spyOn(ReadableStreamDefaultController.prototype, "enqueue")
		.mockImplementation(() => {
			throw new TypeError("Invalid state: Controller is already closed");
		});
}

function emitMarker(caseId: string): void {
	emitSSEEvent("case:updated", caseId, { marker: true });
}

// ---------------------------------------------------------------------------
// Cases, grants and teams
// ---------------------------------------------------------------------------

interface World {
	caseId: string;
	owner: User;
}

type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";
const LEVELS: Level[] = ["VIEW", "COMMENT", "EDIT", "ADMIN"];

async function newWorld(): Promise<World> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	return { owner, caseId: testCase.id };
}

async function mustSucceed(
	result: Promise<{ data: unknown } | { error: string }>
): Promise<void> {
	const outcome = await result;
	if ("error" in outcome) {
		throw new Error(`Setup step failed: ${outcome.error}`);
	}
}

async function directGrant(world: World, level: Level = "VIEW") {
	const user = await createTestUser();
	const grant = await createTestPermission(
		world.caseId,
		user.id,
		world.owner.id,
		level
	);
	return { user, grant };
}

async function teamGrant(
	world: World,
	options: { level?: Level; role?: "ADMIN" | "MEMBER" } = {}
) {
	const user = await createTestUser();
	const team = await createTestTeam(world.owner.id);
	await addTeamMember(team.id, user.id, options.role ?? "MEMBER");
	const grant = await createTestTeamPermission(
		world.caseId,
		team.id,
		world.owner.id,
		options.level ?? "VIEW"
	);
	return { user, team, grant };
}

/** Another team that grants the same user access to the same case. */
async function secondTeamGrant(world: World, user: User) {
	const team = await createTestTeam(world.owner.id);
	await addTeamMember(team.id, user.id);
	const grant = await createTestTeamPermission(
		world.caseId,
		team.id,
		world.owner.id,
		"VIEW"
	);
	return { team, grant };
}

// ---------------------------------------------------------------------------
// Opening a stream
// ---------------------------------------------------------------------------

describe("opening a live-update stream", () => {
	it("answers 401 without a session and registers nothing", async () => {
		const world = await newWorld();
		await mockNoAuth();
		const request = new Request(
			`http://localhost:3000/api/cases/${world.caseId}/events`
		);

		const response = await GET(request, {
			params: Promise.resolve({ id: world.caseId }),
		});

		expect(response.status).toBe(401);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(startedTimers()).toBe(0);
		expect(liveTimers()).toBe(0);
		expect(canAccess).not.toHaveBeenCalled();
	});

	it("gives a missing case, a malformed id and a case the user cannot view the same answer", async () => {
		const world = await newWorld();
		const stranger = await createTestUser();
		await mockAuth(stranger.id);

		const answers = await Promise.all(
			[randomUUID(), "not-a-uuid", world.caseId].map(async (id) => {
				const response = await GET(
					new Request(`http://localhost:3000/api/cases/${id}/events`),
					{ params: Promise.resolve({ id }) }
				);
				return { status: response.status, body: await response.json() };
			})
		);

		expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404]);
		expect(answers.map((answer) => answer.body)).toEqual(
			new Array(3).fill(answers[0]?.body)
		);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(startedTimers()).toBe(0);
	});

	it("answers a trashed case like a missing one, even to its owner", async () => {
		const world = await newWorld();
		await mustSucceed(softDeleteCase(world.owner.id, world.caseId));
		await mockAuth(world.owner.id);

		const response = await GET(
			new Request(`http://localhost:3000/api/cases/${world.caseId}/events`),
			{ params: Promise.resolve({ id: world.caseId }) }
		);

		expect(response.status).toBe(404);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(startedTimers()).toBe(0);
	});

	it("never registers a request that was already aborted when the stream starts", async () => {
		const world = await newWorld();

		const viewer = await openStream(world.owner.id, world.caseId, {
			preAborted: true,
		});
		await until(viewer.isClosed, "the stream to close");
		canAccess.mockClear();
		emitMarker(world.caseId);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
		await flushAll();

		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(sseConnectionManager.getConnectedUsers(world.caseId)).toEqual([]);
		expect(startedTimers()).toBe(0);
		expect(liveTimers()).toBe(0);
		expect(eventsSeen(viewer)).not.toContain("case:updated");
		expect(canAccess).not.toHaveBeenCalled();
	});

	it("starts exactly one heartbeat timer per stream", async () => {
		const world = await newWorld();

		await openStream(world.owner.id, world.caseId);
		await openStream(world.owner.id, world.caseId);
		await openStream(world.owner.id, world.caseId);

		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(3);
		expect(liveTimers()).toBe(3);
		expect(startedTimers()).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// Every way a stream ends
// ---------------------------------------------------------------------------

interface Ending {
	end: (world: World, viewer: Viewer, grantId: string) => Promise<void> | void;
	name: string;
	/** True when the server closes the stream itself. */
	serverCloses: boolean;
}

const ENDINGS: Ending[] = [
	{
		name: "the client cancels the stream",
		serverCloses: false,
		end: async (_world, viewer) => {
			await viewer.cancel();
		},
	},
	{
		name: "the request is aborted",
		serverCloses: true,
		end: async (_world, viewer) => {
			viewer.abort();
			await until(viewer.isClosed, "the stream to close");
		},
	},
	{
		name: "the client cancels and then the request is aborted",
		serverCloses: false,
		end: async (_world, viewer) => {
			await viewer.cancel();
			viewer.abort();
			await flushAll();
		},
	},
	{
		name: "the request is aborted and then the client cancels",
		serverCloses: true,
		end: async (_world, viewer) => {
			viewer.abort();
			await until(viewer.isClosed, "the stream to close");
			await viewer.cancel();
		},
	},
	{
		name: "the user's access is revoked and the next heartbeat finds out",
		serverCloses: true,
		end: async (world, viewer, grantId) => {
			await mustSucceed(
				revokeUserPermission(world.owner.id, world.caseId, grantId)
			);
			canAccess.mockClear();
			await passHeartbeat();
			await until(viewer.isClosed, "the stream to close");
		},
	},
	{
		name: "the case is trashed and the next heartbeat finds out",
		serverCloses: true,
		end: async (world, viewer) => {
			await mustSucceed(softDeleteCase(world.owner.id, world.caseId));
			canAccess.mockClear();
			await passHeartbeat();
			await until(viewer.isClosed, "the stream to close");
		},
	},
	{
		name: "a write to the stream fails during a broadcast",
		serverCloses: false,
		end: (world) => {
			breakStreamWrites();
			emitMarker(world.caseId);
		},
	},
	{
		name: "a write to the stream fails during a heartbeat",
		serverCloses: false,
		end: async () => {
			breakStreamWrites();
			await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
			await flushAll();
		},
	},
];

describe("every way a stream ends", () => {
	it.each(
		ENDINGS
	)("removes the connection and clears its timer once when $name", async (ending) => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
		expect(liveTimers()).toBe(1);

		await ending.end(world, viewer, grant.id);
		await flushAll();

		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(sseConnectionManager.getConnectedUsers(world.caseId)).toEqual([]);
		expect(liveTimers()).toBe(0);
		expect(clearCounts()).toEqual([1]);
		expect(uncaught).toEqual([]);
		if (ending.serverCloses) {
			expect(viewer.isClosed()).toBe(true);
		}

		// Nothing is left running: later heartbeats start no check and add no timer.
		canAccess.mockClear();
		enqueueSpy?.mockRestore();
		enqueueSpy = null;
		expect(() => emitMarker(world.caseId)).not.toThrow();
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
		await flushAll();
		expect(canAccess).not.toHaveBeenCalled();
		expect(liveTimers()).toBe(0);
		expect(clearCounts()).toEqual([1]);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
	});

	it("survives a request abort that arrives after the server has closed the stream", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		await passHeartbeat();
		await until(viewer.isClosed, "the stream to close");

		viewer.abort();
		await viewer.cancel();
		await flushAll();

		expect(uncaught).toEqual([]);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(clearCounts()).toEqual([1]);
	});

	it("leaves no connection and no timer after many open and close cycles", async () => {
		const world = await newWorld();
		let streams = 0;

		for (let i = 0; i < 36; i += 1) {
			const kind = i % 4;
			if (kind === 3) {
				await openStream(world.owner.id, world.caseId, { preAborted: true });
			} else {
				const viewer = await openStream(world.owner.id, world.caseId);
				streams += 1;
				expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
				if (kind === 1) {
					viewer.abort();
					await until(viewer.isClosed, "the stream to close");
				} else {
					await viewer.cancel();
					if (kind === 2) {
						viewer.abort();
					}
				}
			}
			await flushAll();
			expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
			expect(liveTimers()).toBe(0);
		}

		expect(streams).toBe(27);
		expect(clearCounts()).toEqual(new Array(streams).fill(1));
		canAccess.mockClear();
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3);
		await flushAll();
		expect(canAccess).not.toHaveBeenCalled();
	});

	it("releases concurrent streams one by one in any order", async () => {
		const world = await newWorld();
		const viewers: Viewer[] = [];
		for (let i = 0; i < 12; i += 1) {
			viewers.push(await openStream(world.owner.id, world.caseId));
		}
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(12);
		expect(liveTimers()).toBe(12);

		const order = [5, 0, 11, 3, 7, 1, 10, 2, 9, 4, 8, 6];
		for (const [done, index] of order.entries()) {
			const viewer = viewers.at(index);
			if (!viewer) {
				throw new Error(`No stream at position ${index}`);
			}
			if (done % 2 === 0) {
				await viewer.cancel();
			} else {
				viewer.abort();
			}
			await flushAll();
			const remaining = order.length - done - 1;
			expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(
				remaining
			);
			expect(liveTimers()).toBe(remaining);
		}

		expect(clearCounts()).toEqual(new Array(12).fill(1));
	});
});

// ---------------------------------------------------------------------------
// The access re-check at each heartbeat
// ---------------------------------------------------------------------------

interface Keeper {
	name: string;
	setup: (world: World) => Promise<User>;
}

const KEEPERS: Keeper[] = [
	{ name: "the owner", setup: async (world) => world.owner },
	...LEVELS.map((level) => ({
		name: `a user with a direct ${level} grant`,
		setup: async (world: World) => (await directGrant(world, level)).user,
	})),
	...LEVELS.map((level) => ({
		name: `a team member whose team has a ${level} grant`,
		setup: async (world: World) => (await teamGrant(world, { level })).user,
	})),
	{
		name: "a team administrator",
		setup: async (world) =>
			(await teamGrant(world, { role: "ADMIN", level: "EDIT" })).user,
	},
];

describe("keeping the stream of a user who can still view the case", () => {
	it.each(
		KEEPERS
	)("keeps $name connected through repeated heartbeats", async (keeper) => {
		const world = await newWorld();
		const user = await keeper.setup(world);
		const viewer = await openStream(user.id, world.caseId);
		canAccess.mockClear();

		await passHeartbeat();
		await passHeartbeat();
		await passHeartbeat();
		emitMarker(world.caseId);
		await flushAll();

		expect(canAccess).toHaveBeenCalledTimes(3);
		expect(canAccess).toHaveBeenCalledWith(
			{ userId: user.id, caseId: world.caseId },
			"VIEW"
		);
		expect(viewer.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
		expect(liveTimers()).toBe(1);
		expect(clearCounts()).toEqual([0]);
		expect(heartbeatsSeen(viewer)).toBe(3);
		expect(eventsSeen(viewer)).toContain("case:updated");
		expect(logs.entries.map((entry) => entry.msg).join("\n")).not.toMatch(
			ACCESS_LOG
		);
	});

	it("keeps a direct grant that is lowered to VIEW", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world, "ADMIN");
		const viewer = await openStream(user.id, world.caseId);

		const { default: prisma } = await import("@/lib/prisma");
		await prisma.casePermission.update({
			where: { id: grant.id },
			data: { permission: "VIEW" },
		});
		await passHeartbeat();

		expect(viewer.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
	});
});

interface Revocation {
	name: string;
	setup: (world: World) => Promise<{ revoke: () => Promise<void>; user: User }>;
}

const REVOCATIONS: Revocation[] = [
	...LEVELS.map((level) => ({
		name: `a direct ${level} grant is revoked`,
		setup: async (world: World) => {
			const { user, grant } = await directGrant(world, level);
			return {
				user,
				revoke: () =>
					mustSucceed(
						revokeUserPermission(world.owner.id, world.caseId, grant.id)
					),
			};
		},
	})),
	{
		name: "a team administrator removes the user from the team",
		setup: async (world) => {
			const { user, team } = await teamGrant(world);
			return {
				user,
				revoke: () =>
					mustSucceed(removeMember(world.owner.id, team.id, user.id)),
			};
		},
	},
	{
		name: "the user leaves the team",
		setup: async (world) => {
			const { user, team } = await teamGrant(world);
			return {
				user,
				revoke: () => mustSucceed(leaveTeam(user.id, team.id)),
			};
		},
	},
	{
		name: "the team's grant on the case is removed",
		setup: async (world) => {
			const { user, grant } = await teamGrant(world, { level: "EDIT" });
			return {
				user,
				revoke: () =>
					mustSucceed(
						revokeTeamPermission(world.owner.id, world.caseId, grant.id)
					),
			};
		},
	},
	{
		name: "the team is deleted",
		setup: async (world) => {
			const { user, team } = await teamGrant(world, { level: "ADMIN" });
			return {
				user,
				revoke: () => mustSucceed(deleteTeam(world.owner.id, team.id)),
			};
		},
	},
];

describe("closing the stream of a user who has lost access", () => {
	it.each(
		REVOCATIONS
	)("closes the stream at the next heartbeat, and not before, when $name", async (revocation) => {
		const world = await newWorld();
		const { user, revoke } = await revocation.setup(world);
		const viewer = await openStream(user.id, world.caseId);
		await revoke();
		canAccess.mockClear();

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS - 1);
		await flushAll();
		expect(canAccess).not.toHaveBeenCalled();
		expect(viewer.isClosed()).toBe(false);

		await vi.advanceTimersByTimeAsync(1);
		await until(viewer.isClosed, "the stream to close");

		expect(canAccess).toHaveBeenCalledTimes(1);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
		expect(clearCounts()).toEqual([1]);
		expect(
			logs.entries.filter(
				(entry) => entry.msg === "Closing stream: case access lost"
			)
		).toHaveLength(1);
	});

	it("receives nothing after it closes, while the users who kept access keep receiving", async () => {
		const world = await newWorld();
		const revoked = await directGrant(world);
		const direct = await directGrant(world, "COMMENT");
		const member = await teamGrant(world);
		const ownerView = await openStream(world.owner.id, world.caseId);
		const revokedView = await openStream(revoked.user.id, world.caseId);
		const directView = await openStream(direct.user.id, world.caseId);
		const memberView = await openStream(member.user.id, world.caseId);
		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, revoked.grant.id)
		);

		await passHeartbeat(4);
		await until(revokedView.isClosed, "the revoked stream to close");
		const seenByRevoked = revokedView.chunks.length;
		emitMarker(world.caseId);
		await flushAll();

		expect(revokedView.chunks).toHaveLength(seenByRevoked);
		expect(sseConnectionManager.getConnectedUsers(world.caseId).sort()).toEqual(
			[world.owner.id, direct.user.id, member.user.id].sort()
		);
		for (const kept of [ownerView, directView, memberView]) {
			expect(kept.isClosed()).toBe(false);
			expect(eventsSeen(kept)).toContain("case:updated");
		}
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(3);
		expect(liveTimers()).toBe(3);

		// The revoked user cannot simply open a new stream either.
		await mockAuth(revoked.user.id);
		const retry = await GET(
			new Request(`http://localhost:3000/api/cases/${world.caseId}/events`),
			{ params: Promise.resolve({ id: world.caseId }) }
		);
		expect(retry.status).toBe(404);
	});

	it("closes every stream the revoked user has open on the case and none of anyone else's", async () => {
		const world = await newWorld();
		const revoked = await directGrant(world);
		const other = await directGrant(world);
		const firstTab = await openStream(revoked.user.id, world.caseId);
		const secondTab = await openStream(revoked.user.id, world.caseId);
		const bystander = await openStream(other.user.id, world.caseId);
		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, revoked.grant.id)
		);

		await passHeartbeat(3);

		expect(firstTab.isClosed()).toBe(true);
		expect(secondTab.isClosed()).toBe(true);
		expect(bystander.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectedUsers(world.caseId)).toEqual([
			other.user.id,
		]);
		expect(liveTimers()).toBe(1);
	});

	it("keeps a team member's stream when a different member of the team leaves", async () => {
		const world = await newWorld();
		const kept = await teamGrant(world);
		const leaver = await createTestUser();
		await addTeamMember(kept.team.id, leaver.id);
		const keptView = await openStream(kept.user.id, world.caseId);
		const leaverView = await openStream(leaver.id, world.caseId);
		await mustSucceed(leaveTeam(leaver.id, kept.team.id));

		await passHeartbeat(2);

		expect(leaverView.isClosed()).toBe(true);
		expect(keptView.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectedUsers(world.caseId)).toEqual([
			kept.user.id,
		]);
	});

	it.each([
		"trashed",
		"permanently deleted",
	])("closes the stream of every user when the case is %s", async (fate) => {
		const world = await newWorld();
		const direct = await directGrant(world, "EDIT");
		const member = await teamGrant(world, { level: "ADMIN" });
		const viewers = [
			await openStream(world.owner.id, world.caseId),
			await openStream(direct.user.id, world.caseId),
			await openStream(member.user.id, world.caseId),
		];
		await mustSucceed(softDeleteCase(world.owner.id, world.caseId));
		if (fate === "permanently deleted") {
			await mustSucceed(purgeCase(world.owner.id, world.caseId));
		}
		canAccess.mockClear();

		await passHeartbeat(3);

		for (const viewer of viewers) {
			expect(viewer.isClosed()).toBe(true);
		}
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
		expect(clearCounts()).toEqual([1, 1, 1]);
	});

	it("keeps the stream of a user with both a direct grant and a team grant until the last route is gone", async () => {
		const world = await newWorld();
		const team = await teamGrant(world);
		const direct = await createTestPermission(
			world.caseId,
			team.user.id,
			world.owner.id,
			"VIEW"
		);
		const viewer = await openStream(team.user.id, world.caseId);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, direct.id)
		);
		await passHeartbeat();
		expect(viewer.isClosed()).toBe(false);

		await mustSucceed(leaveTeam(team.user.id, team.team.id));
		await passHeartbeat();
		await until(viewer.isClosed, "the stream to close");
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
	});

	it("keeps the stream of a user whose team route is the only one left after the direct grant goes, and loses it when the team grant goes", async () => {
		const world = await newWorld();
		const team = await teamGrant(world, { level: "EDIT" });
		const direct = await createTestPermission(
			world.caseId,
			team.user.id,
			world.owner.id,
			"ADMIN"
		);
		const viewer = await openStream(team.user.id, world.caseId);

		await mustSucceed(
			revokeTeamPermission(world.owner.id, world.caseId, team.grant.id)
		);
		await passHeartbeat();
		expect(viewer.isClosed()).toBe(false);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, direct.id)
		);
		await passHeartbeat();
		await until(viewer.isClosed, "the stream to close");
	});

	it("keeps the stream of a user in two granting teams until the second team route goes", async () => {
		const world = await newWorld();
		const first = await teamGrant(world);
		const second = await secondTeamGrant(world, first.user);
		const viewer = await openStream(first.user.id, world.caseId);

		await mustSucceed(deleteTeam(world.owner.id, first.team.id));
		await passHeartbeat();
		expect(viewer.isClosed()).toBe(false);

		await mustSucceed(
			revokeTeamPermission(world.owner.id, world.caseId, second.grant.id)
		);
		await passHeartbeat();
		await until(viewer.isClosed, "the stream to close");
	});
});

// ---------------------------------------------------------------------------
// A check that fails, a check that is slow
// ---------------------------------------------------------------------------

describe("when the access re-check goes wrong", () => {
	it("keeps the stream and logs when the check throws, then checks again at the next heartbeat", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		canAccess.mockClear();
		canAccess.mockRejectedValueOnce(new Error("database unavailable"));

		await passHeartbeat();

		expect(viewer.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
		expect(liveTimers()).toBe(1);
		const warnings = logs.entries.filter(
			(entry) => entry.level === "warn" && KEEPING_OPEN.test(entry.msg)
		);
		expect(warnings).toHaveLength(1);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		canAccess.mockClear();
		await passHeartbeat();

		expect(canAccess).toHaveBeenCalledTimes(1);
		await until(viewer.isClosed, "the stream to close");
	});

	it("keeps the stream through a run of failing checks and the same user is still checked afterwards", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		canAccess.mockClear();
		canAccess.mockRejectedValue(new Error("database unavailable"));

		await passHeartbeat();
		await passHeartbeat();
		await passHeartbeat();

		expect(canAccess).toHaveBeenCalledTimes(3);
		expect(viewer.isClosed()).toBe(false);
		expect(liveTimers()).toBe(1);
		expect(
			logs.entries.filter((entry) => KEEPING_OPEN.test(entry.msg))
		).toHaveLength(3);
	});

	it("does not hold up the heartbeat for a slow check, and never runs two checks at once", async () => {
		const world = await newWorld();
		const viewer = await openStream(world.owner.id, world.caseId);
		const slow = deferred<boolean>();
		canAccess.mockClear();
		canAccess.mockImplementationOnce(() => slow.promise);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await flushAll();
		expect(canAccess).toHaveBeenCalledTimes(1);
		expect(heartbeatsSeen(viewer)).toBe(1);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
		await flushAll();
		expect(heartbeatsSeen(viewer)).toBe(3);
		expect(canAccess).toHaveBeenCalledTimes(1);

		slow.resolve(true);
		await flushAll();
		expect(viewer.isClosed()).toBe(false);

		await passHeartbeat();
		expect(canAccess).toHaveBeenCalledTimes(2);
		expect(viewer.isClosed()).toBe(false);
	});

	it("closes the stream when a slow check finally says access is gone", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		const slow = deferred<boolean>();
		canAccess.mockClear();
		canAccess.mockImplementationOnce(() => slow.promise);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
		await flushAll();
		slow.resolve(false);
		await until(viewer.isClosed, "the stream to close");

		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
		expect(clearCounts()).toEqual([1]);
	});

	it("logs the closing of a stream whose access was lost", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);

		await passHeartbeat();
		await until(viewer.isClosed, "the stream to close");

		expect(logs.entries.map((entry) => entry.msg)).toContain(
			"Closing stream: case access lost"
		);
	});
});

// ---------------------------------------------------------------------------
// After a stream has closed, nothing more should be done for it
// ---------------------------------------------------------------------------

describe("a check that is still running when its stream closes", () => {
	const closers = [
		{ closer: "cancelled", close: (viewer: Viewer) => viewer.cancel() },
		{
			closer: "aborted",
			close: async (viewer: Viewer) => {
				viewer.abort();
				await until(viewer.isClosed, "the stream to close");
			},
		},
	];
	const results = [
		{ result: "denies access", settle: (check: Check) => check.resolve(false) },
		{ result: "allows access", settle: (check: Check) => check.resolve(true) },
		{
			result: "fails",
			settle: (check: Check) => check.reject(new Error("database unavailable")),
		},
	];

	it.each(
		closers.flatMap((closer) =>
			results.map((result) => ({ ...closer, ...result }))
		)
	)("logs nothing about access when the stream was $closer and the check then $result", async ({
		close,
		settle,
	}) => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const viewer = await openStream(user.id, world.caseId);
		const check = deferred<boolean>();
		canAccess.mockClear();
		canAccess.mockImplementationOnce(() => check.promise);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await flushAll();
		expect(canAccess).toHaveBeenCalledTimes(1);

		await close(viewer);
		await flushAll();
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		settle(check);
		await flushAll();

		const accessLogs = logs.entries
			.map((entry) => entry.msg)
			.filter((message) => ACCESS_LOG.test(message));
		expect(accessLogs).toEqual([]);
		expect(clearCounts()).toEqual([1]);
	});

	it("does not close the same user's newer stream when the old stream's check says access is gone", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const oldView = await openStream(user.id, world.caseId);
		const check = deferred<boolean>();
		canAccess.mockClear();
		canAccess.mockImplementationOnce(() => check.promise);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await flushAll();
		await oldView.cancel();
		const newView = await openStream(user.id, world.caseId);

		check.resolve(false);
		await flushAll();

		expect(newView.isClosed()).toBe(false);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(1);
		expect(liveTimers()).toBe(1);
		expect(clearCounts()).toEqual([1, 0]);
	});

	it("starts no check for a connection that a failed heartbeat write has just removed", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		await openStream(user.id, world.caseId);
		canAccess.mockClear();
		breakStreamWrites();

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await flushAll();

		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(canAccess).not.toHaveBeenCalled();
		expect(
			logs.entries
				.map((entry) => entry.msg)
				.filter((message) => ACCESS_LOG.test(message))
		).toEqual([]);
	});
});
