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
import { DELETE as deletePermission } from "@/app/api/cases/[id]/permissions/[permissionId]/route";
import { getSessionVersion } from "@/lib/auth/session-version";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
	revokeTeamPermission,
	revokeUserPermission,
} from "@/lib/services/case-permission-service";
import { softDeleteCase } from "@/lib/services/case-trash-service";
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
	closingReason,
	deferred,
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

// Every call still reaches the real permission logic and the real database;
// the wrapper only records calls and lets a test hold back or fail an answer.
vi.mock("@/lib/permissions", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/permissions")>();
	return { ...actual, canAccessCase: vi.fn(actual.canAccessCase) };
});

// The session read that follows a passing access check is wrapped the same
// way, so a test can tell when a check has finished both of its steps.
vi.mock("@/lib/auth/session-version", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/auth/session-version")>();
	return { ...actual, getSessionVersion: vi.fn(actual.getSessionVersion) };
});

const { canAccessCase: realCanAccess } =
	await vi.importActual<typeof import("@/lib/permissions")>(
		"@/lib/permissions"
	);
const canAccess = vi.mocked(canAccessCase);
const sessionReads = vi.mocked(getSessionVersion);

let setIntervalSpy: MockInstance<typeof globalThis.setInterval>;
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
	baselineTimers = vi.getTimerCount();
	canAccess.mockReset();
	sessionReads.mockClear();
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

/** Heartbeat timers that are still pending. */
const liveTimers = (): number => vi.getTimerCount() - baselineTimers;

/**
 * Opens a stream and waits for the access check, and the session read after
 * it, that the server makes straight after the stream registers. Tests that
 * follow count heartbeat checks, so the opening check must be over first.
 */
async function open(userId: string, caseId: string): Promise<Viewer> {
	const viewer = await openViewer(userId, caseId);
	opened.push(viewer);
	await afterOpeningCheck(settledChecks());
	return viewer;
}

async function mustSucceed(
	result: Promise<{ data: unknown } | { error: string }>
): Promise<void> {
	const outcome = await result;
	if ("error" in outcome) {
		throw new Error(`Setup step failed: ${outcome.error}`);
	}
}

const settledChecks = (): number =>
	canAccess.mock.settledResults.filter((result) => result.type !== "incomplete")
		.length;

/** Session reads that have started and not yet finished. */
const sessionReadsInFlight = (): number =>
	sessionReads.mock.results.length -
	sessionReads.mock.settledResults.filter(
		(result) => result.type !== "incomplete"
	).length;

async function afterOpeningCheck(settledBefore: number): Promise<void> {
	await until(
		() => settledChecks() > settledBefore,
		"the check made on opening"
	);
	await flushAll();
	await until(() => sessionReadsInFlight() === 0, "the session read");
}

/**
 * Lets one heartbeat fall due for every stream, waits for `checks` access
 * checks to finish, and gives the session read that follows a moment to run.
 */
async function passHeartbeat(checks: number): Promise<void> {
	const before = settledChecks();
	await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
	await until(() => settledChecks() >= before + checks, "the access checks");
	await new Promise<void>((resolve) => setTimeout(resolve, 150));
	await flushAll();
}

// ---------------------------------------------------------------------------
// Worlds
// ---------------------------------------------------------------------------

interface World {
	caseId: string;
	owner: User;
}

async function newWorld(): Promise<World> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	return { owner, caseId: testCase.id };
}

async function directGrant(world: World) {
	const user = await createTestUser();
	const grant = await createTestPermission(
		world.caseId,
		user.id,
		world.owner.id,
		"VIEW"
	);
	return { user, grant };
}

/** A team the case owner leads, shared on the case, with `members` ordinary members. */
async function sharedTeam(world: World, members: number) {
	const team = await createTestTeam(world.owner.id);
	const users: User[] = [];
	for (let i = 0; i < members; i += 1) {
		const user = await createTestUser();
		await addTeamMember(team.id, user.id, "MEMBER");
		users.push(user);
	}
	const grant = await createTestTeamPermission(
		world.caseId,
		team.id,
		world.owner.id,
		"VIEW"
	);
	return { team, users, grant };
}

