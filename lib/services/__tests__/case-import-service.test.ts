import { describe, expect, it, vi } from "vitest";
import { isCitedElementIdForeignKeyError } from "@/lib/services/case-import-service";
import { Prisma } from "@/src/generated/prisma";

// case-import-service.ts imports @/lib/prisma at module scope, which throws
// at load without DATABASE_URL (the same module-load dependency
// slug-service.ts had — see "TEA — slug-service unit test fails standalone").
// isCitedElementIdForeignKeyError doesn't touch prisma at all, so mocking it
// at the boundary (issue's own documented fallback, option (b)) is enough to
// let this file load and run with no DATABASE_URL set.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const CITED_ELEMENT_ID_FK_CONSTRAINT =
	"assurance_elements_cited_element_id_fkey";
const MODULE_REFERENCE_ID_FK_CONSTRAINT =
	"assurance_elements_module_reference_id_fkey";

function p2003(constraintName: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError(
		`Foreign key constraint violated on the constraint: \`${constraintName}\``,
		{ code: "P2003", clientVersion: "test" }
	);
}

/**
 * Pins isCitedElementIdForeignKeyError's discrimination directly, rather than
 * via a real insert: case-import.test.ts's "still fails the whole import on
 * a P2003 from an unrelated foreign key" doesn't actually distinguish an
 * anchored guard from a broadened one (its retry path fails again on any
 * non-citedElementId FK regardless of anchoring, so the end-to-end outcome
 * is identical either way — see that test's revised comment).
 */
describe("isCitedElementIdForeignKeyError", () => {
	it("returns true for a P2003 naming the citedElementId constraint", () => {
		expect(
			isCitedElementIdForeignKeyError(p2003(CITED_ELEMENT_ID_FK_CONSTRAINT))
		).toBe(true);
	});

	it("returns false for a P2003 naming a different constraint (moduleReferenceId)", () => {
		expect(
			isCitedElementIdForeignKeyError(p2003(MODULE_REFERENCE_ID_FK_CONSTRAINT))
		).toBe(false);
	});

	it("returns false for a non-P2003 error code", () => {
		const error = new Prisma.PrismaClientKnownRequestError(
			`Foreign key constraint violated on the constraint: \`${CITED_ELEMENT_ID_FK_CONSTRAINT}\``,
			{ code: "P2002", clientVersion: "test" }
		);
		expect(isCitedElementIdForeignKeyError(error)).toBe(false);
	});

	it("returns false for a plain Error", () => {
		expect(
			isCitedElementIdForeignKeyError(
				new Error("Foreign key constraint violated")
			)
		).toBe(false);
	});
});
