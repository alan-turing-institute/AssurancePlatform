/**
 * `pattern_elements.context` (AP-QA-004): the column was never created by
 * the initial migration despite the schema declaring it; added by
 * `prisma/migrations/20260923000000_reconcile_schema_drift`. No application
 * code reads or writes `PatternElement` today, so this goes straight
 * through the Prisma client rather than a service.
 */
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

describe("PatternElement.context", () => {
	it("round-trips a non-empty string array through the Prisma client", async () => {
		const creator = await createTestUser();
		const pattern = await prisma.argumentPattern.create({
			data: {
				name: "Test Pattern",
				description: "A pattern for context round-trip testing",
				version: "1.0",
				createdById: creator.id,
			},
		});

		const element = await prisma.patternElement.create({
			data: {
				patternId: pattern.id,
				elementType: "CONTEXT",
				description: "Element with contextual information",
				context: [
					"operating environment: rail",
					"assumed threat model: benign",
				],
			},
		});

		const inDb = await prisma.patternElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.context).toEqual([
			"operating environment: rail",
			"assumed threat model: benign",
		]);
	});
});
