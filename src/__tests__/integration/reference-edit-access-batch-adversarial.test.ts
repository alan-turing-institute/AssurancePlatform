import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import { createTestElement } from "../utils/prisma-factories";
import {
	type Answer,
	batchCreate,
	batchUpdate,
	countNaming,
	distinctAnswers,
	errorText,
	hiddenCaseWithElement,
	MALFORMED_IDS,
	makeWorld,
	postBatch,
	REF_KINDS,
	referencesOfElement,
	snapshot,
	storeReference,
	UNVIEWABLE_TARGETS,
	VIEWABLE_TARGETS,
	viewableCaseWithElement,
} from "../utils/reference-edit-access-kit";

/**
 * The JSON editor's batch route: a created or updated away goal or module may
 * point at a case only when the editor can view it, and a case they can not
 * view gets one answer whatever the reason. A batch that holds even one
 * forbidden reference writes none of its changes.
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

/** Ids the batch schema lets through as strings, other than the empty one. */
const BAD_ID_STRINGS = MALFORMED_IDS.filter((id) => id !== "");

describe.each(REF_KINDS)("POST /api/cases/[id]/batch: a created %s", (kind) => {
	it.each(VIEWABLE_TARGETS)("is created when it points at $label", async ({
		make,
	}) => {
		const world = await makeWorld();
		const target = await make(world);
		const change = batchCreate(world, kind, target);

		const answer = await postBatch(world.editor, world.homeCaseId, [change]);

		expect(answer.status).toBe(200);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: change.elementId },
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

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, target),
		]);

		expect(answer.status).toBe(400);
		expect(errorText(answer)).not.toContain(target);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(target)).toBe(0);
	});

	it("answers the same, in status and in full body, for every case the editor can not view and for ids that are not cases", async () => {
		const world = await makeWorld();
		const answers: Answer[] = [];

		for (const target of UNVIEWABLE_TARGETS) {
			const id = await target.make(world);
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchCreate(world, kind, id),
				])
			);
		}
		for (const id of BAD_ID_STRINGS) {
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchCreate(world, kind, id),
				])
			);
		}

		expect(answers.length).toBeGreaterThan(UNVIEWABLE_TARGETS.length);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
	});

	it("is refused when another element of the case already names the hidden case", async () => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		await storeReference(world, kind, hidden.id, { name: `${kind[0]}7` });
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, hidden.id),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("is refused with an empty reference, and nothing is written", async () => {
		const world = await makeWorld();
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, ""),
		]);

		expect(answer.status).not.toBe(200);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("gets, for an empty reference, the answer every other bad reference gets", async () => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);

		const empty = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, ""),
		]);
		const forbidden = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, hidden.id),
		]);

		expect(empty).toEqual(forbidden);
	});
});

describe("POST /api/cases/[id]/batch: a created element written in other spellings of the type", () => {
	it.each([
		"away_goal",
		"Away_Goal",
		"away goal",
		"AWAY  GOAL",
		"module",
		"Module",
	])("is refused when the type is spelt %j and the reference is hidden", async (type) => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, type, hidden.id),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(hidden.id)).toBe(0);
	});
});

describe("POST /api/cases/[id]/batch: a reference carried by an element of another type", () => {
	it.each([
		"STRATEGY",
		"PROPERTY_CLAIM",
		"EVIDENCE",
		"ASSUMPTION",
		"JUSTIFICATION",
		"CONTRACT",
	])("never leaves a %s naming a hidden case", async (type) => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);

		await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, type, hidden.id),
		]);

		expect(await countNaming(hidden.id)).toBe(0);
	});

	it.each([
		"STRATEGY",
		"PROPERTY_CLAIM",
		"EVIDENCE",
	])("never leaves an updated %s naming a hidden case", async (type) => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		const element = await createTestElement(world.homeCaseId, world.host.id, {
			elementType: type as "STRATEGY" | "PROPERTY_CLAIM" | "EVIDENCE",
			parentId: type === "EVIDENCE" ? undefined : world.strategyId,
		});

		await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: hidden.id }),
		]);

		expect(await countNaming(hidden.id)).toBe(0);
	});
});