async function otherCaseSharedWith(world: World, user: User) {
	const other = await createTestCase(world.owner.id);
	await createTestPermission(other.id, user.id, world.owner.id, "VIEW");
	return other.id;
}

// ---------------------------------------------------------------------------
// The six ways to lose the last route to a case
// ---------------------------------------------------------------------------

interface Outcome {
	/** Streams that stay open and keep receiving events. */
	kept: Viewer[];
	/** Starts the removal and waits for the service to return. */
	removeAccess: () => Promise<void>;
	/** Streams whose user has lost the last route to the case. */
	revoked: Viewer[];
}

type Scenario = (world: World) => Promise<Outcome>;

const SCENARIOS: Record<string, Scenario> = {
	"a direct share is removed": async (world) => {
		const { user, grant } = await directGrant(world);
		const peer = (await directGrant(world)).user;
		const elsewhere = await otherCaseSharedWith(world, user);
		return {
			revoked: [
				await open(user.id, world.caseId),
				await open(user.id, world.caseId),
			],
			kept: [
				await open(peer.id, world.caseId),
				await open(world.owner.id, world.caseId),
				await open(user.id, elsewhere),
			],
			removeAccess: () =>
				mustSucceed(
					revokeUserPermission(world.owner.id, world.caseId, grant.id)
				),
		};
	},
	"a team is unshared from the case": async (world) => {
		const { users, grant } = await sharedTeam(world, 2);
		const mixed = await createTestUser();
		await createTestPermission(world.caseId, mixed.id, world.owner.id, "VIEW");
		const peer = (await directGrant(world)).user;
		const [first, second] = users;
		if (!(first && second)) {
			throw new Error("members missing");
		}
		return {
			revoked: [
				await open(first.id, world.caseId),
				await open(second.id, world.caseId),
			],
			kept: [
				await open(mixed.id, world.caseId),
				await open(peer.id, world.caseId),
				await open(world.owner.id, world.caseId),
			],
			removeAccess: () =>
				mustSucceed(
					revokeTeamPermission(world.owner.id, world.caseId, grant.id)
				),
		};
	},
	"a member is removed from the team": async (world) => {
		const { team, users } = await sharedTeam(world, 2);
		const [removed, stays] = users;
		if (!(removed && stays)) {
			throw new Error("members missing");
		}
		const elsewhere = await otherCaseSharedWith(world, removed);
		return {
			revoked: [
				await open(removed.id, world.caseId),
				await open(removed.id, world.caseId),
			],
			kept: [
				await open(stays.id, world.caseId),
				await open(world.owner.id, world.caseId),
				await open(removed.id, elsewhere),
			],
			removeAccess: () =>
				mustSucceed(removeMember(world.owner.id, team.id, removed.id)),
		};
	},
	"a member leaves the team": async (world) => {
		const { team, users } = await sharedTeam(world, 2);
		const [leaver, stays] = users;
		if (!(leaver && stays)) {
			throw new Error("members missing");
		}
		const elsewhere = await otherCaseSharedWith(world, leaver);
		return {
			revoked: [await open(leaver.id, world.caseId)],
			kept: [
				await open(stays.id, world.caseId),
				await open(world.owner.id, world.caseId),
				await open(leaver.id, elsewhere),
			],
			removeAccess: () => mustSucceed(leaveTeam(leaver.id, team.id)),
		};
	},
	"the team is deleted": async (world) => {
		const { team, users } = await sharedTeam(world, 2);
		const [first, second] = users;
		if (!(first && second)) {
			throw new Error("members missing");
		}
		await createTestPermission(world.caseId, second.id, world.owner.id, "VIEW");
		const rival = await sharedTeam(world, 1);
		const rivalMember = rival.users[0];
		if (!rivalMember) {
			throw new Error("members missing");
		}
		return {
			revoked: [await open(first.id, world.caseId)],
			kept: [
				await open(second.id, world.caseId),
				await open(rivalMember.id, world.caseId),
				await open(world.owner.id, world.caseId),
			],
			removeAccess: () => mustSucceed(deleteTeam(world.owner.id, team.id)),
		};
	},
	"the case is moved to the bin": async (world) => {
		const { user } = await directGrant(world);
		const { users } = await sharedTeam(world, 1);
		const member = users[0];
		if (!member) {
			throw new Error("members missing");
		}
		const elsewhere = await otherCaseSharedWith(world, user);
		return {
			revoked: [
				await open(user.id, world.caseId),
				await open(member.id, world.caseId),
				await open(world.owner.id, world.caseId),
			],
			kept: [await open(user.id, elsewhere)],
			removeAccess: () =>
				mustSucceed(
					softDeleteCase(world.owner.id, world.caseId, {
						publishedCopy: "remove",
					})
				),
		};
	},
};

