import { describe, expect, it } from "vitest";
import { canAccessCase, viewableCaseWhere } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
	addTeamMember,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * `viewableCaseWhere` is the query form of "can this user view this case".
 * For every user and case below it must agree with `canAccessCase` at VIEW,
 * and with the plain statement of who may view a case: its creator, anyone it
 * is shared with at any level directly or through a team they belong to, and
 * nobody once it is in the trash.
 */

type User = Awaited<ReturnType<typeof createTestUser>>;
type Level = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";

const LEVELS = ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const;

/** A user given direct access to every case, at one level. */
interface DirectShare {
	level: Level;
	user: User;
}

/** Who every case is shared with, and who shared it. */
interface Sharing {
	/** A user given a direct share and a team share, and the team. */
	both: { teamId: string; userId: string };
	directShares: DirectShare[];
	granterId: string;
	/** A team that holds a share but has a user outside it. */
	lonelyTeamId: string;
	/** One team per role and level, each shared at its level. */
	teams: { id: string; level: Level }[];
}

/** The creator, a stranger and one user for each level of direct access. */
async function buildDirectUsers(creator: User) {
	const users: Record<string, User> = {
		creator,
		stranger: await createTestUser(),
	};
	const shares: DirectShare[] = [];
	for (const level of LEVELS) {
		const user = await createTestUser();
		users[`direct ${level}`] = user;
		shares.push({ level, user });
	}
	return { users, shares };
}

/** For each team role and share level, a team and a user holding that role. */
async function buildTeamUsers() {
	const users: Record<string, User> = {};
	const teams: { id: string; level: Level }[] = [];
	for (const role of ["OWNER", "ADMIN", "MEMBER"] as const) {
		for (const level of LEVELS) {
			const lead = await createTestUser();
			const team = await createTestTeam(lead.id);
			let member = lead;
			if (role !== "OWNER") {
				member = await createTestUser();
				await addTeamMember(team.id, member.id, role);
			}
			users[`team ${role} at ${level}`] = member;
			teams.push({ id: team.id, level });
		}
	}
	return { users, teams };
}

/** The users that teams reach in odd ways: not at all, or a second time. */
async function buildEdgeUsers() {
	// A member of a team that holds no share on any case below.
	const emptyLead = await createTestUser();
	await createTestTeam(emptyLead.id);

	// A user outside a team that holds a share.
	const lonelyTeamLead = await createTestUser();
	const lonelyTeam = await createTestTeam(lonelyTeamLead.id);
	const outsider = await createTestUser();

	// A user holding two shares at once: directly and through a team.
	const both = await createTestUser();
	const bothTeam = await createTestTeam(lonelyTeamLead.id);
	await addTeamMember(bothTeam.id, both.id, "MEMBER");

	const users: Record<string, User> = {
		"member of an unshared team": emptyLead,
		"outside a shared team": outsider,
		"direct and team": both,
	};
	return {
		users,
		both: { teamId: bothTeam.id, userId: both.id },
		lonelyTeamId: lonelyTeam.id,
	};
}

/** Shares one case with every user and team the grid holds. */
async function shareCase(caseId: string, sharing: Sharing) {
	const { granterId } = sharing;
	for (const { level, user } of sharing.directShares) {
		await createTestPermission(caseId, user.id, granterId, level);
	}
	for (const team of sharing.teams) {
		await createTestTeamPermission(caseId, team.id, granterId, team.level);
	}
	await createTestTeamPermission(
		caseId,
		sharing.lonelyTeamId,
		granterId,
		"VIEW"
	);
	await createTestPermission(caseId, sharing.both.userId, granterId, "COMMENT");
	await createTestTeamPermission(
		caseId,
		sharing.both.teamId,
		granterId,
		"VIEW"
	);
}

/** A live and a trashed case of each kind, each shared as `sharing` says. */
async function buildCases(creator: User, sharing: Sharing) {
	const cases: Record<
		string,
		{ id: string; kind: "CASE" | "PATTERN"; trashed: boolean }
	> = {};
	for (const kind of ["CASE", "PATTERN"] as const) {
		for (const trashed of [false, true]) {
			const label = `${trashed ? "trashed " : ""}${kind}`;
			const made = await prisma.assuranceCase.create({
				data: {
					name: label,
					description: label,
					kind,
					createdById: creator.id,
					deletedAt: trashed ? new Date() : null,
				},
			});
			cases[label] = { id: made.id, kind, trashed };
			await shareCase(made.id, sharing);
		}
	}
	return cases;
}

