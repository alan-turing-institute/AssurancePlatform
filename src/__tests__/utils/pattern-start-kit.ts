import prisma from "@/lib/prisma";
import { exportCase } from "@/lib/services/case-export-service";
import type { Prisma } from "@/src/generated/prisma";
import {
	importOk,
	type RichFileOptions,
	richNestedFile,
} from "./case-kind-kit";
import {
	createTestComment,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

/**
 * Fixtures and readers for the tests of starting a case from a pattern: a
 * pattern holding one of every kind of element, rows for the pattern
 * snapshots published on Discover, and counts of everything a start can
 * create, so a refusal can be shown to have created nothing.
 */

type User = Awaited<ReturnType<typeof createTestUser>>;

/** The element names of the rich file, in the order the readers return them. */
export const RICH_NAMES = [
	"A1",
	"AG1",
	"CG1",
	"CP1",
	"E1",
	"G1",
	"J1",
	"M1",
	"P1",
	"P1.1",
	"S1",
] as const;

/** A pattern made by importing the rich file with kind PATTERN. */
export async function makePattern(
	owner: User,
	options: {
		citedCaseId?: string;
		file?: RichFileOptions;
		name?: string;
	} = {}
) {
	const imported = await importOk(
		owner.id,
		richNestedFile({
			version: "1.1",
			citedCaseId: options.citedCaseId,
			...options.file,
		}),
		{
			kind: "PATTERN",
			name: options.name ?? "Source pattern",
			description: "The pattern's own description",
		}
	);
	return { id: imported.caseId, name: options.name ?? "Source pattern" };
}

/** The id of the element named `name` in a stored case. */
async function elementIdByName(caseId: string, name: string) {
	const row = await prisma.assuranceElement.findFirstOrThrow({
		where: { caseId, name },
		select: { id: true },
	});
	return row.id;
}

/**
 * Gives some elements of a stored rich case the fields the rich file leaves
 * empty: an assumption, a justification, context entries and a declared
 * assertion status.
 */
async function addTextFieldsTo(caseId: string) {
	await prisma.assuranceElement.update({
		where: { id: await elementIdByName(caseId, "P1") },
		data: { assumption: "Assumes the data is current" },
	});
	await prisma.assuranceElement.update({
		where: { id: await elementIdByName(caseId, "S1") },
		data: { justification: "The claims together cover the goal" },
	});
	await prisma.assuranceElement.update({
		where: { id: await elementIdByName(caseId, "G1") },
		data: { context: ["Used only in the training environment"] },
	});
	await prisma.assuranceElement.update({
		where: { id: await elementIdByName(caseId, "P1.1") },
		data: { assertionStatus: "ASSUMED" },
	});
}

/**
 * Comments on a stored pattern: two on the goal (one a reply to the other,
 * by two people) and one on the case itself.
 */
async function addCommentsTo(caseId: string, commenters: [User, User]) {
	const goalId = await elementIdByName(caseId, "G1");
	const first = await createTestComment(commenters[0].id, {
		elementId: goalId,
		content: "First comment on the goal",
	});
	await createTestComment(commenters[1].id, {
		elementId: goalId,
		parentCommentId: first.id,
		content: "Reply to the first comment",
	});
	await createTestComment(commenters[0].id, {
		caseId,
		content: "Comment on the whole case",
	});
}

/**
 * The shape of a stored case: every element's content and where it sits,
 * with parents and targets named rather than numbered, so two cases can be
 * compared though their ids differ.
 */
export async function shapeOf(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null },
		orderBy: { name: "asc" },
	});
	const nameOf = new Map(rows.map((row) => [row.id, row.name]));
	return rows.map((row) => ({
		name: row.name,
		elementType: row.elementType,
		description: row.description,
		role: row.role,
		level: row.level,
		url: row.url,
		assumption: row.assumption,
		justification: row.justification,
		context: row.context,
		// An unset status is read as the default, ASSERTED, by export and import.
		assertionStatus: row.assertionStatus ?? "ASSERTED",
		inSandbox: row.inSandbox,
		isDefeater: row.isDefeater,
		moduleEmbedType: row.moduleEmbedType,
		parent: row.parentId ? (nameOf.get(row.parentId) ?? "?") : null,
		defeats: row.defeatsElementId
			? (nameOf.get(row.defeatsElementId) ?? "?")
			: null,
	}));
}

/** The pattern flags of a stored case's elements, by element name. */
export async function flagsOf(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId },
		select: { name: true, fromPattern: true, modifiedFromPattern: true },
		orderBy: { name: "asc" },
	});
	return rows.map((row) => ({
		name: row.name,
		fromPattern: row.fromPattern,
		modifiedFromPattern: row.modifiedFromPattern,
	}));
}