describe("removing someone's last access to a case", () => {
	it.each(
		Object.entries(SCENARIOS)
	)("when %s, closes their streams before the call returns and leaves everyone else's open", async (_name, scenario) => {
		const world = await newWorld();
		const { revoked, kept, removeAccess } = await scenario(world);
		const timersBefore = liveTimers();
		await flushAll();

		await removeAccess();
		await flushAll();

		for (const viewer of revoked) {
			expect(viewer.isClosed()).toBe(true);
			expect(endsWithClosingEvent(viewer)).toBe(true);
			expect(closingReason(viewer)).toBe("access-removed");
			expect(eventsSeen(viewer)).toEqual(["connected", "stream:closed"]);
		}
		for (const viewer of kept) {
			expect(viewer.isClosed()).toBe(false);
			expect(closingReason(viewer)).toBeNull();
		}
		expect(liveTimers()).toBe(timersBefore - revoked.length);
	});

	it.each(
		Object.entries(SCENARIOS)
	)("when %s, nothing sent afterwards reaches the closed streams", async (_name, scenario) => {
		const world = await newWorld();
		const { revoked, kept, removeAccess } = await scenario(world);
		await removeAccess();
		await flushAll();
		const chunkCounts = revoked.map((viewer) => viewer.chunks.length);
		const keptCounts = kept.map((viewer) => viewer.chunks.length);

		emitSSEEvent("case:updated", world.caseId, { marker: true });
		emitSSEEvent("permission:changed", world.caseId, { marker: true });
		await flushAll();

		expect(revoked.map((viewer) => viewer.chunks.length)).toEqual(chunkCounts);
		for (const [index, viewer] of kept.entries()) {
			const newChunks = viewer.chunks.slice(keptCounts[index]);
			// A stream on another case receives nothing; the others receive both.
			const expected = viewer.caseId === world.caseId ? 2 : 0;
			expect(newChunks).toHaveLength(expected);
		}
	});

	it.each(
		Object.entries(SCENARIOS)
	)("when %s, the streams left open stay open through the next heartbeat check", async (_name, scenario) => {
		const world = await newWorld();
		const { kept, removeAccess } = await scenario(world);
		await removeAccess();
		await flushAll();

		await passHeartbeat(kept.length);

		for (const viewer of kept) {
			expect(viewer.isClosed()).toBe(false);
			expect(heartbeatsSeen(viewer)).toBe(1);
			expect(closingReason(viewer)).toBeNull();
		}
	});

	it("says the same thing to every tab the user has open on the case", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const tabs = [
			await open(user.id, world.caseId),
			await open(user.id, world.caseId),
			await open(user.id, world.caseId),
		];

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		await flushAll();

		for (const tab of tabs) {
			expect(tab.isClosed()).toBe(true);
			expect(closingReason(tab)).toBe("access-removed");
		}
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
		expect(liveTimers()).toBe(0);
	});

	it("writes the closing event in the documented form", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		await flushAll();

		expect(viewer.chunks.at(-1)).toBe(
			'event: stream:closed\ndata: {"reason":"access-removed"}\n\n'
		);
	});

	it("is not retried against the server: a request to open the stream afterwards is answered 404", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		await open(user.id, world.caseId);
		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);

		await expect(openStatus(user.id, world.caseId)).resolves.toBe(404);
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
	});
});

