import { describe, expect, it } from "vitest";
import {
	administrableCaseWhere,
	canAccessCase,
	getCasePermission,
	getTeamRole,
	isLastTeamAdmin,
	isTeamAdmin,
	isTeamMember,
	validateTeamAdmin,
	validateTeamMember,
	viewableCaseWhere,
} from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";

const LEVELS: Level[] = ["VIEW", "COMMENT", "EDIT", "ADMIN"];
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

const NO_ACCESS = { hasAccess: false, permission: null, isOwner: false };

/** For a level held, whether each required level is met. */
const MEETS: Record<Level, Record<Level, boolean>> = {
	VIEW: { VIEW: true, COMMENT: false, EDIT: false, ADMIN: false },
	COMMENT: { VIEW: true, COMMENT: true, EDIT: false, ADMIN: false },
	EDIT: { VIEW: true, COMMENT: true, EDIT: true, ADMIN: false },
	ADMIN: { VIEW: true, COMMENT: true, EDIT: true, ADMIN: true },
};

const NOTHING_MET: Record<Level, boolean> = {
	VIEW: false,
	COMMENT: false,
	EDIT: false,
	ADMIN: false,
};

const ALL_MET: Record<Level, boolean> = MEETS.ADMIN;

const GRANTED = (permission: Level, isOwner = false) => ({
	hasAccess: true,
	permission,
	isOwner,
});

/** A case, its creator and one other person. */
async function buildCase() {
	const owner = await createTestUser();
	const person = await createTestUser();
	const testCase = await createTestCase(owner.id);
	return { owner, person, caseId: testCase.id };
}

/** A team the person belongs to, shared on the case at `level`. */
async function shareThroughTeam(
	ctx: Awaited<ReturnType<typeof buildCase>>,
	level: Level,
	role: "ADMIN" | "MEMBER" = "MEMBER"
) {
	const team = await createTestTeam(ctx.owner.id);
	await addTeamMember(team.id, ctx.person.id, role);
	await createTestTeamPermission(ctx.caseId, team.id, ctx.owner.id, level);
	return team;
}

async function accessAt(
	userId: string,
	caseId: string
): Promise<Record<Level, boolean>> {
	const entries = await Promise.all(
		LEVELS.map(
			async (level) =>
				[level, await canAccessCase({ userId, caseId }, level)] as const
		)
	);
	return Object.fromEntries(entries) as Record<Level, boolean>;
}

