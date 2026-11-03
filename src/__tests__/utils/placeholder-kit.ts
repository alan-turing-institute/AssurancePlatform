import { NextRequest } from "next/server";
import { vi } from "vitest";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import prisma from "@/lib/prisma";
import type { CaseKind } from "@/lib/schemas/case-export";
import useStore from "@/store/store";
import { mockAuth } from "./auth-helpers";
import { createTestCase, createTestUser } from "./prisma-factories";

/**
 * Fixtures for the placeholder tests: a case or pattern holding a goal,
 * elements written straight to the database with whatever markers a test
 * needs, and the three ways text reaches an element (the element route, the
 * batch route and the Case Assistant's apply), behind one shape so a test
 * can hold all three to the same answers.
 */

type ElementType = "GOAL" | "STRATEGY" | "PROPERTY_CLAIM" | "EVIDENCE";

export interface SeedElement {
	assumption?: string | null;
	caseId: string;
	createdById: string;
	description?: string;
	elementType: ElementType;
	fromPattern?: boolean;
	inSandbox?: boolean;
	isPlaceholder?: boolean;
	justification?: string | null;
	modifiedFromPattern?: boolean;
	name: string;
	parentId?: string;
	placeholderHint?: string | null;
	role?: "TOP_LEVEL" | "SUPPORTING";
}

/** Writes an element straight to the database, markers included. */
export function seedElement(seed: SeedElement) {
	return prisma.assuranceElement.create({
		data: {
			caseId: seed.caseId,
			createdById: seed.createdById,
			elementType: seed.elementType,
			name: seed.name,
			description: seed.description ?? "",
			parentId: seed.parentId,
			role: seed.role,
			inSandbox: seed.inSandbox ?? false,
			isPlaceholder: seed.isPlaceholder ?? false,
			placeholderHint: seed.placeholderHint,
			fromPattern: seed.fromPattern ?? false,
			modifiedFromPattern: seed.modifiedFromPattern ?? false,
			assumption: seed.assumption,
			justification: seed.justification,
		},
	});
}

export interface World {
	caseId: string;
	goalId: string;
	kind: CaseKind;
	ownerId: string;
	/** Writes a claim under the goal. */
	seedClaim: (
		fields: Partial<SeedElement> & { name: string }
	) => ReturnType<typeof seedElement>;
}

/** A case or pattern with a goal, its owner signed in. */
export async function openWorld(kind: CaseKind): Promise<World> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, { kind });
	const goal = await seedElement({
		caseId: testCase.id,
		createdById: owner.id,
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
		description: "The system is acceptably safe",
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return {
		caseId: testCase.id,
		goalId: goal.id,
		kind,
		ownerId: owner.id,
		seedClaim: (fields) =>
			seedElement({
				caseId: testCase.id,
				createdById: owner.id,
				elementType: "PROPERTY_CLAIM",
				parentId: goal.id,
				...fields,
			}),
	};
}

/** A placeholder claim with no text and a hint, under the world's goal. */
export function seedPlaceholderClaim(
	world: World,
	fields: Partial<SeedElement> = {}
) {
	return world.seedClaim({
		name: "P1",
		isPlaceholder: true,
		placeholderHint: "Say what this claim asserts",
		...fields,
	});
}

/** The stored row of an element. */
export function stored(elementId: string) {
	return prisma.assuranceElement.findUniqueOrThrow({
		where: { id: elementId },
	});
}

/** PUT /api/elements/[id]. */
export async function putElement(elementId: string, body: unknown) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return await PUT(
		new Request(`http://localhost:3000/api/elements/${elementId}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

/** POST /api/cases/[id]/batch. */
export async function postBatch(caseId: string, changes: unknown[]) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify({ changes }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** POST /api/cases/[id]/elements. */
export async function postElement(caseId: string, body: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** The batch route's update of one element. */
export function batchUpdate(elementId: string, data: Record<string, unknown>) {
	return { type: "update", elementId, data };
}

/** The fields the three write paths have in common. */
export interface Written {
	assumption?: string;
	description?: string;
	justification?: string;
}

export interface WritePath {
	label: string;
	/** Writes the fields to the element and says whether the write was accepted. */
	write: (world: World, elementId: string, fields: Written) => Promise<boolean>;
}

/** A path that carries any field of an update, markers included. */
export interface RawPath {
	label: string;
	send: (
		world: World,
		elementId: string,
		data: Record<string, unknown>
	) => Promise<Response>;
}

/** The two routes whose requests can carry the markers themselves. */
export const RAW_PATHS: RawPath[] = [
	{
		label: "the element route",
		send: (_world, elementId, data) => putElement(elementId, data),
	},
	{
		label: "the batch route",
		send: (world, elementId, data) =>
			postBatch(world.caseId, [batchUpdate(elementId, data)]),
	},
];

function viaRawPath(path: RawPath): WritePath {
	return {
		label: path.label,
		write: async (world, elementId, fields) =>
			(await path.send(world, elementId, { ...fields })).status === 200,
	};
}

const ELEMENT_PATH = /^\/api\/elements\/([^/]+)$/;

/** Sends the browser-side calls of the assistant's card to the route handlers. */
export function routeFetchToElementHandlers(): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string, init?: RequestInit) => {
			const id = ELEMENT_PATH.exec(url)?.[1];
			const routes = await import("@/app/api/elements/[id]/route");
			const method = (init?.method ?? "GET") as "GET" | "PUT";
			const handler = method === "PUT" ? routes.PUT : routes.GET;
			if (!id) {
				return new Response("{}", { status: 404 });
			}
			return await handler(
				new NextRequest(`http://localhost:3000${url}`, {
					method,
					headers: init?.headers,
					body: init?.body,
				}),
				{ params: Promise.resolve({ id }) }
			);
		})
	);
}

/** Tells the open canvas which kind of case it shows, as the browser store does. */
function showCaseInStore(world: World): void {
	useStore.setState({
		assuranceCase: {
			id: world.caseId,
			name: "Shown case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
			kind: world.kind,
		},
	});
}

function changesFor(
	before: {
		assumption: string | null;
		description: string;
		justification: string | null;
	},
	fields: Written
) {
	return {
		...(fields.description !== undefined && {
			description: { before: before.description, after: fields.description },
		}),
		...(fields.assumption !== undefined && {
			assumption: {
				before: before.assumption ?? "",
				after: fields.assumption,
			},
		}),
		...(fields.justification !== undefined && {
			justification: {
				before: before.justification ?? "",
				after: fields.justification,
			},
		}),
	};
}

/** The Case Assistant's apply, which also records the edit for Undo. */
export const ASSISTANT_PATH: WritePath = {
	label: "the Case Assistant's apply",
	write: async (world, elementId, fields) => {
		const row = await stored(elementId);
		routeFetchToElementHandlers();
		showCaseInStore(world);
		const result = await applySuggestion(world.caseId, {
			suggested: true,
			kind: "edit",
			elementId,
			elementType: "property_claim",
			label: row.name ?? "",
			changes: changesFor(row, fields),
		});
		return result.status === "applied";
	},
};

/** The three ways text reaches an element. */
export const WRITE_PATHS: WritePath[] = [
	...RAW_PATHS.map(viaRawPath),
	ASSISTANT_PATH,
];

/** The two kinds a test runs over. */
export const KINDS: CaseKind[] = ["CASE", "PATTERN"];
