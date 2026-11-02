import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	listViewablePatterns,
	type ViewablePattern,
} from "@/lib/services/case-from-pattern-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, createStoredPattern } from "../utils/case-kind-kit";
import {
	createPublishedRow,
	makePattern,
	snapshotWithComments,
} from "../utils/pattern-start-kit";
import { viaService } from "../utils/pattern-starters";
import {
	addTeamMember,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The patterns the new-case dialog offers, through the service and through
 * the server action: own, shared and team-shared patterns and the current
 * published patterns, never ordinary cases, trashed patterns, patterns the
 * user cannot view, or published rows that are not current patterns.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

const viaListService = async (user: User) => {
	const result = await listViewablePatterns(user.id);
	if (!("data" in result)) {
		throw new Error(`list failed: ${result.error}`);
	}
	return result.data;
};

const viaListAction = async (user: User) => {
	await mockAuth(user.id, user.username, user.email ?? undefined);
	const { fetchViewablePatterns } = await import("@/actions/case-from-pattern");
	return await fetchViewablePatterns();
};

const LISTERS: [string, (user: User) => Promise<ViewablePattern[] | null>][] = [
	["the service", viaListService],
	["the action", viaListAction],
];

const trash = (caseId: string) =>
	prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});

/** A pattern case with the given name, owned by `ownerId`. */
async function patternNamed(ownerId: string, name: string) {
	const made = await createStoredPattern(ownerId, name);
	await createTestElement(made.id, ownerId, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
		name: "G1",
		description: "The pattern's goal",
	});
	return made;
}

/**
 * A user and a world around them: patterns they should be offered and
 * patterns, cases and published rows they should not.
 */
async function world() {
	const me = await createTestUser();
	const other = await createTestUser();

	const offered: Record<string, string> = {};
	const hidden: Record<string, string> = {};
	const note = (
		into: Record<string, string>,
		label: string,
		id: string
	): string => {
		into[id] = label;
		return id;
	};

	note(offered, "own pattern", (await patternNamed(me.id, "Own pattern")).id);

	for (const level of ["VIEW", "COMMENT", "EDIT", "ADMIN"] as const) {
		const shared = await patternNamed(other.id, `Shared at ${level}`);
		await createTestPermission(shared.id, me.id, other.id, level);
		note(offered, `shared at ${level}`, shared.id);
	}

	for (const role of ["ADMIN", "MEMBER"] as const) {
		const lead = await createTestUser();
		const team = await createTestTeam(lead.id);
		await addTeamMember(team.id, me.id, role);
		const shared = await patternNamed(other.id, `Team pattern for ${role}`);
		await createTestTeamPermission(shared.id, team.id, other.id, "VIEW");
		note(offered, `team ${role}`, shared.id);
	}

	const myTeam = await createTestTeam(me.id);
	const ownedTeamPattern = await patternNamed(other.id, "Team I own");
	await createTestTeamPermission(
		ownedTeamPattern.id,
		myTeam.id,
		other.id,
		"COMMENT"
	);
	note(offered, "team I own", ownedTeamPattern.id);

	note(
		hidden,
		"another user's private pattern",
		(await patternNamed(other.id, "Private pattern")).id
	);

	const strangerTeam = await createTestTeam(other.id);
	const strangerTeamPattern = await patternNamed(
		other.id,
		"Other team's pattern"
	);
	await createTestTeamPermission(
		strangerTeamPattern.id,
		strangerTeam.id,
		other.id,
		"ADMIN"
	);
	note(hidden, "a team pattern for a team I am not in", strangerTeamPattern.id);

	const ownOrdinary = await createStoredCase(me.id, "My ordinary case");
	note(hidden, "my ordinary case", ownOrdinary.id);
	const sharedOrdinary = await createStoredCase(
		other.id,
		"Shared ordinary case"
	);
	await createTestPermission(sharedOrdinary.id, me.id, other.id, "ADMIN");
	note(hidden, "an ordinary case shared with me", sharedOrdinary.id);
	const teamOrdinary = await createStoredCase(other.id, "Team ordinary case");
	await createTestTeamPermission(teamOrdinary.id, myTeam.id, other.id, "ADMIN");
	note(hidden, "an ordinary case shared with my team", teamOrdinary.id);

	const ownTrashed = await patternNamed(me.id, "My trashed pattern");
	await trash(ownTrashed.id);
	note(hidden, "my trashed pattern", ownTrashed.id);
	const sharedTrashed = await patternNamed(other.id, "Shared trashed pattern");
	await createTestPermission(sharedTrashed.id, me.id, other.id, "ADMIN");
	await trash(sharedTrashed.id);
	note(hidden, "a shared trashed pattern", sharedTrashed.id);
	const teamTrashed = await patternNamed(other.id, "Team trashed pattern");
	await createTestTeamPermission(teamTrashed.id, myTeam.id, other.id, "VIEW");
	await trash(teamTrashed.id);
	note(hidden, "a team-shared trashed pattern", teamTrashed.id);

	return { me, other, offered, hidden, myTeam };
}

