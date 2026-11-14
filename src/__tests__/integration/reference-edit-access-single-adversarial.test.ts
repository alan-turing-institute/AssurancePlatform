import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import { createTestElement } from "../utils/prisma-factories";
import {
	type Answer,
	countNaming,
	createBody,
	distinctAnswers,
	elementIn,
	errorText,
	hiddenCaseWithElement,
	MALFORMED_IDS,
	makeWorld,
	postElement,
	putElement,
	REF_KINDS,
	referencesOfElement,
	snapshot,
	storeReference,
	UNVIEWABLE_TARGETS,
	VIEWABLE_TARGETS,
	viewableCaseWithElement,
} from "../utils/reference-edit-access-kit";

/**
 * Creating and editing one away goal or module through the element routes:
 * the editor may point it at a case only when they can view that case, and a
 * case they can not view gets the one answer, whatever the reason (no access,
 * a revoked share, a team they left, the bin, a purged case, an id nothing
 * ever had). A refused request writes nothing.
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

describe.each(
	REF_KINDS
)("POST /api/cases/[id]/elements: a %s pointing at a case", (kind) => {
	it.each(VIEWABLE_TARGETS)("is created when it points at $label", async ({
		make,
	}) => {
		const world = await makeWorld();
		const target = await make(world);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody(kind, target)
		);

		expect(answer.status).toBe(201);
		const stored = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: world.homeCaseId, elementType: kind },
		});
		expect(stored.moduleReferenceId).toBe(target);
	});

	it.each(
		UNVIEWABLE_TARGETS
	)("is refused, and nothing is written, when it points at $label", async ({
		make,
	}) => {
		const world = await makeWorld();
		const target = await make(world);
		const before = await snapshot(world.homeCaseId);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody(kind, target)
		);

		expect(answer.status).toBe(400);
		expect(errorText(answer)).not.toContain(target);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(target)).toBe(0);
	});

	it("answers the same, in status and in full body, for every case the editor can not view", async () => {
		const world = await makeWorld();
		const answers: Answer[] = [];

		for (const target of UNVIEWABLE_TARGETS) {
			const id = await target.make(world);
			answers.push(
				await postElement(world.editor, world.homeCaseId, createBody(kind, id))
			);
		}

		expect(answers.length).toBeGreaterThan(1);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
	});

	it("is refused when another element of the case already names the hidden case", async () => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		await storeReference(world, kind, hidden.id, { name: `${kind[0]}7` });
		const before = await snapshot(world.homeCaseId);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody(kind, hidden.id)
		);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it.each(
		MALFORMED_IDS
	)("is refused as a bad request, and nothing is written, for the id %j", async (id) => {
		const world = await makeWorld();
		const before = await snapshot(world.homeCaseId);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody(kind, id)
		);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("is refused for someone with no write access to the home case, whatever the target", async () => {
		const world = await makeWorld();
		const target = await createStoredCase(world.editor.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postElement(
			world.stranger,
			world.homeCaseId,
			createBody(kind, target.id)
		);

		expect(answer.status).not.toBe(201);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});
});

describe("POST /api/cases/[id]/elements: other spellings of the element type", () => {
	it.each([
		"away_goal",
		"AWAY_GOAL",
		"Away_Goal",
		"away goal",
		"awaygoal",
		"module",
		"MODULE",
		"Module",
	])("never leaves an element of type %j naming a hidden case", async (type) => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		await postElement(
			world.editor,
			world.homeCaseId,
			createBody("AWAY_GOAL", hidden.id, {
				type,
				...(type.toLowerCase().startsWith("mod")
					? { moduleEmbedType: "COPY" }
					: {}),
			})
		);

		expect(await countNaming(hidden.id)).toBe(0);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});
});

describe("POST /api/cases/[id]/elements: an away goal citing an element", () => {
	it("is created with a citation inside a case the editor can view", async () => {
		const world = await makeWorld();
		const cited = await viewableCaseWithElement(world);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody("AWAY_GOAL", cited.caseId, { citedElementId: cited.elementId })
		);

		expect(answer.status).toBe(201);
		const stored = await prisma.assuranceElement.findFirstOrThrow({
			where: { caseId: world.homeCaseId, elementType: "AWAY_GOAL" },
		});
		expect(stored.moduleReferenceId).toBe(cited.caseId);
		expect(stored.citedElementId).toBe(cited.elementId);
	});

	it("is refused, and nothing is written, when the reference and the cited element are both in a hidden case", async () => {
		const world = await makeWorld();
		const hidden = await hiddenCaseWithElement(world);
		const before = await snapshot(world.homeCaseId);

		const answer = await postElement(
			world.editor,
			world.homeCaseId,
			createBody("AWAY_GOAL", hidden.caseId, {
				citedElementId: hidden.elementId,
			})
		);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(hidden.caseId)).toBe(0);
	});

	it("gives a hidden case's element the same answer as a case and an element that do not exist", async () => {
		const world = await makeWorld();
		const hidden = await hiddenCaseWithElement(world);

		const probeHidden = await postElement(
			world.editor,
			world.homeCaseId,
			createBody("AWAY_GOAL", hidden.caseId, {
				citedElementId: hidden.elementId,
			})
		);
		const probeMissing = await postElement(
			world.editor,
			world.homeCaseId,
			createBody("AWAY_GOAL", randomUUID(), { citedElementId: randomUUID() })
		);

		expect(probeHidden).toEqual(probeMissing);
	});

	it("gives an element in a hidden case, a viewable case's other case, a trashed case and no case at all one answer", async () => {
		const world = await makeWorld();
		const reference = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const otherViewable = await viewableCaseWithElement(world);
		const trashed = await viewableCaseWithElement(world);
		await prisma.assuranceCase.update({
			where: { id: trashed.caseId },
			data: { deletedAt: new Date() },
		});
		const removed = await createTestElement(reference.caseId, world.editor.id, {
			elementType: "GOAL",
			name: "G2",
		});
		await prisma.assuranceElement.update({
			where: { id: removed.id },
			data: { deletedAt: new Date() },
		});

		const answers: Answer[] = [];
		for (const citedElementId of [
			randomUUID(),
			hidden.elementId,
			otherViewable.elementId,
			trashed.elementId,
			removed.id,
		]) {
			answers.push(
				await postElement(
					world.editor,
					world.homeCaseId,
					createBody("AWAY_GOAL", reference.caseId, { citedElementId })
				)
			);
		}

		expect(answers.length).toBeGreaterThan(1);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: world.homeCaseId, elementType: "AWAY_GOAL" },
			})
		).toBe(0);
	});
});

describe.each(
	REF_KINDS
)("PUT /api/elements/[id]: a %s changing the case it points at", (kind) => {
	async function setUp() {
		const world = await makeWorld();
		const first = await createStoredCase(world.editor.id);
		const element = await storeReference(world, kind, first.id);
		return { world, first, element };
	}

	it.each(VIEWABLE_TARGETS)("is changed to point at $label", async ({
		make,
	}) => {
		const { world, element } = await setUp();
		const target = await make(world);

		const answer = await putElement(world.editor, element.id, {
			moduleReferenceId: target,
		});

		expect(answer.status).toBe(200);
		expect((await referencesOfElement(element.id)).moduleReferenceId).toBe(
			target
		);
	});

	it.each(
		UNVIEWABLE_TARGETS
	)("is refused, and nothing is written, when changed to point at $label", async ({
		make,
	}) => {
		const { world, first, element } = await setUp();
		const target = await make(world);
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, element.id, {
			moduleReferenceId: target,
		});

		expect(answer.status).toBe(400);
		expect(errorText(answer)).not.toContain(target);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect((await referencesOfElement(element.id)).moduleReferenceId).toBe(
			first.id
		);
		expect(await countNaming(target)).toBe(0);
	});

	it("answers the same, in status and in full body, for every case the editor can not view", async () => {
		const { world, element } = await setUp();
		const answers: Answer[] = [];

		for (const target of UNVIEWABLE_TARGETS) {
			const id = await target.make(world);
			answers.push(
				await putElement(world.editor, element.id, { moduleReferenceId: id })
			);
		}

		expect(answers.length).toBeGreaterThan(1);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
	});

	it("keeps the other edits in the same request out of the case too when the reference is refused", async () => {
		const { world, element } = await setUp();
		const hidden = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, element.id, {
			description: "Edited alongside a forbidden reference",
			moduleReferenceId: hidden.id,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it.each(
		MALFORMED_IDS
	)("is refused as a bad request, and nothing is written, for the id %j", async (id) => {
		const { world, element } = await setUp();
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, element.id, {
			moduleReferenceId: id,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("is refused for someone with no write access to the home case", async () => {
		const { world, first, element } = await setUp();
		const other = await createStoredCase(world.stranger.id);

		const answer = await putElement(world.stranger, element.id, {
			moduleReferenceId: other.id,
		});

		expect(answer.status).not.toBe(200);
		expect((await referencesOfElement(element.id)).moduleReferenceId).toBe(
			first.id
		);
	});
});

describe("PUT /api/elements/[id]: an away goal's citation", () => {
	it("takes a new citation inside the case it points at when the editor can view that case", async () => {
		const world = await makeWorld();
		const cited = await viewableCaseWithElement(world);
		const second = await elementIn(cited.caseId, world.editor.id);
		const away = await storeReference(world, "AWAY_GOAL", cited.caseId, {
			citedElementId: cited.elementId,
		});

		const answer = await putElement(world.editor, away.id, {
			citedElementId: second.id,
		});

		expect(answer.status).toBe(200);
		expect((await referencesOfElement(away.id)).citedElementId).toBe(second.id);
	});

	it("moves the reference and the citation together to another case the editor can view", async () => {
		const world = await makeWorld();
		const first = await viewableCaseWithElement(world);
		const second = await viewableCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", first.caseId, {
			citedElementId: first.elementId,
		});

		const answer = await putElement(world.editor, away.id, {
			moduleReferenceId: second.caseId,
			citedElementId: second.elementId,
		});

		expect(answer.status).toBe(200);
		expect(await referencesOfElement(away.id)).toMatchObject({
			moduleReferenceId: second.caseId,
			citedElementId: second.elementId,
		});
	});

	it("refuses to move the reference to a viewable case while citing an element of a hidden one", async () => {
		const world = await makeWorld();
		const first = await viewableCaseWithElement(world);
		const second = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", first.caseId, {
			citedElementId: first.elementId,
		});
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, away.id, {
			moduleReferenceId: second.caseId,
			citedElementId: hidden.elementId,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("refuses a citation that names an element of a hidden case while the reference stays on a viewable one", async () => {
		const world = await makeWorld();
		const reference = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", reference.caseId);
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, away.id, {
			citedElementId: hidden.elementId,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("gives the move to a hidden case, with a citation inside it, the answer for a case and an element that do not exist", async () => {
		const world = await makeWorld();
		const first = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", first.caseId);

		const probeHidden = await putElement(world.editor, away.id, {
			moduleReferenceId: hidden.caseId,
			citedElementId: hidden.elementId,
		});
		const probeMissing = await putElement(world.editor, away.id, {
			moduleReferenceId: randomUUID(),
			citedElementId: randomUUID(),
		});

		expect(probeHidden.status).toBe(400);
		expect(probeHidden).toEqual(probeMissing);
		expect((await referencesOfElement(away.id)).moduleReferenceId).toBe(
			first.caseId
		);
	});

	it("gives an element in a hidden case, in another viewable case, in a trashed case and nowhere one answer", async () => {
		const world = await makeWorld();
		const reference = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const otherViewable = await viewableCaseWithElement(world);
		const trashed = await viewableCaseWithElement(world);
		await prisma.assuranceCase.update({
			where: { id: trashed.caseId },
			data: { deletedAt: new Date() },
		});
		const away = await storeReference(world, "AWAY_GOAL", reference.caseId);

		const answers: Answer[] = [];
		for (const citedElementId of [
			randomUUID(),
			hidden.elementId,
			otherViewable.elementId,
			trashed.elementId,
		]) {
			answers.push(await putElement(world.editor, away.id, { citedElementId }));
		}

		expect(answers.length).toBeGreaterThan(1);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
		expect((await referencesOfElement(away.id)).citedElementId).toBeNull();
	});
});
