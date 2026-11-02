import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createRichCase,
	otherKind,
	storedKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

/**
 * A conversion racing something else for the same case. Each race is made
 * real by holding the case row's lock in an open transaction, so the
 * conversion's write waits behind it and sees whatever that transaction
 * commits: the outcome does not depend on scheduling.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const KINDS = ["CASE", "PATTERN"] as const;

/**
 * A transaction that touches the case row and changes nothing a conversion
 * cares about. Finish it with `rollback()`: writers queued behind a rolled-back
 * lock take the row in the order they queued, whereas after a commit they wake
 * together and the one that goes first is down to scheduling.
 */
function holdCaseRow(caseId: string) {
	return holdRowLock(async (tx) => {
		await tx.assuranceCase.update({
			where: { id: caseId },
			data: { updatedAt: new Date() },
		});
	});
}

describe.each(
	KINDS
)("converting a %s while something else commits first", (from) => {
	const to = otherKind(from);
	const noun = from === "PATTERN" ? "pattern" : "case";

	it("is refused when a publish commits between the permission check and the write", async () => {
		const rich = await createRichCase(from);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: rich.caseId },
				data: {
					published: true,
					publishStatus: "PUBLISHED",
					publishedAt: new Date(),
				},
			});
			await tx.publishedAssuranceCase.create({
				data: {
					assuranceCaseId: rich.caseId,
					slug: "raced-publish",
					title: "Raced",
					content: { version: "1.0" },
				},
			});
		});
		const tap = tapCaseEvents(rich.caseId);

		const pending = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait();
		await holder.release();
		const result = await pending;
		tap.stop();

		expect(result).toEqual({
			error: `Unpublish this ${noun} before converting it`,
		});
		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(tap.events()).toEqual([]);
		expect(
			await prisma.publishedAssuranceCase.count({
				where: { assuranceCaseId: rich.caseId },
			})
		).toBe(1);
	});

	it("is refused when the case is trashed between the permission check and the write", async () => {
		const rich = await createRichCase(from);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: rich.caseId },
				data: { deletedAt: new Date(), deletedById: rich.ownerId },
			});
		});
		const tap = tapCaseEvents(rich.caseId);

		const pending = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait();
		await holder.release();
		const result = await pending;
		tap.stop();

		expect(result).toEqual({ error: "Permission denied" });
		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(tap.events()).toEqual([]);
	});

	it("is refused, and says it is already done, when another conversion to the same kind commits first", async () => {
		const rich = await createRichCase(from);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: rich.caseId },
				data: { kind: to },
			});
		});
		const tap = tapCaseEvents(rich.caseId);

		const pending = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait();
		await holder.release();
		const result = await pending;
		tap.stop();

		expect(result).toEqual({
			error: `This is already a ${to === "PATTERN" ? "pattern" : "case"}`,
		});
		expect((await storedKind(rich.caseId)).kind).toBe(to);
		expect(tap.events()).toEqual([]);
	});

	it("lets exactly one of two simultaneous conversions through", async () => {
		const rich = await createRichCase(from);
		const holder = await holdCaseRow(rich.caseId);
		const tap = tapCaseEvents(rich.caseId);

		const first = convertCaseKind(rich.ownerId, rich.caseId, to);
		const second = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const results = await Promise.all([first, second]);
		tap.stop();

		expect(results.filter((result) => "data" in result)).toHaveLength(1);
		expect(results.filter((result) => "error" in result)).toHaveLength(1);
		expect((await storedKind(rich.caseId)).kind).toBe(to);
		expect(tap.events()).toHaveLength(1);
	});

	it("lets exactly one of six simultaneous conversions through", async () => {
		const rich = await createRichCase(from);
		const holder = await holdCaseRow(rich.caseId);
		const tap = tapCaseEvents(rich.caseId);

		const all = Array.from({ length: 6 }, () =>
			convertCaseKind(rich.ownerId, rich.caseId, to)
		);
		await waitForLockWait(5000, 6);
		await holder.rollback();
		const results = await Promise.all(all);
		tap.stop();

		expect(results.filter((result) => "data" in result)).toHaveLength(1);
		expect(tap.events()).toHaveLength(1);
		expect((await storedKind(rich.caseId)).kind).toBe(to);
	});

	it("announces only after the new kind is stored, not while the write is still waiting", async () => {
		const rich = await createRichCase(from);
		const holder = await holdCaseRow(rich.caseId);
		const tap = tapCaseEvents(rich.caseId);

		const pending = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait();
		const eventsWhileWaiting = tap.events().length;
		const kindWhileWaiting = (await storedKind(rich.caseId)).kind;
		await holder.rollback();
		await pending;
		tap.stop();

		expect(eventsWhileWaiting).toBe(0);
		expect(kindWhileWaiting).toBe(from);
		expect(tap.events()).toHaveLength(1);
		expect((await storedKind(rich.caseId)).kind).toBe(to);
	});

	it("announces nothing when the write it waited for is then refused", async () => {
		const rich = await createRichCase(from);
		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: rich.caseId },
				data: { published: true },
			});
		});
		const tap = tapCaseEvents(rich.caseId);

		const pending = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait();
		const eventsWhileWaiting = tap.events().length;
		await holder.release();
		const result = await pending;
		tap.stop();

		expect(eventsWhileWaiting).toBe(0);
		expect(result).toHaveProperty("error");
		expect(tap.events()).toEqual([]);
	});
});

describe.each(KINDS)("converting a %s while it is being published", (from) => {
	const to = otherKind(from);

	/** Whether a stored snapshot says it came from a pattern. */
	function snapshotKind(content: unknown): "CASE" | "PATTERN" {
		const caseBlock = (content as { case?: { kind?: string } }).case;
		return caseBlock?.kind === "PATTERN" ? "PATTERN" : "CASE";
	}

	it("never leaves a published case whose snapshot is of the other kind, when the conversion goes first", async () => {
		const rich = await createRichCase(from);
		const holder = await holdCaseRow(rich.caseId);

		const converting = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait(5000, 1);
		const publishing = publishAssuranceCase(rich.ownerId, rich.caseId);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		await Promise.all([converting, publishing]);

		const stored = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: rich.caseId },
		});
		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: rich.caseId },
		});
		if (stored.published) {
			expect(rows.length).toBeGreaterThan(0);
		}
		for (const row of rows) {
			expect(snapshotKind(row.content)).toBe(stored.kind);
		}
	});

	it("refuses the conversion and keeps the kind when the publish goes first", async () => {
		const rich = await createRichCase(from);
		const holder = await holdCaseRow(rich.caseId);

		const publishing = publishAssuranceCase(rich.ownerId, rich.caseId);
		await waitForLockWait(5000, 1);
		const converting = convertCaseKind(rich.ownerId, rich.caseId, to);
		await waitForLockWait(5000, 2);
		await holder.rollback();
		const [published, converted] = await Promise.all([publishing, converting]);

		expect(published).toHaveProperty("data");
		expect(converted).toHaveProperty("error");
		const stored = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: rich.caseId },
		});
		expect(stored).toMatchObject({ kind: from, published: true });
		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: rich.caseId },
		});
		expect(rows).toHaveLength(1);
		expect(snapshotKind(rows[0]?.content)).toBe(from);
	});
});