describe.each(
	REF_KINDS
)("POST /api/cases/[id]/batch: an updated %s", (kind) => {
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

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: target }),
		]);

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

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: target }),
		]);

		expect(answer.status).toBe(400);
		expect(errorText(answer)).not.toContain(target);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect((await referencesOfElement(element.id)).moduleReferenceId).toBe(
			first.id
		);
		expect(await countNaming(target)).toBe(0);
	});

	it("answers the same, in status and in full body, for every case the editor can not view and for ids that are not cases", async () => {
		const { world, element } = await setUp();
		const answers: Answer[] = [];

		for (const target of UNVIEWABLE_TARGETS) {
			const id = await target.make(world);
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchUpdate(element.id, { moduleReferenceId: id }),
				])
			);
		}
		for (const id of BAD_ID_STRINGS) {
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchUpdate(element.id, { moduleReferenceId: id }),
				])
			);
		}

		expect(answers.length).toBeGreaterThan(UNVIEWABLE_TARGETS.length);
		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
	});

	it("is refused with an empty reference, and nothing is written", async () => {
		const { world, first, element } = await setUp();
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: "" }),
		]);

		expect(answer.status).not.toBe(200);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect((await referencesOfElement(element.id)).moduleReferenceId).toBe(
			first.id
		);
	});

	it("gets, for an empty reference, the answer every other bad reference gets", async () => {
		const { world, element } = await setUp();
		const hidden = await createStoredCase(world.stranger.id);

		const empty = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: "" }),
		]);
		const forbidden = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, { moduleReferenceId: hidden.id }),
		]);

		expect(empty).toEqual(forbidden);
	});

	it("keeps the other edits in the same update out of the case too when the reference is refused", async () => {
		const { world, element } = await setUp();
		const hidden = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(element.id, {
				description: "Edited alongside a forbidden reference",
				moduleReferenceId: hidden.id,
			}),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});
});

describe("POST /api/cases/[id]/batch: an away goal that already cites an element", () => {
	it("gives a move to a hidden, trashed, unknown or malformed case one answer", async () => {
		const world = await makeWorld();
		const cited = await viewableCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", cited.caseId, {
			citedElementId: cited.elementId,
		});
		const before = await snapshot(world.homeCaseId);

		const answers: Answer[] = [];
		for (const target of UNVIEWABLE_TARGETS) {
			const id = await target.make(world);
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchUpdate(away.id, { moduleReferenceId: id }),
				])
			);
		}
		for (const id of BAD_ID_STRINGS) {
			answers.push(
				await postBatch(world.editor, world.homeCaseId, [
					batchUpdate(away.id, { moduleReferenceId: id }),
				])
			);
		}

		expect(distinctAnswers(answers)).toHaveLength(1);
		expect(answers[0]?.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("is refused when it moves to another viewable case that does not hold the cited element", async () => {
		const world = await makeWorld();
		const cited = await viewableCaseWithElement(world);
		const other = await viewableCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", cited.caseId, {
			citedElementId: cited.elementId,
		});
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(away.id, { moduleReferenceId: other.caseId }),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("keeps its citation when it is updated to the same viewable case", async () => {
		const world = await makeWorld();
		const cited = await viewableCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", cited.caseId, {
			citedElementId: cited.elementId,
		});

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(away.id, { moduleReferenceId: cited.caseId }),
		]);

		expect(answer.status).toBe(200);
		expect(await referencesOfElement(away.id)).toMatchObject({
			moduleReferenceId: cited.caseId,
			citedElementId: cited.elementId,
		});
	});

	it("can not take a citation into a hidden case by smuggling the field into an update", async () => {
		const world = await makeWorld();
		const reference = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", reference.caseId);

		await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(away.id, { citedElementId: hidden.elementId }),
		]);

		expect((await referencesOfElement(away.id)).citedElementId).toBeNull();
	});

	it("can not be created with a citation field smuggled into the data", async () => {
		const world = await makeWorld();
		const reference = await viewableCaseWithElement(world);
		const hidden = await hiddenCaseWithElement(world);
		const change = batchCreate(world, "AWAY_GOAL", reference.caseId);
		(change.data as Record<string, unknown>).citedElementId = hidden.elementId;

		await postBatch(world.editor, world.homeCaseId, [change]);

		const stored = await prisma.assuranceElement.findUnique({
			where: { id: change.elementId },
		});
		expect(stored?.citedElementId ?? null).toBeNull();
	});
});

