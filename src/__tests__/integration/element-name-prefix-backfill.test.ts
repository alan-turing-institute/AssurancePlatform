import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Pins the hand-written data migration
 * `prisma/migrations/20260903000000_element_name_prefix_backfill/migration.sql`
 * (TEA — Element Name Prefix Validation, Chris's ruling 2026-09-03: enforce
 * on create/rename AND migrate stored names).
 *
 * The migration file's CREATE TABLE/CREATE INDEX statements already ran once
 * against this worker's database — as part of the normal `prisma migrate
 * deploy` the integration suite's setup applies to every migration in
 * `prisma/migrations/` — so replaying the whole file here would fail with
 * "relation already exists". Only the backfill statement itself (the single
 * `WITH ... UPDATE` starting at `WITH prefixes(`) is re-runnable, and is
 * exactly what "idempotent" means for this migration: sliced out and sent
 * verbatim via `$executeRawUnsafe`, the same text `prisma migrate deploy`
 * applied, not a hand-copied predicate that could drift from it.
 */
const MIGRATION_SQL = readFileSync(
	path.join(
		import.meta.dirname,
		"../../../prisma/migrations/20260903000000_element_name_prefix_backfill/migration.sql"
	),
	"utf8"
);

const BACKFILL_MARKER = "WITH prefixes(";
const backfillMarkerIndex = MIGRATION_SQL.indexOf(BACKFILL_MARKER);
if (backfillMarkerIndex === -1) {
	throw new Error(
		`Could not find backfill statement marker '${BACKFILL_MARKER}' in the migration file — has it been rewritten?`
	);
}
const BACKFILL_SQL = MIGRATION_SQL.slice(backfillMarkerIndex);

async function runBackfill(): Promise<void> {
	await prisma.$executeRawUnsafe(BACKFILL_SQL);
}

/**
 * Raw SQL insert with explicit `createdAt`, so ordering is deterministic
 * rather than relying on wall-clock gaps between factory calls. Raw SQL
 * (not `prisma.assuranceElement.create`) for the same reason
 * `identifier-service.test.ts`'s CONTEXT fixture uses `$executeRaw`: the
 * Prisma client's element-validation extension (`lib/prisma.ts`) runs
 * `validateElementData` on every `.create()` call, which rejects CONTEXT
 * outright (absent from `ELEMENT_TYPES` — see the design note's Decision 1
 * correction) — this fixture needs to create exactly the pre-migration
 * shapes the migration targets, several of which the application-level
 * validation would never let through the normal service path.
 */
async function insertElement(params: {
	caseId: string;
	createdById: string;
	elementType:
		| "GOAL"
		| "CONTEXT"
		| "STRATEGY"
		| "PROPERTY_CLAIM"
		| "EVIDENCE"
		| "JUSTIFICATION"
		| "ASSUMPTION"
		| "MODULE"
		| "AWAY_GOAL"
		| "CONTRACT";
	name: string | null;
	createdAt: Date;
	parentId?: string;
	deletedAt?: Date;
}): Promise<{ id: string }> {
	const id = randomUUID();
	await prisma.$executeRaw`
		INSERT INTO assurance_elements
			(id, case_id, element_type, parent_id, name, description, created_by_id, created_at, updated_at, deleted_at)
		VALUES
			(${id}, ${params.caseId}, ${params.elementType}::"ElementType", ${params.parentId ?? null}, ${params.name}, 'fixture', ${params.createdById}, ${params.createdAt}, ${params.createdAt}, ${params.deletedAt ?? null})
	`;
	return { id };
}

const HOUR = 60 * 60 * 1000;

describe("migration: element_name_prefix_backfill", () => {
	it("renames only non-conforming names, continuing the counter from the highest conforming number, in creation order", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const base = new Date("2026-01-01T00:00:00Z");

		const goal = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "GOAL",
			name: "G1",
			createdAt: base,
		});
		const conformingClaim = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			createdAt: new Date(base.getTime() + HOUR),
			parentId: goal.id,
		});
		const placeholderClaim1 = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "Property claim",
			createdAt: new Date(base.getTime() + 2 * HOUR),
			parentId: goal.id,
		});
		const placeholderClaim2 = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "Property claim",
			createdAt: new Date(base.getTime() + 3 * HOUR),
			parentId: goal.id,
		});
		const placeholderContext = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "CONTEXT",
			name: "Context",
			createdAt: new Date(base.getTime() + 4 * HOUR),
			parentId: goal.id,
		});
		const unnamedEvidence = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "EVIDENCE",
			name: null,
			createdAt: new Date(base.getTime() + 5 * HOUR),
		});
		const deletedPlaceholder = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "Property claim",
			createdAt: new Date(base.getTime() + 6 * HOUR),
			parentId: goal.id,
			deletedAt: new Date(),
		});

		await runBackfill();

		const byId = new Map(
			(
				await prisma.assuranceElement.findMany({
					where: { caseId: testCase.id },
					select: { id: true, name: true },
				})
			).map((e) => [e.id, e.name])
		);

		// Conforming names untouched.
		expect(byId.get(goal.id)).toBe("G1");
		expect(byId.get(conformingClaim.id)).toBe("P1");
		// Non-conforming claims renamed in creation order, continuing from the
		// existing conforming max (P1 -> next is P2, P3).
		expect(byId.get(placeholderClaim1.id)).toBe("P2");
		expect(byId.get(placeholderClaim2.id)).toBe("P3");
		// Context has no prior conforming name in this case, so it starts at 1.
		expect(byId.get(placeholderContext.id)).toBe("C1");
		// Null name left null.
		expect(byId.get(unnamedEvidence.id)).toBeNull();
		// Soft-deleted element left untouched even though its name doesn't conform.
		expect(byId.get(deletedPlaceholder.id)).toBe("Property claim");

		// Every rename logged, old -> new, nothing extra.
		const backfillRows = await prisma.elementNameBackfill.findMany({
			where: {
				elementId: {
					in: [
						placeholderClaim1.id,
						placeholderClaim2.id,
						placeholderContext.id,
					],
				},
			},
		});
		expect(backfillRows).toHaveLength(3);
		const byElementId = new Map(backfillRows.map((r) => [r.elementId, r]));
		expect(byElementId.get(placeholderClaim1.id)).toMatchObject({
			oldName: "Property claim",
			newName: "P2",
		});
		expect(byElementId.get(placeholderClaim2.id)).toMatchObject({
			oldName: "Property claim",
			newName: "P3",
		});
		expect(byElementId.get(placeholderContext.id)).toMatchObject({
			oldName: "Context",
			newName: "C1",
		});
	});

	it("continues the counter from a dotted conforming name's LEADING integer, not its full number", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const base = new Date("2026-01-01T00:00:00Z");

		// The only conforming claim in this case is sub-numbered — leading
		// integer 1, not 2 — so the stray placeholder must continue from 1
		// (-> P2), never from a naive read of the "2" in "P1.2".
		const dottedClaim = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "P1.2",
			createdAt: base,
		});
		const placeholder = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "Property claim",
			createdAt: new Date(base.getTime() + HOUR),
		});

		await runBackfill();

		const afterBackfill = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
			select: { id: true, name: true },
		});
		const byId = new Map(afterBackfill.map((e) => [e.id, e.name]));

		expect(byId.get(dottedClaim.id)).toBe("P1.2");
		expect(byId.get(placeholder.id)).toBe("P2");

		const backfillRow = await prisma.elementNameBackfill.findFirst({
			where: { elementId: placeholder.id },
		});
		expect(backfillRow).toMatchObject({
			oldName: "Property claim",
			newName: "P2",
		});
	});

	it("leaves a non-conforming name untouched inside a trashed case, and logs no backfill row for it", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const base = new Date("2026-01-01T00:00:00Z");

		const placeholder = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "PROPERTY_CLAIM",
			name: "Property claim",
			createdAt: base,
		});

		// Trashing a case (case-trash-service.ts's deleteCase) sets deletedAt
		// only on assurance_cases — it never touches its elements' own
		// deletedAt. Mirrors that exact shape rather than soft-deleting the
		// element itself, which a different (already-covered) branch handles.
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { deletedAt: new Date(), deletedById: user.id },
		});

		await runBackfill();

		const afterBackfill = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: placeholder.id },
			select: { name: true },
		});
		expect(afterBackfill.name).toBe("Property claim");

		const backfillRows = await prisma.elementNameBackfill.count({
			where: { elementId: placeholder.id },
		});
		expect(backfillRows).toBe(0);
	});

	it("is idempotent — re-running renames nothing and logs no further rows", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const base = new Date("2026-01-01T00:00:00Z");

		const placeholder = await insertElement({
			caseId: testCase.id,
			createdById: user.id,
			elementType: "STRATEGY",
			name: "Strategy",
			createdAt: base,
		});

		await runBackfill();
		const afterFirstRun = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: placeholder.id },
			select: { name: true },
		});
		expect(afterFirstRun.name).toBe("S1");
		const rowsAfterFirstRun = await prisma.elementNameBackfill.count({
			where: { elementId: placeholder.id },
		});
		expect(rowsAfterFirstRun).toBe(1);

		await runBackfill();
		const afterSecondRun = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: placeholder.id },
			select: { name: true },
		});
		expect(afterSecondRun.name).toBe("S1");
		const rowsAfterSecondRun = await prisma.elementNameBackfill.count({
			where: { elementId: placeholder.id },
		});
		expect(rowsAfterSecondRun).toBe(1);
	});
});