describe("a user with more than one route to the case", () => {
	it("keeps a stream open when a direct share goes but a team still gives access, and closes it when the team goes", async () => {
		const world = await newWorld();
		const { users, grant: teamGrant } = await sharedTeam(world, 1);
		const user = users[0];
		if (!user) {
			throw new Error("members missing");
		}
		const direct = await createTestPermission(
			world.caseId,
			user.id,
			world.owner.id,
			"VIEW"
		);
		const viewer = await open(user.id, world.caseId);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, direct.id)
		);
		await flushAll();
		expect(viewer.isClosed()).toBe(false);
		expect(closingReason(viewer)).toBeNull();

		await mustSucceed(
			revokeTeamPermission(world.owner.id, world.caseId, teamGrant.id)
		);
		await flushAll();
		expect(viewer.isClosed()).toBe(true);
		expect(closingReason(viewer)).toBe("access-removed");
	});

	it("keeps a stream open when a team goes but a direct share remains, and closes it when the share goes", async () => {
		const world = await newWorld();
		const { users, grant: teamGrant } = await sharedTeam(world, 1);
		const user = users[0];
		if (!user) {
			throw new Error("members missing");
		}
		const direct = await createTestPermission(
			world.caseId,
			user.id,
			world.owner.id,
			"VIEW"
		);
		const viewer = await open(user.id, world.caseId);

		await mustSucceed(
			revokeTeamPermission(world.owner.id, world.caseId, teamGrant.id)
		);
		await flushAll();
		expect(viewer.isClosed()).toBe(false);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, direct.id)
		);
		await flushAll();
		expect(viewer.isClosed()).toBe(true);
	});

	it("survives leaving one of two teams that share the case, and closes on leaving the second", async () => {
		const world = await newWorld();
		const user = await createTestUser();
		const first = await sharedTeam(world, 0);
		const second = await sharedTeam(world, 0);
		await addTeamMember(first.team.id, user.id);
		await addTeamMember(second.team.id, user.id);
		const viewer = await open(user.id, world.caseId);

		await mustSucceed(leaveTeam(user.id, first.team.id));
		await flushAll();
		expect(viewer.isClosed()).toBe(false);
		expect(closingReason(viewer)).toBeNull();

		await mustSucceed(removeMember(world.owner.id, second.team.id, user.id));
		await flushAll();
		expect(viewer.isClosed()).toBe(true);
		expect(closingReason(viewer)).toBe("access-removed");
	});

	it("survives the deletion of one of two teams that share the case, and closes on the deletion of the second", async () => {
		const world = await newWorld();
		const user = await createTestUser();
		const first = await sharedTeam(world, 0);
		const second = await sharedTeam(world, 0);
		await addTeamMember(first.team.id, user.id);
		await addTeamMember(second.team.id, user.id);
		const viewer = await open(user.id, world.caseId);

		await mustSucceed(deleteTeam(world.owner.id, first.team.id));
		await flushAll();
		expect(viewer.isClosed()).toBe(false);

		await mustSucceed(deleteTeam(world.owner.id, second.team.id));
		await flushAll();
		expect(viewer.isClosed()).toBe(true);
	});

	it("never closes the case owner's stream when a team the owner belongs to is unshared or deleted", async () => {
		const world = await newWorld();
		const { team, grant } = await sharedTeam(world, 1);
		const owner = await open(world.owner.id, world.caseId);

		await mustSucceed(
			revokeTeamPermission(world.owner.id, world.caseId, grant.id)
		);
		await mustSucceed(deleteTeam(world.owner.id, team.id));
		await flushAll();
		await passHeartbeat(1);

		expect(owner.isClosed()).toBe(false);
		expect(closingReason(owner)).toBeNull();
	});

	it("closes only the case the team gave the user when they also hold a direct share on another case", async () => {
		const world = await newWorld();
		const { team, users } = await sharedTeam(world, 1);
		const user = users[0];
		if (!user) {
			throw new Error("members missing");
		}
		const direct = await otherCaseSharedWith(world, user);
		const viaTeam = await open(user.id, world.caseId);
		const viaShare = await open(user.id, direct);

		await mustSucceed(leaveTeam(user.id, team.id));
		await flushAll();

		expect(viaTeam.isClosed()).toBe(true);
		expect(viaShare.isClosed()).toBe(false);
	});

	it("closes every case a team gave the user when they leave it", async () => {
		const world = await newWorld();
		const { team, users } = await sharedTeam(world, 1);
		const user = users[0];
		if (!user) {
			throw new Error("members missing");
		}
		const second = await createTestCase(world.owner.id);
		await createTestTeamPermission(second.id, team.id, world.owner.id, "VIEW");
		const onFirst = await open(user.id, world.caseId);
		const onSecond = await open(user.id, second.id);

		await mustSucceed(leaveTeam(user.id, team.id));
		await flushAll();

		expect(onFirst.isClosed()).toBe(true);
		expect(onSecond.isClosed()).toBe(true);
		expect(closingReason(onSecond)).toBe("access-removed");
	});
});