describe("POST /api/cases/[id]/batch: a batch with a forbidden reference among other changes", () => {
	it.each([
		["last", 25],
		["first", 0],
		["in the middle", 12],
	])("writes none of 25 allowed creates when the forbidden one is %s", async (_position, index) => {
		const world = await makeWorld();
		const viewable = await createStoredCase(world.editor.id);
		const hidden = await createStoredCase(world.stranger.id);
		const changes = Array.from({ length: 25 }, (_, n) =>
			batchCreate(world, "AWAY_GOAL", viewable.id, { name: `AG${n + 10}` })
		);
		changes.splice(index, 0, batchCreate(world, "AWAY_GOAL", hidden.id));
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, changes);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it.each([
		[
			"a hidden create after an allowed text edit and an allowed create",
			"create",
		],
		[
			"a hidden update after an allowed text edit and an allowed create",
			"update",
		],
	])("writes nothing for %s", async (_label, forbidden) => {
		const world = await makeWorld();
		const viewable = await createStoredCase(world.editor.id);
		const hidden = await createStoredCase(world.stranger.id);
		const edited = await storeReference(world, "AWAY_GOAL", viewable.id);
		const moved = await storeReference(world, "MODULE", viewable.id);
		const before = await snapshot(world.homeCaseId);
		const changes = [
			batchUpdate(edited.id, { description: "An allowed edit" }),
			batchCreate(world, "AWAY_GOAL", viewable.id, { name: "AG20" }),
			forbidden === "create"
				? batchCreate(world, "MODULE", hidden.id, { name: "M20" })
				: batchUpdate(moved.id, { moduleReferenceId: hidden.id }),
		];

		const answer = await postBatch(world.editor, world.homeCaseId, changes);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("keeps a deleted element when a hidden reference shares its batch", async () => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		const doomed = await createTestElement(world.homeCaseId, world.host.id, {
			elementType: "STRATEGY",
			name: "S8",
			parentId: world.strategyId,
		});
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			{ type: "delete", elementId: doomed.id },
			batchCreate(world, "AWAY_GOAL", hidden.id),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("creates no evidence link when a hidden reference shares its batch", async () => {
		const world = await makeWorld();
		const hidden = await createStoredCase(world.stranger.id);
		const claim = await createTestElement(world.homeCaseId, world.host.id, {
			elementType: "PROPERTY_CLAIM",
			name: "P1",
			parentId: world.strategyId,
		});
		const evidence = await createTestElement(world.homeCaseId, world.host.id, {
			elementType: "EVIDENCE",
			name: "E1",
		});

		const answer = await postBatch(world.editor, world.homeCaseId, [
			{ type: "link_evidence", evidenceId: evidence.id, claimId: claim.id },
			batchCreate(world, "AWAY_GOAL", hidden.id),
		]);

		expect(answer.status).toBe(400);
		expect(await prisma.evidenceLink.count()).toBe(0);
	});

	it("applies every change when all the references are allowed", async () => {
		const world = await makeWorld();
		const one = await createStoredCase(world.editor.id);
		const two = await viewableCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", one.id);
		const moved = await storeReference(world, "MODULE", one.id);
		const created = batchCreate(world, "AWAY_GOAL", two.caseId, {
			name: "AG20",
		});

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(away.id, { description: "An allowed edit" }),
			batchUpdate(moved.id, { moduleReferenceId: two.caseId }),
			created,
		]);

		expect(answer.status).toBe(200);
		expect((await referencesOfElement(away.id)).description).toBe(
			"An allowed edit"
		);
		expect((await referencesOfElement(moved.id)).moduleReferenceId).toBe(
			two.caseId
		);
		expect(
			(await referencesOfElement(created.elementId)).moduleReferenceId
		).toBe(two.caseId);
	});

	it.each([
		["a hidden case then the stored one", "forward"],
		["the stored case then a hidden one", "reverse"],
	])("refuses an element changed to %s in one batch, and writes nothing", async (_label, order) => {
		const world = await makeWorld();
		const stored = await createStoredCase(world.editor.id);
		const hidden = await createStoredCase(world.stranger.id);
		const away = await storeReference(world, "AWAY_GOAL", stored.id);
		const toHidden = batchUpdate(away.id, { moduleReferenceId: hidden.id });
		const restore = batchUpdate(away.id, { moduleReferenceId: stored.id });
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(
			world.editor,
			world.homeCaseId,
			order === "forward" ? [toHidden, restore] : [restore, toHidden]
		);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(hidden.id)).toBe(0);
	});

	it("refuses an update of an element that the same batch creates, and writes nothing", async () => {
		const world = await makeWorld();
		const viewable = await createStoredCase(world.editor.id);
		const hidden = await createStoredCase(world.stranger.id);
		const created = batchCreate(world, "AWAY_GOAL", viewable.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			created,
			batchUpdate(created.elementId, { moduleReferenceId: hidden.id }),
		]);

		expect(answer.status).toBeGreaterThanOrEqual(400);
		expect(answer.status).toBeLessThan(500);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(hidden.id)).toBe(0);
	});

	it("tells a stranger with no write access to the home case nothing about the target", async () => {
		const world = await makeWorld();
		const target = await createStoredCase(world.editor.id);
		const missing = await postBatch(world.stranger, world.homeCaseId, [
			batchCreate(world, "AWAY_GOAL", randomUUID()),
		]);

		const answer = await postBatch(world.stranger, world.homeCaseId, [
			batchCreate(world, "AWAY_GOAL", target.id),
		]);

		expect(answer.status).not.toBe(200);
		expect(answer).toEqual(missing);
	});
});
