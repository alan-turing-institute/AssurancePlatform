import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { revokeHealthEvidence } from "@/lib/services/health-evidence-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addClaim,
	appendRecord,
	callBoundCheck,
	callReinstate,
	callRevoke,
	callStatus,
	importMachineRoute,
	machineGet,
	setupClaim,
	setupMachineWriter,
} from "../utils/health-adversarial-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const NONEXISTENT = "00000000-0000-4000-8000-000000000999";

beforeEach(async () => {
	await mockNoAuth();
});

type Role =
	| "owner"
	| "directEdit"
	| "teamEdit"
	| "comment"
	| "view"
	| "none"
	| "signedOut";

/** One case with a claim and one actor per role. */
async function world() {
	const base = await setupClaim();
	const { owner, testCase } = base;
	const actors: Record<Exclude<Role, "signedOut">, { id: string }> = {
		owner,
		directEdit: await createTestUser(),
		teamEdit: await createTestUser(),
		comment: await createTestUser(),
		view: await createTestUser(),
		none: await createTestUser(),
	};
	await createTestPermission(
		testCase.id,
		actors.directEdit.id,
		owner.id,
		"EDIT"
	);
	await createTestPermission(
		testCase.id,
		actors.comment.id,
		owner.id,
		"COMMENT"
	);
	await createTestPermission(testCase.id, actors.view.id, owner.id, "VIEW");
	const team = await createTestTeam(owner.id);
	await addTeamMember(team.id, actors.teamEdit.id, "MEMBER", owner.id);
	await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
	return { ...base, actors };
}

async function actAs(role: Role, actors: Record<string, { id: string }>) {
	if (role === "signedOut") {
		await mockNoAuth();
		return;
	}
	await mockAuth(actors[role]?.id ?? "");
}

const ROLES: [Role, number][] = [
	["owner", 201],
	["directEdit", 201],
	["teamEdit", 201],
	["comment", 404],
	["view", 404],
	["none", 404],
	["signedOut", 401],
];

async function openRevocations(evidenceRecordId: string) {
	return await prisma.pluginHealthRevocation.count({
		where: { evidence: { recordId: evidenceRecordId }, reinstatedAt: null },
	});
}

describe("revocation route: who may revoke", () => {
	it.each(ROLES)("%s gets %i", async (role, expected) => {
		const { owner, claim, actors } = await world();
		const record = await appendRecord(owner.id, claim.id);
		await actAs(role, actors);

		const response = await callRevoke(claim.id, record.record_id);

		expect(response.status).toBe(expected);
		expect(await openRevocations(record.record_id)).toBe(
			expected === 201 ? 1 : 0
		);
	});

	it("gives the same answer for a claim the caller cannot see as for a claim that does not exist", async () => {
		const { owner, claim, actors } = await world();
		const record = await appendRecord(owner.id, claim.id);
		await mockAuth(actors.none.id);

		const hidden = await callRevoke(claim.id, record.record_id);
		const missing = await callRevoke(NONEXISTENT, record.record_id);

		expect(hidden.status).toBe(404);
		expect(missing.status).toBe(hidden.status);
		expect(await missing.json()).toEqual(await hidden.json());
	});

	it("gives the same answer for a view-only caller as for a missing claim", async () => {
		const { owner, claim, actors } = await world();
		const record = await appendRecord(owner.id, claim.id);
		await mockAuth(actors.view.id);

		const viewOnly = await callRevoke(claim.id, record.record_id);
		const missing = await callRevoke(NONEXISTENT, record.record_id);

		expect(await viewOnly.json()).toEqual(await missing.json());
	});

	it("refuses an element that is not a property claim exactly as it refuses a missing one", async () => {
		const { owner, testCase } = await setupClaim();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(owner.id);

		const goalResponse = await callRevoke(
			goal.id,
			"11111111-1111-4111-8111-111111111111"
		);
		const missing = await callRevoke(
			NONEXISTENT,
			"11111111-1111-4111-8111-111111111111"
		);

		expect(goalResponse.status).toBe(404);
		expect(await goalResponse.json()).toEqual(await missing.json());
	});

	it("does not revoke a record that belongs to a different claim of the same case", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await addClaim(testCase.id, owner.id);
		const record = await appendRecord(owner.id, other.id);
		await mockAuth(owner.id);

		const response = await callRevoke(claim.id, record.record_id);

		expect(response.status).toBe(404);
		expect(await openRevocations(record.record_id)).toBe(0);
	});

	it("does not reveal a record in a case the caller cannot see: same answer as an unknown record id", async () => {
		const { owner, claim } = await setupClaim();
		const stranger = await createTestUser();
		const strangerCase = await createTestCase(stranger.id);
		const strangerClaim = await createTestElement(
			strangerCase.id,
			stranger.id,
			{ elementType: "PROPERTY_CLAIM" }
		);
		const hiddenRecord = await appendRecord(stranger.id, strangerClaim.id);
		await mockAuth(owner.id);

		const viaOwnClaim = await callRevoke(claim.id, hiddenRecord.record_id);
		const unknown = await callRevoke(claim.id, NONEXISTENT);
		const viaHiddenClaim = await callRevoke(
			strangerClaim.id,
			hiddenRecord.record_id
		);
		const missingClaim = await callRevoke(NONEXISTENT, hiddenRecord.record_id);

		expect(viaOwnClaim.status).toBe(404);
		expect(await viaOwnClaim.json()).toEqual(await unknown.json());
		expect(viaHiddenClaim.status).toBe(404);
		expect(await viaHiddenClaim.json()).toEqual(await missingClaim.json());
		expect(await openRevocations(hiddenRecord.record_id)).toBe(0);
	});

	it("refuses a machine token: a bearer header alone does not authenticate a revocation", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const record = await appendRecord(owner.id, claim.id);
		const { secret } = await setupMachineWriter(owner.id, testCase.id);
		await mockNoAuth();
		const { POST } = await import(
			"@/app/api/elements/[id]/health/records/[recordId]/revocation/route"
		);
		const { sessionJson, revocationUrl } = await import(
			"../utils/health-adversarial-kit"
		);

		const response = await POST(
			sessionJson(
				revocationUrl(claim.id, record.record_id),
				"POST",
				{ cause: "other", reason: "x" },
				{ authorization: `Bearer ${secret}` }
			),
			{ params: Promise.resolve({ id: claim.id, recordId: record.record_id }) }
		);

		expect(response.status).toBe(401);
		expect(await openRevocations(record.record_id)).toBe(0);
	});
});

