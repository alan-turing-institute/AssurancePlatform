import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { deleteAccount } from "@/lib/services/user-management-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Regression test for feasibility review R2 (ADR 0002 v2 §2.4):
 * `getOrCreateSystemUser` used to select the fallback account via bare
 * `findFirst({ isSystemUser: true })`, which — once integration system
 * users exist alongside the generic fallback — could resolve to WHICHEVER
 * system user Postgres returned first. That would hand a deleted user's
 * case ownership (createdById, i.e. implicit ADMIN) to an integration's
 * machine principal instead of the intended generic fallback account: a
 * privilege escalation. The fix selects by the stable
 * `system@tea-platform.internal` email identifier instead.
 */
const SYSTEM_USER_EMAIL = "system@tea-platform.internal";

describe("getOrCreateSystemUser (via deleteAccount) — R2 regression", () => {
	it("reassigns a deleted user's case to the generic fallback account, not an unrelated system user created first", async () => {
		// Simulates an integration's machine principal: isSystemUser: true,
		// but NOT the generic fallback — and it exists in the DB before the
		// generic fallback account is ever created.
		const decoySystemUser = await createTestUser({
			email: "integration+decoy@tea-platform.internal",
			username: "integration-decoy",
		});
		await prisma.user.update({
			where: { id: decoySystemUser.id },
			data: { isSystemUser: true },
		});

		// OAuth user — deleteAccount skips password verification for non-LOCAL auth.
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const ownedCase = await createTestCase(owner.id, { name: "Owner's case" });

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: ownedCase.id },
		});

		// Must NOT have been reassigned to the decoy system user.
		expect(updatedCase.createdById).not.toBe(decoySystemUser.id);

		const fallbackUser = await prisma.user.findUnique({
			where: { email: SYSTEM_USER_EMAIL },
		});
		expect(fallbackUser).not.toBeNull();
		expect(fallbackUser?.isSystemUser).toBe(true);
		expect(updatedCase.createdById).toBe(fallbackUser?.id);
	});

	it("reuses the same fallback account across multiple deletions rather than creating duplicates", async () => {
		const ownerA = await createTestUser({ authProvider: "GITHUB" });
		const ownerB = await createTestUser({ authProvider: "GITHUB" });
		const caseA = await createTestCase(ownerA.id, { name: "Case A" });
		const caseB = await createTestCase(ownerB.id, { name: "Case B" });

		expectSuccess(await deleteAccount(ownerA.id));
		expectSuccess(await deleteAccount(ownerB.id));

		const fallbackUsers = await prisma.user.findMany({
			where: { email: SYSTEM_USER_EMAIL },
		});
		expect(fallbackUsers).toHaveLength(1);

		const [updatedCaseA, updatedCaseB] = await Promise.all([
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseA.id } }),
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseB.id } }),
		]);
		expect(updatedCaseA.createdById).toBe(fallbackUsers[0]?.id);
		expect(updatedCaseB.createdById).toBe(fallbackUsers[0]?.id);
	});
});
