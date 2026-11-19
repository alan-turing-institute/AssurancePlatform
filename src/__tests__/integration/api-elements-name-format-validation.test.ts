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
 * Route-level coverage for the element-name format validation reaching all
 * the way out to the HTTP layer, proving the `lib/api-response.ts` error
 * mapping end to end rather than just at the service layer
 * (src/__tests__/integration/element-service.test.ts carries that). Bad
 * payloads answer a clean 400, never an unmapped 500:
 *
 * - An unrecognised `type`: a bad type with no name is refused rather than
 *   reaching the name generator, which throws for a type the prefix registry
 *   does not know.
 * - A non-conforming `name`, on create and on update: the validation's
 *   rejection is mapped to 400, not left to fall through to INTERNAL.
 * - A create that fills in a field its type does not hold (an assumption on
 *   evidence) answers 400 and stores nothing; the same field sent empty
 *   is accepted.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const UNKNOWN_TYPE_PATTERN = /Unknown element type/;
const GOAL_FORMAT_PATTERN = /Goal names must look like G1 or G1\.1/;

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — unrecognised element type", () => {
	it("rejects an unrecognised type with 400, not an unmapped 500", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "banana",
					description: "Should never reach naming",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(UNKNOWN_TYPE_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("POST /api/cases/[id]/elements — non-conforming element name", () => {
	it("rejects a create with a non-conforming name with 400, naming the expected format", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "goal",
					name: "Root Goal",
					description: "Free-text name, should be rejected",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(GOAL_FORMAT_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — non-conforming element name", () => {
	it("rejects a rename to a non-conforming name with 400, leaving the stored name unchanged", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${element.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ name: "Renamed Freely" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: element.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(GOAL_FORMAT_PATTERN);

		const unchanged = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(unchanged?.name).toBe("G1");
	});
});

describe("POST /api/cases/[id]/elements — a field the element type does not hold", () => {
	async function create(body: Record<string, unknown>) {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);
		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const response = await POST(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/elements`,
				{
					method: "POST",
					body: JSON.stringify(body),
					headers: { "Content-Type": "application/json" },
				}
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		return { response, stored };
	}

	it("refuses an assumption on evidence with 400 and stores nothing", async () => {
		const { response, stored } = await create({
			type: "evidence",
			description: "Test report",
			assumption: "Tests were run on the final build",
		});

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"assumption is not applicable to EVIDENCE elements"
		);
		expect(stored).toHaveLength(0);
	});

	it("still creates evidence when the field is sent empty", async () => {
		const { response, stored } = await create({
			type: "evidence",
			description: "Test report",
			assumption: "",
		});

		expect(response.status).toBe(201);
		expect(stored).toHaveLength(1);
	});
});
