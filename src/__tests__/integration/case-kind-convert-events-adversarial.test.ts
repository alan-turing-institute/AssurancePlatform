import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { convertCaseKind as convertWithService } from "@/lib/services/case-kind-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createPublishedRow,
	createRichCase,
	MISSING_CASE_ID,
	otherKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * What open editors are told when a case changes kind: one `case:updated`
 * event, naming the new kind and who changed it, sent to the converted case
 * only; and nothing at all when the conversion is refused.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const KINDS = ["CASE", "PATTERN"] as const;

async function convertAs(
	user: { email: string; id: string; username: string } | null,
	caseId: string,
	target: unknown
) {
	if (user) {
		await mockAuth(user.id, user.username, user.email);
	} else {
		await mockNoAuth();
	}
	const { convertCaseKind } = await import("@/actions/case-kind");
	return convertCaseKind(caseId, target as "CASE" | "PATTERN");
}

describe.each(KINDS)("converting a %s: the live-update event", (from) => {
	const to = otherKind(from);

	it("sends exactly one case:updated event that names the new kind and the person who converted", async () => {
		const rich = await createRichCase(from);
		const tap = tapCaseEvents(rich.caseId);

		const result = await convertAs(rich.owner, rich.caseId, to);
		tap.stop();

		expect(result).toMatchObject({ success: true });
		const events = tap.events();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "case:updated",
			caseId: rich.caseId,
			userId: rich.owner.id,
			payload: {
				action: "kind-changed",
				kind: to,
				userId: rich.owner.id,
				username: rich.owner.username,
			},
		});
		expect(typeof events[0]?.timestamp).toBe("string");
		expect(Object.keys(events[0]?.payload ?? {})).not.toContain("email");
	});

	it("names a collaborator who converted, not the owner", async () => {
		const rich = await createRichCase(from);
		const admin = await createTestUser();
		await createTestPermission(rich.caseId, admin.id, rich.ownerId, "ADMIN");
		const tap = tapCaseEvents(rich.caseId, rich.ownerId);

		await convertAs(admin, rich.caseId, to);
		tap.stop();

		expect(tap.events()).toHaveLength(1);
		expect(tap.events()[0]).toMatchObject({
			userId: admin.id,
			payload: { userId: admin.id, username: admin.username },
		});
	});

	it("sends it the same way when the service is called without the action", async () => {
		const rich = await createRichCase(from);
		const tap = tapCaseEvents(rich.caseId);

		await convertWithService(rich.ownerId, rich.caseId, to);
		tap.stop();

		expect(tap.events()).toHaveLength(1);
		expect(tap.events()[0]?.payload).toMatchObject({
			action: "kind-changed",
			kind: to,
		});
	});

	it("reaches every open editor of the case once each", async () => {
		const rich = await createRichCase(from);
		const taps = [1, 2, 3].map((n) =>
			tapCaseEvents(rich.caseId, `viewer-${n}`)
		);

		await convertAs(rich.owner, rich.caseId, to);
		for (const tap of taps) {
			tap.stop();
		}

		expect(taps.map((tap) => tap.events().length)).toEqual([1, 1, 1]);
	});

	it("does not reach the editors of any other case, including the ones that cite it or came from it", async () => {
		const rich = await createRichCase(from);
		const unrelated = await createTestCase(rich.ownerId);
		const others = [rich.citingCaseId, rich.derivedCaseId, unrelated.id].map(
			(caseId) => tapCaseEvents(caseId)
		);
		const own = tapCaseEvents(rich.caseId);

		await convertAs(rich.owner, rich.caseId, to);
		own.stop();
		for (const tap of others) {
			tap.stop();
		}

		expect(own.events()).toHaveLength(1);
		expect(others.map((tap) => tap.events())).toEqual([[], [], []]);
	});

	it("is sent again, with the other kind, when the case is converted back", async () => {
		const rich = await createRichCase(from);
		const tap = tapCaseEvents(rich.caseId);

		await convertAs(rich.owner, rich.caseId, to);
		await convertAs(rich.owner, rich.caseId, from);
		tap.stop();

		expect(tap.events().map((event) => event.payload.kind)).toEqual([to, from]);
	});

	it("is not sent twice for a repeated request", async () => {
		const rich = await createRichCase(from);
		const tap = tapCaseEvents(rich.caseId);

		const first = await convertAs(rich.owner, rich.caseId, to);
		const second = await convertAs(rich.owner, rich.caseId, to);
		tap.stop();

		expect(first).toMatchObject({ success: true });
		expect(second).toMatchObject({ success: false });
		expect(tap.events()).toHaveLength(1);
	});
});

describe.each(KINDS)("a refused conversion of a %s sends nothing", (from) => {
	const to = otherKind(from);

	async function expectSilentRefusal(
		caseId: string,
		attempt: () => Promise<{ success: boolean }>,
		watched: string[] = [caseId]
	) {
		const taps = watched.map((id) => tapCaseEvents(id));
		const result = await attempt();
		for (const tap of taps) {
			tap.stop();
		}
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(result.success).toBe(false);
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(taps.flatMap((tap) => tap.events())).toEqual([]);
	}

	it("from a stranger", async () => {
		const rich = await createRichCase(from);
		const stranger = await createTestUser();

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(stranger, rich.caseId, to)
		);
	});

	it.each([
		"VIEW",
		"COMMENT",
		"EDIT",
	] as const)("from someone with %s", async (level) => {
		const rich = await createRichCase(from);
		const user = await createTestUser();
		await createTestPermission(rich.caseId, user.id, rich.ownerId, level);

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(user, rich.caseId, to)
		);
	});

	it("from a signed-out caller", async () => {
		const rich = await createRichCase(from);

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(null, rich.caseId, to)
		);
	});

	it("for a case that does not exist", async () => {
		const rich = await createRichCase(from);

		await expectSilentRefusal(
			rich.caseId,
			() => convertAs(rich.owner, MISSING_CASE_ID, to),
			[rich.caseId, MISSING_CASE_ID]
		);
	});

	it("for an invalid kind or case id", async () => {
		const rich = await createRichCase(from);

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, rich.caseId, "TEMPLATE")
		);
		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, "not-a-uuid", to)
		);
	});

	it("for a published case", async () => {
		const rich = await createRichCase(from);
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { published: true, publishStatus: "PUBLISHED" },
		});

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, rich.caseId, to)
		);
	});

	it("for a case with a published row", async () => {
		const rich = await createRichCase(from);
		await createPublishedRow(rich.caseId, { archivedAt: new Date() });

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, rich.caseId, to)
		);
	});

	it("for a case in Trash", async () => {
		const rich = await createRichCase(from);
		await prisma.assuranceCase.update({
			where: { id: rich.caseId },
			data: { deletedAt: new Date(), deletedById: rich.ownerId },
		});

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, rich.caseId, to)
		);
	});

	it("for a case that already is that kind", async () => {
		const rich = await createRichCase(from);

		await expectSilentRefusal(rich.caseId, () =>
			convertAs(rich.owner, rich.caseId, from)
		);
	});
});
