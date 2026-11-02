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

/** Everything below is built once per test: users, teams and cases. */
async function grid() {
	const creator = await createTestUser();
	const granter = await createTestUser();

	const users: Record<string, User> = {
		creator,
		stranger: await createTestUser(),
	};
	for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
		users[`direct ${level}`] = await createTestUser();
	}

	const teams: Record<string, { id: string; level: Level }> = {};
	for (const role of ["OWNER", "ADMIN", "MEMBER"] as const) {
		for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
			const lead = await createTestUser();
			const team = await createTestTeam(lead.id);
			let member = lead;
			if (role !== "OWNER") {
				member = await createTestUser();
				await addTeamMember(team.id, member.id, role);
			}
			users[`team ${role} at ${level}`] = member;
			teams[`team ${role} at ${level}`] = { id: team.id, level };
		}
	}

	// A member of a team that holds no share on any case below.
	const emptyLead = await createTestUser();
	await createTestTeam(emptyLead.id);
	users["member of an unshared team"] = emptyLead;

	// A user outside a team that holds a share.
	const lonelyTeamLead = await createTestUser();
	const lonelyTeam = await createTestTeam(lonelyTeamLead.id);
	users["outside a shared team"] = await createTestUser();

	// A user holding two shares at once: directly and through a team.
	users["direct and team"] = await createTestUser();
	const bothTeam = await createTestTeam(lonelyTeamLead.id);
	await addTeamMember(bothTeam.id, users["direct and team"].id, "MEMBER");

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
			for (const [name, user] of Object.entries(users)) {
				if (name.startsWith("direct ") && name !== "direct and team") {
					await createTestPermission(
						made.id,
						user.id,
						granter.id,
						name.slice("direct ".length) as Level
					);
				}
			}
			for (const team of Object.values(teams)) {
				await createTestTeamPermission(
					made.id,
					team.id,
					granter.id,
					team.level
				);
			}
			await createTestTeamPermission(
				made.id,
				lonelyTeam.id,
				granter.id,
				"VIEW"
			);
			await createTestPermission(
				made.id,
				users["direct and team"].id,
				granter.id,
				"COMMENT"
			);
			await createTestTeamPermission(made.id, bothTeam.id, granter.id, "VIEW");
		}
	}

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
