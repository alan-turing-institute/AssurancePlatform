import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import type { CaseKind } from "@/lib/schemas/case-export";
import {
	type SSEEvent,
	sseConnectionManager,
} from "@/lib/services/sse-connection-manager";
import type { User } from "@/src/generated/prisma";
import {
	addTeamMember,
	createTestCase,
	createTestComment,
	createTestElement,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestPluginData,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

/**
 * Fixtures for the tests of converting a case to a pattern and back: people
 * at every level of access, a case with something in every table keyed to it,
 * a snapshot of all of that, and a stand-in for an open editor's live-update
 * connection.
 */

type PermissionLevel = "VIEW" | "COMMENT" | "EDIT" | "ADMIN";

export interface Person {
	/** Whether this person may convert the case. */
	allowed: boolean;
	label: string;
	/** Creates the person and gives them their access to the case. */
	setup: (input: { caseId: string; ownerId: string }) => Promise<User>;
}

async function directly(
	level: PermissionLevel,
	input: { caseId: string; ownerId: string }
): Promise<User> {
	const user = await createTestUser();
	await createTestPermission(input.caseId, user.id, input.ownerId, level);
	return user;
}

async function throughTeam(
	level: PermissionLevel,
	teamRole: "ADMIN" | "MEMBER",
	input: { caseId: string; ownerId: string }
): Promise<User> {
	const user = await createTestUser();
	const founder = await createTestUser();
	const team = await createTestTeam(founder.id);
	await addTeamMember(team.id, user.id, teamRole);
	await createTestTeamPermission(input.caseId, team.id, input.ownerId, level);
	return user;
}

/** Everyone who might reach the conversion, and whether they may convert. */
export const PEOPLE: Person[] = [
	{
		label: "a direct ADMIN",
		allowed: true,
		setup: (input) => directly("ADMIN", input),
	},
	{
		label: "a plain member of a team shared at ADMIN",
		allowed: true,
		setup: (input) => throughTeam("ADMIN", "MEMBER", input),
	},
	{
		label: "someone with VIEW directly and ADMIN through a team",
		allowed: true,
		setup: async (input) => {
			const user = await throughTeam("ADMIN", "MEMBER", input);
			await createTestPermission(input.caseId, user.id, input.ownerId, "VIEW");
			return user;
		},
	},
	{
		label: "a direct EDIT",
		allowed: false,
		setup: (input) => directly("EDIT", input),
	},
	{
		label: "a direct COMMENT",
		allowed: false,
		setup: (input) => directly("COMMENT", input),
	},
	{
		label: "a direct VIEW",
		allowed: false,
		setup: (input) => directly("VIEW", input),
	},
	{
		label: "a team ADMIN of a team shared at EDIT",
		allowed: false,
		setup: (input) => throughTeam("EDIT", "ADMIN", input),
	},
	{
		label: "a member of a team shared at EDIT",
		allowed: false,
		setup: (input) => throughTeam("EDIT", "MEMBER", input),
	},
	{
		label: "a member of a team shared at COMMENT",
		allowed: false,
		setup: (input) => throughTeam("COMMENT", "MEMBER", input),
	},
	{
		label: "a member of a team shared at VIEW",
		allowed: false,
		setup: (input) => throughTeam("VIEW", "MEMBER", input),
	},
	{
		label: "an ADMIN of a team shared at VIEW",
		allowed: false,
		setup: (input) => throughTeam("VIEW", "ADMIN", input),
	},
	{
		label: "a member of a team that has ADMIN on a different case",
		allowed: false,
		setup: async (input) => {
			const user = await createTestUser();
			const founder = await createTestUser();
			const team = await createTestTeam(founder.id);
			await addTeamMember(team.id, user.id, "MEMBER");
			const elsewhere = await createTestCase(founder.id);
			await createTestTeamPermission(
				elsewhere.id,
				team.id,
				founder.id,
				"ADMIN"
			);
			await createTestPermission(elsewhere.id, user.id, founder.id, "ADMIN");
			// A team shared into this case at VIEW does not make them an admin.
			await createTestTeamPermission(
				input.caseId,
				team.id,
				input.ownerId,
				"VIEW"
			);
			return user;
		},
	},
	{
		label: "a stranger",
		allowed: false,
		setup: () => createTestUser(),
	},
];

/** A uuid that names no case. */
export const MISSING_CASE_ID = "00000000-0000-4000-8000-00000000dead";

export function otherKind(kind: CaseKind): CaseKind {
	return kind === "PATTERN" ? "CASE" : "PATTERN";
}

/** The columns of a stored case that matter to a conversion. */
export function storedKind(caseId: string) {
	return prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: {
			kind: true,
			published: true,
			publishStatus: true,
			deletedAt: true,
			updatedAt: true,
		},
	});
}

