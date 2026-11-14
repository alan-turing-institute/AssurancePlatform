import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createPublishedRow,
	richSource,
	snapshotWithComments,
	worldCounts,
} from "../utils/pattern-start-kit";
import { STARTERS } from "../utils/pattern-starters";

/**
 * Starting a case from the slug a published pattern's page hands the dialog.
 * The server answers from the slug's current row at the moment of the start,
 * whatever the page or the dialog showed earlier: a slug whose current row is
 * not a pattern, or that was withdrawn after the dialog listed it, is refused
 * and nothing is created.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

describe.each(
	STARTERS
)("starting a case from a published slug through %s", (_label, starter) => {
	it("refuses a slug whose current row is an ordinary case, though an older row of that slug was a pattern", async () => {
		const { owner, pattern } = await richSource();
		const content = await snapshotWithComments(owner, pattern.id);
		await createPublishedRow({
			slug: "once-a-pattern",
			type: "ARGUMENT_PATTERN",
			isCurrent: false,
			assuranceCaseId: pattern.id,
			content,
		});
		await createPublishedRow({
			slug: "once-a-pattern",
			type: "ASSURANCE_CASE",
			isCurrent: true,
			assuranceCaseId: pattern.id,
			content,
		});
		const before = await worldCounts();

		const outcome = await starter.start(owner, {
			publishedSlug: "once-a-pattern",
		});

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses a slug that was withdrawn after the pattern was shown, and creates nothing", async () => {
		const { owner, pattern } = await richSource();
		const row = await createPublishedRow({
			slug: "withdrawn-pattern",
			assuranceCaseId: pattern.id,
			content: await snapshotWithComments(owner, pattern.id),
		});
		const before = await worldCounts();
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: { isCurrent: false },
		});

		const outcome = await starter.start(owner, {
			publishedSlug: "withdrawn-pattern",
		});

		expect(outcome).toEqual({ ok: false, error: "Pattern not found" });
		expect(await worldCounts()).toEqual(before);
	});
});
