/**
 * Representative data for the page checker, on top of the development seed.
 *
 * Creates one small case owned by chris, publishes it, then moves it to the
 * trash keeping its published copy. The trash page then has a row and the
 * Discover page has an archived card, so the checker measures those pages in
 * the state a real instance reaches. Only the verify-in-browser server runs
 * this; the development seed itself is unchanged.
 *
 * Run: DATABASE_URL=<url> npx tsx prisma/seed/page-check-state.ts
 */

import { prisma } from "../../lib/prisma";
import { sectors } from "../../lib/sectors";
import { softDeleteCase } from "../../lib/services/case-trash-service";
import { publishAssuranceCase } from "../../lib/services/publish-service";

async function findSeedUserId(): Promise<string> {
	const chris = await prisma.user.findUnique({
		where: { username: "chris" },
		select: { id: true },
	});
	if (!chris) {
		throw new Error(
			"Seed user chris not found; run the development seed first"
		);
	}
	return chris.id;
}

async function createFixtureCase(userId: string): Promise<string> {
	const created = await prisma.assuranceCase.create({
		data: {
			name: "Archived Discover Case",
			description: "A small case that is published and then trashed",
			createdById: userId,
			mode: "STANDARD",
			publishStatus: "DRAFT",
		},
	});
	await prisma.assuranceElement.create({
		data: {
			caseId: created.id,
			elementType: "GOAL",
			role: "TOP_LEVEL",
			name: "G1",
			description: "The system is safe to use",
			createdById: userId,
		},
	});
	await prisma.caseInformation.create({
		data: {
			caseId: created.id,
			description: "A small case that is published and then trashed",
			authors: "Seed author",
			sector: String(
				sectors.find((sector) => sector.Name === "Health & Social Care")?.ID
			),
		},
	});
	return created.id;
}

async function publishThenTrash(userId: string, caseId: string): Promise<void> {
	const published = await publishAssuranceCase(userId, caseId);
	if ("error" in published) {
		throw new Error(`Failed to publish the fixture case: ${published.error}`);
	}
	const trashed = await softDeleteCase(userId, caseId, {
		publishedCopy: "archive",
	});
	if ("error" in trashed) {
		throw new Error(`Failed to trash the fixture case: ${trashed.error}`);
	}
}

async function main() {
	const userId = await findSeedUserId();
	const caseId = await createFixtureCase(userId);
	await publishThenTrash(userId, caseId);
	console.log(
		"Page-check state: one trashed case with an archived published copy."
	);
}

main()
	.catch((e) => {
		console.error("Page-check state failed:", e);
		process.exitCode = 1;
	})
	.finally(async () => {
		try {
			await prisma.$disconnect();
		} finally {
			process.exit(process.exitCode ?? 0);
		}
	});
