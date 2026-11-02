import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	fetchCaseFromPrisma,
	listSharedCases,
	listUserCases,
	updateCaseWithPrisma,
} from "@/lib/services/case-fetch-service";
import {
	purgeCase,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createStoredCase,
	createStoredPattern,
	importOk,
	patternFlags,
	RICH_ELEMENT_COUNT,
	richNestedFile,
	storedCase,
} from "../utils/case-kind-kit";
import {
	addTeamMember,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * The lists meant for ordinary cases (My Assurance Cases, the integrations
 * grant form and the away-goal and module picker) never return a pattern,
 * however the reader came to see it; the lists for ordinary cases keep every
 * ordinary case. The link from a started case to its pattern clears when the
 * pattern is deleted.
 */

beforeEach(async () => {
	await mockNoAuth();
});

/** A reader with ordinary cases and patterns that reach them in every way. */
async function buildWorld() {
	const reader = await createTestUser();
	const other = await createTestUser();
	const team = await createTestTeam(other.id);
	await addTeamMember(team.id, reader.id, "MEMBER", other.id);

	const own = {
		case: await createStoredCase(reader.id, "own case"),
		pattern: await createStoredPattern(reader.id, "own pattern"),
	};
	const direct = {
		case: await createStoredCase(other.id, "direct case"),
		pattern: await createStoredPattern(other.id, "direct pattern"),
		editPattern: await createStoredPattern(other.id, "direct edit pattern"),
		adminPattern: await createStoredPattern(other.id, "direct admin pattern"),
	};
	const viaTeam = {
		case: await createStoredCase(other.id, "team case"),
		pattern: await createStoredPattern(other.id, "team pattern"),
	};
	const both = {
		case: await createStoredCase(other.id, "direct and team case"),
		pattern: await createStoredPattern(other.id, "direct and team pattern"),
	};
	const unshared = {
		case: await createStoredCase(other.id, "unshared case"),
		pattern: await createStoredPattern(other.id, "unshared pattern"),
	};
	const trashed = await createStoredPattern(reader.id, "trashed own pattern");
	await prisma.assuranceCase.update({
		where: { id: trashed.id },
		data: { deletedAt: new Date(), deletedById: reader.id },
	});

	await createTestPermission(direct.case.id, reader.id, other.id, "VIEW");
	await createTestPermission(direct.pattern.id, reader.id, other.id, "VIEW");
	await createTestPermission(
		direct.editPattern.id,
		reader.id,
		other.id,
		"EDIT"
	);
	await createTestPermission(
		direct.adminPattern.id,
		reader.id,
		other.id,
		"ADMIN"
	);
	await createTestTeamPermission(viaTeam.case.id, team.id, other.id, "VIEW");
	await createTestTeamPermission(viaTeam.pattern.id, team.id, other.id, "VIEW");
	for (const shared of [both.case, both.pattern]) {
		await createTestPermission(shared.id, reader.id, other.id, "EDIT");
		await createTestTeamPermission(shared.id, team.id, other.id, "EDIT");
	}

	const patternIds = [
		own.pattern,
		direct.pattern,
		direct.editPattern,
		direct.adminPattern,
		viaTeam.pattern,
		both.pattern,
		unshared.pattern,
		trashed,
	].map((row) => row.id);
	return { reader, other, own, direct, viaTeam, both, unshared, patternIds };
}

describe("My Assurance Cases (listUserCases)", () => {
	it("returns the reader's own and directly shared ordinary cases and no pattern", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(await listUserCases(world.reader.id));

		const ids = listed.map((row) => row.id);
		expect(ids).toContain(world.own.case.id);
		expect(ids).toContain(world.direct.case.id);
		expect(ids).toContain(world.both.case.id);
		for (const patternId of world.patternIds) {
			expect(ids).not.toContain(patternId);
		}
		expect(listed.every((row) => row.kind === "CASE")).toBe(true);
	});

	it("returns no pattern to the pattern's owner either", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(await listUserCases(world.other.id));

		const ids = listed.map((row) => row.id);
		expect(ids).toContain(world.direct.case.id);
		expect(ids).toContain(world.unshared.case.id);
		expect(ids).not.toContain(world.direct.pattern.id);
		expect(ids).not.toContain(world.unshared.pattern.id);
	});

	it("returns an empty list, not an error, for someone who has only patterns", async () => {
		const user = await createTestUser();
		await createStoredPattern(user.id);

		const listed = expectSuccess(await listUserCases(user.id));

		expect(listed).toEqual([]);
	});

	it("brings back a case that is changed from a pattern to a case", async () => {
		const user = await createTestUser();
		const made = await createStoredPattern(user.id, "changing");
		const hidden = expectSuccess(await listUserCases(user.id));
		await prisma.assuranceCase.update({
			where: { id: made.id },
			data: { kind: "CASE" },
		});

		const shown = expectSuccess(await listUserCases(user.id));

		expect(hidden).toEqual([]);
		expect(shown.map((row) => row.id)).toEqual([made.id]);
	});
});

