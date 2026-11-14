import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { listViewablePatterns } from "@/lib/services/case-from-pattern-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { softDeleteCase } from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import { worldCounts } from "../utils/pattern-start-kit";
import { STARTERS } from "../utils/pattern-starters";
import { createTestUser } from "../utils/prisma-factories";
import { openCase, publishedRows } from "../utils/publish-type-kit";

/**
 * What the rest of the app does with the type a publish writes: the chooser
 * of patterns to start from and starting a case from a published slug. Both
 * read the stored type, so a pattern published through the service must be
 * offered and usable, and a published case must not be, whatever the case went
 * through on its way.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

async function publish(kind: "CASE" | "PATTERN") {
	const open = await openCase(kind);
	expectSuccess(await publishAssuranceCase(open.ownerId, open.caseId));
	const [row] = await publishedRows(open.caseId);
	if (!row) {
		throw new Error("nothing was published");
	}
	return { ...open, slug: row.slug };
}

describe("the chooser of patterns to start from", () => {
	it("offers a published pattern to another person, and never a published case", async () => {
		const pattern = await publish("PATTERN");
		const published = await publish("CASE");
		const stranger = await createTestUser();

		const listed = expectSuccess(await listViewablePatterns(stranger.id));

		expect(
			listed.map((entry) => [entry.origin, entry.source, entry.name])
		).toEqual([["published", { publishedSlug: pattern.slug }, pattern.name]]);
		expect(JSON.stringify(listed)).not.toContain(published.slug);
	});

	it("lists the owner's pattern once, carrying the slug of its published copy, and stops offering the slug when it is unpublished", async () => {
		const pattern = await publish("PATTERN");

		const listed = expectSuccess(await listViewablePatterns(pattern.ownerId));
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({
			origin: "own",
			publishedSlug: pattern.slug,
		});

		expectSuccess(
			await unpublishAssuranceCase(pattern.ownerId, pattern.caseId)
		);
		const afterwards = expectSuccess(
			await listViewablePatterns(pattern.ownerId)
		);
		expect(afterwards).toHaveLength(1);
		expect(afterwards[0]).not.toHaveProperty("publishedSlug");
	});

	it("still offers an archived published pattern, marked archived", async () => {
		const pattern = await publish("PATTERN");
		expectSuccess(
			await softDeleteCase(pattern.ownerId, pattern.caseId, {
				publishedCopy: "archive",
			})
		);
		const stranger = await createTestUser();

		const listed = expectSuccess(await listViewablePatterns(stranger.id));

		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({
			origin: "published",
			archived: true,
			source: { publishedSlug: pattern.slug },
		});
	});
});

describe.each(
	STARTERS
)("starting a case from a published slug through %s", (_label, starter) => {
	it("works for a pattern published through the service, before and after an Update Published", async () => {
		const pattern = await publish("PATTERN");
		const stranger = await createTestUser();

		const first = await starter.start(stranger, {
			publishedSlug: pattern.slug,
		});
		expectSuccess(await updatePublishedCase(pattern.ownerId, pattern.caseId));
		const second = await starter.start(stranger, {
			publishedSlug: pattern.slug,
		});

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (first.ok) {
			const created = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: first.id },
			});
			expect(created).toMatchObject({
				kind: "CASE",
				createdById: stranger.id,
			});
		}
	});

	it("refuses the slug of a case published through the service, and creates nothing", async () => {
		const published = await publish("CASE");
		const stranger = await createTestUser();
		const before = await worldCounts();

		const outcome = await starter.start(stranger, {
			publishedSlug: published.slug,
		});

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses a slug that was a pattern until it was unpublished, converted and published as a case", async () => {
		const pattern = await publish("PATTERN");
		expectSuccess(
			await unpublishAssuranceCase(pattern.ownerId, pattern.caseId)
		);
		expect(
			await convertCaseKind(pattern.ownerId, pattern.caseId, "CASE")
		).toEqual({ data: { kind: "CASE" } });
		expectSuccess(await publishAssuranceCase(pattern.ownerId, pattern.caseId));
		const [row] = await publishedRows(pattern.caseId);
		const stranger = await createTestUser();
		const before = await worldCounts();

		const outcome = await starter.start(stranger, {
			publishedSlug: row?.slug ?? "",
		});

		expect(row?.type).toBe("ASSURANCE_CASE");
		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it("accepts a slug that was a case until it was unpublished, converted and published as a pattern", async () => {
		const published = await publish("CASE");
		expectSuccess(
			await unpublishAssuranceCase(published.ownerId, published.caseId)
		);
		expect(
			await convertCaseKind(published.ownerId, published.caseId, "PATTERN")
		).toEqual({ data: { kind: "PATTERN" } });
		expectSuccess(
			await publishAssuranceCase(published.ownerId, published.caseId)
		);
		const [row] = await publishedRows(published.caseId);
		const stranger = await createTestUser();

		const outcome = await starter.start(stranger, {
			publishedSlug: row?.slug ?? "",
		});

		expect(row?.type).toBe("ARGUMENT_PATTERN");
		expect(outcome.ok).toBe(true);
	});

	it("works for an archived published pattern, as for a live one", async () => {
		const pattern = await publish("PATTERN");
		expectSuccess(
			await softDeleteCase(pattern.ownerId, pattern.caseId, {
				publishedCopy: "archive",
			})
		);
		const stranger = await createTestUser();

		const outcome = await starter.start(stranger, {
			publishedSlug: pattern.slug,
		});

		expect(outcome.ok).toBe(true);
	});
});
