import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";
import {
	createReferencingElement,
	signInEditor,
} from "../utils/reference-targets";

/**
 * moduleReferenceId route wiring — "AWAY_GOAL cannot be created via the
 * single-element route" (moduleReferenceId gap). Before this fix,
 * `moduleReferenceId` was not part of `createElementSchema`/
 * `buildCreateInput`/`updateElementSchema` at all: the batch path
 * (case-batch-update-service.ts, via AwayGoalSchema/ModuleSchema in
 * lib/schemas/element-validation.ts) already required and persisted it, but
 * the single-element POST/PUT routes had no way to carry it through, so an
 * AWAY_GOAL created via POST would hit the Prisma element-validation
 * extension's "Element validation failed" and surface as an opaque 500 —
 * this is the exact gap api-elements-cited-element-id.test.ts's docstring
 * flagged as making a route-level AWAY_GOAL creation test impossible during
 * ADR 0004 D5 (its deviation 1). These tests exercise the real route
 * handlers end to end, following that file's convention.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const NOT_APPLICABLE_PATTERN = /only applicable to MODULE and AWAY_GOAL/;
const REQUIRED_PATTERN = /moduleReferenceId is required/;
const NOT_VIEWABLE_MESSAGE =
	"moduleReferenceId must reference a case you can view";

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — moduleReferenceId", () => {
	it("creates an AWAY_GOAL with moduleReferenceId, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "AG1",
					description: "Cites another case",
					moduleReferenceId: awayCase.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.moduleReferenceId).toBe(awayCase.id);

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findFirst({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCase.id);
	});

	it("rejects creating an AWAY_GOAL without moduleReferenceId (400, not a 500)", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Missing its case reference",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(REQUIRED_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(elements).toHaveLength(0);
	});

	it("rejects moduleReferenceId on a type it doesn't apply to", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "strategy",
					name: "A Strategy",
					description: "Not a MODULE or AWAY_GOAL",
					moduleReferenceId: awayCase.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_APPLICABLE_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "STRATEGY" },
		});
		expect(elements).toHaveLength(0);
	});

	it("rejects a nonexistent moduleReferenceId target case", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Cites a case that doesn't exist",
					moduleReferenceId: "00000000-0000-0000-0000-000000000000",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(NOT_VIEWABLE_MESSAGE);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — moduleReferenceId", () => {
	it("lets an author change moduleReferenceId on an AWAY_GOAL, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCaseA = await createTestCase(owner.id);
		const awayCaseB = await createTestCase(owner.id);
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			moduleReferenceId: awayCaseA.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ moduleReferenceId: awayCaseB.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.moduleReferenceId).toBe(awayCaseB.id);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCaseB.id);
	});

	it("rejects moduleReferenceId on a non-MODULE/AWAY_GOAL type through the route handler", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const goal = await createTestElement(homeCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${goal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ moduleReferenceId: awayCase.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: goal.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_APPLICABLE_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: goal.id },
		});
		expect(inDb?.moduleReferenceId).toBeNull();
	});

	it("rejects a nonexistent moduleReferenceId target case through the route handler", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			moduleReferenceId: awayCase.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({
					moduleReferenceId: "00000000-0000-0000-0000-000000000000",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(NOT_VIEWABLE_MESSAGE);

		// The element's original moduleReferenceId is untouched — the rejected
		// update didn't partially apply.
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCase.id);
	});
});

const CITED_NOT_FOUND_MESSAGE =
	"citedElementId must reference an existing element";
const MISSING_ELEMENT_ID = "00000000-0000-0000-0000-000000000000";

/** The element types that carry a case reference, as the routes and the database name them. */
const REFERENCING_TYPES = [
	{ routeType: "away_goal", elementType: "AWAY_GOAL", extra: {} },
	{
		routeType: "module",
		elementType: "MODULE",
		extra: { moduleEmbedType: "REFERENCE" },
	},
] as const;