describe("the integrations grant form and the dashboard (fetchAssuranceCases)", () => {
	it("returns the same ordinary cases and no pattern", async () => {
		const world = await buildWorld();
		await mockAuth(world.reader.id, world.reader.username, world.reader.email);

		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");
		const listed = await fetchAssuranceCases();

		const ids = (listed ?? []).map((row) => String(row.id));
		expect(ids).toContain(world.own.case.id);
		expect(ids).toContain(world.direct.case.id);
		for (const patternId of world.patternIds) {
			expect(ids).not.toContain(patternId);
		}
	});

	it("returns an empty list for someone who has only patterns", async () => {
		const user = await createTestUser();
		await createStoredPattern(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { fetchAssuranceCases } = await import("@/actions/assurance-cases");

		expect(await fetchAssuranceCases()).toEqual([]);
	});
});

describe("the away-goal and module picker (listCitableCases)", () => {
	it("lists every ordinary case the reader can reach exactly once and no pattern", async () => {
		const world = await buildWorld();
		await mockAuth(world.reader.id, world.reader.username, world.reader.email);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}
		const ids = result.data.map((row) => row.id);
		for (const reachable of [
			world.own.case,
			world.direct.case,
			world.viaTeam.case,
			world.both.case,
		]) {
			expect(ids.filter((id) => id === reachable.id)).toHaveLength(1);
		}
		for (const patternId of world.patternIds) {
			expect(ids).not.toContain(patternId);
		}
		expect(ids).not.toContain(world.unshared.case.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("lists no pattern the reader owns, shares directly or reaches through a team", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		const team = await createTestTeam(other.id);
		await addTeamMember(team.id, user.id, "MEMBER", other.id);
		await createStoredPattern(user.id);
		const direct = await createStoredPattern(other.id);
		const viaTeam = await createStoredPattern(other.id);
		await createTestPermission(direct.id, user.id, other.id, "VIEW");
		await createTestTeamPermission(viaTeam.id, team.id, other.id, "VIEW");
		await mockAuth(user.id, user.username, user.email);

		const { listCitableCases } = await import("@/actions/cited-element-picker");
		const result = await listCitableCases();

		expect(result).toEqual({ success: true, data: [] });
	});

	it("still reports Unauthorised when nobody is signed in", async () => {
		const { listCitableCases } = await import("@/actions/cited-element-picker");

		expect(await listCitableCases()).toMatchObject({
			success: false,
			error: "Unauthorised",
		});
	});
});

describe("Shared With Me (listSharedCases)", () => {
	it("still lists a shared pattern, marked as a pattern, beside the shared cases", async () => {
		const world = await buildWorld();

		const listed = expectSuccess(await listSharedCases(world.reader.id));

		const kindOf = (id: string) => listed.find((row) => row.id === id)?.kind;
		expect(kindOf(world.direct.case.id)).toBe("CASE");
		expect(kindOf(world.viaTeam.case.id)).toBe("CASE");
		expect(kindOf(world.direct.pattern.id)).toBe("PATTERN");
		expect(kindOf(world.viaTeam.pattern.id)).toBe("PATTERN");
		expect(kindOf(world.own.case.id)).toBeUndefined();
	});
});

describe("case responses carry the kind", () => {
	it("on a fetched case and on an updated case, for a case and for a pattern", async () => {
		const user = await createTestUser();
		const ordinary = await createStoredCase(user.id);
		const pattern = await createStoredPattern(user.id);

		const fetchedCase = expectSuccess(
			await fetchCaseFromPrisma(ordinary.id, user.id)
		);
		const fetchedPattern = expectSuccess(
			await fetchCaseFromPrisma(pattern.id, user.id)
		);
		const updatedCase = expectSuccess(
			await updateCaseWithPrisma(ordinary.id, user.id, { name: "Renamed" })
		);
		const updatedPattern = expectSuccess(
			await updateCaseWithPrisma(pattern.id, user.id, { name: "Renamed" })
		);

		expect(fetchedCase.kind).toBe("CASE");
		expect(fetchedPattern.kind).toBe("PATTERN");
		expect(updatedCase.kind).toBe("CASE");
		expect(updatedPattern.kind).toBe("PATTERN");
		expect((await storedCase(pattern.id)).kind).toBe("PATTERN");
	});
});

async function startedFromPattern() {
	const owner = await createTestUser();
	const pattern = await createStoredPattern(owner.id, "the pattern");
	const derived = await importOk(owner.id, richNestedFile(), {
		kind: "CASE",
		markFromPattern: true,
		sourcePatternId: pattern.id,
	});
	return { owner, pattern, derivedId: derived.caseId };
}

describe("deleting a pattern", () => {
	it("clears the link on a case started from it and leaves that case whole", async () => {
		const { owner, pattern, derivedId } = await startedFromPattern();
		const elementsBefore = await patternFlags(derivedId);

		await prisma.assuranceCase.delete({ where: { id: pattern.id } });

		const after = await storedCase(derivedId);
		expect(after.sourcePatternId).toBeNull();
		expect(after.kind).toBe("CASE");
		expect(await patternFlags(derivedId)).toEqual(elementsBefore);
		const listed = expectSuccess(await listUserCases(owner.id));
		expect(listed.map((row) => row.id)).toEqual([derivedId]);
	});

	it("clears the link when the pattern is purged from the trash", async () => {
		const { owner, pattern, derivedId } = await startedFromPattern();
		expectSuccess(await softDeleteCase(owner.id, pattern.id));

		expectSuccess(await purgeCase(owner.id, pattern.id));

		expect(
			await prisma.assuranceCase.findUnique({ where: { id: pattern.id } })
		).toBeNull();
		expect((await storedCase(derivedId)).sourcePatternId).toBeNull();
		expect(
			await prisma.assuranceElement.count({ where: { caseId: derivedId } })
		).toBe(RICH_ELEMENT_COUNT);
	});

	it("clears the link when expired cases are deleted in bulk", async () => {
		const { pattern, derivedId } = await startedFromPattern();
		await prisma.assuranceCase.update({
			where: { id: pattern.id },
			data: { deletedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
		});

		await prisma.assuranceCase.deleteMany({
			where: { deletedAt: { not: null, lt: new Date() } },
		});

		expect((await storedCase(derivedId)).sourcePatternId).toBeNull();
	});

	it("clears the link on every case started from it, whoever owns them", async () => {
		const { pattern, derivedId } = await startedFromPattern();
		const stranger = await createTestUser();
		const second = await importOk(stranger.id, richNestedFile(), {
			sourcePatternId: pattern.id,
		});

		await prisma.assuranceCase.delete({ where: { id: pattern.id } });

		expect((await storedCase(derivedId)).sourcePatternId).toBeNull();
		expect((await storedCase(second.caseId)).sourcePatternId).toBeNull();
		expect((await storedCase(second.caseId)).createdById).toBe(stranger.id);
	});

	it("clears only the link to the deleted case in a chain of started cases", async () => {
		const { owner, pattern, derivedId } = await startedFromPattern();
		const grandchild = await importOk(owner.id, richNestedFile(), {
			sourcePatternId: derivedId,
		});

		await prisma.assuranceCase.delete({ where: { id: pattern.id } });

		expect((await storedCase(derivedId)).sourcePatternId).toBeNull();
		expect((await storedCase(grandchild.caseId)).sourcePatternId).toBe(
			derivedId
		);

		await prisma.assuranceCase.delete({ where: { id: derivedId } });

		expect((await storedCase(grandchild.caseId)).sourcePatternId).toBeNull();
	});
});

describe("deleting a case started from a pattern", () => {
	it("leaves the pattern and its elements as they were", async () => {
		const owner = await createTestUser();
		const made = await importOk(owner.id, richNestedFile(), {
			kind: "PATTERN",
		});
		const derived = await importOk(owner.id, richNestedFile(), {
			markFromPattern: true,
			sourcePatternId: made.caseId,
		});
		const before = await patternFlags(made.caseId);

		await prisma.assuranceCase.delete({ where: { id: derived.caseId } });

		const pattern = await storedCase(made.caseId);
		expect(pattern.kind).toBe("PATTERN");
		expect(pattern.sourcePatternId).toBeNull();
		expect(await patternFlags(made.caseId)).toEqual(before);
	});
});

describe("moving a pattern to the trash", () => {
	it("leaves the link on a started case alone, and restoring the pattern keeps it", async () => {
		const { owner, pattern, derivedId } = await startedFromPattern();

		expectSuccess(await softDeleteCase(owner.id, pattern.id));

		const trashed = await storedCase(derivedId);
		expect(trashed.sourcePatternId).toBe(pattern.id);
		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: derivedId },
				})
			).deletedAt
		).toBeNull();

		expectSuccess(await restoreCase(owner.id, pattern.id));

		expect((await storedCase(derivedId)).sourcePatternId).toBe(pattern.id);
		expect((await storedCase(pattern.id)).kind).toBe("PATTERN");
	});
});

describe("the source link", () => {
	it("no longer accepts a row of the old argument patterns table", async () => {
		const user = await createTestUser();
		const oldPattern = await prisma.argumentPattern.create({
			data: {
				name: "An old pattern",
				description: "From the old table",
				version: "1.0",
				tags: [],
				createdById: user.id,
			},
		});

		await expect(
			prisma.assuranceCase.create({
				data: {
					name: "Linked to the old table",
					description: "d",
					createdById: user.id,
					sourcePatternId: oldPattern.id,
				},
			})
		).rejects.toThrow();
		expect(
			await prisma.assuranceCase.count({
				where: { name: "Linked to the old table" },
			})
		).toBe(0);
	});

	it("accepts the id of another case", async () => {
		const user = await createTestUser();
		const pattern = await createStoredPattern(user.id);

		const linked = await prisma.assuranceCase.create({
			data: {
				name: "Linked",
				description: "d",
				createdById: user.id,
				sourcePatternId: pattern.id,
			},
		});

		expect(linked.sourcePatternId).toBe(pattern.id);
		expect(linked.kind).toBe("CASE");
	});
});
