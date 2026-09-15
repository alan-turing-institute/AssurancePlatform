import { describe, expect, it } from "vitest";
import { AssertionStatus, ElementType } from "@/src/generated/prisma";
import { AssertionStatusSchema, ElementTypeSchema } from "../case-export";

/**
 * ADR 0004 D1: "the Prisma schema's ElementType enum and the Zod vocabulary
 * are bound by a build-time consistency check ... since Prisma enums cannot
 * be generated from Zod." This is that check, for both enums the ADR calls
 * out by name. Fails on drift in either direction — a value added to one
 * side and not the other, however it happened.
 */
describe("Prisma <-> Zod enum vocabularies (ADR 0004 D1)", () => {
	it("ElementType: Prisma enum and ElementTypeSchema agree exactly", () => {
		const prismaValues = new Set(Object.values(ElementType));
		const zodValues = new Set(ElementTypeSchema.options);

		expect(zodValues).toEqual(prismaValues);
	});

	it("AssertionStatus: Prisma enum and AssertionStatusSchema agree exactly", () => {
		const prismaValues = new Set(Object.values(AssertionStatus));
		const zodValues = new Set(AssertionStatusSchema.options);

		expect(zodValues).toEqual(prismaValues);
	});
});