/** The reference fields of the element named `name` in a stored case. */
export function referencesOf(caseId: string, name: string) {
	return prisma.assuranceElement.findFirstOrThrow({
		where: { caseId, name },
		select: {
			moduleReferenceId: true,
			moduleReferenceDangling: true,
			citedElementId: true,
			citationDangling: true,
		},
	});
}

/**
 * Counts of everything a start from a pattern can create or change. Taken
 * before and after a refused start, equal counts show nothing was written.
 */
export async function worldCounts() {
	const [
		cases,
		elements,
		comments,
		casePermissions,
		teamPermissions,
		evidenceLinks,
		published,
	] = await Promise.all([
		prisma.assuranceCase.count(),
		prisma.assuranceElement.count(),
		prisma.comment.count(),
		prisma.casePermission.count(),
		prisma.caseTeamPermission.count(),
		prisma.evidenceLink.count(),
		prisma.publishedAssuranceCase.count(),
	]);
	return {
		cases,
		elements,
		comments,
		casePermissions,
		teamPermissions,
		evidenceLinks,
		published,
	};
}

/** The comments on any element of `caseId`, or on the case itself. */
export function commentsOn(caseId: string) {
	return prisma.comment.count({
		where: { OR: [{ caseId }, { element: { caseId } }] },
	});
}

/** The whole stored state of a case and its elements, for "left unchanged". */
export async function fullStateOf(caseId: string) {
	const [theCase, elements, comments, userShares, teamShares, links] =
		await Promise.all([
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseId } }),
			prisma.assuranceElement.findMany({
				where: { caseId },
				orderBy: { id: "asc" },
			}),
			prisma.comment.findMany({
				where: { OR: [{ caseId }, { element: { caseId } }] },
				orderBy: { id: "asc" },
			}),
			prisma.casePermission.findMany({
				where: { caseId },
				orderBy: { id: "asc" },
			}),
			prisma.caseTeamPermission.findMany({
				where: { caseId },
				orderBy: { id: "asc" },
			}),
			prisma.evidenceLink.findMany({
				where: { evidence: { caseId } },
				orderBy: { id: "asc" },
			}),
		]);
	return { theCase, elements, comments, userShares, teamShares, links };
}

interface PublishedRowOptions {
	archivedAt?: Date | null;
	assuranceCaseId?: string | null;
	content?: unknown;
	description?: string | null;
	isCurrent?: boolean;
	slug: string;
	title?: string;
	type?: "ASSURANCE_CASE" | "ARGUMENT_PATTERN";
}

/** A row of published snapshots, written straight to the database. */
export function createPublishedRow(options: PublishedRowOptions) {
	return prisma.publishedAssuranceCase.create({
		data: {
			slug: options.slug,
			type: options.type ?? "ARGUMENT_PATTERN",
			isCurrent: options.isCurrent ?? true,
			title: options.title ?? `Published ${options.slug}`,
			description: options.description ?? "A published pattern",
			assuranceCaseId: options.assuranceCaseId ?? null,
			archivedAt: options.archivedAt ?? null,
			content: (options.content ?? {}) as Prisma.InputJsonValue,
		},
	});
}

/**
 * The snapshot a publish would freeze for `caseId`, but with the comments
 * still in it, as an older snapshot can hold, and the keys a real snapshot
 * carries beside the case file.
 */
export async function snapshotWithComments(owner: User, caseId: string) {
	const exported = await exportCase(owner.id, caseId, {
		includeComments: true,
	});
	if (!("data" in exported)) {
		throw new Error(`export failed: ${exported.error}`);
	}
	return {
		...exported.data,
		pluginData: {},
		caseInformation: { summary: "Published summary" },
	};
}

/** A pattern with comments, shares, text fields and mixed pattern flags. */
export async function richSource() {
	const owner = await createTestUser();
	const commenters: [User, User] = [
		await createTestUser(),
		await createTestUser(),
	];
	const sharedUser = await createTestUser();
	const pattern = await makePattern(owner);
	await addTextFieldsTo(pattern.id);
	await addCommentsTo(pattern.id, commenters);
	await createTestPermission(pattern.id, sharedUser.id, owner.id, "EDIT");
	const team = await createTestTeam(owner.id);
	await createTestTeamPermission(pattern.id, team.id, owner.id, "COMMENT");
	await prisma.assuranceElement.updateMany({
		where: { caseId: pattern.id },
		data: { fromPattern: false, modifiedFromPattern: false },
	});
	await prisma.assuranceElement.updateMany({
		where: { caseId: pattern.id, name: { in: ["P1", "E1"] } },
		data: { fromPattern: true, modifiedFromPattern: true },
	});
	return { owner, pattern, sharedUser, team, commenters };
}

/** A new user with VIEW access to `caseId`. */
export async function viewerOf(caseId: string, ownerId: string) {
	const viewer = await createTestUser();
	await createTestPermission(caseId, viewer.id, ownerId, "VIEW");
	return viewer;
}