describe.each(LISTERS)("the patterns offered by %s", (_label, list) => {
	it("lists own, directly shared and team-shared patterns, and nothing else a user can see", async () => {
		const { me, offered } = await world();

		const listed = await list(me);

		expect(listed).not.toBeNull();
		const caseIds = (listed ?? [])
			.map((entry) =>
				"patternCaseId" in entry.source ? entry.source.patternCaseId : null
			)
			.filter((id): id is string => id !== null);
		expect(caseIds.sort()).toEqual(Object.keys(offered).sort());
	});

	it("lists none of the ordinary cases, trashed patterns, private patterns or other teams' patterns", async () => {
		const { me, hidden } = await world();

		const listed = await list(me);

		const caseIds = new Set(
			(listed ?? []).map((entry) =>
				"patternCaseId" in entry.source ? entry.source.patternCaseId : ""
			)
		);
		for (const [id, label] of Object.entries(hidden)) {
			expect(caseIds.has(id), label).toBe(false);
		}
	});

	it("names each pattern as it is stored and says where it comes from", async () => {
		const { me } = await world();

		const listed = (await list(me)) ?? [];

		const byName = new Map(listed.map((entry) => [entry.name, entry]));
		expect(byName.get("Own pattern")).toMatchObject({
			origin: "own",
			description: "A pattern",
		});
		expect(byName.get("Shared at VIEW")?.origin).toBe("shared");
		expect(byName.get("Team pattern for MEMBER")?.origin).toBe("shared");
		expect(byName.get("Team I own")?.origin).toBe("shared");
	});

	it("lists a pattern shared in several ways once", async () => {
		const { me, other } = await world();
		const many = await patternNamed(other.id, "Shared every way");
		await createTestPermission(many.id, me.id, other.id, "VIEW");
		for (const lead of [await createTestUser(), await createTestUser()]) {
			const team = await createTestTeam(lead.id);
			await addTeamMember(team.id, me.id, "MEMBER");
			await createTestTeamPermission(many.id, team.id, other.id, "EDIT");
		}

		const listed = (await list(me)) ?? [];

		expect(
			listed.filter((entry) => entry.name === "Shared every way")
		).toHaveLength(1);
	});

	it("gives every entry its own key", async () => {
		const { me } = await world();

		const listed = (await list(me)) ?? [];

		expect(listed.length).toBeGreaterThan(0);
		expect(new Set(listed.map((entry) => entry.key)).size).toBe(listed.length);
	});

	it("puts own patterns first, then shared ones, then published ones", async () => {
		const { me, other } = await world();
		const snapshotOwner = await createTestUser();
		const source = await makePattern(snapshotOwner);
		await createPublishedRow({
			slug: "a-published-pattern",
			title: "AAA published",
			assuranceCaseId: source.id,
			content: await snapshotWithComments(snapshotOwner, source.id),
		});
		await patternNamed(me.id, "ZZZ own pattern");
		const lateShared = await patternNamed(other.id, "AAA shared pattern");
		await createTestPermission(lateShared.id, me.id, other.id, "VIEW");

		const origins = ((await list(me)) ?? []).map((entry) => entry.origin);

		const rank = { own: 0, shared: 1, published: 2 } as const;
		const ranks = origins.map((origin) => rank[origin]);
		expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
		expect(origins).toContain("published");
	});

	it("lists a user with no patterns, no teams and no published rows as an empty list", async () => {
		const lonely = await createTestUser();
		await createStoredCase(lonely.id);

		expect(await list(lonely)).toEqual([]);
	});

	it("lists only published patterns for a user who has none of their own", async () => {
		const lonely = await createTestUser();
		const author = await createTestUser();
		const source = await makePattern(author);
		await createPublishedRow({
			slug: "only-published",
			title: "Only published",
			description: "From Discover",
			assuranceCaseId: source.id,
			content: await snapshotWithComments(author, source.id),
		});

		const listed = await list(lonely);

		expect(listed).toEqual([
			{
				key: expect.any(String),
				name: "Only published",
				description: "From Discover",
				origin: "published",
				source: { publishedSlug: "only-published" },
			},
		]);
	});

	describe("published patterns", () => {
		it("lists the current rows of type pattern, archived ones included, and no others", async () => {
			const lonely = await createTestUser();
			const author = await createTestUser();
			const source = await makePattern(author);
			const content = await snapshotWithComments(author, source.id);
			await createPublishedRow({
				slug: "current-pattern",
				title: "Current pattern",
				assuranceCaseId: source.id,
				content,
			});
			await createPublishedRow({
				slug: "archived-pattern",
				title: "Archived pattern",
				assuranceCaseId: null,
				archivedAt: new Date(),
				content,
			});
			await createPublishedRow({
				slug: "superseded-pattern",
				title: "Superseded pattern",
				isCurrent: false,
				assuranceCaseId: source.id,
				content,
			});
			await createPublishedRow({
				slug: "published-ordinary-case",
				title: "Published ordinary case",
				type: "ASSURANCE_CASE",
				assuranceCaseId: null,
				content,
			});
			await createPublishedRow({
				slug: "superseded-ordinary-case",
				title: "Superseded ordinary case",
				type: "ASSURANCE_CASE",
				isCurrent: false,
				assuranceCaseId: null,
				content,
			});

			const listed = (await list(lonely)) ?? [];

			expect(
				listed
					.map((entry) => entry.source)
					.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
			).toEqual([
				{ publishedSlug: "archived-pattern" },
				{ publishedSlug: "current-pattern" },
			]);
			expect(listed.every((entry) => entry.origin === "published")).toBe(true);
		});

		it("lists a published pattern whose source case the user cannot view", async () => {
			const lonely = await createTestUser();
			const author = await createTestUser();
			const source = await makePattern(author);
			await createPublishedRow({
				slug: "private-source",
				title: "Private source",
				assuranceCaseId: source.id,
				content: await snapshotWithComments(author, source.id),
			});

			const listed = (await list(lonely)) ?? [];

			expect(listed.map((entry) => entry.name)).toEqual(["Private source"]);
		});

		it("lists a published pattern whose source case is in the trash", async () => {
			const lonely = await createTestUser();
			const author = await createTestUser();
			const source = await makePattern(author);
			await createPublishedRow({
				slug: "trashed-source",
				title: "Trashed source",
				assuranceCaseId: source.id,
				content: await snapshotWithComments(author, source.id),
			});
			await trash(source.id);

			const listed = (await list(lonely)) ?? [];

			expect(listed.map((entry) => entry.name)).toEqual(["Trashed source"]);
		});
	});

	it("offers exactly the patterns a case can be started from, and starts from every one of them", async () => {
		const { me, other } = await world();
		const published = await makePattern(other, { name: "Published source" });
		await createPublishedRow({
			slug: "agreed-published",
			assuranceCaseId: published.id,
			content: await snapshotWithComments(other, published.id),
		});
		const listed = (await list(me)) ?? [];
		const everyPatternCase = await prisma.assuranceCase.findMany({
			where: { kind: "PATTERN" },
			select: { id: true },
		});

		const startable: string[] = [];
		for (const { id } of everyPatternCase) {
			const outcome = await viaService.start(me, { patternCaseId: id });
			if (outcome.ok) {
				startable.push(id);
			}
		}

		const offeredCaseIds = listed
			.map((entry) =>
				"patternCaseId" in entry.source ? entry.source.patternCaseId : null
			)
			.filter((id): id is string => id !== null);
		expect(offeredCaseIds.sort()).toEqual(startable.sort());
		for (const entry of listed) {
			expect((await viaService.start(me, entry.source)).ok).toBe(true);
		}
	});
});

