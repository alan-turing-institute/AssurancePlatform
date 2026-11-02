import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import {
	createCaseFromPattern,
	listViewablePatterns,
} from "@/lib/services/case-from-pattern-service";
import type { Prisma } from "@/src/generated/prisma";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
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
	createTestComment,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Starting a case from a pattern: from a pattern case the user can view or
 * from a pattern published on Discover. Covers who may read each source, what
 * the new case holds, and the picker's list of patterns.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

const NOT_FOUND = "Pattern not found";
const NOT_A_PATTERN = "That case is not a pattern";

/** A pattern owned by `ownerId`, with comments on three of its elements. */
async function makePattern(
	ownerId: string,
	fields: { name?: string; citedCaseId?: string } = {}
) {
	const data = await importOk(
		ownerId,
		richNestedFile({
			version: "1.1",
			citedCaseId: fields.citedCaseId,
			caseFields: {
				kind: "PATTERN",
				name: fields.name ?? "Reusable pattern",
				description: "What the pattern is for",
			},
		})
	);
	const elements = await prisma.assuranceElement.findMany({
		where: { caseId: data.caseId },
		select: { id: true },
	});
	for (const element of elements.slice(0, 3)) {
		await createTestComment(ownerId, {
			elementId: element.id,
			content: "A note on the pattern",
		});
	}
	return data.caseId;
}

function toJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value));
}

/** The frozen content a published pattern holds: the pattern's export and case information. */
async function frozenPattern(ownerId: string, patternId: string) {
	const exported = expectSuccess(
		await exportCase(ownerId, patternId, { includeComments: false })
	);
	return toJson({
		...exported,
		caseInformation: { description: "Shown on Discover" },
	});
}

function publishRow(fields: {
	archivedAt?: Date;
	assuranceCaseId: string | null;
	content: Prisma.InputJsonValue;
	isCurrent?: boolean;
	slug: string;
	type: "ASSURANCE_CASE" | "ARGUMENT_PATTERN";
}) {
	return prisma.publishedAssuranceCase.create({
		data: {
			title: `Published ${fields.slug}`,
			description: "Published description",
			isCurrent: true,
			...fields,
		},
	});
}

async function publishedPattern(owner: User, slug: string) {
	const patternId = await makePattern(owner.id);
	await publishRow({
		slug,
		type: "ARGUMENT_PATTERN",
		assuranceCaseId: patternId,
		content: await frozenPattern(owner.id, patternId),
	});
	return patternId;
}

async function casesOwnedBy(user: User) {
	return await prisma.assuranceCase.count({ where: { createdById: user.id } });
}