/** A row in the published table, written straight to the database. */
export function createPublishedRow(
	caseId: string | null,
	overrides: Partial<{
		archivedAt: Date | null;
		content: Record<string, unknown>;
		isCurrent: boolean;
	}> = {}
) {
	const tag = randomUUID().slice(0, 8);
	return prisma.publishedAssuranceCase.create({
		data: {
			assuranceCaseId: caseId,
			slug: `published-${tag}`,
			title: `Published ${tag}`,
			content: (overrides.content ?? { version: "1.0" }) as never,
			isCurrent: overrides.isCurrent ?? true,
			archivedAt: overrides.archivedAt ?? null,
		},
	});
}

export interface RichCase {
	caseId: string;
	/** The case that cites it through an away goal. */
	citingCaseId: string;
	/** A case started from it. */
	derivedCaseId: string;
	elementIds: string[];
	integrationSystemUserId: string;
	owner: User;
	ownerId: string;
}

/**
 * A case with something in every table keyed to it: elements (one of them
 * soft-deleted), direct and team sharing, an integration account's grant,
 * plugin data on the case and on an element, comments, case information and
 * an invite; plus another case that cites it, another started from it and an
 * unrelated published row.
 */
export async function createRichCase(
	kind: CaseKind,
	owner?: User
): Promise<RichCase> {
	const ownerUser = owner ?? (await createTestUser());
	const testCase = await createTestCase(ownerUser.id, { kind });
	const goal = await createTestElement(testCase.id, ownerUser.id, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
		name: "G1",
	});
	const strategy = await createTestElement(testCase.id, ownerUser.id, {
		elementType: "STRATEGY",
		parentId: goal.id,
		name: "S1",
	});
	const claim = await createTestElement(testCase.id, ownerUser.id, {
		elementType: "PROPERTY_CLAIM",
		parentId: strategy.id,
		name: "P1",
	});
	const evidence = await createTestElement(testCase.id, ownerUser.id, {
		elementType: "EVIDENCE",
		name: "E1",
		url: "https://example.com/evidence",
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: evidence.id, claimId: claim.id },
	});
	const removed = await createTestElement(testCase.id, ownerUser.id, {
		elementType: "ASSUMPTION",
		parentId: claim.id,
		name: "A1",
	});
	await prisma.assuranceElement.update({
		where: { id: removed.id },
		data: { deletedAt: new Date() },
	});

	const viewer = await createTestUser();
	const editor = await createTestUser();
	const admin = await createTestUser();
	await createTestPermission(testCase.id, viewer.id, ownerUser.id, "VIEW");
	await createTestPermission(testCase.id, editor.id, ownerUser.id, "EDIT");
	await createTestPermission(testCase.id, admin.id, ownerUser.id, "ADMIN");
	const { systemUser } = await createTestIntegrationWithSystemUser(
		ownerUser.id
	);
	await createTestPermission(testCase.id, systemUser.id, ownerUser.id, "EDIT");
	const team = await createTestTeam(admin.id);
	await createTestTeamPermission(testCase.id, team.id, ownerUser.id, "COMMENT");

	await createTestPluginData(testCase.id, {
		pluginId: "tea.health",
		data: { level: "case" },
	});
	await createTestPluginData(testCase.id, {
		pluginId: "tea.health",
		elementId: claim.id,
		data: { level: "element" },
	});
	await createTestComment(viewer.id, {
		caseId: testCase.id,
		content: "A case comment",
	});
	await createTestComment(editor.id, {
		elementId: claim.id,
		content: "An element comment",
	});
	await prisma.caseInformation.create({
		data: { caseId: testCase.id, description: "About", authors: "Ada" },
	});
	await prisma.caseInvite.create({
		data: {
			caseId: testCase.id,
			email: "invitee@example.com",
			permission: "VIEW",
			inviteToken: randomUUID(),
			inviteExpiresAt: new Date(Date.now() + 86_400_000),
			invitedById: ownerUser.id,
		},
	});

	const citing = await createTestCase(ownerUser.id, { name: "Cites it" });
	await createTestElement(citing.id, ownerUser.id, {
		elementType: "AWAY_GOAL",
		name: "AG1",
		moduleReferenceId: testCase.id,
	});
	const derived = await createTestCase(ownerUser.id, {
		name: "Started from it",
	});
	await prisma.assuranceCase.update({
		where: { id: derived.id },
		data: { sourcePatternId: testCase.id },
	});
	const unrelated = await createTestCase(ownerUser.id, { name: "Unrelated" });
	await createPublishedRow(unrelated.id);
	await createPublishedRow(null, { archivedAt: new Date() });

	return {
		caseId: testCase.id,
		citingCaseId: citing.id,
		derivedCaseId: derived.id,
		elementIds: [goal.id, strategy.id, claim.id, evidence.id, removed.id],
		integrationSystemUserId: systemUser.id,
		owner: ownerUser,
		ownerId: ownerUser.id,
	};
}

