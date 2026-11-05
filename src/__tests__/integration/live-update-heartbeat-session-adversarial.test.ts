import type { JWT } from "next-auth/jwt";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { authOptions } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password-service";
import { getSessionVersion } from "@/lib/auth/session-version";
import { validateSession } from "@/lib/auth/validate-session";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/services/email-service";
import {
	requestPasswordReset,
	resetPassword,
} from "@/lib/services/password-reset-service";
import {
	emitSSEEvent,
	sseConnectionManager,
} from "@/lib/services/sse-connection-manager";
import { changePassword } from "@/lib/services/user-management-service";
import type { User } from "@/src/generated/prisma";
import { captureLogs } from "../helpers/capture-logs";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	closingReason,
	endsWithClosingEvent,
	eventsSeen,
	flushAll,
	HEARTBEAT_MS,
	heartbeatsSeen,
	openStatus,
	openViewer,
	until,
	type Viewer,
} from "../utils/live-update-stream-kit";
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

vi.mock("@/lib/permissions", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/permissions")>();
	return { ...actual, canAccessCase: vi.fn(actual.canAccessCase) };
});

vi.mock("@/lib/auth/session-version", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/auth/session-version")>();
	return { ...actual, getSessionVersion: vi.fn(actual.getSessionVersion) };
});

// The reset token never touches the database; take it from the mocked email.
vi.mock("@/lib/services/email-service", () => ({
	sendPasswordResetEmail: vi
		.fn()
		.mockResolvedValue({ success: true, messageId: "mock-message-id" }),
}));

const { getSessionVersion: realGetSessionVersion } = await vi.importActual<
	typeof import("@/lib/auth/session-version")
>("@/lib/auth/session-version");
const canAccess = vi.mocked(canAccessCase);
const sessionVersionRead = vi.mocked(getSessionVersion);
const sessionCheck = vi.mocked(validateSession);

const CURRENT_PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "StrongP@ss1";
const TEST_IP = "127.0.0.1";
const MIN_PERIOD_EXCLUSIVE_MS = 25_000;

let setIntervalSpy: MockInstance<typeof globalThis.setInterval>;
let baselineTimers = 0;
let logs: ReturnType<typeof captureLogs>;
const opened: Viewer[] = [];
const uncaught: unknown[] = [];
const recordUncaught = (error: unknown) => {
	uncaught.push(error);
};

beforeEach(() => {
	uncaught.length = 0;
	process.on("uncaughtException", recordUncaught);
	vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	setIntervalSpy = vi.spyOn(globalThis, "setInterval");
	baselineTimers = vi.getTimerCount();
	canAccess.mockReset();
	sessionVersionRead.mockReset();
	logs = captureLogs();
});

afterEach(async () => {
	for (const viewer of opened.splice(0)) {
		await viewer.cancel();
	}
	process.off("uncaughtException", recordUncaught);
	logs.restore();
	setIntervalSpy.mockRestore();
	vi.clearAllTimers();
	vi.useRealTimers();
	await mockNoAuth();
	if (uncaught.length > 0) {
		throw new Error(
			`Uncaught exceptions during the test: ${uncaught.join(", ")}`
		);
	}
});

const liveTimers = (): number => vi.getTimerCount() - baselineTimers;

/** Periods, in milliseconds, of the heartbeat timers started so far, in start order. */
function heartbeatPeriods(): number[] {
	return setIntervalSpy.mock.calls.flatMap((call) => {
		const delay = call[1];
		return typeof delay === "number" &&
			delay > MIN_PERIOD_EXCLUSIVE_MS &&
			delay <= HEARTBEAT_MS
			? [delay]
			: [];
	});
}

async function open(
	userId: string,
	caseId: string,
	authenticate?: (userId: string) => Promise<void>
): Promise<Viewer> {
	const viewer = await openViewer(userId, caseId, authenticate);
	opened.push(viewer);
	return viewer;
}

const sleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

const settledChecks = (): number =>
	canAccess.mock.settledResults.filter((result) => result.type !== "incomplete")
		.length;

/** Lets one heartbeat fall due for every stream and waits for `checks` access checks to finish. */
async function passHeartbeat(checks: number): Promise<void> {
	const before = settledChecks();
	await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
	await until(() => settledChecks() >= before + checks, "the access checks");
	await sleep(150);
	await flushAll();
}

async function newCase() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	return { owner, caseId: testCase.id };
}

// ---------------------------------------------------------------------------
// Heartbeats
// ---------------------------------------------------------------------------

