import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { restoreCase, softDeleteCase } from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	transitionStatus,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	inconsistencies,
	KINDS,
	openCase,
	otherKind,
	publishedRows,
	rowIdentity,
	storedState,
	TYPE_FOR_KIND,
} from "../utils/publish-type-kit";
import { setStatus } from "../utils/variables-kit";

/**
 * The type a published row takes, on every path that writes one: the first
 * publish, Update Published, a republish after the copy was archived, and a
 * publish after an unpublish. The type follows the kind of the case the row
 * is published from, and no later write changes it. Each test runs for a case
 * and for a pattern.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

describe.each(KINDS)("a %s published through the service", (kind) => {
	const type = TYPE_FOR_KIND[kind];
	const wrongType = TYPE_FOR_KIND[otherKind(kind)];

	it("gets a row of its type on first publish, and keeps its own kind", async () => {
		const { caseId, ownerId } = await openCase(kind);

		const result = await publishAssuranceCase(ownerId, caseId);

		expectSuccess(result);
		const { stored, rows } = await storedState(caseId);
		expect(stored.kind).toBe(kind);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ type, isCurrent: true, archivedAt: null });
		expect(rows[0]?.type).not.toBe(wrongType);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("gets the same type when the status route's transition publishes and republishes it", async () => {
		const { caseId, ownerId } = await openCase(kind);

		expectSuccess(await transitionStatus(ownerId, caseId, "PUBLISHED"));
		const afterFirst = await publishedRows(caseId);
		expectSuccess(await transitionStatus(ownerId, caseId, "PUBLISHED"));
		const afterSecond = await publishedRows(caseId);

		expect(afterFirst.map((row) => row.type)).toEqual([type]);
		expect(afterSecond.map((row) => row.type)).toEqual([type, type]);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("Update Published writes a new current row of the same type and leaves older rows as they were", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		const [first] = await publishedRows(caseId);

		for (let republish = 0; republish < 3; republish++) {
			expectSuccess(await updatePublishedCase(ownerId, caseId));
		}

		const rows = await publishedRows(caseId);
		expect(rows).toHaveLength(4);
		expect(rows.map((row) => row.type)).toEqual([type, type, type, type]);
		expect(rows.filter((row) => row.isCurrent)).toHaveLength(1);
		expect(rows.at(-1)?.isCurrent).toBe(true);
		expect(new Set(rows.map((row) => row.slug)).size).toBe(1);
		expect(rows[0]).toMatchObject({
			id: first?.id,
			type,
			isCurrent: false,
			archivedAt: null,
		});
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("gets a row of its type when it is published again after an unpublish", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await unpublishAssuranceCase(ownerId, caseId));
		expect(await publishedRows(caseId)).toHaveLength(0);

		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await updatePublishedCase(ownerId, caseId));

		const rows = await publishedRows(caseId);
		expect(rows.map((row) => row.type)).toEqual([type, type]);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("keeps the type on the archived row, and on the row a later Update Published writes after a restore", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await updatePublishedCase(ownerId, caseId));

		expectSuccess(
			await softDeleteCase(ownerId, caseId, { publishedCopy: "archive" })
		);

		const archived = await publishedRows(caseId);
		expect(archived).toHaveLength(1);
		expect(archived[0]).toMatchObject({ type, isCurrent: true });
		expect(archived[0]?.archivedAt).not.toBeNull();

		expectSuccess(await restoreCase(ownerId, caseId));
		const restored = await publishedRows(caseId);
		expect(restored.map(rowIdentity)).toEqual([
			{ ...rowIdentity(archived[0] as never), archivedAt: null },
		]);

		expectSuccess(await updatePublishedCase(ownerId, caseId));
		const rows = await publishedRows(caseId);
		expect(rows.map((row) => row.type)).toEqual([type, type]);
		expect(rows.filter((row) => row.isCurrent)).toHaveLength(1);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("is refused an Update Published while its copy is archived in Trash, and the archived row is left as it was", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(
			await softDeleteCase(ownerId, caseId, { publishedCopy: "archive" })
		);
		const before = await publishedRows(caseId);

		const result = await updatePublishedCase(ownerId, caseId);

		expect(result).toHaveProperty("error");
		const after = await publishedRows(caseId);
		expect(after).toHaveLength(1);
		expect(after.map(rowIdentity)).toEqual(before.map(rowIdentity));
		expect(after[0]?.type).toBe(type);
	});

	it("keeps the type on the one row that survives archiving after several updates", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await updatePublishedCase(ownerId, caseId));
		expectSuccess(await updatePublishedCase(ownerId, caseId));
		expect(await publishedRows(caseId)).toHaveLength(3);

		expectSuccess(
			await softDeleteCase(ownerId, caseId, { publishedCopy: "archive" })
		);

		const rows = await publishedRows(caseId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ type, isCurrent: true });
	});

	it("is published again with the type of its kind after it was removed with the case, restored and published", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await softDeleteCase(ownerId, caseId));
		expect(await publishedRows(caseId)).toHaveLength(0);
		expectSuccess(await restoreCase(ownerId, caseId));

		expectSuccess(await publishAssuranceCase(ownerId, caseId));

		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			type,
		]);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("writes the type of its new kind when it is unpublished, converted and published again", async () => {
		const to = otherKind(kind);
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await unpublishAssuranceCase(ownerId, caseId));
		expect(await convertCaseKind(ownerId, caseId, to)).toEqual({
			data: { kind: to },
		});

		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(await updatePublishedCase(ownerId, caseId));

		const rows = await publishedRows(caseId);
		expect(rows.map((row) => row.type)).toEqual([
			TYPE_FOR_KIND[to],
			TYPE_FOR_KIND[to],
		]);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});

	it("cannot be converted while its copy is live, so the live row's type cannot go stale", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		const before = await publishedRows(caseId);

		const converted = await convertCaseKind(ownerId, caseId, otherKind(kind));

		expect(converted).toHaveProperty("error");
		const state = await storedState(caseId);
		expect(state.stored.kind).toBe(kind);
		expect(state.rows.map(rowIdentity)).toEqual(before.map(rowIdentity));
		expect(inconsistencies(state)).toEqual([]);
	});

	it("cannot be converted while its copy is archived, before or after a restore", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		expectSuccess(
			await softDeleteCase(ownerId, caseId, { publishedCopy: "archive" })
		);

		expect(
			await convertCaseKind(ownerId, caseId, otherKind(kind))
		).toHaveProperty("error");
		expectSuccess(await restoreCase(ownerId, caseId));
		expect(
			await convertCaseKind(ownerId, caseId, otherKind(kind))
		).toHaveProperty("error");

		const state = await storedState(caseId);
		expect(state.stored.kind).toBe(kind);
		expect(state.rows.map((row) => row.type)).toEqual([type]);
		expect(inconsistencies(state)).toEqual([]);
	});

	it("is listed under the type of its kind by an Update Published even when the row it replaces carries the other type", async () => {
		const { caseId, ownerId } = await openCase(kind);
		expectSuccess(await publishAssuranceCase(ownerId, caseId));
		await prisma.publishedAssuranceCase.updateMany({
			where: { assuranceCaseId: caseId },
			data: { type: wrongType },
		});

		expectSuccess(await updatePublishedCase(ownerId, caseId));

		const current = (await publishedRows(caseId)).filter(
			(row) => row.isCurrent
		);
		expect(current.map((row) => row.type)).toEqual([type]);
	});
});

describe.each(KINDS)("a %s published through the routes", (kind) => {
	const type = TYPE_FOR_KIND[kind];

	it("gets a row of its type from the publish route, from an update through the status route, and from a publish after the status route unpublished it", async () => {
		const { caseId, ownerId } = await openCase(kind, { withInformation: true });
		const owner = await prisma.user.findUniqueOrThrow({
			where: { id: ownerId },
		});
		await mockAuth(owner.id, owner.username, owner.email);
		const { POST } = await import("@/app/api/cases/[id]/publish/route");

		const published = await POST(
			new Request(`http://localhost:3000/api/cases/${caseId}/publish`, {
				method: "POST",
			}) as never,
			{ params: Promise.resolve({ id: caseId }) }
		);
		expect(published.status).toBe(200);
		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			type,
		]);

		expect((await setStatus(caseId, "PUBLISHED")).status).toBe(200);
		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			type,
			type,
		]);

		expect((await setStatus(caseId, "DRAFT")).status).toBe(200);
		expect(await publishedRows(caseId)).toHaveLength(0);

		expect((await setStatus(caseId, "PUBLISHED")).status).toBe(200);
		expect((await publishedRows(caseId)).map((row) => row.type)).toEqual([
			type,
		]);
		expect(inconsistencies(await storedState(caseId))).toEqual([]);
	});
});