describe("getCasePermission and canAccessCase: how a person holds a level", () => {
	it("gives the creator ADMIN, owner, and every required level", async () => {
		const ctx = await buildCase();
		expect(
			await getCasePermission({ userId: ctx.owner.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED("ADMIN", true));
		expect(await accessAt(ctx.owner.id, ctx.caseId)).toStrictEqual(ALL_MET);
	});

	it.each(
		LEVELS
	)("gives a direct %s grant exactly that level", async (level) => {
		const ctx = await buildCase();
		await createTestPermission(ctx.caseId, ctx.person.id, ctx.owner.id, level);
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED(level));
		expect(await accessAt(ctx.person.id, ctx.caseId)).toStrictEqual(
			MEETS[level]
		);
	});

	it.each(LEVELS)("gives a team %s grant exactly that level", async (level) => {
		const ctx = await buildCase();
		await shareThroughTeam(ctx, level);
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED(level));
		expect(await accessAt(ctx.person.id, ctx.caseId)).toStrictEqual(
			MEETS[level]
		);
	});

	it("gives a team grant to an admin of the team as well as to a member", async () => {
		const ctx = await buildCase();
		await shareThroughTeam(ctx, "EDIT", "ADMIN");
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED("EDIT"));
	});

	it.each<[Level, Level, Level]>([
		["ADMIN", "VIEW", "ADMIN"],
		["VIEW", "ADMIN", "ADMIN"],
		["EDIT", "COMMENT", "EDIT"],
		["COMMENT", "EDIT", "EDIT"],
	])("gives the higher of a direct %s grant and a team %s grant", async (direct, viaTeam, expected) => {
		const ctx = await buildCase();
		await createTestPermission(ctx.caseId, ctx.person.id, ctx.owner.id, direct);
		await shareThroughTeam(ctx, viaTeam);
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED(expected));
		expect(await accessAt(ctx.person.id, ctx.caseId)).toStrictEqual(
			MEETS[expected]
		);
	});

	it.each<[Level, Level]>([
		["VIEW", "EDIT"],
		["EDIT", "VIEW"],
	])("gives the higher level for grants through two teams, %s then %s", async (first, second) => {
		const ctx = await buildCase();
		await shareThroughTeam(ctx, first);
		await shareThroughTeam(ctx, second);
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(GRANTED("EDIT"));
	});

	it("refuses a member of a team that has no grant on the case", async () => {
		const ctx = await buildCase();
		const team = await createTestTeam(ctx.owner.id);
		await addTeamMember(team.id, ctx.person.id);
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(NO_ACCESS);
		expect(await accessAt(ctx.person.id, ctx.caseId)).toStrictEqual(
			NOTHING_MET
		);
	});

	it("refuses a person outside a team that holds a grant on the case", async () => {
		const ctx = await buildCase();
		const team = await createTestTeam(ctx.owner.id);
		await createTestTeamPermission(ctx.caseId, team.id, ctx.owner.id, "ADMIN");
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(NO_ACCESS);
	});

	it("refuses a person whose grant is on another case", async () => {
		const ctx = await buildCase();
		const other = await createTestCase(ctx.owner.id);
		await createTestPermission(other.id, ctx.person.id, ctx.owner.id, "ADMIN");
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(NO_ACCESS);
	});

	it("refuses a person with no link to the case, at every level and by default", async () => {
		const ctx = await buildCase();
		expect(
			await getCasePermission({ userId: ctx.person.id, caseId: ctx.caseId })
		).toStrictEqual(NO_ACCESS);
		expect(await accessAt(ctx.person.id, ctx.caseId)).toStrictEqual(
			NOTHING_MET
		);
		expect(
			await canAccessCase({ userId: ctx.person.id, caseId: ctx.caseId })
		).toBe(false);
	});

	it("answers a case that does not exist as no access", async () => {
		const ctx = await buildCase();
		expect(
			await getCasePermission({ userId: ctx.owner.id, caseId: MISSING_ID })
		).toStrictEqual(NO_ACCESS);
		expect(await accessAt(ctx.owner.id, MISSING_ID)).toStrictEqual(NOTHING_MET);
	});

	it("checks VIEW when no level is required", async () => {
		const ctx = await buildCase();
		await createTestPermission(ctx.caseId, ctx.person.id, ctx.owner.id, "VIEW");
		expect(
			await canAccessCase({ userId: ctx.person.id, caseId: ctx.caseId })
		).toBe(true);
	});
});