describe("removals that overlap", () => {
	const closingEvents = (viewer: Viewer): number =>
		viewer.chunks.filter((chunk) => chunk.startsWith("event: stream:closed"))
			.length;

	it("send one closing event, and end cleanly, when both routes to the case go at the same moment", async () => {
		const world = await newWorld();
		const { users, grant: teamGrant } = await sharedTeam(world, 1);
		const user = users[0];
		if (!user) {
			throw new Error("members missing");
		}
		const direct = await createTestPermission(
			world.caseId,
			user.id,
			world.owner.id,
			"VIEW"
		);
		const viewer = await open(user.id, world.caseId);

		await Promise.all([
			mustSucceed(
				revokeUserPermission(world.owner.id, world.caseId, direct.id)
			),
			mustSucceed(
				revokeTeamPermission(world.owner.id, world.caseId, teamGrant.id)
			),
		]);
		await flushAll();

		expect(viewer.isClosed()).toBe(true);
		expect(closingEvents(viewer)).toBe(1);
		expect(endsWithClosingEvent(viewer)).toBe(true);
	});

	it("send one closing event when the removal and a heartbeat check land together", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);

		await Promise.all([
			mustSucceed(revokeUserPermission(world.owner.id, world.caseId, grant.id)),
			vi.advanceTimersByTimeAsync(HEARTBEAT_MS),
		]);
		await until(() => viewer.isClosed(), "the stream to close");
		await flushAll();

		expect(closingEvents(viewer)).toBe(1);
		expect(endsWithClosingEvent(viewer)).toBe(true);
	});

	it("close several users' streams together, each once", async () => {
		const world = await newWorld();
		const { team, users } = await sharedTeam(world, 4);
		const viewers: Viewer[] = [];
		for (const user of users) {
			viewers.push(await open(user.id, world.caseId));
			viewers.push(await open(user.id, world.caseId));
		}

		await mustSucceed(deleteTeam(world.owner.id, team.id));
		await flushAll();

		for (const viewer of viewers) {
			expect(viewer.isClosed()).toBe(true);
			expect(closingEvents(viewer)).toBe(1);
		}
		expect(sseConnectionManager.getConnectionCount(world.caseId)).toBe(0);
	});
});

