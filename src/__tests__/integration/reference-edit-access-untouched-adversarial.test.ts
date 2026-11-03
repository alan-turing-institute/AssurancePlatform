import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	GET as getElement,
	PUT as putElementHandler,
} from "@/app/api/elements/[id]/route";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import type { Suggestion } from "@/lib/plugins/assistant/suggestion";
import prisma from "@/lib/prisma";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createStoredCase } from "../utils/case-kind-kit";
import {
	type Answer,
	batchCreate,
	batchUpdate,
	countNaming,
	distinctAnswers,
	elementIn,
	hiddenCaseWithElement,
	LOST_TARGETS,
	makeWorld,
	postBatch,
	putElement,
	REF_KINDS,
	type RefKind,
	referencesOfElement,
	snapshot,
	storeReference,
	viewableCaseWithElement,
	type World,
} from "../utils/reference-edit-access-kit";

/**
 * An element that already names a case its editor can not view (it was cited
 * by a collaborator who can, or the editor's access has since gone) keeps
 * saving, as long as the edit leaves that reference alone. The same stored
 * value can not be used to point anything else at a hidden case.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const ELEMENT_PATH = /^\/api\/elements\/([^/]+)$/;

beforeEach(async () => {
	await mockNoAuth();
});

interface Stored {
	/** The element cited inside the hidden case, for an away goal. */
	citedId: string | null;
	elementId: string;
	target: string;
}

/** An element of the home case that names a case the editor can not view. */
async function storeHidden(
	world: World,
	kind: RefKind,
	make: (world: World) => Promise<string>
): Promise<Stored> {
	const target = await make(world);
	const cited =
		kind === "AWAY_GOAL" ? await elementIn(target, world.stranger.id) : null;
	const element = await storeReference(
		world,
		kind,
		target,
		cited ? { citedElementId: cited.id } : {}
	);
	return { citedId: cited?.id ?? null, elementId: element.id, target };
}

interface Form {
	body: (stored: Stored) => Record<string, unknown>;
	kinds: readonly RefKind[];
	label: string;
}

/** Ways an edit can leave the stored reference alone. */
const UNTOUCHED: Form[] = [
	{
		label: "changes only the text",
		kinds: REF_KINDS,
		body: () => ({ description: "Reworded" }),
	},
	{
		label: "repeats the stored reference",
		kinds: REF_KINDS,
		body: ({ target }) => ({
			description: "Reworded",
			moduleReferenceId: target,
		}),
	},
	{
		label: "repeats the stored reference and the stored citation",
		kinds: ["AWAY_GOAL"],
		body: ({ target, citedId }) => ({
			description: "Reworded",
			moduleReferenceId: target,
			citedElementId: citedId,
		}),
	},
	{
		label: "repeats the stored citation and leaves the reference out",
		kinds: ["AWAY_GOAL"],
		body: ({ citedId }) => ({
			description: "Reworded",
			citedElementId: citedId,
		}),
	},
];

describe.each(
	UNTOUCHED
)("PUT /api/elements/[id]: an edit that $label", (form) => {
	for (const kind of form.kinds) {
		it.each(
			LOST_TARGETS
		)(`saves a ${kind} whose stored reference is $label`, async ({ make }) => {
			const world = await makeWorld();
			const stored = await storeHidden(world, kind, make);

			const answer = await putElement(
				world.editor,
				stored.elementId,
				form.body(stored)
			);

			expect(answer.status).toBe(200);
			expect(await referencesOfElement(stored.elementId)).toMatchObject({
				description: "Reworded",
				moduleReferenceId: stored.target,
				citedElementId: stored.citedId,
			});
		});
	}
});

