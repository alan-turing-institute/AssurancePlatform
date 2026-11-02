import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateCaseWithPrisma } from "@/lib/services/case-fetch-service";
import { convertCaseKind } from "@/lib/services/case-kind-service";
import { restoreCase, softDeleteCase } from "@/lib/services/case-trash-service";
import { resetIdentifiers } from "@/lib/services/identifier-service";
import {
	publishAssuranceCase,
	unpublishAssuranceCase,
} from "@/lib/services/publish-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createRichCase,
	storedKind,
	tapCaseEvents,
} from "../utils/case-kind-convert-kit";
import { importOk, richNestedFile } from "../utils/case-kind-kit";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Converting is the only way to change a case's kind. The ordinary update
 * route is open to anyone with EDIT, so it and the batch route refuse a kind;
 * and the other things that rewrite a case's row (renaming, editing elements,
 * publishing, trashing, renumbering) leave the kind where it was.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const KINDS = ["CASE", "PATTERN"] as const;
const LEVELS = ["EDIT", "ADMIN"] as const;

async function putCase(
	user: { email: string; id: string; username: string },
	caseId: string,
	body: unknown
) {
	await mockAuth(user.id, user.username, user.email);
	const { PUT } = await import("@/app/api/cases/[id]/route");
	return PUT(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function postBatch(
	user: { email: string; id: string; username: string },
	caseId: string,
	body: unknown
) {
	await mockAuth(user.id, user.username, user.email);
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

describe.each(KINDS)("the update route on a %s", (from) => {
	const to = from === "CASE" ? "PATTERN" : "CASE";

	it.each(
		LEVELS
	)("refuses a kind from someone with %s, with or without other changes, and changes nothing", async (level) => {
		const rich = await createRichCase(from);
		const user = await createTestUser();
		await createTestPermission(rich.caseId, user.id, rich.ownerId, level);
		const tap = tapCaseEvents(rich.caseId);
		const before = await storedKind(rich.caseId);

		const bodies = [
			{ kind: to },
			{ kind: from },
			{ name: "Renamed", kind: to },
			{ description: "Changed", kind: to },
			{ kind: { set: to } },
			{ Kind: to },
			{ "kind ": to },
		];
		for (const body of bodies) {
			const response = await putCase(user, rich.caseId, body);
			expect(response.status).toBe(400);
		}
		tap.stop();

		const after = await storedKind(rich.caseId);
		expect(after).toEqual(before);
		expect(tap.events()).toEqual([]);
		const stored = await import("@/lib/prisma").then(({ default: prisma }) =>
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: rich.caseId } })
		);
		expect(stored.name).not.toBe("Renamed");
		expect(stored.description).not.toBe("Changed");
	});

	it("keeps the kind through an ordinary update of every field it accepts", async () => {
		const rich = await createRichCase(from);

		const response = await putCase(rich.owner, rich.caseId, {
			name: "Renamed",
			description: "Changed",
			colourProfile: "default",
			layoutDirection: "LR",
		});

		expect(response.status).toBe(200);
		expect((await response.json()).kind).toBe(from);
		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});

	it("does not write a kind that is forced past the route into the service", async () => {
		const rich = await createRichCase(from);
		const user = await createTestUser();
		await createTestPermission(rich.caseId, user.id, rich.ownerId, "EDIT");

		const result = await updateCaseWithPrisma(rich.caseId, user.id, {
			name: "Renamed",
			kind: to,
		} as never);

		expect(result).toHaveProperty("data");
		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});
});

