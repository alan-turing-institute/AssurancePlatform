import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { mockAuth } from "./auth-helpers";
import { createStoredCase } from "./case-kind-kit";
import {
	addTeamMember,
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

/**
 * Shared set-up for the tests of who may point an away goal or a module at a
 * case, and who may cite an element of one. A "world" is one home case the
 * editor can change (EDIT, granted by its owner), plus a third user who owns
 * cases the editor has no way into. The targets are every way a case can be
 * reachable by the editor, and every way it can not be.
 */

export type User = Awaited<ReturnType<typeof createTestUser>>;

/** The element types that name another case. */
export type RefKind = "AWAY_GOAL" | "MODULE";
export const REF_KINDS: readonly RefKind[] = ["AWAY_GOAL", "MODULE"];

const NAME_PREFIX: Record<RefKind, string> = { AWAY_GOAL: "AG", MODULE: "M" };

export interface World {
	/** Has EDIT on the home case and nothing else unless a target grants it. */
	editor: User;
	homeCaseId: string;
	/** Owns the home case. */
	host: User;
	/** Owns the cases the editor can not reach. */
	stranger: User;
	/** The strategy every reference element hangs from. */
	strategyId: string;
}

export async function makeWorld(): Promise<World> {
	const host = await createTestUser();
	const editor = await createTestUser();
	const stranger = await createTestUser();
	const home = await createStoredCase(host.id);
	await createTestPermission(home.id, editor.id, host.id, "EDIT");
	const goal = await createTestElement(home.id, host.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	const strategy = await createTestElement(home.id, host.id, {
		elementType: "STRATEGY",
		name: "S1",
		parentId: goal.id,
	});
	return {
		editor,
		homeCaseId: home.id,
		host,
		strategyId: strategy.id,
		stranger,
	};
}

// ---------------------------------------------------------------------------
// Targets: the cases a reference can name
// ---------------------------------------------------------------------------

interface Target {
	label: string;
	/** Makes the case (or the id that stands for one) and returns its id. */
	make: (world: World) => Promise<string>;
	/** Whether a row can hold this id as a stored reference (the case must exist). */
	stored: boolean;
	/** Whether the editor can view the case, so may point at it. */
	viewable: boolean;
}

const trash = (caseId: string) =>
	prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});

const sharedAt = (
	permission: "VIEW" | "COMMENT" | "EDIT" | "ADMIN"
): Target => ({
	label: `a case shared with the editor at ${permission}`,
	viewable: true,
	stored: true,
	make: async (world) => {
		const made = await createStoredCase(world.stranger.id);
		await createTestPermission(
			made.id,
			world.editor.id,
			world.stranger.id,
			permission
		);
		return made.id;
	},
});

const viaTeam = (
	role: "MEMBER" | "ADMIN",
	permission: "VIEW" | "COMMENT" | "EDIT" | "ADMIN"
): Target => ({
	label: `a case shared at ${permission} with a team the editor is a ${role} of`,
	viewable: true,
	stored: true,
	make: async (world) => {
		const lead = await createTestUser();
		const team = await createTestTeam(lead.id);
		await addTeamMember(team.id, world.editor.id, role);
		const made = await createStoredCase(world.stranger.id);
		await createTestTeamPermission(
			made.id,
			team.id,
			world.stranger.id,
			permission
		);
		return made.id;
	},
});

/** A case shared with a team, the editor in it, then taken out of it. */
async function teamCaseEditorLeft(world: World) {
	const lead = await createTestUser();
	const team = await createTestTeam(lead.id);
	await addTeamMember(team.id, world.editor.id, "MEMBER");
	const made = await createStoredCase(world.stranger.id);
	await createTestTeamPermission(made.id, team.id, world.stranger.id, "ADMIN");
	await prisma.teamMember.deleteMany({
		where: { teamId: team.id, userId: world.editor.id },
	});
	return made.id;
}