describe("createCaseFromPattern from a pattern case", () => {
	it("makes an ordinary case with every element marked as from the pattern, no comments, and a link back to the pattern", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);

		const data = expectSuccess(
			await createCaseFromPattern(
				owner.id,
				{ patternCaseId: patternId },
				"  My case  ",
				"My description"
			)
		);

		expect(await storedCase(data.id)).toMatchObject({
			kind: "CASE",
			name: "My case",
			description: "My description",
			sourcePatternId: patternId,
			createdById: owner.id,
		});
		const flags = await patternFlags(data.id);
		expect(flags).toHaveLength(RICH_ELEMENT_COUNT);
		expect(
			flags.every((row) => row.fromPattern && !row.modifiedFromPattern)
		).toBe(true);
		expect(
			await prisma.comment.count({ where: { element: { caseId: data.id } } })
		).toBe(0);
		expect(
			await prisma.comment.count({ where: { element: { caseId: patternId } } })
		).toBe(3);
		expect((await storedCase(patternId)).kind).toBe("PATTERN");
	});

	it("reads a pattern shared with the user directly", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const patternId = await makePattern(owner.id);
		await createTestPermission(patternId, user.id, owner.id);

		const data = expectSuccess(
			await createCaseFromPattern(
				user.id,
				{ patternCaseId: patternId },
				"Mine",
				"About it"
			)
		);

		expect(await storedCase(data.id)).toMatchObject({
			createdById: user.id,
			sourcePatternId: patternId,
		});
		expect(await patternFlags(data.id)).toHaveLength(RICH_ELEMENT_COUNT);
	});

	it("reads a pattern shared with a team the user belongs to", async () => {
		const owner = await createTestUser();
		const user = await createTestUser();
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, user.id);
		const patternId = await makePattern(owner.id);
		await createTestTeamPermission(patternId, team.id, owner.id);

		const data = expectSuccess(
			await createCaseFromPattern(
				user.id,
				{ patternCaseId: patternId },
				"Mine",
				"About it"
			)
		);

		expect(await storedCase(data.id)).toMatchObject({
			createdById: user.id,
			sourcePatternId: patternId,
		});
		expect(await patternFlags(data.id)).toHaveLength(RICH_ELEMENT_COUNT);
	});

	it("refuses a pattern the user cannot view, with the answer given for a case that does not exist", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const patternId = await makePattern(owner.id);

		const refused = await createCaseFromPattern(
			stranger.id,
			{ patternCaseId: patternId },
			"Mine",
			"About it"
		);
		const missing = await createCaseFromPattern(
			stranger.id,
			{ patternCaseId: "00000000-0000-4000-8000-0000000000aa" },
			"Mine",
			"About it"
		);

		expectError(refused, NOT_FOUND);
		expectSameError(refused, missing);
		expect(await casesOwnedBy(stranger)).toBe(0);
	});

	it("refuses a case that is not a pattern, and does not say so to a user who cannot view it", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const ordinary = await createStoredCase(owner.id);

		const own = await createCaseFromPattern(
			owner.id,
			{ patternCaseId: ordinary.id },
			"Mine",
			"About it"
		);
		const notViewable = await createCaseFromPattern(
			stranger.id,
			{ patternCaseId: ordinary.id },
			"Mine",
			"About it"
		);

		expectError(own, NOT_A_PATTERN);
		expectError(notViewable, NOT_FOUND);
		expect(await casesOwnedBy(stranger)).toBe(0);
	});

	it("refuses a pattern in the trash, even for its owner", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		await prisma.assuranceCase.update({
			where: { id: patternId },
			data: { deletedAt: new Date() },
		});
		const before = await casesOwnedBy(owner);

		const result = await createCaseFromPattern(
			owner.id,
			{ patternCaseId: patternId },
			"Mine",
			"About it"
		);

		expectError(result, NOT_FOUND);
		expect(await casesOwnedBy(owner)).toBe(before);
	});

	it.each([
		["an empty name", "", "About it"],
		["a name of spaces", "   ", "About it"],
		["a name over 255 characters", "n".repeat(256), "About it"],
		["an empty description", "Mine", ""],
		["a description over 5000 characters", "Mine", "d".repeat(5001)],
	])("refuses %s and creates nothing", async (_label, name, description) => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		const before = await casesOwnedBy(owner);

		const result = await createCaseFromPattern(
			owner.id,
			{ patternCaseId: patternId },
			name,
			description
		);

		expectError(result);
		expect(await casesOwnedBy(owner)).toBe(before);
	});

	it("clears a reference to a case the new owner cannot view and keeps one they can, naming each cleared reference", async () => {
		const author = await createTestUser();
		const user = await createTestUser();
		const hidden = await createStoredCase(author.id);
		const visible = await createStoredCase(author.id);
		await createTestPermission(visible.id, user.id, author.id);
		const hiddenPattern = await makePattern(author.id, {
			citedCaseId: hidden.id,
		});
		const visiblePattern = await makePattern(author.id, {
			citedCaseId: visible.id,
		});
		await createTestPermission(hiddenPattern, user.id, author.id);
		await createTestPermission(visiblePattern, user.id, author.id);

		const cleared = expectSuccess(
			await createCaseFromPattern(
				user.id,
				{ patternCaseId: hiddenPattern },
				"Hidden",
				"About it"
			)
		);
		const kept = expectSuccess(
			await createCaseFromPattern(
				user.id,
				{ patternCaseId: visiblePattern },
				"Visible",
				"About it"
			)
		);

		const references = (caseId: string) =>
			prisma.assuranceElement.findMany({
				where: { caseId, elementType: { in: ["AWAY_GOAL", "MODULE"] } },
				select: { moduleReferenceId: true, moduleReferenceDangling: true },
			});
		expect(await references(cleared.id)).toEqual([
			{ moduleReferenceId: null, moduleReferenceDangling: true },
			{ moduleReferenceId: null, moduleReferenceDangling: true },
		]);
		expect(cleared.warnings).toHaveLength(2);
		expect(await references(kept.id)).toEqual([
			{ moduleReferenceId: visible.id, moduleReferenceDangling: false },
			{ moduleReferenceId: visible.id, moduleReferenceDangling: false },
		]);
		expect(kept.warnings).toEqual([]);
	});
});

