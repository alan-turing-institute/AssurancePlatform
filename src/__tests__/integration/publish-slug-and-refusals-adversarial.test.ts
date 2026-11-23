import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { Prisma } from "@/src/generated/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";
import { holdCaseRow, publishedRows } from "../utils/publish-type-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";
import { publishCase, setStatus } from "../utils/variables-kit";

/**
 * Publish and status routes where two writers meet on a slug, where case
 * information changes between the route's check and the snapshot, and where a
 * refusal that is the caller's state to correct must not answer 500.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/lib/services/sse-connection-manager")
	>()),
	emitSSEEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.setConfig({ testTimeout: 90_000 });

beforeEach(async () => {
	await mockNoAuth();
});

const WAIT_MS = 20_000;
const INCOMPLETE =
	"Case information is incomplete — add the missing fields before publishing";

interface Scene {
	caseId: string;
	ownerId: string;
}

/** A named case with a top goal and complete information, owned by a new user who is signed in. */
async function openNamedCase(
	name: string,
	options: { withInformation?: boolean; published?: boolean } = {}
): Promise<Scene> {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, {
		name,
		...(options.published && { published: true, publishStatus: "PUBLISHED" }),
	});
	await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		role: "TOP_LEVEL",
	});
	if (options.withInformation !== false) {
		await createTestCaseInformation(testCase.id);
	}
	await mockAuth(owner.id, owner.username, owner.email);
	return { caseId: testCase.id, ownerId: owner.id };
}

async function unpublishRoute(caseId: string) {
	const { DELETE } = await import("@/app/api/cases/[id]/publish/route");
	return await DELETE(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/publish`, {
			method: "DELETE",
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function currentRows(caseId: string) {
	return (await publishedRows(caseId)).filter((row) => row.isCurrent);
}

describe("two first publishes of different cases with the same name", () => {
	it("gives the second the next free slug instead of a server error", async () => {
		const first = await openNamedCase("Same name");
		const second = await openNamedCase("Same name");
		const holder = await holdRowLock(async (tx) => {
			await tx.publishedAssuranceCase.create({
				data: {
					type: "ASSURANCE_CASE",
					title: "Same name",
					slug: "same-name",
					content: {},
					assuranceCaseId: first.caseId,
				},
			});
		});

		const publishing = publishCase(second.caseId);
		await waitForLockWait(WAIT_MS, 1);
		await holder.release();
		const response = await publishing;

		expect(response.status).toBe(200);
		const rows = await currentRows(second.caseId);
		expect(rows.map((row) => row.slug)).toEqual(["same-name-2"]);
	});

	it("answers a 409 asking to try again when three attempts all collide", async () => {
		const scene = await openNamedCase("Busy name");
		// Every transaction the publish opens fails as the slug index would fail
		// it, as three rival first publishes in a row would make it.
		const collision = new Prisma.PrismaClientKnownRequestError(
			"Unique constraint failed on the fields: (`slug`)",
			{ code: "P2002", clientVersion: "test" }
		);
		const transaction = vi
			.spyOn(prisma, "$transaction")
			.mockRejectedValue(collision);

		const response = await publishCase(scene.caseId);
		const attempts = transaction.mock.calls.length;
		transaction.mockRestore();

		expect(attempts).toBe(3);
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: "The case changed while it was being published. Try again.",
			code: "CONFLICT",
		});
		expect(await publishedRows(scene.caseId)).toEqual([]);
	});
});

describe("a first publish of a case that is already published", () => {
	it("keeps the slug and leaves one current row, however often it is called", async () => {
		const scene = await openNamedCase("Keep my slug");

		const first = await publishCase(scene.caseId);
		const [firstRow] = await currentRows(scene.caseId);
		const second = await publishCase(scene.caseId);
		const afterSecond = await currentRows(scene.caseId);
		const third = await publishCase(scene.caseId);

		expect([first.status, second.status, third.status]).toEqual([
			200, 200, 200,
		]);
		expect(afterSecond.map((row) => row.slug)).toEqual(["keep-my-slug"]);
		const rows = await currentRows(scene.caseId);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.slug).toBe(firstRow?.slug);
		expect(rows[0]?.slug).toBe("keep-my-slug");
		const all = await publishedRows(scene.caseId);
		expect(new Set(all.map((row) => row.slug))).toEqual(
			new Set(["keep-my-slug"])
		);
	});

	it("leaves one current row and one slug when two first publishes queue behind the case row", async () => {
		const scene = await openNamedCase("Queued twice");
		const holder = await holdCaseRow(scene.caseId);

		const one = publishCase(scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		const two = publishCase(scene.caseId);
		await waitForLockWait(WAIT_MS, 2);
		await holder.rollback();
		const responses = await Promise.all([one, two]);

		expect(responses.map((response) => response.status)).toEqual([200, 200]);
		const rows = await currentRows(scene.caseId);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.slug).toBe("queued-twice");
		const all = await publishedRows(scene.caseId);
		expect(new Set(all.map((row) => row.slug))).toEqual(
			new Set(["queued-twice"])
		);
	});
});

describe("case information cleared between the route's check and the snapshot", () => {
	it("refuses the publish with a 400 and writes no published row", async () => {
		const scene = await openNamedCase("Clearing authors");
		// The holder blocks the export's read of the elements, and clears the
		// authors when it commits. The route's own check has already read the
		// complete record by then.
		const holder = await holdRowLock(async (tx) => {
			await tx.$executeRaw`LOCK TABLE assurance_elements IN ACCESS EXCLUSIVE MODE`;
			await tx.caseInformation.update({
				where: { caseId: scene.caseId },
				data: { authors: null },
			});
		});

		const publishing = publishCase(scene.caseId);
		await waitForLockWait(WAIT_MS, 1);
		await holder.release();
		const response = await publishing;

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toMatchObject({
			error: INCOMPLETE,
			code: "VALIDATION",
		});
		// The route's own gate names the missing fields; the snapshot check does not.
		expect(body).not.toHaveProperty("fieldErrors");
		expect(await publishedRows(scene.caseId)).toEqual([]);
		const stored = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: scene.caseId },
		});
		expect(stored.published).toBe(false);
	});
});

describe("refusals that name the state the case is in", () => {
	it("answers an unpublish of a draft with 409 and changes nothing", async () => {
		const scene = await openNamedCase("A draft");

		const response = await unpublishRoute(scene.caseId);

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: "Case is not published",
			code: "CONFLICT",
		});
		expect(await publishedRows(scene.caseId)).toEqual([]);
	});

	it("answers a move from draft to draft with 409 and changes nothing", async () => {
		const scene = await openNamedCase("A draft too");

		const response = await setStatus(scene.caseId, "DRAFT");

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: "Invalid status transition: DRAFT to DRAFT",
			code: "CONFLICT",
		});
		expect(await publishedRows(scene.caseId)).toEqual([]);
	});

	it("answers an update of a case marked published with no current row with 409", async () => {
		const scene = await openNamedCase("Marked only", { published: true });

		const response = await setStatus(scene.caseId, "PUBLISHED");

		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({
			error: "No published version found",
			code: "CONFLICT",
		});
		expect(await publishedRows(scene.caseId)).toEqual([]);
	});
});
