import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { listUserCases } from "@/lib/services/case-fetch-service";
import { createCaseFromPattern as startViaService } from "@/lib/services/case-from-pattern-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase, createStoredPattern } from "../utils/case-kind-kit";
import {
	commentsOn,
	createPublishedRow,
	flagsOf,
	fullStateOf,
	makePattern,
	RICH_NAMES,
	richSource,
	shapeOf,
	snapshotWithComments,
	viewerOf,
	worldCounts,
} from "../utils/pattern-start-kit";
import {
	DESCRIPTION,
	NAME,
	STARTERS,
	startOk,
	viaAction,
} from "../utils/pattern-starters";
import {
	addTeamMember,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Starting a case from a pattern, through the service and through the server
 * action. Both are held to the same answers: who may start from which
 * pattern, what the new case holds, what the source keeps, and what is
 * refused, with nothing created whenever the answer is a refusal.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

type User = Awaited<ReturnType<typeof createTestUser>>;

describe.each(
	STARTERS
)("starting a case from a pattern case through %s", (_label, starter) => {
	describe("who may start from a pattern case", () => {
		interface Allowed {
			actor: (owner: User, patternId: string) => Promise<User>;
			label: string;
		}

		const ALLOWED: Allowed[] = [
			{ label: "its owner", actor: async (owner) => owner },
			...(["VIEW", "COMMENT", "EDIT", "ADMIN"] as const).map(
				(level): Allowed => ({
					label: `a user it is shared with at ${level}`,
					actor: async (owner, patternId) => {
						const user = await createTestUser();
						await createTestPermission(patternId, user.id, owner.id, level);
						return user;
					},
				})
			),
			...(["OWNER", "ADMIN", "MEMBER"] as const).flatMap((role) =>
				(["VIEW", "ADMIN"] as const).map(
					(level): Allowed => ({
						label: `a team ${role} of a team it is shared with at ${level}`,
						actor: async (owner, patternId) => {
							const lead = await createTestUser();
							const team = await createTestTeam(lead.id);
							let member = lead;
							if (role !== "OWNER") {
								member = await createTestUser();
								await addTeamMember(team.id, member.id, role);
							}
							await createTestTeamPermission(
								patternId,
								team.id,
								owner.id,
								level
							);
							return member;
						},
					})
				)
			),
		];

		it.each(ALLOWED)("starts a case for $label", async ({ actor }) => {
			const owner = await createTestUser();
			const pattern = await makePattern(owner);
			const user = await actor(owner, pattern.id);

			const outcome = await startOk(starter, user, {
				patternCaseId: pattern.id,
			});

			const started = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: outcome.id },
			});
			expect(started).toMatchObject({
				kind: "CASE",
				createdById: user.id,
				sourcePatternId: pattern.id,
				name: NAME,
				description: DESCRIPTION,
			});
			expect(await shapeOf(outcome.id)).toEqual(await shapeOf(pattern.id));
		});

		interface Refused {
			actor: (owner: User) => Promise<User>;
			error: string;
			label: string;
			/** Prepares the world: trashes or shares the cases. */
			prepare?: (
				owner: User,
				actor: User,
				patternId: string,
				ordinaryId: string
			) => Promise<void>;
			source: (patternId: string, ordinaryId: string) => string;
		}

		const stranger = async () => createTestUser();
		const NOT_FOUND = "Pattern not found";
		const NOT_A_PATTERN = "That case is not a pattern";
		const trash = (caseId: string) =>
			prisma.assuranceCase.update({
				where: { id: caseId },
				data: { deletedAt: new Date() },
			});

		const REFUSED: Refused[] = [
			{
				label: "a stranger",
				actor: stranger,
				source: (patternId) => patternId,
				error: NOT_FOUND,
			},
			{
				label: "a case that does not exist",
				actor: async (owner) => owner,
				source: () => randomUUID(),
				error: NOT_FOUND,
			},
			{
				label: "a member of a team that has no access",
				actor: async () => {
					const lead = await createTestUser();
					await createTestTeam(lead.id);
					return lead;
				},
				source: (patternId) => patternId,
				error: NOT_FOUND,
			},
			{
				label: "a user outside the team the pattern is shared with",
				actor: stranger,
				source: (patternId) => patternId,
				error: NOT_FOUND,
				prepare: async (owner, _actor, patternId) => {
					const team = await createTestTeam(owner.id);
					await createTestTeamPermission(patternId, team.id, owner.id, "ADMIN");
				},
			},
			{
				label: "a trashed pattern, for its owner",
				actor: async (owner) => owner,
				source: (patternId) => patternId,
				error: NOT_FOUND,
				prepare: async (_owner, _actor, patternId) => {
					await trash(patternId);
				},
			},
			{
				label: "a trashed pattern, for a user it is shared with at ADMIN",
				actor: stranger,
				source: (patternId) => patternId,
				error: NOT_FOUND,
				prepare: async (owner, actor, patternId) => {
					await createTestPermission(patternId, actor.id, owner.id, "ADMIN");
					await trash(patternId);
				},
			},
			{
				label: "a trashed pattern, for a member of a team it is shared with",
				actor: stranger,
				source: (patternId) => patternId,
				error: NOT_FOUND,
				prepare: async (owner, actor, patternId) => {
					const team = await createTestTeam(owner.id);
					await addTeamMember(team.id, actor.id, "MEMBER");
					await createTestTeamPermission(patternId, team.id, owner.id, "VIEW");
					await trash(patternId);
				},
			},
			{
				label: "an ordinary case, for a stranger",
				actor: stranger,
				source: (_patternId, ordinaryId) => ordinaryId,
				error: NOT_FOUND,
			},
			{
				label: "a trashed ordinary case, for its owner",
				actor: async (owner) => owner,
				source: (_patternId, ordinaryId) => ordinaryId,
				error: NOT_FOUND,
				prepare: async (_owner, _actor, _patternId, ordinaryId) => {
					await trash(ordinaryId);
				},
			},
			{
				label: "an ordinary case, for its owner",
				actor: async (owner) => owner,
				source: (_patternId, ordinaryId) => ordinaryId,
				error: NOT_A_PATTERN,
			},
			{
				label: "an ordinary case shared at VIEW",
				actor: stranger,
				source: (_patternId, ordinaryId) => ordinaryId,
				error: NOT_A_PATTERN,
				prepare: async (owner, actor, _patternId, ordinaryId) => {
					await createTestPermission(ordinaryId, actor.id, owner.id, "VIEW");
				},
			},
			{
				label: "an ordinary case shared at ADMIN through a team",
				actor: stranger,
				source: (_patternId, ordinaryId) => ordinaryId,
				error: NOT_A_PATTERN,
				prepare: async (owner, actor, _patternId, ordinaryId) => {
					const team = await createTestTeam(owner.id);
					await addTeamMember(team.id, actor.id, "ADMIN");
					await createTestTeamPermission(
						ordinaryId,
						team.id,
						owner.id,
						"ADMIN"
					);
				},
			},
		];

		it.each(
			REFUSED
		)("refuses $label with its own message and creates nothing", async ({
			actor,
			error,
			prepare,
			source,
		}) => {
			const owner = await createTestUser();
			const pattern = await makePattern(owner);
			const ordinary = await createStoredCase(owner.id);
			await createTestElement(ordinary.id, owner.id, {
				elementType: "GOAL",
				role: "TOP_LEVEL",
				name: "G1",
			});
			const user = await actor(owner);
			await prepare?.(owner, user, pattern.id, ordinary.id);
			const before = await worldCounts();

			const outcome = await starter.start(user, {
				patternCaseId: source(pattern.id, ordinary.id),
			});

			expect(outcome).toEqual({ ok: false, error });
			expect(await worldCounts()).toEqual(before);
		});

		it("gives a stranger the same answer for a pattern as for a case that does not exist", async () => {
			const owner = await createTestUser();
			const pattern = await makePattern(owner);
			const user = await createTestUser();

			const existing = await starter.start(user, {
				patternCaseId: pattern.id,
			});
			const missing = await starter.start(user, {
				patternCaseId: randomUUID(),
			});

			expect(existing).toEqual(missing);
		});
	});

	describe("what the new case holds", () => {
		it("copies the tree and every element's text, marks every element as from the pattern, and copies no comments or shares", async () => {
			const { owner, pattern } = await richSource();
			const viewer = await viewerOf(pattern.id, owner.id);
			const sourceShape = await shapeOf(pattern.id);
			expect(sourceShape.map((row) => row.name)).toEqual([...RICH_NAMES]);
			const sourceLinks = await prisma.evidenceLink.count();
			expect(sourceLinks).toBeGreaterThan(0);
			expect(await commentsOn(pattern.id)).toBe(3);

			const outcome = await startOk(starter, viewer, {
				patternCaseId: pattern.id,
			});

			const started = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: outcome.id },
			});
			expect(started).toMatchObject({
				kind: "CASE",
				createdById: viewer.id,
				sourcePatternId: pattern.id,
			});
			expect(await shapeOf(outcome.id)).toEqual(sourceShape);
			expect(await flagsOf(outcome.id)).toEqual(
				RICH_NAMES.map((name) => ({
					name,
					fromPattern: true,
					modifiedFromPattern: false,
				}))
			);
			expect(await commentsOn(outcome.id)).toBe(0);
			expect(
				await prisma.comment.count({ where: { authorId: viewer.id } })
			).toBe(0);
			expect(
				await prisma.casePermission.count({ where: { caseId: outcome.id } })
			).toBe(0);
			expect(
				await prisma.caseTeamPermission.count({ where: { caseId: outcome.id } })
			).toBe(0);
			expect(await prisma.evidenceLink.count()).toBe(sourceLinks * 2);
		});

		it("leaves the source pattern exactly as it was: elements, comments, shares and links", async () => {
			const { owner, pattern } = await richSource();
			const viewer = await viewerOf(pattern.id, owner.id);
			const before = await fullStateOf(pattern.id);

			await startOk(starter, viewer, { patternCaseId: pattern.id });
			await startOk(starter, owner, { patternCaseId: pattern.id });

			expect(await fullStateOf(pattern.id)).toEqual(before);
		});

		it("shares no element ids with the pattern, and two starts make independent cases", async () => {
			const { owner, pattern } = await richSource();

			const first = await startOk(starter, owner, {
				patternCaseId: pattern.id,
			});
			const second = await startOk(starter, owner, {
				patternCaseId: pattern.id,
			});

			expect(first.id).not.toBe(second.id);
			const ids = (
				await prisma.assuranceElement.findMany({ select: { id: true } })
			).map((row) => row.id);
			expect(new Set(ids).size).toBe(ids.length);
		});

		it("leaves out elements that are in the pattern's trash", async () => {
			const { owner, pattern } = await richSource();
			await prisma.assuranceElement.updateMany({
				where: { caseId: pattern.id, name: "A1" },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});

			const outcome = await startOk(starter, owner, {
				patternCaseId: pattern.id,
			});

			const names = (await shapeOf(outcome.id)).map((row) => row.name);
			expect(names).not.toContain("A1");
			expect(names).toContain("G1");
		});

		it("makes an ordinary case that is listed under My Assurance Cases, and never lists the pattern there", async () => {
			const { owner, pattern } = await richSource();
			const viewer = await viewerOf(pattern.id, owner.id);

			const outcome = await startOk(starter, viewer, {
				patternCaseId: pattern.id,
			});

			const listed = expectSuccess(await listUserCases(viewer.id));
			expect(listed.map((row) => row.id)).toEqual([outcome.id]);
		});

		it("refuses a pattern that holds no elements, with a message, and creates nothing", async () => {
			const owner = await createTestUser();
			const empty = await createStoredPattern(owner.id, "Empty pattern");
			const before = await worldCounts();

			const outcome = await starter.start(owner, { patternCaseId: empty.id });

			expect(outcome.ok).toBe(false);
			expect(outcome).toMatchObject({ error: expect.any(String) });
			expect(await worldCounts()).toEqual(before);
		});

		it("keeps the pattern's goal as the new case's single top-level goal", async () => {
			const { owner, pattern } = await richSource();

			const outcome = await startOk(starter, owner, {
				patternCaseId: pattern.id,
			});

			const goals = await prisma.assuranceElement.findMany({
				where: {
					caseId: outcome.id,
					elementType: "GOAL",
					role: "TOP_LEVEL",
					isDefeater: false,
				},
			});
			expect(goals.map((goal) => goal.name)).toEqual(["G1"]);
		});
	});

	describe("name and description", () => {
		it.each([
			["an empty name", ""],
			["a name of spaces", "   "],
			["a name of tabs and line breaks", "\t \n\r "],
			["a name of 256 characters", "n".repeat(256)],
		])("refuses %s, naming the problem, and creates nothing", async (_label, name) => {
			const { owner, pattern } = await richSource();
			const before = await worldCounts();

			const outcome = await starter.start(
				owner,
				{ patternCaseId: pattern.id },
				name
			);

			expect(outcome.ok).toBe(false);
			expect(outcome).toMatchObject({
				error: expect.stringContaining("Case name"),
			});
			expect(await worldCounts()).toEqual(before);
		});

		it.each([
			["an empty description", ""],
			["a description of spaces", "    "],
			["a description of 5001 characters", "d".repeat(5001)],
		])("refuses %s, naming the problem, and creates nothing", async (_label, description) => {
			const { owner, pattern } = await richSource();
			const before = await worldCounts();

			const outcome = await starter.start(
				owner,
				{ patternCaseId: pattern.id },
				NAME,
				description
			);

			expect(outcome.ok).toBe(false);
			expect(outcome).toMatchObject({
				error: expect.stringContaining("Description"),
			});
			expect(await worldCounts()).toEqual(before);
		});

		it("accepts a name of 255 characters and a description of 5000, and stores them", async () => {
			const { owner, pattern } = await richSource();
			const name = "n".repeat(255);
			const description = "d".repeat(5000);

			const outcome = await startOk(
				starter,
				owner,
				{ patternCaseId: pattern.id },
				name,
				description
			);

			const started = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: outcome.id },
			});
			expect(started.name).toBe(name);
			expect(started.description).toBe(description);
		});

		it("stores the name and description without the spaces around them", async () => {
			const { owner, pattern } = await richSource();

			const outcome = await startOk(
				starter,
				owner,
				{ patternCaseId: pattern.id },
				"  Padded name \n",
				"\t Padded description  "
			);

			const started = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: outcome.id },
			});
			expect(started.name).toBe("Padded name");
			expect(started.description).toBe("Padded description");
		});

		it.each([
			["a number", 42],
			["null", null],
			["an object", { toString: "x" }],
			["an array", ["name"]],
		])("refuses %s as the name and creates nothing", async (_label, name) => {
			const { owner, pattern } = await richSource();
			const before = await worldCounts();

			const outcome = await starter.start(
				owner,
				{ patternCaseId: pattern.id },
				name as unknown as string
			);

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});

		it("keeps the pattern's own name and description out of the new case", async () => {
			const { owner, pattern } = await richSource();

			const outcome = await startOk(starter, owner, {
				patternCaseId: pattern.id,
			});

			const started = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: outcome.id },
			});
			expect(started.name).toBe(NAME);
			expect(started.name).not.toBe(pattern.name);
			expect(started.description).toBe(DESCRIPTION);
		});
	});

	describe("which key names the source", () => {
		it("refuses a source naming both a pattern case and a published slug, though each is valid", async () => {
			const { owner, pattern } = await richSource();
			await createPublishedRow({
				slug: "valid-published-pattern",
				assuranceCaseId: pattern.id,
				content: await snapshotWithComments(owner, pattern.id),
			});
			const before = await worldCounts();

			const outcome = await starter.start(owner, {
				patternCaseId: pattern.id,
				publishedSlug: "valid-published-pattern",
			});

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});

		it.each([
			["an empty object", {}],
			["a pattern case id of undefined", { patternCaseId: undefined }],
			["a published slug of undefined", { publishedSlug: undefined }],
			["a pattern case id of null", { patternCaseId: null }],
			["a published slug of null", { publishedSlug: null }],
			["an empty published slug", { publishedSlug: "" }],
			["an empty pattern case id", { patternCaseId: "" }],
		])("refuses a source of %s even when patterns exist to be found", async (_label, source) => {
			const { owner, pattern } = await richSource();
			await createPublishedRow({
				slug: "some-published-pattern",
				assuranceCaseId: pattern.id,
				content: await snapshotWithComments(owner, pattern.id),
			});
			const before = await worldCounts();

			const outcome = await starter.start(owner, source);

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});

		it.each([
			["a string", "pattern"],
			["null", null],
			["an array", []],
			["a number", 7],
		])("refuses a source that is %s and creates nothing", async (_label, source) => {
			const before = await worldCounts();
			const user = await createTestUser();

			const outcome = await starter.start(
				user,
				source as unknown as Record<string, unknown>
			);

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});

		it.each([
			["a slug", "a-pattern-slug"],
			["a path", "../../etc/passwd"],
			["a quote", "x' OR '1'='1"],
			["a number", "12345"],
		])("refuses %s as a pattern case id and creates nothing", async (_label, id) => {
			const { owner } = await richSource();
			const before = await worldCounts();

			const outcome = await starter.start(owner, { patternCaseId: id });

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});

		it("does not read a pattern case when the slug is that case's id", async () => {
			const { owner, pattern } = await richSource();
			const before = await worldCounts();

			const outcome = await starter.start(owner, { publishedSlug: pattern.id });

			expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
			expect(await worldCounts()).toEqual(before);
		});

		it("does not read a pattern case when the case id is the slug of a published pattern", async () => {
			const { owner, pattern } = await richSource();
			await createPublishedRow({
				slug: "a-published-pattern",
				assuranceCaseId: pattern.id,
				content: await snapshotWithComments(owner, pattern.id),
			});
			const stranger = await createTestUser();
			const before = await worldCounts();

			const outcome = await starter.start(stranger, {
				patternCaseId: "a-published-pattern",
			});

			expect(outcome.ok).toBe(false);
			expect(await worldCounts()).toEqual(before);
		});
	});
});