describe("createCaseFromPattern from a published pattern", () => {
	it("makes an ordinary case from the current published pattern, linked to the pattern case", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const patternId = await publishedPattern(owner, "a-published-pattern");

		const data = expectSuccess(
			await createCaseFromPattern(
				reader.id,
				{ publishedSlug: "a-published-pattern" },
				"Mine",
				"About it"
			)
		);

		expect(await storedCase(data.id)).toMatchObject({
			kind: "CASE",
			name: "Mine",
			description: "About it",
			sourcePatternId: patternId,
			createdById: reader.id,
		});
		const flags = await patternFlags(data.id);
		expect(flags).toHaveLength(RICH_ELEMENT_COUNT);
		expect(flags.every((row) => row.fromPattern)).toBe(true);
	});

	it("copies no comments that an older snapshot still holds", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		const exported = expectSuccess(
			await exportCase(owner.id, patternId, { includeComments: false })
		);
		await publishRow({
			slug: "a-commented-snapshot",
			type: "ARGUMENT_PATTERN",
			assuranceCaseId: patternId,
			content: toJson({
				...exported,
				tree: {
					...exported.tree,
					comments: [
						{
							author: "someone",
							content: "An old comment",
							createdAt: new Date().toISOString(),
						},
					],
				},
			}),
		});

		const data = expectSuccess(
			await createCaseFromPattern(
				owner.id,
				{ publishedSlug: "a-commented-snapshot" },
				"Mine",
				"About it"
			)
		);

		expect(
			await prisma.comment.count({ where: { element: { caseId: data.id } } })
		).toBe(0);
	});

	it("refuses the slug of a published case, with the answer given for an unknown slug", async () => {
		const owner = await createTestUser();
		const ordinary = await createStoredCase(owner.id);
		await publishRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: ordinary.id,
			content: toJson(richNestedFile()),
		});
		const before = await casesOwnedBy(owner);

		const publishedCase = await createCaseFromPattern(
			owner.id,
			{ publishedSlug: "a-published-case" },
			"Mine",
			"About it"
		);
		const unknown = await createCaseFromPattern(
			owner.id,
			{ publishedSlug: "no-such-slug" },
			"Mine",
			"About it"
		);

		expectError(publishedCase, NOT_FOUND);
		expectSameError(publishedCase, unknown);
		expect(await casesOwnedBy(owner)).toBe(before);
	});

	it("refuses a pattern row that is no longer the current one", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		await publishRow({
			slug: "an-old-version",
			type: "ARGUMENT_PATTERN",
			assuranceCaseId: patternId,
			isCurrent: false,
			content: await frozenPattern(owner.id, patternId),
		});

		const result = await createCaseFromPattern(
			owner.id,
			{ publishedSlug: "an-old-version" },
			"Mine",
			"About it"
		);

		expectError(result, NOT_FOUND);
	});

	it("reads an archived pattern whose case is gone, and records no source", async () => {
		const owner = await createTestUser();
		const reader = await createTestUser();
		const patternId = await makePattern(owner.id);
		await publishRow({
			slug: "an-archived-pattern",
			type: "ARGUMENT_PATTERN",
			assuranceCaseId: null,
			archivedAt: new Date(),
			content: await frozenPattern(owner.id, patternId),
		});

		const data = expectSuccess(
			await createCaseFromPattern(
				reader.id,
				{ publishedSlug: "an-archived-pattern" },
				"Mine",
				"About it"
			)
		);

		expect((await storedCase(data.id)).sourcePatternId).toBeNull();
		expect(await patternFlags(data.id)).toHaveLength(RICH_ELEMENT_COUNT);
	});

	it("records no source when the row's case is not a pattern", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		const ordinary = await createStoredCase(owner.id);
		await publishRow({
			slug: "a-mislabelled-row",
			type: "ARGUMENT_PATTERN",
			assuranceCaseId: ordinary.id,
			content: await frozenPattern(owner.id, patternId),
		});

		const data = expectSuccess(
			await createCaseFromPattern(
				owner.id,
				{ publishedSlug: "a-mislabelled-row" },
				"Mine",
				"About it"
			)
		);

		expect((await storedCase(data.id)).sourcePatternId).toBeNull();
	});
});