describe("the closing event and the announcement of the change", () => {
	it("reaches the removed viewer before any permission:changed event, which only the others receive", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const peer = (await directGrant(world)).user;
		const removed = await open(user.id, world.caseId);
		const kept = await open(peer.id, world.caseId);
		const owner = await open(world.owner.id, world.caseId);
		await mockAuth(world.owner.id);

		const response = await deletePermission(
			new Request(
				`http://localhost:3000/api/cases/${world.caseId}/permissions/${grant.id}`,
				{ method: "DELETE" }
			),
			{ params: Promise.resolve({ id: world.caseId, permissionId: grant.id }) }
		);
		await flushAll();

		expect(response.status).toBe(200);
		expect(eventsSeen(removed)).toEqual(["connected", "stream:closed"]);
		expect(eventsSeen(kept)).toEqual(["connected", "permission:changed"]);
		expect(eventsSeen(owner)).toEqual(["connected", "permission:changed"]);
	});

	it("does the same when the removal is a team share", async () => {
		const world = await newWorld();
		const { users, grant } = await sharedTeam(world, 1);
		const member = users[0];
		if (!member) {
			throw new Error("members missing");
		}
		const removed = await open(member.id, world.caseId);
		const owner = await open(world.owner.id, world.caseId);
		await mockAuth(world.owner.id);

		const response = await deletePermission(
			new Request(
				`http://localhost:3000/api/cases/${world.caseId}/permissions/${grant.id}?type=team`,
				{ method: "DELETE" }
			),
			{ params: Promise.resolve({ id: world.caseId, permissionId: grant.id }) }
		);
		await flushAll();

		expect(response.status).toBe(200);
		expect(eventsSeen(removed)).toEqual(["connected", "stream:closed"]);
		expect(eventsSeen(owner)).toEqual(["connected", "permission:changed"]);
	});

	it("comes before any element event the removed viewer was about to be sent", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const removed = await open(user.id, world.caseId);

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		emitSSEEvent("element:updated", world.caseId, {
			elementId: randomUUID(),
			content: "full element content",
		});
		await flushAll();

		expect(eventsSeen(removed)).toEqual(["connected", "stream:closed"]);
		expect(removed.chunks.join("")).not.toContain("full element content");
	});
});

describe("a revocation that meets a check already in progress", () => {
	it("is not lost when the running check read the data before the revocation committed", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		const release = deferred<void>();
		let held = false;
		canAccess.mockImplementation(async (...args) => {
			const [identity, level] = args;
			if (!held && identity.userId === user.id && level === "VIEW") {
				held = true;
				const answer = await realCanAccess(...args);
				await release.promise;
				return answer;
			}
			return realCanAccess(...args);
		});

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => held, "the heartbeat check to start");
		const revoking = revokeUserPermission(
			world.owner.id,
			world.caseId,
			grant.id
		);
		await until(
			async () =>
				(await prisma.casePermission.count({ where: { id: grant.id } })) === 0,
			"the share to be deleted"
		);
		await flushAll();
		expect(viewer.isClosed()).toBe(false);

		release.resolve();
		await mustSucceed(revoking);
		await flushAll();

		expect(viewer.isClosed()).toBe(true);
		expect(closingReason(viewer)).toBe("access-removed");
	});

	it("runs one more check, not one per request, however many arrive while it runs", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		const release = deferred<void>();
		let held = false;
		canAccess.mockImplementation(async (...args) => {
			const [identity, level] = args;
			if (!held && identity.userId === user.id && level === "VIEW") {
				held = true;
				const answer = await realCanAccess(...args);
				await release.promise;
				return answer;
			}
			return realCanAccess(...args);
		});
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => held, "the heartbeat check to start");

		const requests = [1, 2, 3, 4].map(() =>
			sseConnectionManager.recheckConnections({
				caseId: world.caseId,
				userId: user.id,
			})
		);
		await flushAll();
		release.resolve();
		await Promise.all(requests);
		await flushAll();

		const viewChecks = canAccess.mock.calls.filter(
			([identity, level]) => identity.userId === user.id && level === "VIEW"
		);
		// The opening request, the check made as the stream registers, the running
		// heartbeat check and one more
		expect(viewChecks).toHaveLength(4);
		expect(viewer.isClosed()).toBe(false);
	});

	it("drops the outcome of a check that finishes after the viewer has gone, without a warning or a write", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		const release = deferred<void>();
		let held = false;
		canAccess.mockImplementation(async (...args) => {
			const [identity, level] = args;
			if (!held && identity.userId === user.id && level === "VIEW") {
				held = true;
				await release.promise;
				return false;
			}
			return realCanAccess(...args);
		});
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => held, "the heartbeat check to start");

		await viewer.cancel();
		await flushAll();
		const chunksBefore = viewer.chunks.length;
		release.resolve();
		await flushAll();

		expect(viewer.chunks).toHaveLength(chunksBefore);
		expect(closingReason(viewer)).toBeNull();
		const noisy = logs.entries.filter(
			(entry) =>
				entry.level === "warn" ||
				entry.level === "error" ||
				String(entry.msg).startsWith("Closing stream")
		);
		expect(noisy).toEqual([]);
	});

	it("does not start another check for a heartbeat that falls due while one is running", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		await open(user.id, world.caseId);
		const release = deferred<void>();
		let held = false;
		canAccess.mockImplementation(async (...args) => {
			const [identity, level] = args;
			if (!held && identity.userId === user.id && level === "VIEW") {
				held = true;
				await release.promise;
			}
			return realCanAccess(...args);
		});
		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
		await until(() => held, "the heartbeat check to start");
		const before = canAccess.mock.calls.length;

		await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2);
		await flushAll();

		expect(canAccess.mock.calls.length).toBe(before);
		release.resolve();
	});

	it("leaves the stream open, and the service call successful, when the check cannot be made", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		canAccess.mockImplementation((...args) => {
			const [identity, level] = args;
			if (identity.userId === user.id && level === "VIEW") {
				return Promise.reject(new Error("database unavailable"));
			}
			return realCanAccess(...args);
		});

		const result = await revokeUserPermission(
			world.owner.id,
			world.caseId,
			grant.id
		);
		await flushAll();

		expect(result).toEqual({ data: true });
		expect(viewer.isClosed()).toBe(false);

		canAccess.mockImplementation(realCanAccess);
		await passHeartbeat(1);
		expect(viewer.isClosed()).toBe(true);
		expect(closingReason(viewer)).toBe("access-removed");
	});

	it("stops waiting for a check that never answers, so the service call still returns", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		canAccess.mockImplementation((...args) => {
			const [identity, level] = args;
			if (identity.userId === user.id && level === "VIEW") {
				return new Promise<boolean>(() => undefined);
			}
			return realCanAccess(...args);
		});

		const result = await revokeUserPermission(
			world.owner.id,
			world.caseId,
			grant.id
		);

		expect(result).toEqual({ data: true });
		expect(viewer.isClosed()).toBe(false);
	}, 25_000);
});