describe("viewableCaseWhere and administrableCaseWhere", () => {
	async function buildGrid() {
		const owner = await createTestUser();
		const person = await createTestUser();
		const third = await createTestUser();
		const made = (name: string, by = owner.id) =>
			createTestCase(by, { name }).then((c) => c.id);

		await made("own", person.id);
		const trashed = await made("own-trashed", person.id);
		await prisma.assuranceCase.update({
			where: { id: trashed },
			data: { deletedAt: new Date() },
		});
		await made("unshared");
		for (const level of LEVELS) {
			const direct = await made(`direct-${level}`);
			await createTestPermission(direct, person.id, owner.id, level);
			const viaTeam = await made(`team-${level}`);
			const team = await createTestTeam(owner.id);
			await addTeamMember(team.id, person.id);
			await createTestTeamPermission(viaTeam, team.id, owner.id, level);
		}
		const foreignTeam = await createTestTeam(owner.id);
		const foreignTeamCase = await made("foreign-team");
		await createTestTeamPermission(
			foreignTeamCase,
			foreignTeam.id,
			owner.id,
			"ADMIN"
		);
		const toThird = await made("direct-to-third");
		await createTestPermission(toThird, third.id, owner.id, "ADMIN");
		return { person, third };
	}

	async function namesFor(
		where: Parameters<typeof prisma.assuranceCase.findMany>[0]
	) {
		const rows = await prisma.assuranceCase.findMany({
			...where,
			select: { name: true },
		});
		return rows.map((r) => r.name).sort();
	}

	it("lists the cases a person created or holds at any level, and none in the bin", async () => {
		const { person } = await buildGrid();
		expect(
			await namesFor({ where: viewableCaseWhere(person.id) })
		).toStrictEqual(
			[
				"direct-ADMIN",
				"direct-COMMENT",
				"direct-EDIT",
				"direct-VIEW",
				"own",
				"team-ADMIN",
				"team-COMMENT",
				"team-EDIT",
				"team-VIEW",
			].sort()
		);
	});

	it("lists as administrable only the cases created or held at ADMIN", async () => {
		const { person } = await buildGrid();
		expect(
			await namesFor({ where: administrableCaseWhere(person.id) })
		).toStrictEqual(["direct-ADMIN", "own", "team-ADMIN"]);
	});

	it("lists for another person only what is shared with them", async () => {
		const { third } = await buildGrid();
		expect(
			await namesFor({ where: viewableCaseWhere(third.id) })
		).toStrictEqual(["direct-to-third"]);
		expect(
			await namesFor({ where: administrableCaseWhere(third.id) })
		).toStrictEqual(["direct-to-third"]);
	});
});

describe("team roles", () => {
	async function buildTeam() {
		const creator = await createTestUser();
		const admin = await createTestUser();
		const member = await createTestUser();
		const outsider = await createTestUser();
		const team = await createTestTeam(creator.id);
		await addTeamMember(team.id, admin.id, "ADMIN");
		await addTeamMember(team.id, member.id, "MEMBER");
		return { creator, admin, member, outsider, teamId: team.id };
	}

	it("reads each person's role, and null for anyone not in the team", async () => {
		const t = await buildTeam();
		expect(await getTeamRole(t.creator.id, t.teamId)).toBe("OWNER");
		expect(await getTeamRole(t.admin.id, t.teamId)).toBe("ADMIN");
		expect(await getTeamRole(t.member.id, t.teamId)).toBe("MEMBER");
		expect(await getTeamRole(t.outsider.id, t.teamId)).toBeNull();
		expect(await getTeamRole(t.admin.id, MISSING_ID)).toBeNull();
	});

	it("treats owner and admin as team admins, and a member or outsider not", async () => {
		const t = await buildTeam();
		expect(await isTeamAdmin(t.creator.id, t.teamId)).toBe(true);
		expect(await isTeamAdmin(t.admin.id, t.teamId)).toBe(true);
		expect(await isTeamAdmin(t.member.id, t.teamId)).toBe(false);
		expect(await isTeamAdmin(t.outsider.id, t.teamId)).toBe(false);
		expect(await isTeamAdmin(t.admin.id, MISSING_ID)).toBe(false);
	});

	it("treats every role as a team member, and an outsider not", async () => {
		const t = await buildTeam();
		expect(await isTeamMember(t.creator.id, t.teamId)).toBe(true);
		expect(await isTeamMember(t.admin.id, t.teamId)).toBe(true);
		expect(await isTeamMember(t.member.id, t.teamId)).toBe(true);
		expect(await isTeamMember(t.outsider.id, t.teamId)).toBe(false);
		expect(await isTeamMember(t.member.id, MISSING_ID)).toBe(false);
	});

	it("validates a team admin and refuses everyone else with the same message", async () => {
		const t = await buildTeam();
		const refused = { valid: false, error: "Permission denied" };
		expect(await validateTeamAdmin(t.admin.id, t.teamId)).toStrictEqual({
			valid: true,
		});
		expect(await validateTeamAdmin(t.creator.id, t.teamId)).toStrictEqual({
			valid: true,
		});
		expect(await validateTeamAdmin(t.member.id, t.teamId)).toStrictEqual(
			refused
		);
		expect(await validateTeamAdmin(t.outsider.id, t.teamId)).toStrictEqual(
			refused
		);
		expect(await validateTeamAdmin(t.admin.id, MISSING_ID)).toStrictEqual(
			refused
		);
	});

	it("validates a team member of any role and refuses an outsider", async () => {
		const t = await buildTeam();
		const refused = { valid: false, error: "Permission denied" };
		for (const user of [t.creator, t.admin, t.member]) {
			expect(await validateTeamMember(user.id, t.teamId)).toStrictEqual({
				valid: true,
			});
		}
		expect(await validateTeamMember(t.outsider.id, t.teamId)).toStrictEqual(
			refused
		);
		expect(await validateTeamMember(t.member.id, MISSING_ID)).toStrictEqual(
			refused
		);
	});
});