describe("the patterns offered by the action", () => {
	it("returns null when nobody is signed in", async () => {
		await world();
		await mockNoAuth();
		const { fetchViewablePatterns } = await import(
			"@/actions/case-from-pattern"
		);

		expect(await fetchViewablePatterns()).toBeNull();
	});

	it("returns the signed-in user's own list, not another user's", async () => {
		const { me, other } = await world();

		const mine = await viaListAction(me);
		const theirs = await viaListAction(other);

		expect(mine?.map((entry) => entry.name)).not.toContain("Private pattern");
		expect(theirs?.map((entry) => entry.name)).toContain("Private pattern");
		expect(theirs?.map((entry) => entry.name)).not.toContain("Own pattern");
	});
});

describe("a user's own published pattern in the picker", () => {
	it("is offered once, though it is both a pattern case and a published row", async () => {
		const author = await createTestUser();
		const source = await makePattern(author, { name: "Published and mine" });
		await createPublishedRow({
			slug: "published-and-mine",
			title: "Published and mine",
			assuranceCaseId: source.id,
			content: await snapshotWithComments(author, source.id),
		});

		const listed = await viaListService(author);

		const entriesForIt = listed.filter(
			(entry) =>
				("patternCaseId" in entry.source &&
					entry.source.patternCaseId === source.id) ||
				("publishedSlug" in entry.source &&
					entry.source.publishedSlug === "published-and-mine")
		);
		expect(entriesForIt).toHaveLength(1);
	});
});
