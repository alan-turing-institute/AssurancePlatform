import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	imageCopyProblems,
	publishedFileKeys,
} from "../utils/publish-race-kit";
import {
	answerOf,
	completeOpenCase,
	completeScene,
	publishingFingerprint,
	signInAs,
} from "../utils/publish-refusal-kit";
import { KINDS, type Kind } from "../utils/publish-type-kit";
import { publishCase, setStatus } from "../utils/variables-kit";

/**
 * Case information is judged on the snapshot that is written. A field an
 * editor clears after the route's own check cannot reach a published copy,
 * and a field the route let through is never newly refused.
 */

const hooks = vi.hoisted(() => ({
	afterGate: null as null | (() => Promise<void>),
}));

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/case-information-service", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("@/lib/services/case-information-service")
		>();
	return {
		...original,
		requireCaseInformationComplete: async (
			...args: Parameters<typeof original.requireCaseInformationComplete>
		) => {
			const verdict = await original.requireCaseInformationComplete(...args);
			await hooks.afterGate?.();
			return verdict;
		},
	};
});

vi.setConfig({ testTimeout: 90_000 });

const INCOMPLETE =
	"Case information is incomplete — add the missing fields before publishing";

beforeEach(async () => {
	hooks.afterGate = null;
	await mockNoAuth();
});

const FIELDS = ["description", "authors", "sector"] as const;

const ROUTES: [string, (caseId: string) => Promise<Response>][] = [
	["POST publish", publishCase],
	["PATCH status PUBLISHED", (caseId) => setStatus(caseId, "PUBLISHED")],
];

function clearAfterGate(caseId: string, data: Record<string, string | null>) {
	hooks.afterGate = async () => {
		await prisma.caseInformation.update({ where: { caseId }, data });
	};
}

const INCOMPLETE_ANSWER = {
	status: 400,
	body: { error: INCOMPLETE, code: "VALIDATION" },
};

describe("a required field cleared between the route's check and the snapshot", () => {
	describe.each(ROUTES)("%s on a draft", (_name, call) => {
		it.each(
			FIELDS
		)("answers 400 and publishes nothing when %s is emptied", async (field) => {
			const scene = await completeScene();
			await signInAs(scene.ownerId);
			const files = await publishedFileKeys();
			const before = await publishingFingerprint(scene.caseId);
			clearAfterGate(scene.caseId, { [field]: "" });

			expect(await answerOf(await call(scene.caseId))).toMatchObject(
				INCOMPLETE_ANSWER
			);

			expect(await publishingFingerprint(scene.caseId)).toEqual(before);
			expect(await imageCopyProblems(files)).toEqual([]);
			expect(await publishedFileKeys()).toEqual(files);
		});

		it("answers 400 when a field is left only whitespace", async () => {
			const scene = await completeScene();
			await signInAs(scene.ownerId);
			clearAfterGate(scene.caseId, { authors: "  \n\t " });

			expect(await answerOf(await call(scene.caseId))).toMatchObject(
				INCOMPLETE_ANSWER
			);
		});

		it("answers 400 when a field is set to null", async () => {
			const scene = await completeScene();
			await signInAs(scene.ownerId);
			clearAfterGate(scene.caseId, { sector: null });

			expect(await answerOf(await call(scene.caseId))).toMatchObject(
				INCOMPLETE_ANSWER
			);
		});

		it("answers 400 when the whole information record is deleted", async () => {
			const scene = await completeScene();
			await signInAs(scene.ownerId);
			hooks.afterGate = async () => {
				await prisma.caseInformation.delete({
					where: { caseId: scene.caseId },
				});
			};

			expect(await answerOf(await call(scene.caseId))).toMatchObject(
				INCOMPLETE_ANSWER
			);
			expect((await publishingFingerprint(scene.caseId)).rows).toEqual([]);
		});

		it("still publishes when only the optional feature image is cleared", async () => {
			const scene = await completeScene();
			await signInAs(scene.ownerId);
			clearAfterGate(scene.caseId, { featureImageUrl: null });

			const answer = await answerOf(await call(scene.caseId));

			expect(answer.status).toBe(200);
		});
	});

	it("answers 400 on Update Published and leaves the published copy as it was", async () => {
		const scene = await completeScene();
		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));
		await signInAs(scene.ownerId);
		const before = await publishingFingerprint(scene.caseId);
		const [row] = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: scene.caseId },
		});
		clearAfterGate(scene.caseId, { description: "" });

		const answer = await answerOf(await setStatus(scene.caseId, "PUBLISHED"));

		expect(answer).toMatchObject(INCOMPLETE_ANSWER);
		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
		const after = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: row?.id },
		});
		expect(after.content).toEqual(row?.content);
	});

	it("answers 400 for a first publish of an already-published case through the publish route", async () => {
		const scene = await completeScene();
		expectSuccess(await publishAssuranceCase(scene.ownerId, scene.caseId));
		await signInAs(scene.ownerId);
		const before = await publishingFingerprint(scene.caseId);
		clearAfterGate(scene.caseId, { sector: "" });

		expect(await answerOf(await publishCase(scene.caseId))).toMatchObject(
			INCOMPLETE_ANSWER
		);

		expect(await publishingFingerprint(scene.caseId)).toEqual(before);
	});
});

describe("what the route lets through, the snapshot check lets through", () => {
	describe.each(KINDS)("a %s", (kind: Kind) => {
		it.each(
			ROUTES
		)("is published by %s with padded fields and no feature image", async (_name, call) => {
			const scene = await completeOpenCase(kind);
			await prisma.caseInformation.update({
				where: { caseId: scene.caseId },
				data: {
					description: "  padded  ",
					authors: "\ta\n",
					sector: " s ",
					featureImageUrl: null,
				},
			});
			await signInAs(scene.ownerId);

			const answer = await answerOf(await call(scene.caseId));

			expect(answer.status).toBe(200);
			const rows = await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: scene.caseId, isCurrent: true },
			});
			expect(rows).toHaveLength(1);
		});

		it("is refused by the route's own gate, with the same message, when information is missing from the start", async () => {
			const scene = await completeOpenCase(kind, false);
			await signInAs(scene.ownerId);

			const answer = await answerOf(await publishCase(scene.caseId));

			expect(answer.status).toBe(400);
			expect(answer.body).toMatchObject({ error: INCOMPLETE });
		});
	});
});
