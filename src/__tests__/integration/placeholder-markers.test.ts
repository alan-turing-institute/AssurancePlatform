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
 * What writing an element's text does to its placeholder and pattern markers,
 * through each way the browser writes an element: the element route (the edit
 * dialog, the Case Assistant, undo and redo) and the batch route (the JSON
 * editor). Both run the same cases, so the two paths cannot disagree.
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

const JSON_HEADERS = { "Content-Type": "application/json" };

type Write = (
	caseId: string,
	elementId: string,
	data: Record<string, unknown>
) => Promise<Response>;

const WRITERS: Record<string, Write> = {
	"the element route": async (_caseId, elementId, data) => {
		const { PUT } = await import("@/app/api/elements/[id]/route");
		return await PUT(
			new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
				method: "PUT",
				body: JSON.stringify(data),
				headers: JSON_HEADERS,
			}),
			{ params: Promise.resolve({ id: elementId }) }
		);
	},
	"the batch route": async (caseId, elementId, data) => {
		const { POST } = await import("@/app/api/cases/[id]/batch/route");
		return await POST(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
				method: "POST",
				body: JSON.stringify({
					changes: [{ type: "update", elementId, data }],
				}),
				headers: JSON_HEADERS,
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);
	},
};

/** A case or pattern holding one goal that is a placeholder, signed in as its owner. */
async function placeholderGoal(
	kind: "CASE" | "PATTERN",
	overrides: Parameters<typeof createTestElement>[2] = {}
) {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id, { kind });
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
		description: "",
		isPlaceholder: true,
		placeholderHint: "Say what the goal is",
		...overrides,
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { caseId: testCase.id, id: goal.id };
}

function stored(id: string) {
	return prisma.assuranceElement.findUniqueOrThrow({
		where: { id },
		select: {
			description: true,
			isPlaceholder: true,
			placeholderHint: true,
			fromPattern: true,
			modifiedFromPattern: true,
		},
	});
}

describe.each(
	Object.entries(WRITERS)
)("writing an element through %s", (_label, write) => {
	it("takes the marker off a case's placeholder when its description is written", async () => {
		const { caseId, id } = await placeholderGoal("CASE");

		const response = await write(caseId, id, {
			description: "The system is safe",
		});

		expect(response.status).toBe(200);
		expect(await stored(id)).toMatchObject({
			description: "The system is safe",
			isPlaceholder: false,
		});
	});

	it("leaves the marker when the save carries the description unchanged or other fields", async () => {
		const { caseId, id } = await placeholderGoal("CASE", {
			description: "A starting point",
		});

		const unchanged = await write(caseId, id, {
			description: "A starting point",
			assumption: "An assumption",
		});
		const otherField = await write(caseId, id, { justification: "Because" });

		expect([unchanged.status, otherField.status]).toEqual([200, 200]);
		expect((await stored(id)).isPlaceholder).toBe(true);
	});

	it("does not take the marker off for text that is empty", async () => {
		const { caseId, id } = await placeholderGoal("CASE", {
			description: "A starting point",
		});

		const response = await write(caseId, id, { description: "" });

		expect(response.status).toBe(200);
		expect(await stored(id)).toMatchObject({
			description: "",
			isPlaceholder: true,
		});
	});

	it("does not take the marker off for the stored text with spaces added", async () => {
		const { caseId, id } = await placeholderGoal("CASE", {
			description: "Draft",
		});

		const response = await write(caseId, id, { description: "Draft " });

		expect(response.status).toBe(200);
		expect((await stored(id)).isPlaceholder).toBe(true);
	});

	it("never takes the marker off in a pattern", async () => {
		const { caseId, id } = await placeholderGoal("PATTERN");

		const response = await write(caseId, id, {
			description: "The system is safe",
		});

		expect(response.status).toBe(200);
		expect((await stored(id)).isPlaceholder).toBe(true);
	});

	it("lets a request that sets the marker decide it, whatever the text", async () => {
		const inCase = await placeholderGoal("CASE");
		const inPattern = await placeholderGoal("PATTERN");

		await write(inCase.caseId, inCase.id, {
			description: "The system is safe",
			isPlaceholder: true,
		});
		await write(inPattern.caseId, inPattern.id, { isPlaceholder: false });

		expect((await stored(inCase.id)).isPlaceholder).toBe(true);
		expect((await stored(inPattern.id)).isPlaceholder).toBe(false);
	});

	it("stores a trimmed hint, clears it when sent empty, and refuses one over 500 characters", async () => {
		const { caseId, id } = await placeholderGoal("PATTERN");

		await write(caseId, id, { placeholderHint: "  Name the hazard  " });
		const trimmed = (await stored(id)).placeholderHint;
		await write(caseId, id, { placeholderHint: "" });
		const cleared = (await stored(id)).placeholderHint;
		const tooLong = await write(caseId, id, {
			placeholderHint: "x".repeat(501),
		});

		expect(trimmed).toBe("Name the hazard");
		expect(cleared).toBeNull();
		expect(tooLong.status).toBe(400);
	});

	it("marks an element from a pattern as modified when its text changes, and not when it is sent unchanged", async () => {
		const { caseId, id } = await placeholderGoal("CASE", {
			description: "From the pattern",
			fromPattern: true,
		});

		await write(caseId, id, { description: "From the pattern" });
		const afterSameText = (await stored(id)).modifiedFromPattern;
		await write(caseId, id, { assumption: "A new assumption" });
		const afterNewText = (await stored(id)).modifiedFromPattern;

		expect(afterSameText).toBe(false);
		expect(afterNewText).toBe(true);
	});
});

describe("creating an element as a placeholder", () => {
	it("stores the marker and a trimmed hint, from the element route and from the batch route", async () => {
		const { caseId, id: goalId } = await placeholderGoal("PATTERN");
		const { POST: createElement } = await import(
			"@/app/api/cases/[id]/elements/route"
		);
		const { POST: batch } = await import("@/app/api/cases/[id]/batch/route");
		const batchId = crypto.randomUUID();

		const created = await createElement(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
				method: "POST",
				body: JSON.stringify({
					type: "property_claim",
					parentId: goalId,
					description: "",
					isPlaceholder: true,
					placeholderHint: "  Name a hazard  ",
				}),
				headers: JSON_HEADERS,
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);
		await batch(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
				method: "POST",
				body: JSON.stringify({
					changes: [
						{
							type: "create",
							elementId: batchId,
							parentId: goalId,
							data: {
								id: batchId,
								type: "PROPERTY_CLAIM",
								name: "P2",
								description: "",
								inSandbox: false,
								isPlaceholder: true,
								placeholderHint: "Name a second hazard",
							},
						},
					],
				}),
				headers: JSON_HEADERS,
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);

		const body = await created.json();
		expect(created.status).toBe(201);
		expect(body).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Name a hazard",
		});
		expect(await stored(batchId)).toMatchObject({
			isPlaceholder: true,
			placeholderHint: "Name a second hazard",
		});
	});
});

describe("markers the batch route ignores", () => {
	it("accepts a change that carries fromPattern or modifiedFromPattern and does not store them", async () => {
		const { caseId, id } = await placeholderGoal("CASE");
		const write = WRITERS["the batch route"];

		const first = await write?.(caseId, id, { fromPattern: true });
		const second = await write?.(caseId, id, { modifiedFromPattern: true });

		expect([first?.status, second?.status]).toEqual([200, 200]);
		expect(await stored(id)).toMatchObject({
			fromPattern: false,
			modifiedFromPattern: false,
		});
	});
});