describe("reinstatement route: who may reinstate", () => {
	it.each(
		ROLES
	)("%s gets %i (200 or 201 counts as success)", async (role, expected) => {
		const { owner, claim, actors } = await world();
		const record = await appendRecord(owner.id, claim.id);
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "other",
				reason: "x",
			})
		);
		await actAs(role, actors);

		const response = await callReinstate(claim.id, record.record_id);

		if (expected === 201) {
			expect([200, 201]).toContain(response.status);
			expect(await openRevocations(record.record_id)).toBe(0);
		} else {
			expect(response.status).toBe(expected);
			expect(await openRevocations(record.record_id)).toBe(1);
		}
	});

	it("refuses to reinstate a record of a different claim and leaves its revocation open", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const other = await addClaim(testCase.id, owner.id);
		const record = await appendRecord(owner.id, other.id);
		expectSuccess(
			await revokeHealthEvidence(owner.id, other.id, record.record_id, {
				cause: "other",
				reason: "x",
			})
		);
		await mockAuth(owner.id);

		const response = await callReinstate(claim.id, record.record_id);

		expect(response.status).toBe(404);
		expect(await openRevocations(record.record_id)).toBe(1);
	});
});

describe("bound-check route: who may change the check", () => {
	it.each(
		ROLES
	)("%s gets %i (200 or 201 counts as success)", async (role, expected) => {
		const { owner, claim, actors } = await world();
		await appendRecord(owner.id, claim.id);
		await actAs(role, actors);

		const response = await callBoundCheck(claim.id);

		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		if (expected === 201) {
			expect([200, 201]).toContain(response.status);
			expect(state.boundCheckName).toBe("Another Checker");
		} else {
			expect(response.status).toBe(expected);
			expect(state.boundCheckName).not.toBe("Another Checker");
		}
	});

	it("refuses a missing claim and a non-claim element with the same answer as no access", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const outsider = await createTestUser();
		await mockAuth(outsider.id);
		const hidden = await callBoundCheck(claim.id);
		await mockAuth(owner.id);
		const missing = await callBoundCheck(NONEXISTENT);
		const notClaim = await callBoundCheck(goal.id);

		expect(hidden.status).toBe(404);
		const hiddenBody = await hidden.json();
		expect(await missing.json()).toEqual(hiddenBody);
		expect(await notClaim.json()).toEqual(hiddenBody);
	});
});

describe("the two reads: who may read", () => {
	const READ_ROLES: [Role, number][] = [
		["owner", 200],
		["directEdit", 200],
		["teamEdit", 200],
		["comment", 200],
		["view", 200],
		["none", 404],
		["signedOut", 401],
	];

	it.each(READ_ROLES)("status route: %s gets %i", async (role, expected) => {
		const { owner, claim, actors } = await world();
		await appendRecord(owner.id, claim.id);
		await actAs(role, actors);

		const response = await callStatus(claim.id);

		expect(response.status).toBe(expected);
	});

	it.each(
		READ_ROLES
	)("evidence list route: %s gets %i", async (role, expected) => {
		const { owner, claim, actors } = await world();
		await appendRecord(owner.id, claim.id);
		await actAs(role, actors);
		const { GET } = await importMachineRoute();

		const response = await GET(machineGet(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(expected);
	});

	it("evidence list route: a missing claim and a claim the caller cannot see give the same answer", async () => {
		const { owner, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id);
		const outsider = await createTestUser();
		await mockAuth(outsider.id);
		const { GET } = await importMachineRoute();

		const hidden = await GET(machineGet(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});
		const missing = await GET(machineGet(NONEXISTENT), {
			params: Promise.resolve({ id: NONEXISTENT }),
		});

		expect(hidden.status).toBe(404);
		expect(await hidden.json()).toEqual(await missing.json());
	});

	it("evidence list route: a token without the read scope, and a token with no grant on the case, are refused", async () => {
		const { owner, testCase, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id);
		const writeOnly = await setupMachineWriter(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const noGrant = await setupMachineWriter(
			owner.id,
			testCase.id,
			["health:evidence:read"],
			null
		);
		const { GET } = await importMachineRoute();

		const wrongScope = await GET(machineGet(claim.id, writeOnly.secret), {
			params: Promise.resolve({ id: claim.id }),
		});
		const ungranted = await GET(machineGet(claim.id, noGrant.secret), {
			params: Promise.resolve({ id: claim.id }),
		});
		const missing = await GET(machineGet(NONEXISTENT, noGrant.secret), {
			params: Promise.resolve({ id: NONEXISTENT }),
		});

		expect(wrongScope.status).toBe(401);
		expect(ungranted.status).toBe(404);
		expect(await ungranted.json()).toEqual(await missing.json());
	});
});