/**
 * Everything in the database that a conversion of `caseId` must leave alone,
 * as plain data: the case row without its kind and modified time, and every
 * row of every table keyed to it, and every other case.
 */
export async function snapshotAroundKind(caseId: string) {
	const [
		caseRow,
		otherCases,
		elements,
		evidenceLinks,
		permissions,
		teamPermissions,
		comments,
		pluginData,
		information,
		invites,
		published,
		integrations,
		tokens,
		users,
		teams,
	] = await Promise.all([
		prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseId } }),
		prisma.assuranceCase.findMany({
			where: { id: { not: caseId } },
			orderBy: { id: "asc" },
		}),
		prisma.assuranceElement.findMany({ orderBy: { id: "asc" } }),
		prisma.evidenceLink.findMany({ orderBy: { id: "asc" } }),
		prisma.casePermission.findMany({ orderBy: { id: "asc" } }),
		prisma.caseTeamPermission.findMany({ orderBy: { id: "asc" } }),
		prisma.comment.findMany({ orderBy: { id: "asc" } }),
		prisma.pluginData.findMany({ orderBy: { id: "asc" } }),
		prisma.caseInformation.findMany({ orderBy: { id: "asc" } }),
		prisma.caseInvite.findMany({ orderBy: { id: "asc" } }),
		prisma.publishedAssuranceCase.findMany({ orderBy: { id: "asc" } }),
		prisma.integration.findMany({ orderBy: { id: "asc" } }),
		prisma.apiToken.findMany({ orderBy: { id: "asc" } }),
		prisma.user.findMany({ orderBy: { id: "asc" } }),
		prisma.team.findMany({ orderBy: { id: "asc" } }),
	]);

	const { kind: _kind, updatedAt: _updatedAt, ...caseWithoutKind } = caseRow;
	return JSON.parse(
		JSON.stringify({
			caseWithoutKind,
			otherCases,
			elements,
			evidenceLinks,
			permissions,
			teamPermissions,
			comments,
			pluginData,
			information,
			invites,
			published,
			integrations,
			tokens,
			users,
			teams,
		})
	) as Record<string, unknown>;
}

/** What a live-update subscriber to one case has been sent. */
export interface CaseEventTap {
	/** Every event received, in order. */
	events: () => SSEEvent[];
	stop: () => void;
}

/**
 * Registers a stand-in for an open editor's live-update connection to a
 * case, on the real connection manager, and records what it is sent.
 */
export function tapCaseEvents(
	caseId: string,
	userId = "watcher"
): CaseEventTap {
	const chunks: Uint8Array[] = [];
	const connectionId = randomUUID();
	const controller = {
		enqueue: (chunk: Uint8Array) => {
			chunks.push(chunk);
		},
	} as unknown as ReadableStreamDefaultController<Uint8Array>;
	sseConnectionManager.addConnection(caseId, connectionId, controller, userId);

	const decoder = new TextDecoder();
	return {
		events: () =>
			chunks
				.map((chunk) => decoder.decode(chunk))
				.filter((text) => text.startsWith("event: "))
				.map((text) => {
					const data = text.split("\ndata: ")[1] ?? "";
					return JSON.parse(data.trim()) as SSEEvent;
				}),
		stop: () => sseConnectionManager.removeConnection(caseId, connectionId),
	};
}
