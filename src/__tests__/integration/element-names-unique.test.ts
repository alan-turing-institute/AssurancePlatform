import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * The names TEA generates stay unique across a case: a deleted element's name
 * counts as taken (so a restore never meets a repeat), the dotted namers skip
 * names the other branch already used, two renames in one batch differ, and
 * restoring an element whose name was typed again meanwhile renames it.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const RENAMED_EVIDENCE = /^E(?!1$)\d+$/;

beforeEach(async () => {
	await mockNoAuth();
});

async function postElement(caseId: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function deleteViaRoute(id: string) {
	const { DELETE } = await import("@/app/api/elements/[id]/route");
	return DELETE(
		new NextRequest(`http://localhost:3000/api/elements/${id}`, {
			method: "DELETE",
		}),
		{ params: Promise.resolve({ id }) }
	);
}

async function restoreViaRoute(id: string) {
	const { POST } = await import("@/app/api/elements/[id]/restore/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/elements/${id}/restore`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ id }) }
	);
}

async function postBatch(caseId: string, changes: unknown[]) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
			method: "POST",
			body: JSON.stringify({ changes }),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function setUp() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, caseId: testCase.id, goal };
}

async function createdName(caseId: string, body: Record<string, unknown>) {
	const response = await postElement(caseId, body);
	if (response.status !== 201) {
		throw new Error(`create answered ${response.status}`);
	}
	return (await response.json()).name as string;
}

async function liveNames(caseId: string) {
	const rows = await prisma.assuranceElement.findMany({
		where: { caseId, deletedAt: null, name: { not: null } },
		select: { name: true },
	});
	return rows.map((row) => row.name);
}

describe("flat names after a deletion", () => {
	it.each([
		{ type: "EVIDENCE", prefix: "E" },
		{ type: "STRATEGY", prefix: "S" },
	])("never reuses a deleted $type's number", async ({ type, prefix }) => {
		const { owner, caseId, goal } = await setUp();
		const made: { id: string }[] = [];
		for (const n of [1, 2, 3]) {
			made.push(
				await createTestElement(caseId, owner.id, {
					elementType: type as "EVIDENCE" | "STRATEGY",
					name: `${prefix}${n}`,
					parentId: type === "STRATEGY" ? goal.id : undefined,
				})
			);
		}
		const middle = made[1];
		expect((await deleteViaRoute(middle?.id ?? "")).status).toBe(200);

		const name = await createdName(caseId, {
			elementType: type,
			description: "next",
			parentId: type === "STRATEGY" ? goal.id : undefined,
		});

		expect(name).toBe(`${prefix}4`);
		const names = await liveNames(caseId);
		expect(new Set(names).size).toBe(names.length);
	});
});

describe("dotted names", () => {
	async function claimWithChildren() {
		const ctx = await setUp();
		const claim = await createTestElement(ctx.caseId, ctx.owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: ctx.goal.id,
		});
		return { ...ctx, claim };
	}

	it("does not repeat P1.3 after P1.2 is deleted", async () => {
		const { owner, caseId, claim } = await claimWithChildren();
		const children: { id: string }[] = [];
		for (const n of [1, 2, 3]) {
			children.push(
				await createTestElement(caseId, owner.id, {
					elementType: "PROPERTY_CLAIM",
					name: `P1.${n}`,
					parentId: claim.id,
				})
			);
		}
		expect((await deleteViaRoute(children[1]?.id ?? "")).status).toBe(200);

		const name = await createdName(caseId, {
			elementType: "PROPERTY_CLAIM",
			description: "next",
			parentId: claim.id,
		});

		expect(name).toBe("P1.4");
	});

	it("does not give a direct child and a child through a strategy the same name", async () => {
		const { owner, caseId, claim } = await claimWithChildren();
		const strategy = await createTestElement(caseId, owner.id, {
			elementType: "STRATEGY",
			name: "S1",
			parentId: claim.id,
		});
		await createTestElement(caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1.1",
			parentId: strategy.id,
		});

		const name = await createdName(caseId, {
			elementType: "PROPERTY_CLAIM",
			description: "direct child",
			parentId: claim.id,
		});

		expect(name).toBe("P1.2");
	});

	it("names a child of a defeater without repeating a binned name", async () => {
		const { owner, caseId, claim } = await claimWithChildren();
		const defeater = await createTestElement(caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "CP1",
			parentId: claim.id,
			isDefeater: true,
			defeatsElementId: claim.id,
		});
		const binned = await createTestElement(caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "CP1.1",
			parentId: defeater.id,
			isDefeater: true,
			defeatsElementId: defeater.id,
		});
		await prisma.assuranceElement.update({
			where: { id: binned.id },
			data: { deletedAt: new Date() },
		});

		const name = await createdName(caseId, {
			elementType: "PROPERTY_CLAIM",
			description: "counter to the counter",
			parentId: defeater.id,
			isDefeater: true,
			defeatsElementId: defeater.id,
		});

		expect(name).toBe("CP1.2");
	});
});