describe.each(KINDS)("the batch route on a %s", (from) => {
	const to = from === "CASE" ? "PATTERN" : "CASE";

	async function anElementOf(caseId: string) {
		const { default: prisma } = await import("@/lib/prisma");
		return prisma.assuranceElement.findFirstOrThrow({
			where: { caseId, deletedAt: null, elementType: "STRATEGY" },
		});
	}

	it.each(
		LEVELS
	)("refuses a kind sent with the changes by someone with %s, and changes nothing", async (level) => {
		const rich = await createRichCase(from);
		const user = await createTestUser();
		await createTestPermission(rich.caseId, user.id, rich.ownerId, level);
		const element = await anElementOf(rich.caseId);
		const change = {
			type: "update",
			elementId: element.id,
			data: { description: "Changed by the batch" },
		};
		const { default: prisma } = await import("@/lib/prisma");
		const descriptionNow = async () =>
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: element.id },
				})
			).description;
		const bodies = [
			{ changes: [change], kind: to },
			{ changes: [change], case: { kind: to } },
			{
				changes: [{ ...change, data: { ...change.data, kind: to } }],
			},
		];

		for (const body of bodies) {
			const response = await postBatch(user, rich.caseId, body);
			expect(response.status).toBe(400);
		}

		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(await descriptionNow()).toBe(element.description);

		// The same change without a kind is accepted, so the refusals above
		// were about the kind and nothing else.
		const accepted = await postBatch(user, rich.caseId, { changes: [change] });
		expect(accepted.status).toBe(200);
		expect(await descriptionNow()).toBe("Changed by the batch");
		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});

	it("keeps the kind through a batch that is accepted", async () => {
		const rich = await createRichCase(from);
		const element = await anElementOf(rich.caseId);

		const response = await postBatch(rich.owner, rich.caseId, {
			changes: [
				{
					type: "update",
					elementId: element.id,
					data: { description: "Changed by the batch" },
				},
			],
		});

		expect(response.status).toBe(200);
		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});
});

describe.each(KINDS)("other operations on a %s", (from) => {
	it("keep the kind through publishing and unpublishing", async () => {
		const rich = await createRichCase(from);

		expect(
			await publishAssuranceCase(rich.ownerId, rich.caseId)
		).toHaveProperty("data");
		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(
			await unpublishAssuranceCase(rich.ownerId, rich.caseId)
		).toHaveProperty("data");

		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});

	it("keep the kind through trashing with an archived copy and restoring", async () => {
		const rich = await createRichCase(from);
		await publishAssuranceCase(rich.ownerId, rich.caseId);

		expect(
			await softDeleteCase(rich.ownerId, rich.caseId, {
				publishedCopy: "archive",
			})
		).toEqual({ data: true });
		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect(await restoreCase(rich.ownerId, rich.caseId)).toEqual({
			data: true,
		});

		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});

	it("keep the kind through renumbering the identifiers", async () => {
		const rich = await createRichCase(from);

		expect(await resetIdentifiers(rich.caseId, rich.ownerId)).toEqual({
			data: null,
		});

		expect((await storedKind(rich.caseId)).kind).toBe(from);
	});

	it("keep every existing case's kind when a pattern file or a case file is imported", async () => {
		const rich = await createRichCase(from);
		const other = await createTestCase(rich.ownerId, {
			kind: from === "CASE" ? "PATTERN" : "CASE",
		});
		await importOk(
			rich.ownerId,
			richNestedFile({ version: "1.1", caseFields: { kind: "PATTERN" } })
		);
		await importOk(rich.ownerId, richNestedFile());

		expect((await storedKind(rich.caseId)).kind).toBe(from);
		expect((await storedKind(other.id)).kind).toBe(
			from === "CASE" ? "PATTERN" : "CASE"
		);
	});
});

describe("the JSON editor's saved version", () => {
	it("is out of date after a conversion, so a stale save is refused instead of applied", async () => {
		const rich = await createRichCase("CASE");
		const { default: prisma } = await import("@/lib/prisma");
		const element = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: rich.caseId, deletedAt: null, elementType: "STRATEGY" },
		});
		const versionWhenOpened = (await storedKind(rich.caseId)).updatedAt;

		expect(await convertCaseKind(rich.ownerId, rich.caseId, "PATTERN")).toEqual(
			{ data: { kind: "PATTERN" } }
		);
		const response = await postBatch(rich.owner, rich.caseId, {
			expectedVersion: versionWhenOpened.toISOString(),
			changes: [
				{
					type: "update",
					elementId: element.id,
					data: { description: "Changed from a stale editor" },
				},
			],
		});

		expect(response.status).toBe(409);
		expect(
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id: element.id },
				})
			).description
		).toBe(element.description);
	});
});