describe.each(
	REF_KINDS
)("PUT /api/elements/[id]: a %s that names a case the editor can not view", (kind) => {
	async function setUp() {
		const world = await makeWorld();
		const stored = await storeHidden(world, kind, async (w) => {
			const made = await createStoredCase(w.stranger.id);
			return made.id;
		});
		return { world, stored };
	}

	it("can not be pointed at a different hidden case", async () => {
		const { world, stored } = await setUp();
		const other = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, stored.elementId, {
			moduleReferenceId: other.id,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("gets, for a different hidden case, the answer for a case that does not exist", async () => {
		const { world, stored } = await setUp();
		const other = await createStoredCase(world.stranger.id);
		const probes: Answer[] = [];

		for (const id of [other.id, crypto.randomUUID()]) {
			probes.push(
				await putElement(world.editor, stored.elementId, {
					moduleReferenceId: id,
				})
			);
		}

		expect(distinctAnswers(probes)).toHaveLength(1);
	});

	it("can be pointed at a case the editor can view", async () => {
		const { world, stored } = await setUp();
		const viewable = await createStoredCase(world.editor.id);

		const answer = await putElement(world.editor, stored.elementId, {
			// An away goal's citation belongs to the case it left.
			...(kind === "AWAY_GOAL" ? { citedElementId: null } : {}),
			moduleReferenceId: viewable.id,
		});

		expect(answer.status).toBe(200);
		expect(
			(await referencesOfElement(stored.elementId)).moduleReferenceId
		).toBe(viewable.id);
	});

	it("does not lend its stored value to a sibling element", async () => {
		const { world, stored } = await setUp();
		const viewable = await createStoredCase(world.editor.id);
		const sibling = await storeReference(world, kind, viewable.id, {
			name: `${kind[0]}5`,
		});
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, sibling.id, {
			moduleReferenceId: stored.target,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect((await referencesOfElement(sibling.id)).moduleReferenceId).toBe(
			viewable.id
		);
	});

	it("can not have its reference cleared and then put back", async () => {
		const { world, stored } = await setUp();

		const cleared = await putElement(world.editor, stored.elementId, {
			...(kind === "AWAY_GOAL" ? { citedElementId: null } : {}),
			moduleReferenceId: null,
		});
		const putBack = await putElement(world.editor, stored.elementId, {
			moduleReferenceId: stored.target,
		});

		expect(cleared.status).toBe(200);
		expect(putBack.status).toBe(400);
		expect(
			(await referencesOfElement(stored.elementId)).moduleReferenceId
		).toBeNull();
	});

	it("can not be pointed at the hidden case again after a stored reference went missing", async () => {
		const { world, stored } = await setUp();
		await prisma.$executeRaw`UPDATE assurance_elements SET module_reference_id = NULL, cited_element_id = NULL, module_reference_dangling = TRUE WHERE id = ${stored.elementId}`;
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, stored.elementId, {
			moduleReferenceId: stored.target,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("keeps its reference through a batch edit of the text", async () => {
		const { world, stored } = await setUp();

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, { description: "Reworded in a batch" }),
		]);

		expect(answer.status).toBe(200);
		expect(await referencesOfElement(stored.elementId)).toMatchObject({
			description: "Reworded in a batch",
			moduleReferenceId: stored.target,
			citedElementId: stored.citedId,
		});
	});

	it("keeps its reference through a batch edit that repeats the stored reference", async () => {
		const { world, stored } = await setUp();

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, {
				description: "Reworded in a batch",
				moduleReferenceId: stored.target,
			}),
		]);

		expect(answer.status).toBe(200);
		expect(await referencesOfElement(stored.elementId)).toMatchObject({
			description: "Reworded in a batch",
			moduleReferenceId: stored.target,
			citedElementId: stored.citedId,
		});
	});

	it("can not be pointed at a different hidden case by a batch", async () => {
		const { world, stored } = await setUp();
		const other = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, { moduleReferenceId: other.id }),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
		expect(await countNaming(other.id)).toBe(0);
	});

	it("can not be pointed at the hidden case again by a batch after a stored reference went missing", async () => {
		const { world, stored } = await setUp();
		await prisma.$executeRaw`UPDATE assurance_elements SET module_reference_id = NULL, cited_element_id = NULL, module_reference_dangling = TRUE WHERE id = ${stored.elementId}`;
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, { moduleReferenceId: stored.target }),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("does not lend its stored value to a sibling element in a batch, or to a new one", async () => {
		const { world, stored } = await setUp();
		const viewable = await createStoredCase(world.editor.id);
		const sibling = await storeReference(world, kind, viewable.id, {
			name: `${kind[0]}5`,
		});
		const before = await snapshot(world.homeCaseId);

		const update = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(sibling.id, { moduleReferenceId: stored.target }),
		]);
		const create = await postBatch(world.editor, world.homeCaseId, [
			batchCreate(world, kind, stored.target),
		]);

		expect(update.status).toBe(400);
		expect(create.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("writes nothing from a batch that repeats the stored reference next to a hidden new one", async () => {
		const { world, stored } = await setUp();
		const other = await createStoredCase(world.stranger.id);
		const before = await snapshot(world.homeCaseId);

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, {
				description: "Reworded in a batch",
				moduleReferenceId: stored.target,
			}),
			batchCreate(world, kind, other.id),
		]);

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("applies a batch that repeats the stored reference next to an allowed change", async () => {
		const { world, stored } = await setUp();
		const viewable = await viewableCaseWithElement(world);
		const created = batchCreate(world, kind, viewable.caseId, {
			name: kind === "MODULE" ? "M30" : "AG30",
		});

		const answer = await postBatch(world.editor, world.homeCaseId, [
			batchUpdate(stored.elementId, {
				description: "Reworded in a batch",
				moduleReferenceId: stored.target,
			}),
			created,
		]);

		expect(answer.status).toBe(200);
		expect((await referencesOfElement(stored.elementId)).description).toBe(
			"Reworded in a batch"
		);
		expect(
			(await referencesOfElement(created.elementId)).moduleReferenceId
		).toBe(viewable.caseId);
	});
});

describe("PUT /api/elements/[id]: an away goal whose reference the editor can not view, and its citation", () => {
	async function setUp() {
		const world = await makeWorld();
		const hidden = await hiddenCaseWithElement(world);
		const second = await elementIn(hidden.caseId, world.stranger.id);
		const away = await storeReference(world, "AWAY_GOAL", hidden.caseId, {
			citedElementId: hidden.elementId,
		});
		return { world, hidden, second, away };
	}

	it("can not be made to cite another element of the hidden case", async () => {
		const { world, second, away } = await setUp();
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, away.id, {
			moduleReferenceId: away.moduleReferenceId,
			citedElementId: second.id,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("can not be made to cite another element of the hidden case with the reference left out", async () => {
		const { world, second, away } = await setUp();
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, away.id, {
			citedElementId: second.id,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("gets, for another element of the hidden case, the answer for an element that does not exist", async () => {
		const { world, second, away } = await setUp();

		const real = await putElement(world.editor, away.id, {
			citedElementId: second.id,
		});
		const missing = await putElement(world.editor, away.id, {
			citedElementId: crypto.randomUUID(),
		});

		expect(real).toEqual(missing);
	});

	it("gets, for an element of the hidden case, the answer a missing element gets under a reference the editor can view", async () => {
		const { world, second, away } = await setUp();
		const viewable = await viewableCaseWithElement(world);
		const visibleAway = await storeReference(
			world,
			"AWAY_GOAL",
			viewable.caseId,
			{ name: "AG5" }
		);

		const intoHidden = await putElement(world.editor, away.id, {
			citedElementId: second.id,
		});
		const missing = await putElement(world.editor, visibleAway.id, {
			citedElementId: crypto.randomUUID(),
		});

		expect(intoHidden.status).toBe(400);
		expect(intoHidden).toEqual(missing);
	});

	it("can not cite a first element of the hidden case when it cited none", async () => {
		const world = await makeWorld();
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", hidden.caseId);
		const before = await snapshot(world.homeCaseId);

		const answer = await putElement(world.editor, away.id, {
			citedElementId: hidden.elementId,
		});

		expect(answer.status).toBe(400);
		expect(await snapshot(world.homeCaseId)).toEqual(before);
	});

	it("can have its citation taken off", async () => {
		const { world, away } = await setUp();

		const answer = await putElement(world.editor, away.id, {
			citedElementId: null,
		});

		expect(answer.status).toBe(200);
		expect(await referencesOfElement(away.id)).toMatchObject({
			moduleReferenceId: away.moduleReferenceId,
			citedElementId: null,
		});
	});
});

describe("the Case Assistant's apply", () => {
	function routeFetchToHandlers(sent: { method: string; body: unknown }[]) {
		vi.stubGlobal(
			"fetch",
			vi.fn((url: string, init?: RequestInit) => {
				const method = init?.method ?? "GET";
				const request = new NextRequest(`http://localhost:3000${url}`, {
					method,
					headers: init?.headers,
					body: init?.body,
				});
				const id = ELEMENT_PATH.exec(url)?.[1] ?? "";
				if (method === "PUT") {
					sent.push({
						method,
						body: JSON.parse(String(init?.body ?? "null")),
					});
					return putElementHandler(request, {
						params: Promise.resolve({ id }),
					});
				}
				if (method === "GET") {
					return getElement(request, { params: Promise.resolve({ id }) });
				}
				return Promise.resolve(
					new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
				);
			})
		);
	}

	beforeEach(() => {
		useHistoryStore.setState({
			caseId: null,
			undoStack: [],
			redoStack: [],
			isApplying: false,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function reword(elementId: string, label: string): Suggestion {
		return {
			suggested: true,
			kind: "edit",
			elementId,
			elementType: "away_goal",
			label,
			changes: {
				description: {
					before: "Cites a hidden case",
					after: "Cites it, reworded",
				},
			},
		};
	}

	it("saves a reworded away goal that cites a case the editor can not view, sends no reference, and Undo and Redo keep it", async () => {
		const world = await makeWorld();
		const hidden = await hiddenCaseWithElement(world);
		const away = await storeReference(world, "AWAY_GOAL", hidden.caseId, {
			citedElementId: hidden.elementId,
		});
		await prisma.assuranceElement.update({
			where: { id: away.id },
			data: { description: "Cites a hidden case" },
		});
		await mockAuth(
			world.editor.id,
			world.editor.username,
			world.editor.email ?? undefined
		);
		const sent: { method: string; body: unknown }[] = [];
		routeFetchToHandlers(sent);

		const result = await applySuggestion(
			world.homeCaseId,
			reword(away.id, "AG1")
		);

		expect(result).toEqual({ status: "applied" });
		expect(sent).toHaveLength(1);
		expect(Object.keys(sent[0]?.body as object)).not.toContain(
			"moduleReferenceId"
		);
		expect(Object.keys(sent[0]?.body as object)).not.toContain(
			"citedElementId"
		);
		expect(await referencesOfElement(away.id)).toMatchObject({
			description: "Cites it, reworded",
			moduleReferenceId: hidden.caseId,
			citedElementId: hidden.elementId,
		});

		const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
		if (!command) {
			throw new Error("Nothing was recorded for Undo");
		}
		await applyUndo(command);
		expect(await referencesOfElement(away.id)).toMatchObject({
			description: "Cites a hidden case",
			moduleReferenceId: hidden.caseId,
			citedElementId: hidden.elementId,
		});
		await applyRedo(command);
		expect(await referencesOfElement(away.id)).toMatchObject({
			description: "Cites it, reworded",
			moduleReferenceId: hidden.caseId,
			citedElementId: hidden.elementId,
		});
		for (const request of sent) {
			expect(Object.keys(request.body as object)).not.toContain(
				"moduleReferenceId"
			);
		}
	});
});
