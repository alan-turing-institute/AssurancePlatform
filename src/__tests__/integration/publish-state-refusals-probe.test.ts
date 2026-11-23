import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import {
	answerOf,
	markPublishedWithoutRow,
	publishingFingerprint,
	signedInCase,
	signInAs,
	unpublishRoute,
} from "../utils/publish-refusal-kit";
import { publishCase, setStatus } from "../utils/variables-kit";

/**
 * A publish route asked for something the case's state does not allow answers
 * 409 and changes nothing. Callers who may not act, or are not signed in,
 * are answered as they always were.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
	await mockNoAuth();
});

const CONFLICT = (error: string) => ({
	status: 409,
	body: { error, code: "CONFLICT" },
});

describe("a refusal for the state the case is in", () => {
	it("answers 409 when a draft is unpublished", async () => {
		const scene = await signedInCase();
		const before = await publishingFingerprint(scene.caseId);

		const answer = await answerOf(await unpublishRoute(scene.caseId));

		expect(answer).toEqual(CONFLICT("Case is not published"));
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});

	it("answers 409 when a draft is moved to draft", async () => {
		const scene = await signedInCase();
		const before = await publishingFingerprint(scene.caseId);

		const answer = await answerOf(await setStatus(scene.caseId, "DRAFT"));

		expect(answer).toEqual(
			CONFLICT("Invalid status transition: DRAFT to DRAFT")
		);
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});

	it("answers 409 when Update Published finds a published case with no current row", async () => {
		const scene = await signedInCase();
		await markPublishedWithoutRow(scene.caseId);
		const before = await publishingFingerprint(scene.caseId);

		const answer = await answerOf(await setStatus(scene.caseId, "PUBLISHED"));

		expect(answer).toEqual(CONFLICT("No published version found"));
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});

	it("answers 409 when a draft is unpublished a second time", async () => {
		const scene = await signedInCase();
		expect((await publishCase(scene.caseId)).status).toBe(200);
		expect((await unpublishRoute(scene.caseId)).status).toBe(200);

		const answer = await answerOf(await unpublishRoute(scene.caseId));

		expect(answer).toEqual(CONFLICT("Case is not published"));
	});
});

describe("callers who may not act on the case", () => {
	it("is told 403 Permission denied by a signed-in stranger, whatever the state", async () => {
		const scene = await signedInCase();
		const stranger = await createTestUser();
		await signInAs(stranger.id);

		const answers = [
			await answerOf(await unpublishRoute(scene.caseId)),
			await answerOf(await setStatus(scene.caseId, "DRAFT")),
			await answerOf(await setStatus(scene.caseId, "PUBLISHED")),
			await answerOf(await publishCase(scene.caseId)),
		];

		for (const answer of answers) {
			expect(answer.status).toBe(403);
			expect(answer.body).toMatchObject({ code: "FORBIDDEN" });
		}
	});

	it("is told 403 by a view-only member for unpublish and publish", async () => {
		const scene = await signedInCase();
		const viewer = await createTestUser();
		await createTestPermission(scene.caseId, viewer.id, scene.ownerId, "VIEW");
		await signInAs(viewer.id);

		const answers = [
			await answerOf(await unpublishRoute(scene.caseId)),
			await answerOf(await publishCase(scene.caseId)),
			await answerOf(await setStatus(scene.caseId, "PUBLISHED")),
		];

		for (const answer of answers) {
			expect(answer.status).toBe(403);
			expect(answer.body).toMatchObject({ code: "FORBIDDEN" });
		}
	});

	it("is told 403 by a view-only member who asks to unpublish a published case", async () => {
		const scene = await signedInCase();
		expect((await publishCase(scene.caseId)).status).toBe(200);
		const viewer = await createTestUser();
		await createTestPermission(scene.caseId, viewer.id, scene.ownerId, "VIEW");
		const before = await publishingFingerprint(scene.caseId);
		await signInAs(viewer.id);

		const answers = [
			await answerOf(await setStatus(scene.caseId, "DRAFT")),
			await answerOf(await setStatus(scene.caseId, "PUBLISHED")),
			await answerOf(await unpublishRoute(scene.caseId)),
		];

		for (const answer of answers) {
			expect(answer.status).toBe(403);
		}
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});

	it("never succeeds for a view-only member who asks for a draft to become a draft", async () => {
		const scene = await signedInCase();
		const viewer = await createTestUser();
		await createTestPermission(scene.caseId, viewer.id, scene.ownerId, "VIEW");
		const before = await publishingFingerprint(scene.caseId);
		await signInAs(viewer.id);

		const answer = await answerOf(await setStatus(scene.caseId, "DRAFT"));

		expect(answer.status).toBeGreaterThanOrEqual(400);
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});

	it("is told 403 for a case that does not exist", async () => {
		const scene = await signedInCase();
		const missing = "00000000-0000-4000-8000-000000000000";
		expect(scene.caseId).not.toBe(missing);

		const answers = [
			await answerOf(await unpublishRoute(missing)),
			await answerOf(await setStatus(missing, "DRAFT")),
		];

		for (const answer of answers) {
			expect(answer.status).toBe(403);
		}
	});

	it("is told 401 when signed out", async () => {
		const scene = await signedInCase();
		await mockNoAuth();

		const answers = [
			await answerOf(await unpublishRoute(scene.caseId)),
			await answerOf(await setStatus(scene.caseId, "DRAFT")),
			await answerOf(await publishCase(scene.caseId)),
		];

		for (const answer of answers) {
			expect(answer.status).toBe(401);
			expect(answer.body).toMatchObject({ code: "UNAUTHORISED" });
		}
	});
});