describe("the createCaseFromPattern action", () => {
	it("refuses a request with no session", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		const { createCaseFromPattern: action } = await import(
			"@/actions/case-from-pattern"
		);

		const result = await action({ patternCaseId: patternId }, "Mine", "About");

		expect(result).toEqual({ success: false, error: "Invalid session" });
	});

	it("starts a case for the signed-in user", async () => {
		const owner = await createTestUser();
		const patternId = await makePattern(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);
		const { createCaseFromPattern: action } = await import(
			"@/actions/case-from-pattern"
		);

		const result = await action({ patternCaseId: patternId }, "Mine", "About");

		expect(result.success).toBe(true);
		if (result.success) {
			expect((await storedCase(result.data.id)).sourcePatternId).toBe(
				patternId
			);
		}
	});

	it.each([
		["an id that is not a UUID", { patternCaseId: "not-a-uuid" }],
		["a slug that is not a slug", { publishedSlug: "Not A Slug!" }],
		[
			"both an id and a slug",
			{
				patternCaseId: "00000000-0000-4000-8000-0000000000aa",
				publishedSlug: "a-slug",
			},
		],
		["neither", {}],
	])("refuses %s before reading anything", async (_label, source) => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);
		const { createCaseFromPattern: action } = await import(
			"@/actions/case-from-pattern"
		);

		const result = await action(
			source as Parameters<typeof action>[0],
			"Mine",
			"About"
		);

		expect(result.success).toBe(false);
		expect(await casesOwnedBy(owner)).toBe(0);
	});
});

describe("listViewablePatterns", () => {
	it("lists own patterns, then patterns shared directly or through a team, then published patterns, and nothing else", async () => {
		const author = await createTestUser();
		const user = await createTestUser();
		const team = await createTestTeam(author.id);
		await addTeamMember(team.id, user.id);

		const own = await makePattern(user.id, { name: "Own pattern" });
		const direct = await makePattern(author.id, { name: "Direct pattern" });
		await createTestPermission(direct, user.id, author.id);
		const viaTeam = await makePattern(author.id, { name: "Team pattern" });
		await createTestTeamPermission(viaTeam, team.id, author.id);
		await makePattern(author.id, { name: "Unshared pattern" });
		await createStoredCase(user.id, "An ordinary case");
		const trashed = await createStoredPattern(user.id, "Trashed pattern");
		await prisma.assuranceCase.update({
			where: { id: trashed.id },
			data: { deletedAt: new Date() },
		});
		await publishedPattern(author, "a-published-pattern");
		await publishRow({
			slug: "a-published-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: null,
			content: toJson(richNestedFile()),
		});
		await publishRow({
			slug: "a-superseded-pattern",
			type: "ARGUMENT_PATTERN",
			assuranceCaseId: null,
			isCurrent: false,
			content: toJson(richNestedFile()),
		});

		const listed = expectSuccess(await listViewablePatterns(user.id));

		expect(
			listed.map(({ origin, name, source }) => ({ origin, name, source }))
		).toEqual([
			{
				origin: "own",
				name: "Own pattern",
				source: { patternCaseId: own },
			},
			{
				origin: "shared",
				name: "Direct pattern",
				source: { patternCaseId: direct },
			},
			{
				origin: "shared",
				name: "Team pattern",
				source: { patternCaseId: viaTeam },
			},
			{
				origin: "published",
				name: "Published a-published-pattern",
				source: { publishedSlug: "a-published-pattern" },
			},
		]);
		expect(listed[0]?.description).toBe("What the pattern is for");
		expect(new Set(listed.map((pattern) => pattern.key)).size).toBe(4);
	});

	it("lists nothing when there are no patterns", async () => {
		const user = await createTestUser();

		expect(expectSuccess(await listViewablePatterns(user.id))).toEqual([]);
	});
});

describe("the createAssuranceCase action and the kind of a new case", () => {
	it("starts a blank pattern with one goal when asked, and an ordinary case otherwise", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);
		const { createAssuranceCase } = await import("@/actions/assurance-cases");

		const pattern = await createAssuranceCase({
			name: "Blank pattern",
			description: "Starts empty",
			kind: "PATTERN",
		});
		const ordinary = await createAssuranceCase({
			name: "Blank case",
			description: "Starts empty",
		});

		expect(pattern.success && ordinary.success).toBe(true);
		if (!(pattern.success && ordinary.success)) {
			return;
		}
		expect((await storedCase(pattern.data.id)).kind).toBe("PATTERN");
		expect((await storedCase(ordinary.data.id)).kind).toBe("CASE");
		const goals = await prisma.assuranceElement.findMany({
			where: { caseId: pattern.data.id },
			select: { elementType: true, name: true },
		});
		expect(goals).toEqual([{ elementType: "GOAL", name: "G1" }]);
	});
});
