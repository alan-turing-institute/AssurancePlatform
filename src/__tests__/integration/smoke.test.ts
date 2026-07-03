import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { INTEGRATION_TEST_WORKER_DATABASE_PATTERN } from "../scripts/test-db-config";
import { createTestUser } from "../utils/prisma-factories";

describe("Integration test infrastructure", () => {
	it("connects to its own worker-scoped test database", async () => {
		const result = await prisma.$queryRaw<
			Array<{ current_database: string }>
		>`SELECT current_database()`;
		expect(result).toHaveLength(1);
		expect(result[0]?.current_database).toMatch(
			INTEGRATION_TEST_WORKER_DATABASE_PATTERN
		);
	});

	it("creates and retrieves a user via factory", async () => {
		const user = await createTestUser();
		expect(user.id).toBeDefined();
		expect(user.email).toContain("@example.com");

		const found = await prisma.user.findUnique({ where: { id: user.id } });
		expect(found).not.toBeNull();
		expect(found?.email).toBe(user.email);
	});

	it("truncates tables after each test (previous user should be gone)", async () => {
		const count = await prisma.user.count();
		expect(count).toBe(0);
	});
});