describe("isLastTeamAdmin", () => {
	/** A team that has only plain members, plus an outsider. */
	async function buildMembersOnlyTeam() {
		const creator = await createTestUser();
		const member = await createTestUser();
		const outsider = await createTestUser();
		const team = await createTestTeam(creator.id);
		await addTeamMember(team.id, member.id, "MEMBER");
		await prisma.teamMember.deleteMany({
			where: { teamId: team.id, userId: creator.id },
		});
		return { member, outsider, teamId: team.id };
	}

	it("is true for the one admin of a team", async () => {
		const admin = await createTestUser();
		const team = await createTestTeam(admin.id);
		await prisma.teamMember.update({
			where: { teamId_userId: { teamId: team.id, userId: admin.id } },
			data: { role: "ADMIN" },
		});
		expect(await isLastTeamAdmin(admin.id, team.id)).toBe(true);
	});

	it("is true for the one admin when the others are plain members", async () => {
		const admin = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(admin.id);
		await prisma.teamMember.update({
			where: { teamId_userId: { teamId: team.id, userId: admin.id } },
			data: { role: "ADMIN" },
		});
		await addTeamMember(team.id, member.id, "MEMBER");
		expect(await isLastTeamAdmin(admin.id, team.id)).toBe(true);
	});

	it("is true for the sole owner", async () => {
		const owner = await createTestUser();
		const team = await createTestTeam(owner.id);
		expect(await isLastTeamAdmin(owner.id, team.id)).toBe(true);
	});

	it("is false for each of two admins", async () => {
		const first = await createTestUser();
		const second = await createTestUser();
		const team = await createTestTeam(first.id);
		await prisma.teamMember.delete({
			where: { teamId_userId: { teamId: team.id, userId: first.id } },
		});
		await addTeamMember(team.id, first.id, "ADMIN");
		await addTeamMember(team.id, second.id, "ADMIN");
		expect(await isLastTeamAdmin(first.id, team.id)).toBe(false);
		expect(await isLastTeamAdmin(second.id, team.id)).toBe(false);
	});

	it("is false for an admin when the team also has an owner", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, admin.id, "ADMIN");
		expect(await isLastTeamAdmin(admin.id, team.id)).toBe(false);
	});

	it("is false for an owner when the team also has an admin", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, admin.id, "ADMIN");
		expect(await isLastTeamAdmin(owner.id, team.id)).toBe(false);
	});

	it("is false for a plain member of a team that has no admin", async () => {
		const t = await buildMembersOnlyTeam();
		expect(await isLastTeamAdmin(t.member.id, t.teamId)).toBe(false);
	});

	it("is false for a person outside a team that has no admin", async () => {
		const t = await buildMembersOnlyTeam();
		expect(await isLastTeamAdmin(t.outsider.id, t.teamId)).toBe(false);
	});

	it("is false for a team that does not exist", async () => {
		const user = await createTestUser();
		expect(await isLastTeamAdmin(user.id, MISSING_ID)).toBe(false);
	});
});