describe("restoring an element", () => {
	it("renames it when a live element took its name while it was deleted", async () => {
		const { owner, caseId } = await setUp();
		const evidence = await createTestElement(caseId, owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});
		expect((await deleteViaRoute(evidence.id)).status).toBe(200);
		// A typed name is allowed to repeat one in the bin.
		const typed = await createdName(caseId, {
			elementType: "EVIDENCE",
			name: "E1",
			description: "typed again",
		});
		expect(typed).toBe("E1");

		expect((await restoreViaRoute(evidence.id)).status).toBe(200);

		const names = await liveNames(caseId);
		expect(new Set(names).size).toBe(names.length);
		const restored = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(restored?.deletedAt).toBeNull();
		expect(restored?.name).toMatch(RENAMED_EVIDENCE);
	});

	it("renames a grandchild after its nearest renamed ancestor, not a further one", async () => {
		const { owner, caseId, goal } = await setUp();
		const claim = (name: string, parentId: string) =>
			createTestElement(caseId, owner.id, {
				elementType: "PROPERTY_CLAIM",
				name,
				parentId,
			});
		const p1 = await claim("P1", goal.id);
		await claim("P1.1", p1.id);
		const p12 = await claim("P1.2", p1.id);
		const child = await claim("P1.2.1", p12.id);
		const grandchild = await claim("P1.2.1.1", child.id);
		await claim("P1.3", p1.id);
		expect((await deleteViaRoute(p12.id)).status).toBe(200);
		// Typed names may repeat one in the bin: P1.2 is taken again, and so is
		// the first child name under the name the restored claim is given.
		await claim("P1.2", p1.id);
		await claim("P1.6.1", p1.id);

		expect((await restoreViaRoute(p12.id)).status).toBe(200);

		const nameOf = async (id: string) =>
			(
				await prisma.assuranceElement.findUniqueOrThrow({
					where: { id },
					select: { name: true },
				})
			).name;
		const childName = await nameOf(child.id);
		expect(await nameOf(p12.id)).toBe("P1.6");
		expect(childName).not.toBe("P1.6.1");
		expect(await nameOf(grandchild.id)).toBe(`${childName}.1`);
	});

	it("leaves a name nobody else holds as it was", async () => {
		const { owner, caseId } = await setUp();
		const evidence = await createTestElement(caseId, owner.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});
		expect((await deleteViaRoute(evidence.id)).status).toBe(200);

		expect((await restoreViaRoute(evidence.id)).status).toBe(200);

		const restored = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(restored?.name).toBe("E1");
	});
});

describe("renames in one batch", () => {
	it("gives two claims turned into defeaters different names", async () => {
		const { owner, caseId, goal } = await setUp();
		const first = await createTestElement(caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: goal.id,
		});
		const second = await createTestElement(caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P2",
			parentId: goal.id,
		});

		const response = await postBatch(caseId, [
			{ type: "update", elementId: first.id, data: { isDefeater: true } },
			{ type: "update", elementId: second.id, data: { isDefeater: true } },
		]);

		expect(response.status).toBe(200);
		const rows = await prisma.assuranceElement.findMany({
			where: { id: { in: [first.id, second.id] } },
			select: { name: true },
		});
		expect(new Set(rows.map((row) => row.name)).size).toBe(2);
	});
});

describe("concurrent creates", () => {
	it("give every new element a different name", async () => {
		const { caseId } = await setUp();

		const responses = await Promise.all(
			[1, 2, 3, 4].map(() =>
				postElement(caseId, { elementType: "EVIDENCE", description: "e" })
			)
		);

		expect(responses.map((response) => response.status)).toEqual([
			201, 201, 201, 201,
		]);
		const names = (await liveNames(caseId)).filter((name) =>
			name?.startsWith("E")
		);
		expect(names.sort()).toEqual(["E1", "E2", "E3", "E4"]);
	});
});
