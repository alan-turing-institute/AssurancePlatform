import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import type { ElementChange } from "@/lib/services/json-diff-service";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// SSE connection manager is an in-process side-effect with no external I/O;
// mock it so tests never block on real SSE setup.
vi.mock("@/lib/services/sse-connection-manager", () => ({
	getSSEConnectionManager: vi.fn().mockReturnValue({
		broadcast: vi.fn(),
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	}),
}));

// ============================================
// applyBatchUpdate
// ============================================

describe("applyBatchUpdate", () => {
	it("creates elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const newId = `element-create-${Date.now()}`;
		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: newId,
				parentId: null,
				data: {
					id: newId,
					type: "GOAL",
					name: "New Goal",
					description: "A goal created via batch",
					inSandbox: false,
					role: "TOP_LEVEL",
				},
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.summary.created).toBe(1);
		expect(result.data.summary.updated).toBe(0);
		expect(result.data.summary.deleted).toBe(0);

		const created = await prisma.assuranceElement.findUnique({
			where: { id: newId },
		});
		expect(created).not.toBeNull();
		expect(created?.name).toBe("New Goal");
	});

	it("updates elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Original Name",
			description: "Original description",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "update",
				elementId: element.id,
				data: { name: "Updated Name" },
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.summary.updated).toBe(1);

		const updated = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(updated?.name).toBe("Updated Name");
	});

	it("deletes elements via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "To Be Deleted",
			description: "Will be removed",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "delete",
				elementId: element.id,
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.summary.deleted).toBe(1);

		const found = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(found).toBeNull();
	});

	it("handles a mixed batch of create, update, and delete in a single call", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Existing element to update
		const toUpdate = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Update Me",
			description: "Will be updated",
		});

		// Existing element to delete
		const toDelete = await createTestElement(testCase.id, user.id, {
			elementType: "STRATEGY",
			name: "Delete Me",
			description: "Will be removed",
			parentId: toUpdate.id,
		});

		const newId = `element-mixed-${Date.now()}`;

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "create",
				elementId: newId,
				parentId: null,
				data: {
					id: newId,
					type: "GOAL",
					name: "Brand New Goal",
					description: "Created in mixed batch",
					inSandbox: false,
					role: "TOP_LEVEL",
				},
			},
			{
				type: "update",
				elementId: toUpdate.id,
				data: { name: "Now Updated" },
			},
			{
				type: "delete",
				elementId: toDelete.id,
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.summary.created).toBe(1);
		expect(result.data.summary.updated).toBe(1);
		expect(result.data.summary.deleted).toBe(1);

		// Verify DB state
		const created = await prisma.assuranceElement.findUnique({
			where: { id: newId },
		});
		expect(created?.name).toBe("Brand New Goal");

		const updated = await prisma.assuranceElement.findUnique({
			where: { id: toUpdate.id },
		});
		expect(updated?.name).toBe("Now Updated");

		const deleted = await prisma.assuranceElement.findUnique({
			where: { id: toDelete.id },
		});
		expect(deleted).toBeNull();
	});

	it("returns a permission denied error when user has no EDIT access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const result = await applyBatchUpdate(stranger.id, testCase.id, []);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Permission denied");
	});

	it("returns a permission denied error for a user with only VIEW access", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const result = await applyBatchUpdate(viewer.id, testCase.id, []);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Permission denied");
	});

	it("returns a permission denied error for a non-existent case", async () => {
		const user = await createTestUser();

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const result = await applyBatchUpdate(
			user.id,
			"non-existent-case-id",
			[]
		);

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		// Same error as no-permission — prevents enumeration
		expect(result.error).toBe("Permission denied");
	});

	it("detects a conflict when expectedVersion does not match", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		// Use a stale timestamp that will not match the actual updatedAt
		const staleVersion = new Date(0).toISOString();
		const result = await applyBatchUpdate(user.id, testCase.id, [], {
			expectedVersion: staleVersion,
		});

		expect("error" in result).toBe(true);
		if (!("error" in result)) return;
		expect(result.error).toBe("Case has been modified by another user");
		expect(result.conflictDetected).toBe(true);
	});

	it("succeeds when expectedVersion matches the actual case version", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Fetch the real updatedAt to use as expected version
		const fresh = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { updatedAt: true },
		});
		const expectedVersion = fresh!.updatedAt.toISOString();

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const result = await applyBatchUpdate(user.id, testCase.id, [], {
			expectedVersion,
		});

		expect("data" in result).toBe(true);
	});

	it("succeeds with an empty changes array (no-op)", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const result = await applyBatchUpdate(user.id, testCase.id, []);

		expect("data" in result).toBe(true);
		if (!("data" in result)) return;
		expect(result.data.summary.created).toBe(0);
		expect(result.data.summary.updated).toBe(0);
		expect(result.data.summary.deleted).toBe(0);
	});

	it("links evidence to a claim via a batch update", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Create a property claim to link evidence to
		const claim = await createTestElement(testCase.id, user.id, {
			elementType: "PROPERTY_CLAIM",
			name: "A Claim",
			description: "Something to link evidence to",
		});

		// Create an evidence element (no parent — uses evidence_links)
		const evidence = await createTestElement(testCase.id, user.id, {
			elementType: "EVIDENCE",
			name: "Some Evidence",
			description: "Supporting evidence",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			{
				type: "link_evidence",
				evidenceId: evidence.id,
				claimId: claim.id,
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		expect("data" in result).toBe(true);

		const link = await prisma.evidenceLink.findFirst({
			where: { evidenceId: evidence.id, claimId: claim.id },
		});
		expect(link).not.toBeNull();
	});

	it("is atomic — if one operation fails, all are rolled back", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id);

		// Create an element to update (this operation will succeed)
		const element = await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "Should Remain Unchanged",
			description: "This update should be rolled back",
		});

		const { applyBatchUpdate } = await import(
			"@/lib/services/case-batch-update-service"
		);

		const changes: ElementChange[] = [
			// Valid update
			{
				type: "update",
				elementId: element.id,
				data: { name: "Changed Name" },
			},
			// Delete a non-existent element — this will throw inside the transaction
			{
				type: "delete",
				elementId: "does-not-exist-at-all",
			},
		];

		const result = await applyBatchUpdate(user.id, testCase.id, changes);

		// The batch should fail
		expect("error" in result).toBe(true);

		// The update should have been rolled back
		const unchanged = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(unchanged?.name).toBe("Should Remain Unchanged");
	});
});
