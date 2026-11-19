import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { listAdministrableCases } from "@/lib/services/case-fetch-service";
import {
	buildWorld,
	LEVELS,
	type Level,
	type TeamRole,
	teamWithRole,
	type User,
} from "../utils/administrable-cases-kit";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * Which cases the case-grants route accepts, set against which cases the
 * integrations grant form lists. The route needs ADMIN on the case; the form
 * must offer every case that passes and no case that fails.
 */

beforeEach(async () => {
	await mockNoAuth();
});

const NOT_FOUND_ID = "00000000-0000-0000-0000-000000000000";
const GRANT_EVENT = "integration_case_access_granted";

async function postGrant(integrationId: string, caseId: string) {
	const { POST } = await import(
		"@/app/api/integrations/[id]/case-grants/route"
	);
	return POST(
		new Request(
			`http://localhost:3000/api/integrations/${integrationId}/case-grants`,
			{ method: "POST", body: JSON.stringify({ caseId, permission: "EDIT" }) }
		),
		{ params: Promise.resolve({ id: integrationId }) }
	);
}

/** A signed-in owner of an integration, and the integration's machine user. */
async function signedInOwner() {
	const owner = await createTestUser();
	const made = await createTestIntegrationWithSystemUser(owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, ...made };
}

function storedGrant(caseId: string, systemUserId: string) {
	return prisma.casePermission.findUnique({
		where: { caseId_userId: { caseId, userId: systemUserId } },
	});
}

function grantEvents(userId: string) {
	return prisma.securityAuditLog.count({
		where: { userId, eventType: GRANT_EVENT },
	});
}

/** Shares a case the owner did not make with the owner, directly. */
async function shareDirectly(owner: User, level: Level) {
	const creator = await createTestUser();
	const theCase = await createTestCase(creator.id);
	await createTestPermission(theCase.id, owner.id, creator.id, level);
	return theCase;
}

/** Shares a case the owner did not make with a team the owner holds a role in. */
async function shareToTeam(owner: User, role: TeamRole, level: Level) {
	const creator = await createTestUser();
	const theCase = await createTestCase(creator.id);
	const team = await teamWithRole(owner.id, role);
	await createTestTeamPermission(theCase.id, team.id, creator.id, level);
	return theCase;
}

/** What came of one attempt to grant a case, and what it left behind. */
async function attempt(
	owner: User,
	integration: { id: string },
	systemUserId: string,
	caseId: string
) {
	const response = await postGrant(integration.id, caseId);
	const missing = await postGrant(integration.id, NOT_FOUND_ID);
	return {
		status: response.status,
		body: await response.json(),
		missingBody: await missing.json(),
		stored: await storedGrant(caseId, systemUserId),
		events: await grantEvents(owner.id),
	};
}

interface Way {
	share: (owner: User, level: Level) => Promise<{ id: string }>;
	via: string;
}

const WAYS: Way[] = [
	{ via: "directly", share: shareDirectly },
	{
		via: "to a team the owner belongs to",
		share: (owner, level) => shareToTeam(owner, "MEMBER", level),
	},
];

const BELOW_ADMIN = LEVELS.filter((level) => level !== "ADMIN");

const REFUSED = WAYS.flatMap((way) =>
	BELOW_ADMIN.map((level) => ({ ...way, level }))
);

const ACCEPTED: Array<{
	share: (owner: User) => Promise<{ id: string }>;
	via: string;
}> = [
	{ via: "directly", share: (owner) => shareDirectly(owner, "ADMIN") },
	...(["MEMBER", "ADMIN", "OWNER"] as const).map((role) => ({
		via: `to a team in which the owner is ${role}`,
		share: (owner: User) => shareToTeam(owner, role, "ADMIN"),
	})),
];

describe("granting a case that is shared with the owner below Admin", () => {
	it.each(
		REFUSED
	)("refuses a case shared $via at $level with the not-found answer and stores nothing", async ({
		level,
		share,
	}) => {
		const { owner, integration, systemUser } = await signedInOwner();
		const theCase = await share(owner, level);

		const outcome = await attempt(
			owner,
			integration,
			systemUser.id,
			theCase.id
		);

		expect(outcome.status).toBe(404);
		expect(outcome.body).toEqual(outcome.missingBody);
		expect(outcome.stored).toBeNull();
		expect(outcome.events).toBe(0);
	});
});

describe("granting a case that is shared with the owner at Admin", () => {
	it.each(
		ACCEPTED
	)("accepts a case shared at ADMIN $via and stores the grant", async ({
		share,
	}) => {
		const { owner, integration, systemUser } = await signedInOwner();
		const theCase = await share(owner);

		const outcome = await attempt(
			owner,
			integration,
			systemUser.id,
			theCase.id
		);

		expect(outcome.status).toBe(201);
		expect(outcome.stored?.permission).toBe("EDIT");
		expect(outcome.events).toBe(1);
		expect(
			await canAccessCase({ userId: systemUser.id, caseId: theCase.id }, "EDIT")
		).toBe(true);
	});
});

describe("the grant form's list and the grant route", () => {
	it("accept the same cases: every listed case is granted, and every other ordinary case is refused", async () => {
		const world = await buildWorld();
		const reader = world.people.reader;
		const made = await createTestIntegrationWithSystemUser(reader.id);
		await mockAuth(reader.id, reader.username, reader.email);
		const listed = new Set(
			expectSuccess(await listAdministrableCases(reader.id)).map(
				(row) => row.id
			)
		);
		const ordinary = world.cases.filter(
			(theCase) => theCase.spec.kind !== "PATTERN"
		);

		const statuses: Record<string, number> = {};
		for (const theCase of ordinary) {
			const response = await postGrant(made.integration.id, theCase.id);
			statuses[theCase.spec.name] = response.status;
		}

		const expected = Object.fromEntries(
			ordinary.map((theCase) => [
				theCase.spec.name,
				listed.has(theCase.id) ? 201 : 404,
			])
		);
		expect(listed.size).toBeGreaterThan(0);
		expect(statuses).toEqual(expected);
	});
});