describe("access removed behind the manager's back", () => {
	it("is still caught by the heartbeat check", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const viewer = await open(user.id, world.caseId);
		await prisma.casePermission.delete({ where: { id: grant.id } });
		await flushAll();
		expect(viewer.isClosed()).toBe(false);

		await passHeartbeat(1);

		expect(viewer.isClosed()).toBe(true);
		expect(closingReason(viewer)).toBe("access-removed");
		expect(endsWithClosingEvent(viewer)).toBe(true);
	});

	it("closes a stream opened while the revocation was committing from the check made as it opens, without a heartbeat", async () => {
		const world = await newWorld();
		const { user, grant } = await directGrant(world);
		const release = deferred<void>();
		let held = false;
		canAccess.mockImplementation(async (...args) => {
			const [identity, level] = args;
			if (!held && identity.userId === user.id && level === "VIEW") {
				held = true;
				const answer = await realCanAccess(...args);
				await release.promise;
				return answer;
			}
			return realCanAccess(...args);
		});
		const opening = open(user.id, world.caseId);
		await until(() => held, "the opening request's access check");

		await mustSucceed(
			revokeUserPermission(world.owner.id, world.caseId, grant.id)
		);
		release.resolve();
		const viewer = await opening;
		await until(viewer.isClosed, "the stream to close");

		// No heartbeat was due: the check made as the stream registered found
		// the share gone.
		expect(heartbeatsSeen(viewer)).toBe(0);
		expect(closingReason(viewer)).toBe("access-removed");
		expect(endsWithClosingEvent(viewer)).toBe(true);
		expect(liveTimers()).toBe(0);
	});

	it("closes the stream of a user who is deleted, at the next heartbeat", async () => {
		const world = await newWorld();
		const { user } = await directGrant(world);
		const peer = (await directGrant(world)).user;
		const viewer = await open(user.id, world.caseId);
		const kept = await open(peer.id, world.caseId);
		await prisma.user.delete({ where: { id: user.id } });

		await passHeartbeat(2);

		expect(viewer.isClosed()).toBe(true);
		expect(endsWithClosingEvent(viewer)).toBe(true);
		expect(kept.isClosed()).toBe(false);
	});
});
