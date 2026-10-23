import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createElementInCase } from "@/app/api/cases/[id]/elements/route";
import { POST as restoreElement } from "@/app/api/elements/[id]/restore/route";
import {
	DELETE as deleteElement,
	GET as getElement,
	PUT as putElement,
} from "@/app/api/elements/[id]/route";
import { applySuggestion } from "@/lib/plugins/assistant/apply-suggestion";
import type { Suggestion } from "@/lib/plugins/assistant/suggestion";
import prisma from "@/lib/prisma";
import { applyRedo, applyUndo } from "@/lib/services/history-service";
import useHistoryStore from "@/store/history-store";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Applying a suggestion against the real element routes and a real database:
 * what the card reads back, what it writes, and what Undo and Redo do with it.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const ELEMENT_PATH = /^\/api\/elements\/([^/]+)$/;
const RESTORE_PATH = /^\/api\/elements\/([^/]+)\/restore$/;
const CASE_ELEMENTS_PATH = /^\/api\/cases\/([^/]+)\/elements$/;

/** Sends the browser-side calls of the card to the route handlers. */
function routeFetchToHandlers() {
	const seen: string[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string, init?: RequestInit) => {
			const method = init?.method ?? "GET";
			seen.push(`${method} ${url}`);
			const request = new NextRequest(`http://localhost:3000${url}`, {
				method,
				headers: init?.headers,
				body: init?.body,
			});
			const element = ELEMENT_PATH.exec(url);
			if (element) {
				const id = element[1] ?? "";
				const handler = {
					GET: getElement,
					PUT: putElement,
					DELETE: deleteElement,
				}[method as "GET" | "PUT" | "DELETE"];
				return handler(request, { params: Promise.resolve({ id }) });
			}
			const restore = RESTORE_PATH.exec(url);
			if (restore && method === "POST") {
				const id = restore[1] ?? "";
				return restoreElement(request, { params: Promise.resolve({ id }) });
			}
			const created = CASE_ELEMENTS_PATH.exec(url);
			if (created && method === "POST") {
				const id = created[1] ?? "";
				return createElementInCase(request, {
					params: Promise.resolve({ id }),
				});
			}
			return Promise.resolve(
				new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
			);
		})
	);
	return seen;
}

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: "The system is acceptably safe",
		role: "TOP_LEVEL",
	});
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		description: "Operators are trained",
		parentId: goal.id,
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, testCase, goal, claim };
}

function reword(
	claimId: string,
	changes: Extract<Suggestion, { kind: "edit" }>["changes"]
): Suggestion {
	return {
		suggested: true,
		kind: "edit",
		elementId: claimId,
		elementType: "property_claim",
		label: "P1",
		changes,
	};
}

function addUnder(
	parentId: string,
	childType: "strategy" | "property_claim" | "evidence",
	parentType = "property_claim"
): Suggestion {
	return {
		suggested: true,
		kind: "new",
		parentId,
		parentLabel: "P1",
		parentType,
		childType,
		description: "A new element from the assistant",
	};
}

async function stored(id: string) {
	return await prisma.assuranceElement.findUniqueOrThrow({ where: { id } });
}

function recorded() {
	const command = useHistoryStore.getState().undoStack.at(-1)?.commands[0];
	if (!command) {
		throw new Error("Nothing was recorded for Undo");
	}
	return command;
}

