import { beforeEach, describe, expect, it, vi } from "vitest";
import { administrableCaseWhere, canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { listAdministrableCases } from "@/lib/services/case-fetch-service";
import {
	buildWorld,
	canAdminister,
	PERSON_KEYS,
	type PersonKey,
	shouldList,
	type World,
} from "../utils/administrable-cases-kit";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestPermission,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * The cases a person can administer, which the integrations grant form lists:
 * the ones they created, and the ones shared with them at ADMIN directly or
 * through a team they belong to. A share below ADMIN never counts, however
 * many of them there are, and neither do trashed cases or other people's
 * ADMIN shares. The query form must agree with `canAccessCase` at ADMIN.
 */

beforeEach(async () => {
	await mockNoAuth();
});

const NO_ONE = "00000000-0000-4000-8000-000000000000";

async function whereIds(userId: string) {
	const rows = await prisma.assuranceCase.findMany({
		where: administrableCaseWhere(userId),
		select: { id: true },
	});
	return new Set(rows.map((row) => row.id));
}

/** The cases for which the query, canAccessCase and the plain rule differ. */
async function disagreements(world: World, person: PersonKey) {
	const userId = world.people[person].id;
	const byQuery = await whereIds(userId);
	const found: string[] = [];
	for (const made of world.cases) {
		const answers = {
			query: byQuery.has(made.id),
			canAccessCase: await canAccessCase({ userId, caseId: made.id }, "ADMIN"),
			rule: canAdminister(person, made.spec),
		};
		if (new Set(Object.values(answers)).size > 1) {
			found.push(`${person} / ${made.spec.name}: ${JSON.stringify(answers)}`);
		}
	}
	return found;
}

function expectedIds(world: World, person: PersonKey) {
	return world.cases
		.filter((made) => shouldList(person, made.spec))
		.map((made) => made.id)
		.sort();
}

describe("administrableCaseWhere", () => {
	it("agrees with canAccessCase at ADMIN and with the plain rule for every person and every case", async () => {
		const world = await buildWorld();

		for (const person of PERSON_KEYS) {
			expect(await disagreements(world, person)).toEqual([]);
		}
	});

	it("matches nothing for a user id that no one holds", async () => {
		await buildWorld();

		expect(await whereIds(NO_ONE)).toEqual(new Set());
	});

	it("matches nothing for an empty or wildcard-like user id", async () => {
		await buildWorld();

		expect(await whereIds("")).toEqual(new Set());
		expect(await whereIds("' OR 1=1 --")).toEqual(new Set());
		expect(await whereIds("%")).toEqual(new Set());
	});
});

describe("listAdministrableCases", () => {
	it("lists exactly the live ordinary cases each person can administer, each once", async () => {
		const world = await buildWorld();

		for (const person of PERSON_KEYS) {
			const listed = expectSuccess(
				await listAdministrableCases(world.people[person].id)
			);

			expect(
				listed.map((row) => row.id).sort(),
				`the list for ${person}`
			).toEqual(expectedIds(world, person));
		}
	});

	it("lists each case as its id and name and nothing else", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(
			await listAdministrableCases(world.people.reader.id)
		);

		expect(listed.length).toBeGreaterThan(0);
		for (const row of listed) {
			const made = world.cases.find((candidate) => candidate.id === row.id);
			expect(row).toEqual({ id: row.id, name: made?.spec.name });
		}
	});

	it("lists a case the reader made once, though it is also shared to the reader below Admin", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(
			await listAdministrableCases(world.people.reader.id)
		);
		const ownShared = world.cases.find((made) =>
			made.spec.name.startsWith("own case also shared")
		);

		expect(listed.filter((row) => row.id === ownShared?.id)).toHaveLength(1);
	});

	it("returns an empty list, not an error, for a person who administers nothing", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(
			await listAdministrableCases(world.people.stranger.id)
		);

		expect(listed).toEqual([]);
	});

	it("returns an empty list for a user id that no one holds", async () => {
		await buildWorld();

		expect(expectSuccess(await listAdministrableCases(NO_ONE))).toEqual([]);
	});

	it("lists the newest case first whether the person made it or was given it", async () => {
		const world = await buildWorld([]);
		const { reader, creator } = world.people;
		const first = await createTestCase(reader.id, { name: "oldest" });
		const second = await createTestCase(creator.id, { name: "shared middle" });
		const third = await createTestCase(reader.id, { name: "newest" });
		await createTestPermission(second.id, reader.id, creator.id, "ADMIN");
		const at = (hoursAgo: number) =>
			new Date(Date.now() - hoursAgo * 3_600_000);
		await prisma.assuranceCase.update({
			where: { id: first.id },
			data: { createdAt: at(3) },
		});
		await prisma.assuranceCase.update({
			where: { id: second.id },
			data: { createdAt: at(2) },
		});
		await prisma.assuranceCase.update({
			where: { id: third.id },
			data: { createdAt: at(1) },
		});

		const listed = expectSuccess(await listAdministrableCases(reader.id));

		expect(listed.map((row) => row.name)).toEqual([
			"newest",
			"shared middle",
			"oldest",
		]);
	});

	it("stops listing a case when its Admin share is lowered, and lists it again when raised", async () => {
		const world = await buildWorld([]);
		const { reader, creator } = world.people;
		const theCase = await createTestCase(creator.id);
		const share = await createTestPermission(
			theCase.id,
			reader.id,
			creator.id,
			"ADMIN"
		);
		const idsFor = async () =>
			expectSuccess(await listAdministrableCases(reader.id)).map(
				(row) => row.id
			);

		expect(await idsFor()).toEqual([theCase.id]);
		await prisma.casePermission.update({
			where: { id: share.id },
			data: { permission: "EDIT" },
		});
		expect(await idsFor()).toEqual([]);
		await prisma.casePermission.update({
			where: { id: share.id },
			data: { permission: "ADMIN" },
		});
		expect(await idsFor()).toEqual([theCase.id]);
	});

	it("stops listing a team's case when the reader leaves the team", async () => {
		const world = await buildWorld([]);
		const { reader } = world.people;
		const teamId = world.holders.memberTeam.id;
		const theCase = await createTestCase(world.people.creator.id);
		await prisma.caseTeamPermission.create({
			data: {
				caseId: theCase.id,
				teamId,
				grantedById: world.people.creator.id,
				permission: "ADMIN",
			},
		});
		const idsFor = async () =>
			expectSuccess(await listAdministrableCases(reader.id)).map(
				(row) => row.id
			);

		expect(await idsFor()).toEqual([theCase.id]);
		await prisma.teamMember.deleteMany({
			where: { teamId, userId: reader.id },
		});
		expect(await idsFor()).toEqual([]);
	});
});

describe("fetchAdministrableCases", () => {
	it("returns null, never anyone's cases, when nobody is signed in", async () => {
		await buildWorld();
		const { fetchAdministrableCases } = await import(
			"@/actions/assurance-cases"
		);

		expect(await fetchAdministrableCases()).toBeNull();
	});

	it("returns the signed-in person's administrable cases and no one else's", async () => {
		const world = await buildWorld();
		const { fetchAdministrableCases } = await import(
			"@/actions/assurance-cases"
		);

		for (const person of PERSON_KEYS) {
			const { id, username, email } = world.people[person];
			await mockAuth(id, username, email);

			const listed = await fetchAdministrableCases();

			expect(
				(listed ?? []).map((row) => row.id).sort(),
				`the action for ${person}`
			).toEqual(expectedIds(world, person));
		}
	});

	it("returns an empty list, not null, for a signed-in person who administers nothing", async () => {
		const world = await buildWorld();
		const { id, username, email } = world.people.stranger;
		await mockAuth(id, username, email);
		const { fetchAdministrableCases } = await import(
			"@/actions/assurance-cases"
		);

		expect(await fetchAdministrableCases()).toEqual([]);
	});
});