const TARGETS: Target[] = [
	// ---- the editor can view these --------------------------------------
	{
		label: "a case the editor owns",
		viewable: true,
		stored: true,
		make: async (world) => (await createStoredCase(world.editor.id)).id,
	},
	{
		label: "the case the element is in",
		viewable: true,
		stored: true,
		make: (world) => Promise.resolve(world.homeCaseId),
	},
	sharedAt("VIEW"),
	sharedAt("COMMENT"),
	sharedAt("EDIT"),
	sharedAt("ADMIN"),
	viaTeam("MEMBER", "VIEW"),
	viaTeam("ADMIN", "VIEW"),
	viaTeam("MEMBER", "COMMENT"),
	viaTeam("MEMBER", "EDIT"),
	viaTeam("MEMBER", "ADMIN"),
	{
		label: "a case shared with a team the editor created",
		viewable: true,
		stored: true,
		make: async (world) => {
			const team = await createTestTeam(world.editor.id);
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"VIEW"
			);
			return made.id;
		},
	},
	{
		label: "a case whose direct share was revoked but whose team share remains",
		viewable: true,
		stored: true,
		make: async (world) => {
			const lead = await createTestUser();
			const team = await createTestTeam(lead.id);
			await addTeamMember(team.id, world.editor.id, "MEMBER");
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"VIEW"
			);
			await createTestPermission(
				made.id,
				world.editor.id,
				world.stranger.id,
				"VIEW"
			);
			await prisma.casePermission.deleteMany({
				where: { caseId: made.id, userId: world.editor.id },
			});
			return made.id;
		},
	},
	{
		label: "a case whose team share was revoked but whose direct share remains",
		viewable: true,
		stored: true,
		make: async (world) => {
			const lead = await createTestUser();
			const team = await createTestTeam(lead.id);
			await addTeamMember(team.id, world.editor.id, "MEMBER");
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"VIEW"
			);
			await createTestPermission(
				made.id,
				world.editor.id,
				world.stranger.id,
				"VIEW"
			);
			await prisma.caseTeamPermission.deleteMany({
				where: { caseId: made.id, teamId: team.id },
			});
			return made.id;
		},
	},
	// ---- the editor can not view these ----------------------------------
	{
		label: "a case nobody shared with the editor",
		viewable: false,
		stored: true,
		make: async (world) => (await createStoredCase(world.stranger.id)).id,
	},
	{
		label: "a published case nobody shared with the editor",
		viewable: false,
		stored: true,
		make: async (world) =>
			(
				await createTestCase(world.stranger.id, {
					published: true,
					publishStatus: "PUBLISHED",
				})
			).id,
	},
	{
		label: "a case whose direct share with the editor was revoked",
		viewable: false,
		stored: true,
		make: async (world) => {
			const made = await createStoredCase(world.stranger.id);
			await createTestPermission(
				made.id,
				world.editor.id,
				world.stranger.id,
				"EDIT"
			);
			await prisma.casePermission.deleteMany({
				where: { caseId: made.id, userId: world.editor.id },
			});
			return made.id;
		},
	},
	{
		label: "a team's case after the editor was removed from the team",
		viewable: false,
		stored: true,
		make: teamCaseEditorLeft,
	},
	{
		label: "a case whose share with the editor's team was revoked",
		viewable: false,
		stored: true,
		make: async (world) => {
			const lead = await createTestUser();
			const team = await createTestTeam(lead.id);
			await addTeamMember(team.id, world.editor.id, "ADMIN");
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"ADMIN"
			);
			await prisma.caseTeamPermission.deleteMany({
				where: { caseId: made.id, teamId: team.id },
			});
			return made.id;
		},
	},
	{
		label: "a case shared only with a team the editor is not in",
		viewable: false,
		stored: true,
		make: async (world) => {
			const team = await createTestTeam(world.stranger.id);
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"ADMIN"
			);
			return made.id;
		},
	},
	{
		label: "a case the editor owns that is in the trash",
		viewable: false,
		stored: true,
		make: async (world) => {
			const made = await createStoredCase(world.editor.id);
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "a case shared with the editor at ADMIN that is in the trash",
		viewable: false,
		stored: true,
		make: async (world) => {
			const made = await createStoredCase(world.stranger.id);
			await createTestPermission(
				made.id,
				world.editor.id,
				world.stranger.id,
				"ADMIN"
			);
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "a team's case, the editor in the team, that is in the trash",
		viewable: false,
		stored: true,
		make: async (world) => {
			const team = await createTestTeam(world.editor.id);
			const made = await createStoredCase(world.stranger.id);
			await createTestTeamPermission(
				made.id,
				team.id,
				world.stranger.id,
				"ADMIN"
			);
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "another user's case that is in the trash",
		viewable: false,
		stored: true,
		make: async (world) => {
			const made = await createStoredCase(world.stranger.id);
			await trash(made.id);
			return made.id;
		},
	},
	{
		label: "a case that was purged",
		viewable: false,
		stored: false,
		make: async (world) => {
			const made = await createStoredCase(world.editor.id);
			await prisma.assuranceCase.delete({ where: { id: made.id } });
			return made.id;
		},
	},
	{
		label: "an id no case ever had",
		viewable: false,
		stored: false,
		make: () => Promise.resolve(randomUUID()),
	},
	{
		label: "the all-zero id",
		viewable: false,
		stored: false,
		make: () => Promise.resolve("00000000-0000-0000-0000-000000000000"),
	},
];

export const VIEWABLE_TARGETS = TARGETS.filter((target) => target.viewable);
export const UNVIEWABLE_TARGETS = TARGETS.filter((target) => !target.viewable);
/** The cases the editor can not view that a row can still hold a reference to. */
export const LOST_TARGETS = UNVIEWABLE_TARGETS.filter(
	(target) => target.stored
);

/** Strings that are not case ids, in the forms a forced request can carry. */
export const MALFORMED_IDS: string[] = [
	"not-a-uuid",
	"",
	"12345678-1234-1234-1234-12345678901",
	"12345678-1234-1234-1234-1234567890123",
	"{12345678-1234-1234-1234-123456789012}",
	"'; DROP TABLE assurance_cases; --",
	"../../etc/passwd",
];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** An element of the home case that names `reference`, written straight to the database. */
export function storeReference(
	world: World,
	kind: RefKind,
	reference: string | null,
	options: { citedElementId?: string; name?: string } = {}
) {
	return createTestElement(world.homeCaseId, world.host.id, {
		elementType: kind,
		name: options.name ?? `${NAME_PREFIX[kind]}1`,
		parentId: world.strategyId,
		...(reference ? { moduleReferenceId: reference } : {}),
		...(kind === "MODULE" ? { moduleEmbedType: "COPY" as const } : {}),
		...(options.citedElementId
			? { citedElementId: options.citedElementId }
			: {}),
	});
}

/** An element in `caseId`, which an away goal can cite. */
export function elementIn(caseId: string, ownerId: string) {
	return createTestElement(caseId, ownerId, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
}

/** A case the editor owns, holding one element: somewhere a citation is allowed. */
export async function viewableCaseWithElement(world: World) {
	const made = await createStoredCase(world.editor.id);
	const element = await elementIn(made.id, world.editor.id);
	return { caseId: made.id, elementId: element.id };
}

/** A case the editor can not view, holding one element. */
export async function hiddenCaseWithElement(world: World) {
	const made = await createStoredCase(world.stranger.id);
	const element = await elementIn(made.id, world.stranger.id);
	return { caseId: made.id, elementId: element.id };
}

/** The stored reference fields of one element. */
export function referencesOfElement(elementId: string) {
	return prisma.assuranceElement.findUniqueOrThrow({
		where: { id: elementId },
		select: {
			moduleReferenceId: true,
			moduleReferenceDangling: true,
			citedElementId: true,
			citationDangling: true,
			description: true,
		},
	});
}

/**
 * Everything the home case holds, and its last-changed time. Equal snapshots
 * before and after a refused request show nothing was written.
 */
export async function snapshot(caseId: string) {
	const [elements, theCase] = await Promise.all([
		prisma.assuranceElement.findMany({
			where: { caseId },
			orderBy: { id: "asc" },
		}),
		prisma.assuranceCase.findUniqueOrThrow({
			where: { id: caseId },
			select: { updatedAt: true },
		}),
	]);
	return { elements, caseUpdatedAt: theCase.updatedAt };
}

/** How many elements anywhere name `caseId` as the case they reference. */
export function countNaming(caseId: string) {
	return prisma.assuranceElement.count({
		where: { moduleReferenceId: caseId },
	});
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface Answer {
	body: unknown;
	status: number;
}

async function asAnswer(response: Response): Promise<Answer> {
	return { status: response.status, body: await response.json() };
}

function jsonRequest(url: string, method: string, body: unknown) {
	return new NextRequest(url, {
		method,
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

function signIn(user: User) {
	return mockAuth(user.id, user.username, user.email ?? undefined);
}

/** POST /api/cases/[id]/elements */
export async function postElement(
	actor: User,
	caseId: string,
	body: unknown
): Promise<Answer> {
	await signIn(actor);
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return asAnswer(
		await POST(
			jsonRequest(
				`http://localhost:3000/api/cases/${caseId}/elements`,
				"POST",
				body
			),
			{ params: Promise.resolve({ id: caseId }) }
		)
	);
}

/** PUT /api/elements/[id] */
export async function putElement(
	actor: User,
	elementId: string,
	body: unknown
): Promise<Answer> {
	await signIn(actor);
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return asAnswer(
		await PUT(
			jsonRequest(
				`http://localhost:3000/api/elements/${elementId}`,
				"PUT",
				body
			),
			{ params: Promise.resolve({ id: elementId }) }
		)
	);
}

/** POST /api/cases/[id]/batch */
export async function postBatch(
	actor: User,
	caseId: string,
	changes: unknown[]
): Promise<Answer> {
	await signIn(actor);
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return asAnswer(
		await POST(
			jsonRequest(`http://localhost:3000/api/cases/${caseId}/batch`, "POST", {
				changes,
			}),
			{ params: Promise.resolve({ id: caseId }) }
		)
	);
}

/** The body of POST /api/cases/[id]/elements for an away goal or a module. */
export function createBody(
	kind: RefKind,
	reference: unknown,
	extra: Record<string, unknown> = {}
) {
	return {
		type: kind === "AWAY_GOAL" ? "away_goal" : "module",
		description: `A ${kind} made through the route`,
		moduleReferenceId: reference,
		...(kind === "MODULE" ? { moduleEmbedType: "COPY" } : {}),
		...extra,
	};
}

/** A batch change that creates an away goal or a module (or any `type`) under the home strategy. */
export function batchCreate(
	world: World,
	type: string,
	reference: unknown,
	options: { id?: string; name?: string; parentId?: string } = {}
) {
	const id = options.id ?? randomUUID();
	const upper = type.toUpperCase();
	const isModule = upper.startsWith("MODULE");
	const isAwayGoal = upper.startsWith("AWAY");
	let name: string | null = null;
	if (isModule) {
		name = "M9";
	} else if (isAwayGoal) {
		name = "AG9";
	}
	return {
		type: "create",
		elementId: id,
		parentId: options.parentId ?? world.strategyId,
		data: {
			id,
			type,
			name: options.name ?? name,
			description: `A ${type} made through the batch`,
			inSandbox: false,
			moduleReferenceId: reference,
			...(isModule ? { moduleEmbedType: "COPY" } : {}),
		},
	};
}

/** A batch change that updates one element. */
export function batchUpdate(elementId: string, data: Record<string, unknown>) {
	return { type: "update", elementId, data };
}

/** The answers with repeats (same status, same full body) taken out, so one entry means they all matched. */
export function distinctAnswers(answers: Answer[]): Answer[] {
	const seen = new Map<string, Answer>();
	for (const answer of answers) {
		seen.set(JSON.stringify(answer), answer);
	}
	return [...seen.values()];
}

/** The error text of an answer, for checks that the text does not name an id. */
export function errorText(answer: Answer): string {
	const body = answer.body as { error?: unknown };
	return typeof body.error === "string" ? body.error : JSON.stringify(body);
}