describe.each(
	STARTERS
)("starting a case from a published pattern through %s", (_label, starter) => {
	/** A pattern case and a current published row for it, with comments in the snapshot. */
	async function published(slug = "published-pattern") {
		const source = await richSource();
		const content = await snapshotWithComments(source.owner, source.pattern.id);
		const row = await createPublishedRow({
			slug,
			assuranceCaseId: source.pattern.id,
			content,
		});
		return { ...source, row, content };
	}

	it("starts a case for a user who cannot view the pattern case: a published pattern is open to everyone", async () => {
		const { pattern } = await published();
		const stranger = await createTestUser();

		const outcome = await startOk(starter, stranger, {
			publishedSlug: "published-pattern",
		});

		const started = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: outcome.id },
		});
		expect(started).toMatchObject({
			kind: "CASE",
			createdById: stranger.id,
			sourcePatternId: pattern.id,
			name: NAME,
		});
		expect(await shapeOf(outcome.id)).toEqual(await shapeOf(pattern.id));
	});

	it("copies no comments from a snapshot that still holds them, and marks every element as from the pattern", async () => {
		const { content } = await published();
		expect(JSON.stringify(content)).toContain("First comment on the goal");
		expect(JSON.stringify(content)).toContain("Reply to the first comment");
		const stranger = await createTestUser();

		const outcome = await startOk(starter, stranger, {
			publishedSlug: "published-pattern",
		});

		expect(await commentsOn(outcome.id)).toBe(0);
		expect(
			await prisma.comment.count({ where: { authorId: stranger.id } })
		).toBe(0);
		expect(await flagsOf(outcome.id)).toEqual(
			RICH_NAMES.map((name) => ({
				name,
				fromPattern: true,
				modifiedFromPattern: false,
			}))
		);
		expect(
			await prisma.casePermission.count({ where: { caseId: outcome.id } })
		).toBe(0);
		expect(
			await prisma.caseTeamPermission.count({ where: { caseId: outcome.id } })
		).toBe(0);
	});

	it("leaves the pattern case and the published row as they were", async () => {
		const { pattern, row } = await published();
		const stranger = await createTestUser();
		const before = await fullStateOf(pattern.id);
		const rowBefore = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: row.id },
		});

		await startOk(starter, stranger, { publishedSlug: "published-pattern" });

		expect(await fullStateOf(pattern.id)).toEqual(before);
		expect(
			await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: row.id },
			})
		).toEqual(rowBefore);
	});

	it("starts from an archived current row whose pattern case is gone, linking no source", async () => {
		const { owner, pattern } = await richSource();
		const content = await snapshotWithComments(owner, pattern.id);
		await createPublishedRow({
			slug: "archived-pattern",
			assuranceCaseId: null,
			archivedAt: new Date(),
			content,
		});
		const stranger = await createTestUser();

		const outcome = await startOk(starter, stranger, {
			publishedSlug: "archived-pattern",
		});

		const started = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: outcome.id },
		});
		expect(started.sourcePatternId).toBeNull();
		expect(started.kind).toBe("CASE");
		expect(await shapeOf(outcome.id)).toEqual(await shapeOf(pattern.id));
	});

	it("starts from an archived current row whose pattern case still exists, linking it", async () => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "archived-pattern",
			assuranceCaseId: pattern.id,
			archivedAt: new Date(),
			content: await snapshotWithComments(owner, pattern.id),
		});
		const stranger = await createTestUser();

		const outcome = await startOk(starter, stranger, {
			publishedSlug: "archived-pattern",
		});

		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: outcome.id },
				})
			).sourcePatternId
		).toBe(pattern.id);
	});

	it("links no source when the row's case is an ordinary case", async () => {
		const { owner, pattern } = await richSource();
		const ordinary = await createStoredCase(owner.id);
		await createPublishedRow({
			slug: "stale-pattern",
			assuranceCaseId: ordinary.id,
			content: await snapshotWithComments(owner, pattern.id),
		});

		const outcome = await startOk(starter, owner, {
			publishedSlug: "stale-pattern",
		});

		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: outcome.id },
				})
			).sourcePatternId
		).toBeNull();
	});

	it("links no source when the row's case has been deleted for good", async () => {
		const { owner, pattern } = await richSource();
		const gone = await makePattern(owner, { name: "Soon gone" });
		await createPublishedRow({
			slug: "orphaned-pattern",
			assuranceCaseId: gone.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		await prisma.assuranceCase.delete({ where: { id: gone.id } });

		const outcome = await startOk(starter, owner, {
			publishedSlug: "orphaned-pattern",
		});

		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: outcome.id },
				})
			).sourcePatternId
		).toBeNull();
	});

	it("reads the current row, not an older one with the same slug", async () => {
		const { owner, pattern } = await richSource();
		const older = await makePattern(owner, { name: "Older pattern" });
		await prisma.assuranceElement.updateMany({
			where: { caseId: older.id, name: "G1" },
			data: { description: "The older version's goal" },
		});
		await createPublishedRow({
			slug: "versioned-pattern",
			assuranceCaseId: pattern.id,
			isCurrent: false,
			content: await snapshotWithComments(owner, older.id),
		});
		await createPublishedRow({
			slug: "versioned-pattern",
			assuranceCaseId: pattern.id,
			isCurrent: true,
			content: await snapshotWithComments(owner, pattern.id),
		});

		const outcome = await startOk(starter, owner, {
			publishedSlug: "versioned-pattern",
		});

		const goal = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: outcome.id, name: "G1" },
		});
		expect(goal.description).toBe("The goal");
	});

	it("refuses a slug whose only row has been superseded, and creates nothing", async () => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "superseded-pattern",
			assuranceCaseId: pattern.id,
			isCurrent: false,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const before = await worldCounts();

		const outcome = await starter.start(owner, {
			publishedSlug: "superseded-pattern",
		});

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses the slug of a published ordinary case, even to the case's owner, and creates nothing", async () => {
		const { owner, pattern } = await richSource();
		const ordinary = await createStoredCase(owner.id);
		await createPublishedRow({
			slug: "published-ordinary-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: ordinary.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const stranger = await createTestUser();
		const before = await worldCounts();

		const asOwner = await starter.start(owner, {
			publishedSlug: "published-ordinary-case",
		});
		const asStranger = await starter.start(stranger, {
			publishedSlug: "published-ordinary-case",
		});

		expect(asOwner).toEqual({ ok: false, error: "Pattern not found" });
		expect(asStranger).toEqual(asOwner);
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses a row typed as an ordinary case even when its content is a pattern file", async () => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "published-pattern-file-as-case",
			type: "ASSURANCE_CASE",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const before = await worldCounts();

		const outcome = await starter.start(owner, {
			publishedSlug: "published-pattern-file-as-case",
		});

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it.each([
		["an unknown slug", "no-such-slug"],
		["a slug that is a case id", randomUUID()],
	])("refuses %s with the same message as any unavailable pattern", async (_label, slug) => {
		const user = await createTestUser();
		const before = await worldCounts();

		const outcome = await starter.start(user, { publishedSlug: slug });

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it.each([
		["upper case letters", "Published-Pattern"],
		["spaces", "published pattern"],
		["a slash", "published/pattern"],
		["a leading hyphen", "-published-pattern"],
		["two hyphens together", "published--pattern"],
		["more than 255 characters", "p".repeat(256)],
	])("refuses a slug with %s and creates nothing", async (_label, slug) => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "published-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const before = await worldCounts();

		const outcome = await starter.start(owner, { publishedSlug: slug });

		expect(outcome.ok).toBe(false);
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses a snapshot that is a version 1.0 file marked as a pattern, and creates nothing", async () => {
		const { owner, pattern } = await richSource();
		const content = await snapshotWithComments(owner, pattern.id);
		await createPublishedRow({
			slug: "old-format-pattern",
			assuranceCaseId: pattern.id,
			content: { ...content, version: "1.0" },
		});
		const before = await worldCounts();

		const outcome = await starter.start(owner, {
			publishedSlug: "old-format-pattern",
		});

		expect(outcome.ok).toBe(false);
		expect(await worldCounts()).toEqual(before);
	});

	it.each([
		["an empty object", {}],
		["a string", "not a case file"],
		["null", null],
		["a case file with no elements", { version: "1.0", case: { name: "x" } }],
	])("refuses a snapshot that is %s with a message, and creates nothing", async (_label, content) => {
		await createPublishedRow({
			slug: "broken-pattern",
			content,
		});
		const user = await createTestUser();
		const before = await worldCounts();

		const outcome = await starter.start(user, {
			publishedSlug: "broken-pattern",
		});

		expect(outcome.ok).toBe(false);
		expect(outcome).toMatchObject({ error: expect.any(String) });
		expect(await worldCounts()).toEqual(before);
	});

	it("starts from two published patterns in turn, taking each one's own content", async () => {
		const { owner, pattern } = await richSource();
		const other = await makePattern(owner, { name: "Other pattern" });
		await prisma.assuranceElement.updateMany({
			where: { caseId: other.id, name: "G1" },
			data: { description: "The other pattern's goal" },
		});
		await createPublishedRow({
			slug: "first-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		await createPublishedRow({
			slug: "second-pattern",
			assuranceCaseId: other.id,
			content: await snapshotWithComments(owner, other.id),
		});

		const first = await startOk(starter, owner, {
			publishedSlug: "first-pattern",
		});
		const second = await startOk(starter, owner, {
			publishedSlug: "second-pattern",
		});

		const goalOf = async (caseId: string) =>
			(
				await prisma.assuranceElement.findFirstOrThrow({
					where: { caseId, name: "G1" },
				})
			).description;
		expect(await goalOf(first.id)).toBe("The goal");
		expect(await goalOf(second.id)).toBe("The other pattern's goal");
	});
});

describe("the server action alone", () => {
	it("refuses a signed-out caller with the session message and creates nothing", async () => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "open-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		await mockNoAuth();
		const before = await worldCounts();
		const { createCaseFromPattern } = await import(
			"@/actions/case-from-pattern"
		);

		const fromCase = await createCaseFromPattern(
			{ patternCaseId: pattern.id },
			NAME,
			DESCRIPTION
		);
		const fromSlug = await createCaseFromPattern(
			{ publishedSlug: "open-pattern" },
			NAME,
			DESCRIPTION
		);

		expect(fromCase).toEqual({ success: false, error: "Invalid session" });
		expect(fromSlug).toEqual({ success: false, error: "Invalid session" });
		expect(await worldCounts()).toEqual(before);
	});

	it.each([
		["a source pattern id", { patternCaseId: "x", sourcePatternId: "y" }],
		["a kind", { patternCaseId: "x", kind: "PATTERN" }],
		["a fromPattern flag", { publishedSlug: "x", fromPattern: false }],
		["a user id", { publishedSlug: "x", userId: "someone-else" }],
	])("refuses a source that also carries %s", async (_label, extra) => {
		const { owner, pattern } = await richSource();
		await createPublishedRow({
			slug: "x",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const source =
			"patternCaseId" in extra
				? { ...extra, patternCaseId: pattern.id }
				: extra;
		const before = await worldCounts();

		const outcome = await viaAction.start(owner, source);

		expect(outcome.ok).toBe(false);
		expect(await worldCounts()).toEqual(before);
	});

	it("names the field that failed when the name is blank", async () => {
		const { owner, pattern } = await richSource();
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);
		const { createCaseFromPattern } = await import(
			"@/actions/case-from-pattern"
		);

		const result = await createCaseFromPattern(
			{ patternCaseId: pattern.id },
			"   ",
			DESCRIPTION
		);

		expect(result).toMatchObject({ success: false });
		expect(result.success === false && result.fieldErrors).toHaveProperty(
			"name"
		);
	});

	it("takes the new case's owner from the session, whoever the pattern belongs to", async () => {
		const { owner, pattern } = await richSource();
		const viewer = await viewerOf(pattern.id, owner.id);

		const outcome = await startOk(viaAction, viewer, {
			patternCaseId: pattern.id,
		});

		expect(
			(
				await prisma.assuranceCase.findUniqueOrThrow({
					where: { id: outcome.id },
				})
			).createdById
		).toBe(viewer.id);
		expect(
			await prisma.assuranceCase.count({ where: { createdById: viewer.id } })
		).toBe(1);
	});
});

describe("several starts at the same time", () => {
	it("from one pattern through the service make separate, complete cases", async () => {
		const { owner, pattern } = await richSource();

		const results = await Promise.all(
			[1, 2, 3].map((n) =>
				startViaService(
					owner.id,
					{ patternCaseId: pattern.id },
					`Case ${n}`,
					DESCRIPTION
				)
			)
		);

		const ids = results.map((result) => {
			if (!("data" in result)) {
				throw new Error(`start refused: ${result.error}`);
			}
			return result.data.id;
		});
		expect(new Set(ids).size).toBe(3);
		for (const id of ids) {
			expect((await shapeOf(id)).length).toBe(RICH_NAMES.length);
		}
	});

	it("from one pattern through the action make separate, complete cases", async () => {
		const { owner, pattern } = await richSource();
		await mockAuth(owner.id, owner.username, owner.email ?? undefined);
		const { createCaseFromPattern } = await import(
			"@/actions/case-from-pattern"
		);

		const results = await Promise.all(
			[1, 2, 3].map((n) =>
				createCaseFromPattern(
					{ patternCaseId: pattern.id },
					`Case ${n}`,
					DESCRIPTION
				)
			)
		);

		const ids = results.map((result) => {
			if (!result.success) {
				throw new Error(`start refused: ${result.error}`);
			}
			return result.data.id;
		});
		expect(new Set(ids).size).toBe(3);
		for (const id of ids) {
			expect((await shapeOf(id)).length).toBe(RICH_NAMES.length);
		}
	});
});