/** Everything below is built once per test: users, teams and cases. */
async function grid() {
	const creator = await createTestUser();
	const granter = await createTestUser();
	const direct = await buildDirectUsers(creator);
	const byTeam = await buildTeamUsers();
	const edge = await buildEdgeUsers();

	const users = { ...direct.users, ...byTeam.users, ...edge.users };
	const cases = await buildCases(creator, {
		both: edge.both,
		directShares: direct.shares,
		granterId: granter.id,
		lonelyTeamId: edge.lonelyTeamId,
		teams: byTeam.teams,
	});

	return { users, cases };
}

/** Whether the user may view the case, from the plain statement of the rule. */
function shouldView(userName: string, trashed: boolean) {
	if (trashed) {
		return false;
	}
	return !(
		userName === "stranger" ||
		userName === "member of an unshared team" ||
		userName === "outside a shared team"
	);
}

describe("viewableCaseWhere", () => {
	it("matches canAccessCase at VIEW for every user and every case, and the plain rule", async () => {
		const { users, cases } = await grid();

		for (const [userName, user] of Object.entries(users)) {
			const viewable = new Set(
				(
					await prisma.assuranceCase.findMany({
						where: viewableCaseWhere(user.id),
						select: { id: true },
					})
				).map((row) => row.id)
			);
			for (const [caseName, theCase] of Object.entries(cases)) {
				const byFunction = await canAccessCase(
					{ userId: user.id, caseId: theCase.id },
					"VIEW"
				);
				const byQuery = viewable.has(theCase.id);
				expect(byQuery, `${userName} / ${caseName} against canAccessCase`).toBe(
					byFunction
				);
				expect(byQuery, `${userName} / ${caseName} against the rule`).toBe(
					shouldView(userName, theCase.trashed)
				);
			}
		}
	});

	it("answers the same for one case named by id as for the whole list", async () => {
		const { users, cases } = await grid();

		for (const [userName, user] of Object.entries(users)) {
			for (const [caseName, theCase] of Object.entries(cases)) {
				const found = await prisma.assuranceCase.findFirst({
					where: { id: theCase.id, ...viewableCaseWhere(user.id) },
					select: { id: true },
				});
				expect(found !== null, `${userName} / ${caseName}`).toBe(
					shouldView(userName, theCase.trashed)
				);
			}
		}
	});

	it("narrows rather than widens when combined with a kind filter, however it is combined", async () => {
		const { users, cases } = await grid();
		const user = users["team MEMBER at VIEW"];
		if (!user) {
			throw new Error("missing user");
		}

		const spread = await prisma.assuranceCase.findMany({
			where: { kind: "PATTERN", ...viewableCaseWhere(user.id) },
			select: { id: true },
		});
		const wrapped = await prisma.assuranceCase.findMany({
			where: { kind: "PATTERN", AND: [viewableCaseWhere(user.id)] },
			select: { id: true },
		});

		expect(spread.map((row) => row.id)).toEqual([cases.PATTERN?.id]);
		expect(wrapped.map((row) => row.id)).toEqual([cases.PATTERN?.id]);
	});

	it("lists each viewable case once, though a user can see it in several ways", async () => {
		const { users, cases } = await grid();
		const user = users["direct and team"];
		if (!user) {
			throw new Error("missing user");
		}

		const rows = await prisma.assuranceCase.findMany({
			where: viewableCaseWhere(user.id),
			select: { id: true },
		});

		expect(rows.map((row) => row.id).sort()).toEqual(
			[cases.CASE?.id, cases.PATTERN?.id].sort()
		);
	});

	it("applies to the case an element belongs to, as the import's lookups use it", async () => {
		const { users, cases } = await grid();
		const owner = users.creator;
		const reader = users["direct VIEW"];
		const outsider = users.stranger;
		if (!(owner && reader && outsider && cases.CASE && cases["trashed CASE"])) {
			throw new Error("missing fixture");
		}
		const live = await createTestElement(cases.CASE.id, owner.id, {
			name: "G1",
		});
		const trashed = await createTestElement(
			cases["trashed CASE"].id,
			owner.id,
			{
				name: "G1",
			}
		);
		const find = (userId: string) =>
			prisma.assuranceElement.findMany({
				where: {
					id: { in: [live.id, trashed.id] },
					case: viewableCaseWhere(userId),
				},
				select: { id: true },
			});

		expect((await find(reader.id)).map((row) => row.id)).toEqual([live.id]);
		expect((await find(owner.id)).map((row) => row.id)).toEqual([live.id]);
		expect(await find(outsider.id)).toEqual([]);
	});

	it("matches nothing for a user id that no one holds", async () => {
		await grid();

		const rows = await prisma.assuranceCase.findMany({
			where: viewableCaseWhere("00000000-0000-4000-8000-000000000000"),
			select: { id: true },
		});

		expect(rows).toEqual([]);
	});
});