beforeEach(async () => {
	await mockNoAuth();
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

describe("applying a rewording against the real element routes", () => {
	it("saves the new description, leaves the label and status alone, and Undo and Redo move between the two texts", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		const before = await stored(claim.id);

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: {
					before: "Operators are trained",
					after: "Operators complete the accredited course",
				},
			})
		);

		expect(result).toEqual({ status: "applied" });
		const after = await stored(claim.id);
		expect(after.description).toBe("Operators complete the accredited course");
		expect(after.name).toBe(before.name);
		expect(after.assertionStatus).toBe(before.assertionStatus);

		await applyUndo(recorded());
		expect((await stored(claim.id)).description).toBe("Operators are trained");

		await applyRedo(recorded());
		expect((await stored(claim.id)).description).toBe(
			"Operators complete the accredited course"
		);
	});

	it("adds an assumption and a context list where there were none, in one save", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				assumption: { before: "", after: "Training is refreshed yearly" },
				context: { before: [], after: ["Applies to night shifts", "UK only"] },
			})
		);

		expect(result).toEqual({ status: "applied" });
		const row = await stored(claim.id);
		expect(row.assumption).toBe("Training is refreshed yearly");
		expect(row.context).toEqual(["Applies to night shifts", "UK only"]);
	});

	// An applied context list has to come off again on Undo, whatever the
	// element held before. The element read back for the Undo entry leaves the
	// list out when it is empty.
	it("takes the context entries off again on Undo when the element had none", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		await applySuggestion(
			testCase.id,
			reword(claim.id, {
				context: { before: [], after: ["Applies to night shifts"] },
			})
		);
		expect((await stored(claim.id)).context).toEqual([
			"Applies to night shifts",
		]);

		await applyUndo(recorded());

		expect((await stored(claim.id)).context ?? []).toEqual([]);
	});

	it("puts the earlier context list back on Undo when the element already had one", async () => {
		const { testCase, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { context: ["Original entry"] },
		});
		routeFetchToHandlers();
		await applySuggestion(
			testCase.id,
			reword(claim.id, {
				context: { before: ["Original entry"], after: ["Replaced entry"] },
			})
		);

		await applyUndo(recorded());

		expect((await stored(claim.id)).context).toEqual(["Original entry"]);
	});

	it("saves nothing, and records nothing, when someone edited the element after the suggestion", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { description: "Edited in another tab" },
		});

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: {
					before: "Operators are trained",
					after: "Operators complete the accredited course",
				},
			})
		);

		expect(result).toEqual({ status: "changed" });
		expect((await stored(claim.id)).description).toBe("Edited in another tab");
		expect(useHistoryStore.getState().undoStack).toHaveLength(0);
	});

	it("saves nothing when the element was deleted after the suggestion", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: { before: "Operators are trained", after: "New" },
			})
		);

		expect(result).toEqual({ status: "changed" });
		expect((await stored(claim.id)).description).toBe("Operators are trained");
	});

	it("saves nothing when the suggestion is applied in a different case from the element's", async () => {
		const { owner, claim } = await setup();
		const elsewhere = await createTestCase(owner.id);
		routeFetchToHandlers();

		const result = await applySuggestion(
			elsewhere.id,
			reword(claim.id, {
				description: { before: "Operators are trained", after: "New" },
			})
		);

		expect(result).toEqual({ status: "changed" });
		expect((await stored(claim.id)).description).toBe("Operators are trained");
	});

	it.each([
		"VIEW",
		"COMMENT",
	] as const)("fails, saves nothing and records nothing for a user with only %s rights", async (level) => {
		const { owner, testCase, claim } = await setup();
		const reader = await createTestUser();
		await createTestPermission(testCase.id, reader.id, owner.id, level);
		await mockAuth(reader.id, reader.username, reader.email);
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: { before: "Operators are trained", after: "New" },
			})
		);

		expect(result.status).toBe("failed");
		expect((await stored(claim.id)).description).toBe("Operators are trained");
		expect(useHistoryStore.getState().undoStack).toHaveLength(0);
	});

	it("fails without saving when the session has ended", async () => {
		const { testCase, claim } = await setup();
		await mockNoAuth();
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: { before: "Operators are trained", after: "New" },
			})
		);

		expect(result.status).not.toBe("applied");
		expect((await stored(claim.id)).description).toBe("Operators are trained");
	});

	it("saves text of exactly 5000 characters, which is the most the server takes", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		const longest = "x".repeat(5000);

		const result = await applySuggestion(
			testCase.id,
			reword(claim.id, {
				description: { before: "Operators are trained", after: longest },
			})
		);

		expect(result).toEqual({ status: "applied" });
		expect((await stored(claim.id)).description).toBe(longest);
	});
});

