import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { reassignIntegrationOwner } from "@/lib/services/integration-registry-service";
import { deleteAccount } from "@/lib/services/user-management-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestUser,
} from "../utils/prisma-factories";

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
const SINGLE_INTEGRATION_BLOCK_PATTERN =
	/reassign or remove your 1 integration/i;
const MULTIPLE_INTEGRATIONS_BLOCK_PATTERN =
	/reassign or remove your 2 integrations/i;

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

/**
 * `deleteAccount` used to hit a raw P2003 from the DB's unconditional
 * `ON DELETE RESTRICT` on `Integration.ownerId` (ADR 0002 v2 §2.4) whenever
 * the deleting user owned any integration — that error was caught by the
 * function's catch-all and flattened into an unhelpful "Failed to delete
 * account". `deleteAccount` now checks `getIntegrationsOwnedBy` FIRST and
 * returns a clean, typed, actionable error instead of ever reaching the
 * transaction.
 */
describe("deleteAccount — owned-integrations block (ADR 0002 v2 §2.4)", () => {
	it("refuses with a clean typed error (not a raw P2003) when the user owns an integration", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await createTestIntegrationWithSystemUser(owner.id);

		const result = await deleteAccount(owner.id);

		expectError(result, SINGLE_INTEGRATION_BLOCK_PATTERN);

		// The user must still exist — the transaction was never attempted.
		const stillThere = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(stillThere).not.toBeNull();
	});

	it("pluralises the count for more than one owned integration", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await createTestIntegrationWithSystemUser(owner.id);
		await createTestIntegrationWithSystemUser(owner.id);

		const result = await deleteAccount(owner.id);

		expectError(result, MULTIPLE_INTEGRATIONS_BLOCK_PATTERN);
	});

	it("succeeds once the owned integration is reassigned away", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const newOwner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);

		expectSuccess(
			await reassignIntegrationOwner(integration.id, newOwner.id, owner.id)
		);

		expectSuccess(await deleteAccount(owner.id));

		const deletedUser = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(deletedUser).toBeNull();
	});

	it("succeeds once the owned integration is deleted outright", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);

		await prisma.integration.delete({ where: { id: integration.id } });

		expectSuccess(await deleteAccount(owner.id));
	});

	it("is unaffected by an integration owned by a DIFFERENT user", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const otherOwner = await createTestUser();
		await createTestIntegrationWithSystemUser(otherOwner.id);

		expectSuccess(await deleteAccount(owner.id));
	});
});
