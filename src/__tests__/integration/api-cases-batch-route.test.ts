import { randomUUID } from "node:crypto";
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
 * Route-level regression tests for POST /api/cases/[id]/batch — the JSON
 * editor's batch-update path (TEA — Mutation-schema hardening, Part 2).
 * These exercise the real route handler, not applyBatchUpdate directly
 * (see case-batch-update-service.test.ts for the service-level suite), to
 * prove nullableUrlSchema is actually wired into the schema the route
 * parses against and that the route surfaces its friendly message.
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

async function postBatch(caseId: string, body: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	const req = new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/batch`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await POST(req, { params: Promise.resolve({ id: caseId }) });
}

describe("POST /api/cases/[id]/batch — evidence URL validation (nullableUrlSchema)", () => {
	it("normalises a schemeless URL and stores it with https:// prepended", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: "example.com/report.pdf" },
				},
			],
		});

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(inDb?.url).toBe("https://example.com/report.pdf");
	});

	it("rejects a mailto: address with the friendly message", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: "mailto:x@y" },
				},
			],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(
			"Enter a web address, such as example.com/report.pdf"
		);
	});

	it("clears an existing URL when data.url is null (JSON editor's clear affordance)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/existing.pdf",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: null },
				},
			],
		});

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(inDb?.url).toBeNull();
	});

	it("leaves an existing URL unchanged when data omits url entirely (undefined means leave unchanged, not clear)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/existing.pdf",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { description: "Updated description, no url field at all" },
				},
			],
		});

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(inDb?.url).toBe("https://example.com/existing.pdf");
		expect(inDb?.description).toBe("Updated description, no url field at all");
	});
});

describe("POST /api/cases/[id]/batch — strict schema (unrecognised key rejection)", () => {
	it("rejects an update change whose data carries an unrecognised key (URL, uppercase — batchUpdateRequestSchema only declares lowercase url) with 400 naming the key", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { URL: "https://x.example" },
				},
			],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("URL");
	});
});

const NOT_VIEWABLE_MESSAGE =
	"moduleReferenceId must reference a case you can view";

/** The element types that carry a case reference, as the batch names them. */
const REFERENCING_KINDS = [
	{ type: "AWAY_GOAL", prefix: "AG", extra: {} },
	{ type: "MODULE", prefix: "M", extra: { moduleEmbedType: "REFERENCE" } },
] as const;

type ReferencingKind = (typeof REFERENCING_KINDS)[number];

/** A batch change that creates an element of the kind, pointing at the case. */
function createReferencing(
	kind: ReferencingKind,
	index: number,
	moduleReferenceId: string
) {
	const id = randomUUID();
	return {
		type: "create",
		elementId: id,
		parentId: null,
		data: {
			id,
			type: kind.type,
			name: `${kind.prefix}${index + 1}`,
			description: `Cites case ${index + 1}`,
			inSandbox: false,
			moduleReferenceId,
			...kind.extra,
		},
	};
}

/** A batch change that edits the element's data. */
function updateElement(elementId: string, data: Record<string, unknown>) {
	return { type: "update", elementId, data };
}

describe("POST /api/cases/[id]/batch — the editor must be able to view the case a reference names", () => {
	it.each(
		REFERENCING_KINDS
	)("accepts creates and updates that point at every case the editor can view for a $type", async (kind) => {
		const { editor, homeCase, other, viewable } = await signInEditor();
		const targets = Object.values(viewable);

		const created = await postBatch(homeCase.id, {
			changes: targets.map((caseId, index) =>
				createReferencing(kind, index, caseId)
			),
		});
		expect(created.status).toBe(200);
		const stored = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: kind.type },
		});
		expect(stored.map((row) => row.moduleReferenceId).sort()).toEqual(
			[...targets].sort()
		);

		const hiddenStart = await createTestCase(other.id);
		const existing = await Promise.all(
			targets.map(() =>
				createReferencingElement(
					homeCase.id,
					editor.id,
					kind.type,
					hiddenStart.id
				)
			)
		);
		const updated = await postBatch(homeCase.id, {
			changes: existing.map((element, index) =>
				updateElement(element.id, { moduleReferenceId: targets[index] })
			),
		});
		expect(updated.status).toBe(200);
		for (const [index, element] of existing.entries()) {
			const row = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(row?.moduleReferenceId).toBe(targets[index]);
		}
	});

	it.each(
		REFERENCING_KINDS
	)("refuses creates and updates that point at a case it cannot view, one in the bin or a missing one with the same message for a $type", async (kind) => {
		const { editor, homeCase, hidden, viewable } = await signInEditor();
		const start = await createTestCase(editor.id);
		const element = await createReferencingElement(
			homeCase.id,
			editor.id,
			kind.type,
			start.id
		);

		for (const [label, caseId] of Object.entries(hidden)) {
			const attempts = [
				createReferencing(kind, 0, caseId),
				updateElement(element.id, { moduleReferenceId: caseId }),
			];
			for (const change of attempts) {
				const response = await postBatch(homeCase.id, { changes: [change] });
				expect(response.status, `${label} / ${change.type}`).toBe(400);
				expect((await response.json()).error, label).toBe(NOT_VIEWABLE_MESSAGE);
			}
		}

		// One refused change refuses the whole batch.
		const [viewableId = ""] = Object.values(viewable);
		const mixed = await postBatch(homeCase.id, {
			changes: [
				createReferencing(kind, 0, viewableId),
				createReferencing(kind, 1, hidden["a case the editor cannot view"]),
			],
		});
		expect(mixed.status).toBe(400);
		expect((await mixed.json()).error).toBe(NOT_VIEWABLE_MESSAGE);

		const rows = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id },
		});
		expect(rows.map((row) => row.moduleReferenceId)).toEqual([start.id]);
	});

	it.each(
		REFERENCING_KINDS
	)("saves a batch that leaves the reference of a $type to a case the editor cannot view alone, whether or not it repeats it", async (kind) => {
		const { editor, homeCase, other } = await signInEditor();
		const unviewable = await createTestCase(other.id);
		const element = await createReferencingElement(
			homeCase.id,
			editor.id,
			kind.type,
			unviewable.id
		);

		const reworded = await postBatch(homeCase.id, {
			changes: [updateElement(element.id, { description: "Reworded" })],
		});
		expect(reworded.status).toBe(200);
		const repeated = await postBatch(homeCase.id, {
			changes: [
				updateElement(element.id, {
					description: "Reworded again",
					moduleReferenceId: unviewable.id,
				}),
			],
		});
		expect(repeated.status).toBe(200);

		const row = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(row?.moduleReferenceId).toBe(unviewable.id);
		expect(row?.description).toBe("Reworded again");
	});
});