describe("heartbeats on streams opened together", () => {
	beforeEach(() => {
		// Every user may view; these tests are about timing, not access.
		canAccess.mockResolvedValue(true);
	});

	async function usersAndCase(count: number) {
		const { caseId } = await newCase();
		const users: User[] = [];
		for (let i = 0; i < count; i += 1) {
			users.push(await createTestUser());
		}
		return { caseId, users };
	}

	it("gives each of three viewers exactly one heartbeat per period", async () => {
		const { caseId, users } = await usersAndCase(3);
		const viewers: Viewer[] = [];
		for (const user of users) {
			viewers.push(await open(user.id, caseId));
		}

		for (const expected of [1, 2, 3]) {
			await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
			expect(viewers.map(heartbeatsSeen)).toEqual([
				expected,
				expected,
				expected,
			]);
		}
	});

	it("writes ten heartbeats, not a hundred, when ten viewers share a case", async () => {
		const { caseId, users } = await usersAndCase(2);
		const viewers: Viewer[] = [];
		for (let i = 0; i < 10; i += 1) {
			const user = users[i % 2];
			if (!user) {
				throw new Error("users missing");
			}
			viewers.push(await open(user.id, caseId));
		}

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

		const total = viewers.reduce(
			(sum, viewer) => sum + heartbeatsSeen(viewer),
			0
		);
		expect(total).toBe(10);
	});

	it("gives every stream the heartbeats of its own timer and no others", async () => {
		const { caseId, users } = await usersAndCase(3);
		const viewers: Viewer[] = [];
		for (let i = 0; i < 12; i += 1) {
			const user = users[i % 3];
			if (!user) {
				throw new Error("users missing");
			}
			viewers.push(await open(user.id, caseId));
		}
		const periods = heartbeatPeriods();
		expect(periods).toHaveLength(12);

		let elapsed = 0;
		for (const checkpoint of [
			20_000, 25_000, 26_000, 28_500, 30_000, 31_000, 50_000, 55_000, 60_000,
			75_000, 90_000,
		]) {
			await vi.advanceTimersByTimeAsync(checkpoint - elapsed);
			elapsed = checkpoint;
			const expected = periods.map((period) => Math.floor(checkpoint / period));
			expect(viewers.map(heartbeatsSeen)).toEqual(expected);
		}
	});

	it("starts no heartbeat before 25 seconds and gives every stream one by 30 seconds", async () => {
		const { caseId, users } = await usersAndCase(3);
		const viewers: Viewer[] = [];
		for (let i = 0; i < 9; i += 1) {
			const user = users[i % 3];
			if (!user) {
				throw new Error("users missing");
			}
			viewers.push(await open(user.id, caseId));
		}

		await vi.advanceTimersByTimeAsync(25_000);
		expect(viewers.map(heartbeatsSeen)).toEqual(new Array(9).fill(0));

		await vi.advanceTimersByTimeAsync(5000);
		expect(viewers.map(heartbeatsSeen)).toEqual(new Array(9).fill(1));
	});

	it("does not keep thirty streams opened together in step", async () => {
		const { caseId, users } = await usersAndCase(3);
		for (let i = 0; i < 30; i += 1) {
			const user = users[i % 3];
			if (!user) {
				throw new Error("users missing");
			}
			await open(user.id, caseId);
		}

		const periods = heartbeatPeriods();

		expect(periods).toHaveLength(30);
		for (const period of periods) {
			expect(Number.isInteger(period)).toBe(true);
		}
		expect(new Set(periods).size).toBeGreaterThan(8);
	});

	it("leaves the others' heartbeats unchanged when one viewer disconnects", async () => {
		const { caseId, users } = await usersAndCase(3);
		const viewers: Viewer[] = [];
		for (const user of users) {
			viewers.push(await open(user.id, caseId));
		}
		const leaver = viewers[0];
		if (!leaver) {
			throw new Error("viewers missing");
		}

		await leaver.cancel();
		await flushAll();
		expect(liveTimers()).toBe(2);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

		expect(heartbeatsSeen(leaver)).toBe(0);
		expect(viewers.slice(1).map(heartbeatsSeen)).toEqual([1, 1]);
	});

	it("leaves no timer running once every stream has ended", async () => {
		const { caseId, users } = await usersAndCase(3);
		const viewers: Viewer[] = [];
		for (const user of users) {
			viewers.push(await open(user.id, caseId));
		}
		expect(liveTimers()).toBe(3);

		viewers[0]?.abort();
		await viewers[1]?.cancel();
		await flushAll();
		expect(liveTimers()).toBe(1);
		await viewers[2]?.cancel();
		await flushAll();

		expect(liveTimers()).toBe(0);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// The recipients a broadcast reports
// ---------------------------------------------------------------------------

describe("the recipients logged for an event", () => {
	beforeEach(() => {
		canAccess.mockResolvedValue(true);
	});

	const recipientsLogged = (): unknown[] =>
		logs.entries
			.filter((entry) => entry.msg === "SSE broadcast event")
			.map((entry) => entry.recipients);

	it("equals the open streams, and falls by one when a viewer leaves", async () => {
		const { caseId } = await newCase();
		const viewers: Viewer[] = [];
		for (let i = 0; i < 3; i += 1) {
			const user = await createTestUser();
			viewers.push(await open(user.id, caseId));
		}

		emitSSEEvent("case:updated", caseId, {});
		await viewers[2]?.cancel();
		await flushAll();
		emitSSEEvent("case:updated", caseId, {});

		expect(recipientsLogged()).toEqual([3, 2]);
	});

	it("counts only the connections written to when one write fails", async () => {
		const { caseId } = await newCase();
		const viewers: Viewer[] = [];
		for (let i = 0; i < 3; i += 1) {
			const user = await createTestUser();
			viewers.push(await open(user.id, caseId));
		}
		const original = ReadableStreamDefaultController.prototype.enqueue;
		let writes = 0;
		const spy = vi
			.spyOn(ReadableStreamDefaultController.prototype, "enqueue")
			.mockImplementation(function (this: unknown, ...args) {
				writes += 1;
				if (writes === 2) {
					throw new TypeError("Invalid state: Controller is already closed");
				}
				return original.apply(this as never, args as never);
			});

		try {
			emitSSEEvent("case:updated", caseId, {});
		} finally {
			spy.mockRestore();
		}

		expect(recipientsLogged()).toEqual([2]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(2);
	});

	it("is zero when every write fails, never negative", async () => {
		const { caseId } = await newCase();
		for (let i = 0; i < 3; i += 1) {
			const user = await createTestUser();
			await open(user.id, caseId);
		}
		const spy = vi
			.spyOn(ReadableStreamDefaultController.prototype, "enqueue")
			.mockImplementation(() => {
				throw new TypeError("Invalid state: Controller is already closed");
			});

		try {
			emitSSEEvent("case:updated", caseId, {});
		} finally {
			spy.mockRestore();
		}

		expect(recipientsLogged()).toEqual([0]);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Sessions ended by a password change or reset
// ---------------------------------------------------------------------------

const configuredJwt = authOptions.callbacks?.jwt;
if (!configuredJwt) {
	throw new Error("authOptions.callbacks.jwt must be configured");
}
type JwtParams = Parameters<typeof configuredJwt>[0];
const jwt = async (params: JwtParams): Promise<JWT> => configuredJwt(params);

/** A token stamped as it is at sign-in, with the user's session version at that moment. */
const signIn = (userId: string): Promise<JWT> =>
	jwt({
		token: {} as JWT,
		user: { id: userId, provider: "credentials" },
	} as JwtParams);

/**
 * Answers the way a real session read does: the session is valid only while
 * the token's stamped session version is still the user's current one.
 */
function authenticateWith(token: JWT) {
	return (userId: string) => {
		sessionCheck.mockImplementation(async () => {
			try {
				await jwt({ token } as JwtParams);
			} catch {
				return null;
			}
			return { userId, username: null, email: null };
		});
		return Promise.resolve();
	};
}

async function localUser(): Promise<User> {
	return createTestUser({
		authProvider: "LOCAL",
		passwordHash: await hashPassword(CURRENT_PASSWORD),
	});
}

async function changeOf(user: User): Promise<void> {
	const result = await changePassword(user.id, {
		currentPassword: CURRENT_PASSWORD,
		newPassword: NEW_PASSWORD,
	});
	if ("error" in result) {
		throw new Error(`Password change failed: ${result.error}`);
	}
}

async function resetOf(user: User): Promise<void> {
	await requestPasswordReset(user.email, TEST_IP);
	const lastCall = vi.mocked(sendPasswordResetEmail).mock.calls.at(-1);
	if (!lastCall) {
		throw new Error("no reset email was sent");
	}
	const result = await resetPassword(
		lastCall[0].resetToken,
		NEW_PASSWORD,
		TEST_IP
	);
	if ("error" in result) {
		throw new Error(`Password reset failed: ${result.error}`);
	}
}

const WAYS_TO_END_A_SESSION = {
	"changed password": changeOf,
	"reset password": resetOf,
};

describe("a session ended by a password change or reset", () => {
	it.each(
		Object.entries(WAYS_TO_END_A_SESSION)
	)("closes every open stream of a user who %s within one heartbeat period, and nobody else's", async (_name, endSession) => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const secondCase = await createTestCase(owner.id);
		await createTestPermission(secondCase.id, user.id, owner.id, "VIEW");
		const bystander = await createTestUser();
		await createTestPermission(caseId, bystander.id, owner.id, "VIEW");
		const token = await signIn(user.id);
		const as = authenticateWith(token);
		const tabs = [
			await open(user.id, caseId, as),
			await open(user.id, caseId, as),
			await open(user.id, secondCase.id, as),
		];
		const peer = await open(bystander.id, caseId, (id) => mockAuth(id));
		const ownerStream = await open(owner.id, caseId, (id) => mockAuth(id));

		await endSession(user);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		for (const tab of tabs) {
			await until(() => tab.isClosed(), "the revoked stream to close");
		}
		await flushAll();

		for (const tab of tabs) {
			expect(endsWithClosingEvent(tab)).toBe(true);
			expect(closingReason(tab)).toBe("signed-out");
		}
		expect(peer.isClosed()).toBe(false);
		expect(ownerStream.isClosed()).toBe(false);
		expect(closingReason(peer)).toBeNull();
		expect(liveTimers()).toBe(2);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(2);
	});

	it.each([
		"case owner",
		"direct viewer",
		"team member",
	])("closes the stream of a %s", async (role) => {
		const { owner, caseId } = await newCase();
		let user: User;
		if (role === "case owner") {
			user = owner;
			await prisma.user.update({
				where: { id: owner.id },
				data: { passwordHash: await hashPassword(CURRENT_PASSWORD) },
			});
		} else if (role === "direct viewer") {
			user = await localUser();
			await createTestPermission(caseId, user.id, owner.id, "VIEW");
		} else {
			user = await localUser();
			const team = await createTestTeam(owner.id);
			await addTeamMember(team.id, user.id);
			await createTestTeamPermission(caseId, team.id, owner.id, "VIEW");
		}
		const token = await signIn(user.id);
		const viewer = await open(user.id, caseId, authenticateWith(token));

		await changeOf(user);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => viewer.isClosed(), "the stream to close");

		expect(closingReason(viewer)).toBe("signed-out");
		expect(endsWithClosingEvent(viewer)).toBe(true);
	});

	it("does not close the stream of a user whose session version has not moved", async () => {
		const user = await localUser();
		const ownCase = await createTestCase(user.id);
		const token = await signIn(user.id);
		const viewer = await open(user.id, ownCase.id, authenticateWith(token));

		await passHeartbeat(1);
		await passHeartbeat(1);

		expect(viewer.isClosed()).toBe(false);
		expect(heartbeatsSeen(viewer)).toBe(2);
		expect(closingReason(viewer)).toBeNull();
	});

	it("leaves a stream opened after the change, with a fresh sign-in, open", async () => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		await changeOf(user);
		const fresh = await signIn(user.id);

		const viewer = await open(user.id, caseId, authenticateWith(fresh));
		await passHeartbeat(1);
		await passHeartbeat(1);

		expect(viewer.isClosed()).toBe(false);
		expect(closingReason(viewer)).toBeNull();
		expect(heartbeatsSeen(viewer)).toBe(2);
	});

	it("refuses to open a stream with a token from before the change", async () => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const stale = await signIn(user.id);
		await changeOf(user);

		const status = await openStatus(user.id, caseId, authenticateWith(stale));

		expect(status).toBe(401);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
	});

	it.each([
		"before",
		"after",
	])("refuses to open a stream when the password is changed %s the session version is read", async (when) => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const token = await signIn(user.id);
		sessionVersionRead.mockImplementationOnce(async (id) => {
			if (when === "before") {
				await changeOf(user);
			}
			const version = await realGetSessionVersion(id);
			if (when === "after") {
				await changeOf(user);
			}
			return version;
		});

		const status = await openStatus(user.id, caseId, authenticateWith(token));

		expect(status).toBe(401);
		expect(sseConnectionManager.getConnectionCount(caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
	});

	it("refuses to open a stream for a user who no longer exists", async () => {
		const { owner, caseId } = await newCase();
		const user = await createTestUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const token = await signIn(user.id);
		await prisma.user.delete({ where: { id: user.id } });

		const status = await openStatus(user.id, caseId, authenticateWith(token));

		expect(status).toBe(401);
	});

	it("delivers the closing event after any heartbeat or event already sent, and nothing after it", async () => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const token = await signIn(user.id);
		const viewer = await open(user.id, caseId, authenticateWith(token));
		emitSSEEvent("case:updated", caseId, {});
		await flushAll();

		await changeOf(user);
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => viewer.isClosed(), "the stream to close");
		emitSSEEvent("case:updated", caseId, {});
		await flushAll();

		expect(eventsSeen(viewer)).toEqual([
			"connected",
			"case:updated",
			"stream:closed",
		]);
		expect(endsWithClosingEvent(viewer)).toBe(true);
	});

	it("closes at the second heartbeat when the change lands after the first one has passed", async () => {
		const { owner, caseId } = await newCase();
		const user = await localUser();
		await createTestPermission(caseId, user.id, owner.id, "VIEW");
		const token = await signIn(user.id);
		const viewer = await open(user.id, caseId, authenticateWith(token));
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await changeOf(user);

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => viewer.isClosed(), "the stream to close");

		expect(closingReason(viewer)).toBe("signed-out");
	});
});