describe("applying a new element against the real element routes", () => {
	it.each([
		["evidence", "EVIDENCE"],
		["strategy", "STRATEGY"],
		["property_claim", "PROPERTY_CLAIM"],
	] as const)("creates a %s beneath the claim, in its case, with a generated label", async (childType, elementType) => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			addUnder(claim.id, childType)
		);

		expect(result).toEqual({ status: "applied" });
		const created = await prisma.assuranceElement.findFirstOrThrow({
			where: {
				caseId: testCase.id,
				description: "A new element from the assistant",
			},
		});
		expect(created.elementType).toBe(elementType);
		// Evidence hangs from its claim by a link, not by a parent.
		if (elementType === "EVIDENCE") {
			const links = await prisma.evidenceLink.findMany({
				where: { evidenceId: created.id },
			});
			expect(links.map((link) => link.claimId)).toEqual([claim.id]);
		} else {
			expect(created.parentId).toBe(claim.id);
		}
		expect(created.name?.trim()).toBeTruthy();
		expect(recorded()).toMatchObject({ type: "create", elementId: created.id });
	});

	it.each([
		["goal", "strategy", "STRATEGY"],
		["goal", "property_claim", "PROPERTY_CLAIM"],
		["strategy", "property_claim", "PROPERTY_CLAIM"],
		["property_claim", "property_claim", "PROPERTY_CLAIM"],
		["property_claim", "strategy", "STRATEGY"],
		["property_claim", "evidence", "EVIDENCE"],
	] as const)("creates what the server accepts for every pairing the assistant may suggest: a %s with a %s beneath it", async (parentKind, childType, elementType) => {
		const { owner, testCase, goal, claim } = await setup();
		const strategy = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			name: "S1",
			description: "Argue by operator training",
			parentId: goal.id,
		});
		const parent = { goal, strategy, property_claim: claim }[parentKind];
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			addUnder(parent.id, childType, parentKind)
		);

		expect(result).toEqual({ status: "applied" });
		const created = await prisma.assuranceElement.findFirstOrThrow({
			where: {
				caseId: testCase.id,
				description: "A new element from the assistant",
			},
		});
		expect(created.elementType).toBe(elementType);
		expect(created.name?.trim()).toBeTruthy();
		if (childType === "evidence") {
			const links = await prisma.evidenceLink.findMany({
				where: { evidenceId: created.id },
			});
			expect(links.map((link) => link.claimId)).toEqual([parent.id]);
		} else {
			expect(created.parentId).toBe(parent.id);
		}
	});

	it("removes the new element on Undo and brings it back on Redo", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		await applySuggestion(testCase.id, addUnder(claim.id, "evidence"));
		const command = recorded();

		await applyUndo(command);
		expect((await stored(command.elementId)).deletedAt).not.toBeNull();

		await applyRedo(command);
		expect((await stored(command.elementId)).deletedAt).toBeNull();
	});

	it("creates nothing when the claim has been deleted since the suggestion", async () => {
		const { testCase, claim } = await setup();
		routeFetchToHandlers();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});

		const result = await applySuggestion(
			testCase.id,
			addUnder(claim.id, "evidence")
		);

		expect(result).toEqual({ status: "changed" });
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: testCase.id, elementType: "EVIDENCE" },
			})
		).toBe(0);
	});

	it("creates nothing beneath a goal when the child is evidence, though the server alone would allow it", async () => {
		const { testCase, goal } = await setup();
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			addUnder(goal.id, "evidence", "goal")
		);

		expect(result).toEqual({ status: "changed" });
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: testCase.id, elementType: "EVIDENCE" },
			})
		).toBe(0);
	});

	it("creates nothing for a user with only view rights", async () => {
		const { owner, testCase, claim } = await setup();
		const reader = await createTestUser();
		await createTestPermission(testCase.id, reader.id, owner.id, "VIEW");
		await mockAuth(reader.id, reader.username, reader.email);
		routeFetchToHandlers();

		const result = await applySuggestion(
			testCase.id,
			addUnder(claim.id, "evidence")
		);

		expect(result.status).toBe("failed");
		expect(
			await prisma.assuranceElement.count({
				where: { caseId: testCase.id, elementType: "EVIDENCE" },
			})
		).toBe(0);
		expect(useHistoryStore.getState().undoStack).toHaveLength(0);
	});
});
