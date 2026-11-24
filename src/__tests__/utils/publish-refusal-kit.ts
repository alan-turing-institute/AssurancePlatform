import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { mockAuth } from "./auth-helpers";
import { newScene } from "./publish-race-kit";
import { openCase } from "./publish-type-kit";

/**
 * Callers and observers for the tests that check what the publish, unpublish
 * and status routes answer when a case is in a state they refuse, and what is
 * left in the database afterwards.
 */

/** The answer a route sent: its status and parsed body. */
export interface Answer {
	body: Record<string, unknown>;
	status: number;
}

export async function answerOf(response: Response): Promise<Answer> {
	return {
		status: response.status,
		body: (await response.json()) as Record<string, unknown>,
	};
}

export async function signInAs(userId: string): Promise<void> {
	const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
	await mockAuth(user.id, user.username, user.email);
}

export async function unpublishRoute(caseId: string): Promise<Response> {
	const { DELETE } = await import("@/app/api/cases/[id]/publish/route");
	return await DELETE(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "DELETE",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

/** Gives a case every required case-information field, keeping any feature image it has. */
async function fillInformation(caseId: string): Promise<void> {
	const fields = {
		description: "A description",
		authors: "Ada Lovelace",
		sector: "Healthcare",
	};
	await prisma.caseInformation.upsert({
		where: { caseId },
		create: { caseId, ...fields },
		update: fields,
	});
}

/** A case with a feature image and every required case-information field. */
export async function completeScene(kind: "CASE" | "PATTERN" = "CASE") {
	const scene = await newScene(kind);
	await fillInformation(scene.caseId);
	return scene;
}

/** A case with a top goal, and (unless declined) every required case-information field. */
export async function completeOpenCase(
	kind: "CASE" | "PATTERN" = "CASE",
	withInformation = true
) {
	const scene = await openCase(kind, { withInformation });
	if (withInformation) {
		await fillInformation(scene.caseId);
	}
	return scene;
}

/** An owner, signed in, with a ready-to-publish case or pattern named `name`. */
export async function signedInCase(
	kind: "CASE" | "PATTERN" = "CASE",
	name?: string
) {
	const scene = await completeOpenCase(kind);
	if (name) {
		await renameCase(scene.caseId, name);
	}
	await signInAs(scene.ownerId);
	return scene;
}

export async function renameCase(caseId: string, name: string): Promise<void> {
	await prisma.assuranceCase.update({ where: { id: caseId }, data: { name } });
}

/** The rows the case has marked current. */
export function currentRows(caseId: string) {
	return prisma.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: caseId, isCurrent: true },
	});
}

/** Everything stored about the case's publishing, to compare before and after a refusal. */
export async function publishingFingerprint(caseId: string) {
	const stored = await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: { published: true, publishedAt: true, publishStatus: true },
	});
	const rows = await prisma.publishedAssuranceCase.findMany({
		where: { assuranceCaseId: caseId },
		orderBy: { createdAt: "asc" },
		select: { id: true, slug: true, isCurrent: true, archivedAt: true },
	});
	return { stored, rows };
}

/** Marks a case published without giving it any published row. */
export async function markPublishedWithoutRow(caseId: string): Promise<void> {
	await prisma.assuranceCase.update({
		where: { id: caseId },
		data: {
			published: true,
			publishedAt: new Date(),
			publishStatus: "PUBLISHED",
		},
	});
}
