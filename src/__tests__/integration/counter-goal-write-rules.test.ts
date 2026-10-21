import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { importCase } from "@/lib/services/case-import-service";
import { deleteElement } from "@/lib/services/element-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { addCounterGoal, buildArgument } from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * The goal rules hold on every way of writing a goal, not only on creation: a
 * counter-goal (goal-type defeater) keeps a parent, and a case keeps one
 * ordinary goal. Changing a goal with PUT, the JSON editor's batch endpoint or
 * an imported file must not leave a parentless counter-goal, a second ordinary
 * goal, or a top goal turned into a counter-goal.
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

async function putElement(
	elementId: string,
	body: Record<string, unknown>
): Promise<Response> {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return PUT(
		new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: elementId }) }
	);
}

async function postBatch(
	caseId: string,
	changes: unknown[]
): Promise<Response> {
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

/** The goals of a case as stored, for checking a refused write changed nothing. */
function storedGoals(caseId: string) {
	return prisma.assuranceElement.findMany({
		where: { caseId, elementType: "GOAL" },
		orderBy: { createdAt: "asc" },
		select: { id: true, isDefeater: true, parentId: true, deletedAt: true },
	});
}

/** A case with its top goal and one counter-goal hung from a claim. */
async function buildCaseWithCounterGoal() {
	const owner = await createTestUser();
	const fx = await buildArgument(owner.id);
	const counterGoal = await addCounterGoal(fx, {
		name: "CG1",
		description: "counter-goal against the claim",
		parentId: fx.claim.id,
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, fx, counterGoal };
}

type Fixture = Awaited<ReturnType<typeof buildCaseWithCounterGoal>>;

function newGoalChange(data: Record<string, unknown>, parentId: string | null) {
	const id = crypto.randomUUID();
	return {
		type: "create",
		elementId: id,
		parentId,
		data: {
			id,
			type: "GOAL",
			name: null,
			description: "a goal made in the batch",
			inSandbox: false,
			...data,
		},
	};
}

describe("changing a goal with PUT /api/elements/[id]", () => {
	it.each([
		{
			label: "clearing the parent of a counter-goal",
			target: ({ counterGoal }: Fixture) => counterGoal.id,
			body: { parentId: null },
			status: 400,
		},
		{
			label: "turning the top goal into a counter-goal",
			target: ({ fx }: Fixture) => fx.goal.id,
			body: { isDefeater: true },
			status: 400,
		},
		{
			label: "making a counter-goal ordinary while the case has its top goal",
			target: ({ counterGoal }: Fixture) => counterGoal.id,
			body: { isDefeater: false },
			status: 409,
		},
	])("refuses $label", async ({ target, body, status }) => {
		const setUp = await buildCaseWithCounterGoal();
		const before = await storedGoals(setUp.fx.caseId);

		const response = await putElement(target(setUp), body);

		expect(response.status).toBe(status);
		expect(await storedGoals(setUp.fx.caseId)).toEqual(before);
	});

	it("lets a counter-goal become the ordinary goal when the case has none", async () => {
		const { owner, fx } = await buildCaseWithCounterGoal();
		// Evidence hangs from claims by link, so a counter-goal on it outlives the
		// top goal.
		const counterGoal = await addCounterGoal(fx, {
			name: "CG2",
			description: "counter-goal against the evidence",
			parentId: fx.evidenceOne.id,
		});
		await deleteElement(owner.id, fx.goal.id);

		const response = await putElement(counterGoal.id, {
			isDefeater: false,
			parentId: null,
		});

		expect(response.status).toBe(200);
		const stored = await prisma.assuranceElement.findUniqueOrThrow({
			where: { id: counterGoal.id },
		});
		expect(stored.isDefeater).toBe(false);
		expect(stored.parentId).toBeNull();
	});

	it("still lets a counter-goal stored without a parent be edited", async () => {
		const { owner, fx } = await buildCaseWithCounterGoal();
		const parentless = await createTestElement(fx.caseId, owner.id, {
			elementType: "GOAL",
			name: "CG9",
			description: "stored without a parent",
			isDefeater: true,
		});

		const response = await putElement(parentless.id, {
			description: "edited",
		});

		expect(response.status).toBe(200);
	});
});

describe("changing a goal with POST /api/cases/[id]/batch", () => {
	it.each([
		{
			label: "creating a counter-goal with no parent",
			changes: () => [newGoalChange({ isDefeater: true, name: "CG2" }, null)],
			status: 400,
		},
		{
			label: "clearing the parent of a counter-goal",
			changes: ({ counterGoal }: Fixture) => [
				{
					type: "update",
					elementId: counterGoal.id,
					data: { parentId: null },
				},
			],
			status: 400,
		},
		{
			label: "turning the top goal into a counter-goal",
			changes: ({ fx }: Fixture) => [
				{
					type: "update",
					elementId: fx.goal.id,
					data: { isDefeater: true },
				},
			],
			status: 400,
		},
		{
			label: "making a counter-goal ordinary while the case has its top goal",
			changes: ({ counterGoal }: Fixture) => [
				{
					type: "update",
					elementId: counterGoal.id,
					data: { isDefeater: false },
				},
			],
			status: 409,
		},
		{
			label: "creating a second ordinary goal",
			changes: () => [newGoalChange({}, null)],
			status: 409,
		},
		{
			label:
				"updating the top goal twice, which would leave a parentless counter-goal",
			changes: ({ fx }: Fixture) => [
				{
					type: "update",
					elementId: fx.goal.id,
					data: { isDefeater: true, parentId: fx.evidenceOne.id },
				},
				{ type: "update", elementId: fx.goal.id, data: { parentId: null } },
			],
			status: 400,
		},
		{
			label: "updating and deleting one counter-goal",
			changes: ({ counterGoal }: Fixture) => [
				{
					type: "update",
					elementId: counterGoal.id,
					data: { description: "edited" },
				},
				{ type: "delete", elementId: counterGoal.id },
			],
			status: 400,
		},
	])("refuses $label", async ({ changes, status }) => {
		const setUp = await buildCaseWithCounterGoal();
		const before = await storedGoals(setUp.fx.caseId);

		const response = await postBatch(setUp.fx.caseId, changes(setUp));

		expect(response.status).toBe(status);
		expect(await storedGoals(setUp.fx.caseId)).toEqual(before);
	});

	it("lets the top goal and a counter-goal change places in one batch", async () => {
		const { fx, counterGoal } = await buildCaseWithCounterGoal();

		const response = await postBatch(fx.caseId, [
			{
				type: "update",
				elementId: fx.goal.id,
				data: { isDefeater: true, parentId: fx.evidenceOne.id },
			},
			{
				type: "update",
				elementId: counterGoal.id,
				data: { isDefeater: false, parentId: null },
			},
		]);

		expect(response.status).toBe(200);
		const ordinary = await prisma.assuranceElement.findMany({
			where: { caseId: fx.caseId, elementType: "GOAL", isDefeater: false },
		});
		expect(ordinary.map((goal) => goal.id)).toEqual([counterGoal.id]);
	});

	it("refuses that change of places when the batch also creates an ordinary goal", async () => {
		const { fx, counterGoal } = await buildCaseWithCounterGoal();
		const before = await storedGoals(fx.caseId);

		const response = await postBatch(fx.caseId, [
			{
				type: "update",
				elementId: fx.goal.id,
				data: { isDefeater: true, parentId: fx.evidenceOne.id },
			},
			{
				type: "update",
				elementId: counterGoal.id,
				data: { isDefeater: false, parentId: null },
			},
			newGoalChange({}, null),
		]);

		expect(response.status).toBe(409);
		expect(await storedGoals(fx.caseId)).toEqual(before);
	});

	it("judges the goals as the batch leaves them", async () => {
		const setUp = await buildCaseWithCounterGoal();

		const response = await postBatch(setUp.fx.caseId, [
			{ type: "delete", elementId: setUp.fx.goal.id },
			newGoalChange({ name: "G2" }, null),
			newGoalChange({ isDefeater: true, name: "CG2" }, setUp.fx.evidenceOne.id),
		]);

		expect(response.status).toBe(200);
	});
});

describe("importing a file with goal rows", () => {
	function goalRow(id: string, extra: Record<string, unknown>) {
		return {
			id,
			elementType: "GOAL",
			parentId: null,
			name: null,
			description: `goal ${id}`,
			inSandbox: false,
			...extra,
		};
	}

	function flatFile(elements: unknown[], evidenceLinks: unknown[] = []) {
		return {
			version: "2.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Imported", description: "" },
			elements,
			evidenceLinks,
		};
	}

	const TOP = crypto.randomUUID();
	const SECOND_TOP = crypto.randomUUID();
	const COUNTER = crypto.randomUUID();
	const ELSEWHERE = crypto.randomUUID();

	it.each([
		{
			label: "a counter-goal with no parent",
			elements: [
				goalRow(TOP, { role: "TOP_LEVEL" }),
				goalRow(COUNTER, { isDefeater: true }),
			],
			problem: "elements.1.parentId",
		},
		{
			label: "a counter-goal whose parent is not in the file",
			elements: [
				goalRow(TOP, { role: "TOP_LEVEL" }),
				goalRow(COUNTER, { isDefeater: true, parentId: ELSEWHERE }),
			],
			problem: "elements.1.parentId",
		},
		{
			label: "a second ordinary goal",
			elements: [goalRow(TOP, { role: "TOP_LEVEL" }), goalRow(SECOND_TOP, {})],
			problem: "elements.1.elementType",
		},
	])("refuses a flat file with $label and creates nothing", async ({
		elements,
		problem,
	}) => {
		const owner = await createTestUser();

		const result = await importCase(owner.id, flatFile(elements));

		expect(result).toMatchObject({ error: "Invalid import data" });
		expect("validationErrors" in result && result.validationErrors).toEqual([
			expect.stringContaining(problem),
		]);
		expect(
			await prisma.assuranceCase.count({ where: { createdById: owner.id } })
		).toBe(0);
	});

	it("keeps only counter-goals beneath evidence in a flat file too, and says what it left out", async () => {
		const owner = await createTestUser();
		const ids = {
			goal: crypto.randomUUID(),
			claim: crypto.randomUUID(),
			evidence: crypto.randomUUID(),
			counter: crypto.randomUUID(),
			stray: crypto.randomUUID(),
			strayEvidence: crypto.randomUUID(),
		};
		const row = (
			id: string,
			elementType: string,
			name: string,
			parentId: string | null,
			extra: Record<string, unknown> = {}
		) => ({
			id,
			elementType,
			name,
			parentId,
			description: `${elementType} ${name}`,
			inSandbox: false,
			...extra,
		});
		const file = flatFile(
			[
				row(ids.goal, "GOAL", "G1", null),
				row(ids.claim, "PROPERTY_CLAIM", "P1", ids.goal),
				row(ids.evidence, "EVIDENCE", "E1", null),
				row(ids.counter, "GOAL", "CG1", ids.evidence, { isDefeater: true }),
				row(ids.stray, "PROPERTY_CLAIM", "P9", ids.evidence),
				row(ids.strayEvidence, "EVIDENCE", "E9", null),
			],
			[
				{ evidenceId: ids.evidence, claimId: ids.claim },
				{ evidenceId: ids.strayEvidence, claimId: ids.stray },
			]
		);

		const result = await importCase(owner.id, file);

		if ("error" in result) {
			throw new Error(result.error);
		}
		expect(result.data.warnings).toEqual([
			expect.stringContaining("P9: only counter-goals can hang from evidence"),
		]);
		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: result.data.caseId },
		});
		expect(stored.map((element) => element.name).sort()).toEqual([
			"CG1",
			"E1",
			"G1",
			"P1",
		]);
		expect(result.data.evidenceLinkCount).toBe(1);
	});

	it("keeps only counter-goals beneath evidence in a nested file, and says what it left out", async () => {
		const owner = await createTestUser();
		const ids = {
			goal: crypto.randomUUID(),
			claim: crypto.randomUUID(),
			evidence: crypto.randomUUID(),
			stray: crypto.randomUUID(),
			counter: crypto.randomUUID(),
		};
		const node = (
			id: string,
			type: string,
			name: string,
			children: unknown[] = [],
			extra: Record<string, unknown> = {}
		) => ({
			id,
			type,
			name,
			description: `${type} ${name}`,
			inSandbox: false,
			children,
			...extra,
		});
		const file = {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Nested", description: "" },
			tree: node(ids.goal, "GOAL", "G1", [
				node(ids.claim, "PROPERTY_CLAIM", "P1", [
					node(
						ids.evidence,
						"EVIDENCE",
						"E1",
						[
							node(ids.stray, "PROPERTY_CLAIM", "P9"),
							node(ids.counter, "GOAL", "CG1", [], { isDefeater: true }),
						],
						{ url: "https://example.com/e1" }
					),
				]),
			]),
		};

		const result = await importCase(owner.id, file);

		if ("error" in result) {
			throw new Error(result.error);
		}
		expect(result.data.warnings).toEqual([
			expect.stringContaining("P9: only counter-goals can hang from evidence"),
		]);
		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: result.data.caseId },
		});
		expect(stored.map((element) => element.name).sort()).toEqual([
			"CG1",
			"E1",
			"G1",
			"P1",
		]);
		const evidence = stored.find((element) => element.name === "E1");
		expect(stored.find((element) => element.name === "CG1")?.parentId).toBe(
			evidence?.id
		);
	});
});
