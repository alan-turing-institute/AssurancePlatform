import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createCase, listUserCases } from "@/lib/services/case-fetch-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { worldCounts } from "../utils/pattern-start-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Creating a blank case or a blank pattern, through the service and through
 * the server action behind the new-case dialog. The kind defaults to an
 * ordinary case; a client can choose a case or a pattern and nothing else,
 * and can set neither a source pattern nor the pattern flags.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const BODY = { name: "Blank start", description: "Nothing in it yet" };

/** The stored state of a case made blank. */
async function stored(caseId: string) {
	const theCase = await prisma.assuranceCase.findUniqueOrThrow({
		where: { id: caseId },
		select: {
			kind: true,
			sourcePatternId: true,
			createdById: true,
			name: true,
			description: true,
		},
	});
	const elements = await prisma.assuranceElement.findMany({
		where: { caseId },
		select: {
			elementType: true,
			role: true,
			parentId: true,
			fromPattern: true,
			modifiedFromPattern: true,
		},
	});
	return { theCase, elements };
}

describe("createCase", () => {
	it("makes an ordinary case with a single top-level goal when no kind is given", async () => {
		const user = await createTestUser();

		const { id } = expectSuccess(await createCase(user.id, BODY));

		const { theCase, elements } = await stored(id);
		expect(theCase).toMatchObject({
			kind: "CASE",
			sourcePatternId: null,
			createdById: user.id,
			...BODY,
		});
		expect(elements).toEqual([
			{
				elementType: "GOAL",
				role: "TOP_LEVEL",
				parentId: null,
				fromPattern: false,
				modifiedFromPattern: false,
			},
		]);
	});

	it("makes an ordinary case when the kind is named as undefined or as CASE", async () => {
		const user = await createTestUser();

		const unnamed = expectSuccess(
			await createCase(user.id, { ...BODY, kind: undefined })
		);
		const named = expectSuccess(
			await createCase(user.id, { ...BODY, kind: "CASE" })
		);

		expect((await stored(unnamed.id)).theCase.kind).toBe("CASE");
		expect((await stored(named.id)).theCase.kind).toBe("CASE");
	});

	it("makes a blank pattern with the same single goal, owned by the user and linked to nothing", async () => {
		const user = await createTestUser();

		const { id } = expectSuccess(
			await createCase(user.id, { ...BODY, kind: "PATTERN" })
		);

		const { theCase, elements } = await stored(id);
		expect(theCase).toMatchObject({
			kind: "PATTERN",
			sourcePatternId: null,
			createdById: user.id,
			...BODY,
		});
		expect(elements).toHaveLength(1);
		expect(elements[0]).toMatchObject({
			elementType: "GOAL",
			role: "TOP_LEVEL",
			fromPattern: false,
		});
	});

	it("keeps a blank pattern out of My Assurance Cases and an ordinary case in", async () => {
		const user = await createTestUser();
		const pattern = expectSuccess(
			await createCase(user.id, { ...BODY, kind: "PATTERN" })
		);
		const ordinary = expectSuccess(await createCase(user.id, BODY));

		const listed = expectSuccess(await listUserCases(user.id));

		expect(listed.map((row) => row.id)).toEqual([ordinary.id]);
		expect(listed.map((row) => row.id)).not.toContain(pattern.id);
	});

	it("refuses a kind the database does not know, and creates nothing", async () => {
		const user = await createTestUser();
		const before = await worldCounts();

		const result = await createCase(user.id, {
			...BODY,
			kind: "TEMPLATE" as unknown as "CASE",
		});

		expect(result).toHaveProperty("error");
		expect(await worldCounts()).toEqual(before);
	});
});

describe("the createAssuranceCase action", () => {
	async function create(
		user: { id: string; username: string; email: string | null },
		input: unknown
	) {
		await mockAuth(user.id, user.username, user.email ?? undefined);
		const { createAssuranceCase } = await import("@/actions/assurance-cases");
		return await createAssuranceCase(
			input as Parameters<typeof createAssuranceCase>[0]
		);
	}

	it("makes an ordinary case when no kind is sent", async () => {
		const user = await createTestUser();

		const result = await create(user, BODY);

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}
		expect((await stored(result.data.id)).theCase).toMatchObject({
			kind: "CASE",
			createdById: user.id,
		});
	});

	it.each([
		["CASE", "CASE"],
		["PATTERN", "PATTERN"],
	])("makes a case of kind %s when that kind is sent", async (kind, expected) => {
		const user = await createTestUser();

		const result = await create(user, { ...BODY, kind });

		expect(result.success).toBe(true);
		if (!result.success) {
			return;
		}
		const { theCase, elements } = await stored(result.data.id);
		expect(theCase.kind).toBe(expected);
		expect(theCase.sourcePatternId).toBeNull();
		expect(elements).toHaveLength(1);
	});

	it.each([
		["a kind that does not exist", { kind: "TEMPLATE" }],
		["a kind in lower case", { kind: "pattern" }],
		["an empty kind", { kind: "" }],
		["a null kind", { kind: null }],
		["a numeric kind", { kind: 1 }],
		["a kind as a list", { kind: ["PATTERN"] }],
		[
			"a source pattern",
			{ sourcePatternId: "30000000-0000-4000-8000-000000000001" },
		],
		["a pattern flag", { fromPattern: true }],
		["a mark-from-pattern flag", { markFromPattern: true }],
		["an owner", { createdById: "someone-else" }],
	])("refuses a body with %s and creates nothing", async (_label, extra) => {
		const user = await createTestUser();
		const before = await worldCounts();

		const result = await create(user, { ...BODY, ...extra });

		expect(result.success).toBe(false);
		expect(await worldCounts()).toEqual(before);
	});

	it("refuses a signed-out caller, whatever kind it asks for", async () => {
		await mockNoAuth();
		const { createAssuranceCase } = await import("@/actions/assurance-cases");
		const before = await worldCounts();

		const result = await createAssuranceCase({ ...BODY, kind: "PATTERN" });

		expect(result).toEqual({ success: false, error: "Invalid session" });
		expect(await worldCounts()).toEqual(before);
	});

	it("still accepts a colour profile with a kind", async () => {
		const user = await createTestUser();

		const result = await create(user, {
			...BODY,
			kind: "PATTERN",
			colourProfile: "default",
		});

		expect(result.success).toBe(true);
	});
});
