import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import type { CaseExportNested, CaseKind } from "@/lib/schemas/case-export";
import type { ContextEntry } from "@/lib/schemas/context-entry";
import { exportCase } from "@/lib/services/case-export-service";
import {
	openWorld,
	putElement as putElementRoute,
	seedElement,
	type World,
} from "./placeholder-kit";
import { createTestCaseInformation } from "./prisma-factories";

/**
 * Fixtures for the variable tests: a case or pattern whose goal defines one
 * variable, with a strategy, a claim and a piece of evidence beneath it, and
 * the routes that write and read the flag.
 */

export const SYS = "k3f9x2m7qa";
export const OTHER = "p4n8c2d6xz";
export const MORE = "q1w2e3r4t5";

export type Entry = Extract<ContextEntry, object>;

export const ref = (name: string, id: string): string => `{${name}#${id}}`;

export function variableEntry(
	value?: string,
	name = "system",
	id = SYS,
	text = "the system under test"
): Entry {
	return value === undefined
		? { id, name, text, variable: true }
		: { id, name, text, value, variable: true };
}

export function ordinaryEntry(
	value?: string,
	name = "window",
	id = OTHER,
	text = "the moving interval"
): Entry {
	return value === undefined ? { id, name, text } : { id, name, text, value };
}

/** Writes an element's context straight to the database. */
export async function setContext(
	elementId: string,
	context: unknown[]
): Promise<void> {
	await prisma.assuranceElement.update({
		where: { id: elementId },
		data: { context: context as never },
	});
}

/** The stored context of an element. */
export async function storedContext(elementId: string): Promise<unknown> {
	const row = await prisma.assuranceElement.findUniqueOrThrow({
		where: { id: elementId },
		select: { context: true },
	});
	return row.context;
}

export async function setText(
	elementId: string,
	fields: {
		assumption?: string;
		description?: string;
		justification?: string;
	}
): Promise<void> {
	await prisma.assuranceElement.update({
		where: { id: elementId },
		data: fields,
	});
}

export interface VariableWorld extends World {
	claimId: string;
	evidenceId: string;
	strategyId: string;
}

/**
 * A case or pattern with complete case information, so only its argument can
 * hold publishing back. G1 defines the variable `system` (no value unless
 * given) and nothing mentions it yet; S1 sits under G1, P1 under S1 and E1
 * is linked to P1.
 */
export async function variableWorld(
	kind: CaseKind = "CASE",
	value?: string
): Promise<VariableWorld> {
	const world = await openWorld(kind);
	await createTestCaseInformation(world.caseId);
	await setContext(world.goalId, [variableEntry(value)]);
	const strategy = await seedElement({
		caseId: world.caseId,
		createdById: world.ownerId,
		elementType: "STRATEGY",
		name: "S1",
		parentId: world.goalId,
		description: "Argue over the hazards",
	});
	const claim = await seedElement({
		caseId: world.caseId,
		createdById: world.ownerId,
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: strategy.id,
		description: "Operators are trained",
	});
	const evidence = await seedElement({
		caseId: world.caseId,
		createdById: world.ownerId,
		elementType: "EVIDENCE",
		name: "E1",
		description: "Training records",
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: evidence.id, claimId: claim.id },
	});
	return {
		...world,
		claimId: claim.id,
		evidenceId: evidence.id,
		strategyId: strategy.id,
	};
}

export async function publishCase(caseId: string): Promise<Response> {
	const { POST } = await import("@/app/api/cases/[id]/publish/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

export async function setStatus(
	caseId: string,
	targetStatus: "DRAFT" | "PUBLISHED"
): Promise<Response> {
	const { PATCH } = await import("@/app/api/cases/[id]/status/route");
	return await PATCH(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/status`, {
			method: "PATCH",
			body: JSON.stringify({ targetStatus }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** Both routes that can move a case to PUBLISHED. */
export const PUBLISH_ROUTES: readonly [
	string,
	(caseId: string) => Promise<Response>,
][] = [
	["the publish route", publishCase],
	["the status route", (caseId) => setStatus(caseId, "PUBLISHED")],
];

export function snapshotCount(caseId: string): Promise<number> {
	return prisma.publishedAssuranceCase.count({
		where: { assuranceCaseId: caseId },
	});
}

export async function publishStatusOf(caseId: string): Promise<string> {
	return (
		await prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseId } })
	).publishStatus;
}

/** The export of a case, as the owner sees it. */
export async function exported(
	userId: string,
	caseId: string
): Promise<CaseExportNested> {
	const result = await exportCase(userId, caseId, { includeComments: false });
	if (!("data" in result)) {
		throw new Error(result.error);
	}
	return result.data;
}

/** The export file the export route sends, parsed. */
export async function exportFile(caseId: string): Promise<CaseExportNested> {
	const { GET } = await import("@/app/api/cases/export/route");
	const response = await GET(
		new NextRequest(
			`http://localhost:3000/api/cases/export?id=${caseId}&includeComments=false`
		)
	);
	if (response.status !== 200) {
		throw new Error(`export failed with ${response.status}`);
	}
	return JSON.parse(await response.text());
}

/** POST /api/cases/import with a parsed document. */
export async function importFile(file: unknown): Promise<Response> {
	const { POST } = await import("@/app/api/cases/import/route");
	return await POST(
		new NextRequest("http://localhost:3000/api/cases/import", {
			method: "POST",
			body: JSON.stringify(file),
			headers: { "Content-Type": "application/json" },
		})
	);
}

/** POST /api/cases/[id]/elements. */
export async function postElementWithContext(
	caseId: string,
	context: unknown,
	type = "goal"
): Promise<Response> {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return await POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
			method: "POST",
			body: JSON.stringify({ type, description: "A new element", context }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** PUT /api/elements/[id] with a context. */
export function putContext(
	elementId: string,
	context: unknown
): Promise<Response> {
	return putElementRoute(elementId, { context });
}

/** GET /api/elements/[id]. */
export async function getElement(elementId: string): Promise<Response> {
	const { GET } = await import("@/app/api/elements/[id]/route");
	return await GET(
		new NextRequest(`http://localhost:3000/api/elements/${elementId}`),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

/** One element of the batch route's update. */
export function batchContext(elementId: string, context: unknown) {
	return { type: "update", elementId, data: { context } };
}
