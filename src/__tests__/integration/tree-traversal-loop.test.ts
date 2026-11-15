import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	findParentLoopStart,
	getDeletedDescendantIds,
	getDescendantIds,
	getDescendantIdsForRoots,
} from "@/lib/utils/tree-traversal";
import { captureLogs } from "../helpers/capture-logs";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Walks down the element tree must end on a stored parent loop, return each
 * element once, and leave requests that touch a loop able to finish. Each test
 * has a short timeout so a walk that never ends fails the test instead of
 * hanging the run.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

const TIMEOUT = 10_000;

/** Claims A and B are each other's parent; C sits under B. */
async function buildLoop() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const a = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
	});
	const b = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: a.id,
	});
	const c = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P3",
		parentId: b.id,
	});
	await prisma.assuranceElement.update({
		where: { id: a.id },
		data: { parentId: b.id },
	});
	return { owner, testCase, a, b, c };
}

const sorted = (ids: Iterable<string>) => [...ids].sort();

describe("walks down the element tree on a stored parent loop", () => {
	it(
		"getDescendantIds returns each element once and not the start",
		async () => {
			const { a, b, c } = await buildLoop();
			const logs = captureLogs();
			try {
				const ids = await getDescendantIds(a.id);
				expect(sorted(ids)).toEqual(sorted([b.id, c.id]));
				expect(
					logs.entries.some((entry) => entry.msg === "Element tree loop met")
				).toBe(true);
			} finally {
				logs.restore();
			}
		},
		TIMEOUT
	);

	it(
		"getDescendantIdsForRoots ends with and without deleted elements",
		async () => {
			const { a, b, c } = await buildLoop();
			for (const includeDeleted of [false, true]) {
				const result = await getDescendantIdsForRoots([a.id], undefined, {
					includeDeleted,
				});
				expect(sorted(result.get(a.id) ?? [])).toEqual(sorted([b.id, c.id]));
			}
		},
		TIMEOUT
	);

	it(
		"getDeletedDescendantIds ends on a binned loop",
		async () => {
			const { a, b, c } = await buildLoop();
			await prisma.assuranceElement.updateMany({
				where: { id: { in: [a.id, b.id, c.id] } },
				data: { deletedAt: new Date() },
			});
			const ids = await getDeletedDescendantIds(a.id);
			expect(sorted(ids)).toEqual(sorted([b.id, c.id]));
		},
		TIMEOUT
	);

	it(
		"deleting an element in the loop finishes and bins the whole loop",
		async () => {
			const { owner, a, b, c } = await buildLoop();
			await mockAuth(owner.id, owner.username, owner.email);
			const { DELETE } = await import("@/app/api/elements/[id]/route");
			const response = await DELETE(
				new NextRequest(`http://localhost:3000/api/elements/${a.id}`, {
					method: "DELETE",
				}),
				{ params: Promise.resolve({ id: a.id }) }
			);
			expect(response.status).toBe(200);
			const rows = await prisma.assuranceElement.findMany({
				where: { id: { in: [a.id, b.id, c.id] } },
				select: { deletedAt: true },
			});
			expect(rows.every((row) => row.deletedAt !== null)).toBe(true);
		},
		TIMEOUT
	);

	it(
		"detaching an element in the loop finishes",
		async () => {
			const { owner, a } = await buildLoop();
			await mockAuth(owner.id, owner.username, owner.email);
			const { POST } = await import("@/app/api/elements/[id]/detach/route");
			const response = await POST(
				new NextRequest(`http://localhost:3000/api/elements/${a.id}/detach`, {
					method: "POST",
				}),
				{ params: Promise.resolve({ id: a.id }) }
			);
			expect(response.status).toBe(200);
		},
		TIMEOUT
	);

	it(
		"findParentLoopStart names a start on a loop and not one beneath it",
		async () => {
			const { a, c } = await buildLoop();
			await prisma.$transaction(async (tx) => {
				expect(await findParentLoopStart([a.id], tx)).toBe(a.id);
				expect(await findParentLoopStart([c.id], tx)).toBeUndefined();
			});
		},
		TIMEOUT
	);
});
