import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { buildArgument } from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * The server checks the three things the forms check for it: a new element's
 * type fits its parent, a field written on an update belongs to the element's
 * type, and saving an empty assumption or justification clears it.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const PARENT_MESSAGE = /^parentId /;

beforeEach(async () => {
	await mockNoAuth();
});

async function postElement(caseId: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	return POST(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}/elements`, {
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function putElement(id: string, body: Record<string, unknown>) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	return PUT(
		new NextRequest(`http://localhost:3000/api/elements/${id}`, {
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}),
		{ params: Promise.resolve({ id }) }
	);
}

async function postBatch(caseId: string, changes: unknown[]) {
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

async function build() {
	const owner = await createTestUser();
	const fx = await buildArgument(owner.id);
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, fx };
}

function countElements(caseId: string) {
	return prisma.assuranceElement.count({ where: { caseId } });
}

function newChange(
	type: string,
	parentId: string | null,
	extra: Record<string, unknown> = {}
) {
	const id = crypto.randomUUID();
	return {
		type: "create",
		elementId: id,
		parentId,
		data: {
			id,
			type,
			name: null,
			description: "made in the batch",
			inSandbox: false,
			...extra,
		},
	};
}

describe("a new element's type must fit its parent", () => {
	it("refuses evidence under a goal and stores nothing", async () => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);

		const response = await postElement(fx.caseId, {
			elementType: "EVIDENCE",
			description: "evidence under the goal",
			parentId: fx.goal.id,
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toMatch(PARENT_MESSAGE);
		expect(await countElements(fx.caseId)).toBe(before);
	});

	it("refuses a strategy under a strategy", async () => {
		const { fx } = await build();

		const response = await postElement(fx.caseId, {
			elementType: "STRATEGY",
			description: "strategy under a strategy",
			parentId: fx.strategy.id,
		});

		expect(response.status).toBe(400);
	});

	it("still accepts evidence under a claim", async () => {
		const { fx } = await build();

		const response = await postElement(fx.caseId, {
			elementType: "EVIDENCE",
			description: "evidence under a claim",
			parentId: fx.claim.id,
		});

		expect(response.status).toBe(201);
	});

	it("refuses a batch create whose type does not fit its parent", async () => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);

		const response = await postBatch(fx.caseId, [
			newChange("EVIDENCE", fx.goal.id),
		]);

		expect(response.status).toBe(400);
		expect(await countElements(fx.caseId)).toBe(before);
	});
});

describe("the four old element types cannot be created", () => {
	it.each([
		"CONTEXT",
		"JUSTIFICATION",
		"ASSUMPTION",
		"CONTRACT",
	])("refuses %s with a 400", async (type) => {
		const { fx } = await build();
		const before = await countElements(fx.caseId);

		const response = await postElement(fx.caseId, {
			elementType: type,
			description: "an old type",
		});

		expect(response.status).toBe(400);
		expect(await countElements(fx.caseId)).toBe(before);
	});

	it("refuses one in a batch", async () => {
		const { fx } = await build();

		const response = await postBatch(fx.caseId, [newChange("CONTEXT", null)]);

		expect(response.status).toBe(400);
	});
});

describe("a field must belong to the element's type", () => {
	it("refuses an assumption on evidence", async () => {
		const { fx } = await build();

		const response = await putElement(fx.evidenceOne.id, { assumption: "x" });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toContain("assumption");
		const row = await prisma.assuranceElement.findUnique({
			where: { id: fx.evidenceOne.id },
		});
		expect(row?.assumption).toBeNull();
	});

	it("refuses a link on a claim", async () => {
		const { fx } = await build();

		const response = await putElement(fx.claim.id, {
			url: "https://example.com/x",
		});

		expect(response.status).toBe(400);
	});

	it("lets empty values through for a type that does not hold them", async () => {
		const { fx } = await build();

		const response = await putElement(fx.evidenceOne.id, {
			assumption: "",
			justification: null,
			description: "reworded",
		});

		expect(response.status).toBe(200);
	});

	it("refuses an assumption on evidence in the batch", async () => {
		const { fx } = await build();

		const response = await postBatch(fx.caseId, [
			{
				type: "update",
				elementId: fx.evidenceOne.id,
				data: { assumption: "x" },
			},
		]);

		expect(response.status).toBe(400);
	});
});

describe("saving an empty assumption or justification clears it", () => {
	it.each([
		{ label: "an empty string", value: "" },
		{ label: "only spaces", value: "   " },
		{ label: "null", value: null },
	])("clears both when the form sends $label", async ({ value }) => {
		const { owner, fx } = await build();
		const claim = await createTestElement(fx.caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: fx.goal.id,
			description: "a claim with both",
		});
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { assumption: "old assumption", justification: "old reason" },
		});

		const response = await putElement(claim.id, {
			assumption: value,
			justification: value,
		});

		expect(response.status).toBe(200);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: claim.id },
		});
		expect(row?.assumption).toBeNull();
		expect(row?.justification).toBeNull();
	});

	it("leaves them alone when the request does not mention them", async () => {
		const { owner, fx } = await build();
		const claim = await createTestElement(fx.caseId, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: fx.goal.id,
			description: "a claim with an assumption",
		});
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { assumption: "kept" },
		});

		const response = await putElement(claim.id, { description: "reworded" });

		expect(response.status).toBe(200);
		const row = await prisma.assuranceElement.findUnique({
			where: { id: claim.id },
		});
		expect(row?.assumption).toBe("kept");
	});
});