/** Creates an element through the POST route as the signed-in user. */
async function postElement(caseId: string, body: Record<string, unknown>) {
	const { POST } = await import("@/app/api/cases/[id]/elements/route");
	const req = new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/elements`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await POST(req, { params: Promise.resolve({ id: caseId }) });
}

/** Edits an element through the PUT route as the signed-in user. */
async function putElement(elementId: string, body: Record<string, unknown>) {
	const { PUT } = await import("@/app/api/elements/[id]/route");
	const req = new NextRequest(
		`http://localhost:3000/api/elements/${elementId}`,
		{
			method: "PUT",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await PUT(req, { params: Promise.resolve({ id: elementId }) });
}

describe("moduleReferenceId — the editor must be able to view the case it names", () => {
	it.each(
		REFERENCING_TYPES
	)("accepts a new reference to every case the editor can view when creating a $routeType", async ({
		routeType,
		extra,
	}) => {
		const { homeCase, viewable } = await signInEditor();

		for (const [label, caseId] of Object.entries(viewable)) {
			const response = await postElement(homeCase.id, {
				type: routeType,
				description: `Cites ${label}`,
				moduleReferenceId: caseId,
				...extra,
			});
			expect(response.status, label).toBe(201);
			expect((await response.json()).moduleReferenceId, label).toBe(caseId);
		}
	});

	it.each(
		REFERENCING_TYPES
	)("refuses a new reference to a case it cannot view, one in the bin or a missing one with the same message when creating a $routeType", async ({
		routeType,
		extra,
	}) => {
		const { homeCase, hidden } = await signInEditor();

		for (const [label, caseId] of Object.entries(hidden)) {
			const response = await postElement(homeCase.id, {
				type: routeType,
				description: `Cites ${label}`,
				moduleReferenceId: caseId,
				...extra,
			});
			expect(response.status, label).toBe(400);
			expect((await response.json()).error, label).toBe(NOT_VIEWABLE_MESSAGE);
		}
		expect(
			await prisma.assuranceElement.count({ where: { caseId: homeCase.id } })
		).toBe(0);
	});

	it.each(
		REFERENCING_TYPES
	)("accepts a changed reference to every case the editor can view when editing a $routeType", async ({
		elementType,
	}) => {
		const { editor, homeCase, other, viewable } = await signInEditor();
		const hiddenStart = await createTestCase(other.id);
		const element = await createReferencingElement(
			homeCase.id,
			editor.id,
			elementType,
			hiddenStart.id
		);

		for (const [label, caseId] of Object.entries(viewable)) {
			const response = await putElement(element.id, {
				moduleReferenceId: caseId,
			});
			expect(response.status, label).toBe(200);
			const stored = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(stored?.moduleReferenceId, label).toBe(caseId);
		}
	});

	it.each(
		REFERENCING_TYPES
	)("refuses a changed reference to a case it cannot view, one in the bin or a missing one with the same message when editing a $routeType", async ({
		elementType,
	}) => {
		const { editor, homeCase, hidden } = await signInEditor();
		const start = await createTestCase(editor.id);
		const element = await createReferencingElement(
			homeCase.id,
			editor.id,
			elementType,
			start.id
		);

		for (const [label, caseId] of Object.entries(hidden)) {
			const response = await putElement(element.id, {
				moduleReferenceId: caseId,
			});
			expect(response.status, label).toBe(400);
			expect((await response.json()).error, label).toBe(NOT_VIEWABLE_MESSAGE);
		}
		const stored = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(stored?.moduleReferenceId).toBe(start.id);
	});

	it.each(
		REFERENCING_TYPES
	)("saves an edit to a $routeType whose existing reference the editor cannot view, whether or not the request repeats it", async ({
		elementType,
	}) => {
		const { editor, homeCase, other, hidden } = await signInEditor();
		const unviewable = await createTestCase(other.id);

		for (const caseId of [unviewable.id, hidden["a case in the bin"]]) {
			const element = await createReferencingElement(
				homeCase.id,
				editor.id,
				elementType,
				caseId
			);
			const reworded = await putElement(element.id, {
				description: "Reworded",
			});
			expect(reworded.status).toBe(200);
			const repeated = await putElement(element.id, {
				description: "Reworded again",
				moduleReferenceId: caseId,
			});
			expect(repeated.status).toBe(200);
			const stored = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(stored?.moduleReferenceId).toBe(caseId);
			expect(stored?.description).toBe("Reworded again");
		}
	});

	it("refuses a new or changed citation in a case the editor cannot view as it does a missing element, and saves an edit that leaves it alone", async () => {
		const { homeCase, other } = await signInEditor();
		const unviewable = await createTestCase(other.id);
		const [cited, repointed] = await Promise.all(
			["G1", "G2"].map((name) =>
				createTestElement(unviewable.id, other.id, { name })
			)
		);
		if (!(cited && repointed)) {
			throw new Error("missing fixture");
		}
		const awayGoal = await createReferencingElement(
			homeCase.id,
			other.id,
			"AWAY_GOAL",
			unviewable.id
		);
		await prisma.assuranceElement.update({
			where: { id: awayGoal.id },
			data: { citedElementId: cited.id },
		});

		for (const citedElementId of [repointed.id, MISSING_ELEMENT_ID]) {
			const response = await putElement(awayGoal.id, { citedElementId });
			expect(response.status, citedElementId).toBe(400);
			expect((await response.json()).error, citedElementId).toBe(
				CITED_NOT_FOUND_MESSAGE
			);
		}

		const repeated = await putElement(awayGoal.id, {
			description: "Reworded",
			citedElementId: cited.id,
		});
		expect(repeated.status).toBe(200);
		const stored = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(stored?.citedElementId).toBe(cited.id);
		expect(stored?.description).toBe("Reworded");
	});
});
