import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createRichCase,
	MISSING_CASE_ID,
	otherKind,
	PEOPLE,
	snapshotAroundKind,
	storedKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Who may convert a case, and what everyone else is told: owner, direct ADMIN
 * and a team shared at ADMIN may; everyone below ADMIN, strangers and a
 * signed-out caller may not. A caller who cannot see the case gets the error
 * a missing case gets, and a refused attempt changes and announces nothing.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const KINDS = ["CASE", "PATTERN"] as const;

const DIRECTIONS = [
	["CASE", "PATTERN"],
	["PATTERN", "CASE"],
] as const;

beforeEach(async () => {
	await mockNoAuth();
	revalidatePath.mockClear();
});

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

describe.each(
	DIRECTIONS
)("converting a %s to a %s through the action", (from, to) => {
	it("lets the owner convert it", async () => {
		const rich = await createRichCase(from);

		const result = await convertAs(rich.owner, rich.caseId, to);

		expect(result).toEqual({ success: true, data: { kind: to } });
		expect((await storedKind(rich.caseId)).kind).toBe(to);
	});

	it.each(
		PEOPLE.filter((person) => person.allowed).map((person) => [
			person.label,
			person,
		])
	)("lets %s convert it, and says so to the open editors", async (_label, person) => {
		const rich = await createRichCase(from);
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});
		const tap = tapCaseEvents(rich.caseId);

		const result = await convertAs(user, rich.caseId, to);
		tap.stop();

		expect(result).toEqual({ success: true, data: { kind: to } });
		expect((await storedKind(rich.caseId)).kind).toBe(to);
		expect(tap.events()).toHaveLength(1);
	});

	it.each(
		PEOPLE.filter((person) => !person.allowed).map((person) => [
			person.label,
			person,
		])
	)("refuses %s with the stranger's error, changes nothing and announces nothing", async (_label, person) => {
		const rich = await createRichCase(from);
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});
		const before = await snapshotAroundKind(rich.caseId);
		const kindBefore = await storedKind(rich.caseId);
		const tap = tapCaseEvents(rich.caseId);

		const result = await convertAs(user, rich.caseId, to);
		tap.stop();

		expect(result).toEqual({ success: false, error: "Permission denied" });
		expect(await storedKind(rich.caseId)).toEqual(kindBefore);
		expect(await snapshotAroundKind(rich.caseId)).toEqual(before);
		expect(tap.events()).toEqual([]);
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("refuses a signed-out caller and changes nothing", async () => {
		const rich = await createRichCase(from);
		const tap = tapCaseEvents(rich.caseId);

		const result = await convertAs(null, rich.caseId, to);
		tap.stop();

		expect(result).toEqual({ success: false, error: "Unauthorised" });
		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(tap.events()).toEqual([]);
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("gives a stranger the same error for a missing case as for this one", async () => {
		const rich = await createRichCase(from);
		const stranger = await createTestUser();

		const forThisCase = await convertAs(stranger, rich.caseId, to);
		const forMissingCase = await convertAs(stranger, MISSING_CASE_ID, to);

		expect(forThisCase).toEqual({ success: false, error: "Permission denied" });
		expect(forMissingCase).toEqual(forThisCase);
	});

	it("gives an owner of another case the same error for a missing case as a stranger gets", async () => {
		const owner = await createTestUser();
		await createTestCase(owner.id, { kind: from });
		const stranger = await createTestUser();

		const asOwner = await convertAs(owner, MISSING_CASE_ID, to);
		const asStranger = await convertAs(stranger, MISSING_CASE_ID, to);

		expect(asOwner).toEqual({ success: false, error: "Permission denied" });
		expect(asOwner).toEqual(asStranger);
	});
});

describe("converting through the action with a forced or malformed request", () => {
	it("takes the acting person from the session, not from anything the caller adds", async () => {
		const rich = await createRichCase("CASE");
		const stranger = await createTestUser();
		await mockAuth(stranger.id, stranger.username, stranger.email);
		const { convertCaseKind } = await import("@/actions/case-kind");
		const forced = convertCaseKind as unknown as (
			...args: unknown[]
		) => ReturnType<typeof convertCaseKind>;

		const result = await forced(rich.caseId, "PATTERN", rich.ownerId, {
			userId: rich.ownerId,
		});

		expect(result).toEqual({ success: false, error: "Permission denied" });
		expect((await storedKind(rich.caseId)).kind).toBe("CASE");
	});

	it.each([
		"not-a-uuid",
		"",
		"0",
		"00000000-0000-4000-8000-00000000dead/../x",
	])("refuses the case id %j as invalid", async (caseId) => {
		const user = await createTestUser();

		const result = await convertAs(user, caseId, "PATTERN");

		expect(result).toEqual({ success: false, error: "Invalid case ID" });
	});

	it.each([
		"pattern",
		"TEMPLATE",
		"",
		undefined,
		null,
		7,
		{ kind: "PATTERN" },
		["PATTERN"],
	])("refuses the target kind %j and changes nothing", async (target) => {
		const rich = await createRichCase("CASE");

		const result = await convertAs(rich.owner, rich.caseId, target);

		expect(result).toEqual({ success: false, error: "Invalid kind" });
		expect((await storedKind(rich.caseId)).kind).toBe("CASE");
	});
});

describe("revalidating the lists after a conversion", () => {
	it("refreshes My Assurance Cases and My Patterns after a conversion, in either direction", async () => {
		for (const from of ["CASE", "PATTERN"] as const) {
			revalidatePath.mockClear();
			const rich = await createRichCase(from);

			const result = await convertAs(rich.owner, rich.caseId, otherKind(from));

			expect(result).toMatchObject({ success: true });
			const paths = revalidatePath.mock.calls.map(([path]) => path);
			expect(paths).toContain("/dashboard");
			expect(paths).toContain("/dashboard/patterns");
		}
	});
});

describe.each(
	KINDS
)("what the editor of a %s is told about who may convert it", (kind) => {
	async function permissionsSeenBy(
		user: { email: string; id: string; username: string },
		caseId: string
	) {
		await mockAuth(user.id, user.username, user.email);
		const { GET } = await import("@/app/api/cases/[id]/route");
		const response = await GET(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}`),
			{ params: Promise.resolve({ id: caseId }) }
		);
		return { status: response.status, body: await response.json() };
	}

	it("labels the owner as managing it, and reports its kind", async () => {
		const rich = await createRichCase(kind);

		const seen = await permissionsSeenBy(rich.owner, rich.caseId);

		expect(seen.status).toBe(200);
		expect(seen.body).toMatchObject({ permissions: "manage", kind });
	});

	it.each(
		PEOPLE.map((person) => [person.label, person])
	)("labels %s as managing it exactly when the server lets them convert it", async (_label, person) => {
		const rich = await createRichCase(kind);
		const user = await person.setup({
			caseId: rich.caseId,
			ownerId: rich.ownerId,
		});

		const seen = await permissionsSeenBy(user, rich.caseId);

		const shownTheMenu =
			seen.status === 200 && seen.body.permissions === "manage";
		expect(shownTheMenu).toBe(person.allowed);
		if (seen.status === 200) {
			expect(seen.body.kind).toBe(kind);
		}
	});
});
