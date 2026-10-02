import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import { appendHealthEvidence } from "@/lib/services/health-evidence-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthRecords,
	type HealthRecordName,
	withOverrides,
} from "../fixtures/health-records";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return {
		...actual,
		emitSSEEvent: vi.fn(),
	};
});

const BASE = "http://localhost:3000/api/elements";

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

async function append(
	ownerId: string,
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
) {
	const record = healthEvidenceRecordSchema.parse(
		withOverrides(buildHealthRecords(claimId)[name], overrides)
	);
	expectSuccess(await appendHealthEvidence(ownerId, claimId, record));
	return record;
}

function jsonRequest(
	url: string,
	method: "POST" | "PUT",
	body: unknown,
	headers: Record<string, string> = {}
): NextRequest {
	return new NextRequest(url, {
		method,
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

const revocationUrl = (claimId: string, recordId: string) =>
	`${BASE}/${claimId}/health/records/${recordId}/revocation`;
const reinstatementUrl = (claimId: string, recordId: string) =>
	`${BASE}/${claimId}/health/records/${recordId}/reinstatement`;
const boundCheckUrl = (claimId: string) =>
	`${BASE}/${claimId}/health/bound-check`;

const importRevocation = () =>
	import("@/app/api/elements/[id]/health/records/[recordId]/revocation/route");
const importReinstatement = () =>
	import(
		"@/app/api/elements/[id]/health/records/[recordId]/reinstatement/route"
	);
const importBoundCheck = () =>
	import("@/app/api/elements/[id]/health/bound-check/route");

async function revoke(
	claimId: string,
	recordId: string,
	body: unknown = { cause: "evidence-defect", reason: "Bad run" }
) {
	const { POST } = await importRevocation();
	return await POST(
		jsonRequest(revocationUrl(claimId, recordId), "POST", body),
		{
			params: Promise.resolve({ id: claimId, recordId }),
		}
	);
}

async function reinstate(
	claimId: string,
	recordId: string,
	body: unknown = { reason: "Run was fine" }
) {
	const { POST } = await importReinstatement();
	return await POST(
		jsonRequest(reinstatementUrl(claimId, recordId), "POST", body),
		{ params: Promise.resolve({ id: claimId, recordId }) }
	);
}

async function changeCheck(
	claimId: string,
	body: unknown = { name: "Forecast Availability Checker", reason: "Renamed" }
) {
	const { PUT } = await importBoundCheck();
	return await PUT(jsonRequest(boundCheckUrl(claimId), "PUT", body), {
		params: Promise.resolve({ id: claimId }),
	});
}

describe("POST .../health/records/[recordId]/revocation", () => {
	it("revokes the record for an editor: 201 with the revocation and the new status, and announces the change", async () => {
		const { owner, testCase, claim } = await setup();
		const first = await append(owner.id, claim.id, "populationPass", {
			timestamp: new Date(Date.now() - 600_000).toISOString(),
		});
		const latest = await append(owner.id, claim.id, "failingSummary");
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await revoke(claim.id, latest.record_id, {
			cause: "evidence-defect",
			reason: "Bad run",
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.revocation).toEqual({
			cause: "evidence-defect",
			reason: "Bad run",
			revoked_at: expect.any(String),
			revoked_by_name: owner.username,
		});
		expect(body.status).toMatchObject({
			verdict: "pass",
			record_id: first.record_id,
		});
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({ claimId: claim.id })
		);
	});

	it("allows a person with EDIT through a direct share", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id);
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		expect((await revoke(claim.id, record.record_id)).status).toBe(201);
	});

	it("refuses a view-only person and a person with no access, revoking nothing", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id);
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		const outsider = await createTestUser();

		for (const person of [viewer, outsider]) {
			await mockAuth(person.id, person.username, person.email);
			expect((await revoke(claim.id, record.record_id)).status).toBe(404);
		}
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("refuses a machine token: no session means 401", async () => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id);
		const { POST } = await importRevocation();

		const response = await POST(
			jsonRequest(
				revocationUrl(claim.id, record.record_id),
				"POST",
				{ cause: "evidence-defect", reason: "x" },
				{ authorization: "Bearer not-a-session" }
			),
			{ params: Promise.resolve({ id: claim.id, recordId: record.record_id }) }
		);

		expect(response.status).toBe(401);
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
	});

	it.each([
		["no reason", { cause: "evidence-defect" }],
		["a blank reason", { cause: "evidence-defect", reason: "  " }],
		["no cause", { reason: "Bad run" }],
		["an unknown cause", { cause: "boredom", reason: "Bad run" }],
	])("refuses %s with 400", async (_label, body) => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id);
		await mockAuth(owner.id, owner.username, owner.email);

		expect((await revoke(claim.id, record.record_id, body)).status).toBe(400);
		expect(await prisma.pluginHealthRevocation.count()).toBe(0);
	});

	it("refuses an already revoked record with 409, and an unknown record with 404", async () => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id);
		await mockAuth(owner.id, owner.username, owner.email);

		expect((await revoke(claim.id, record.record_id)).status).toBe(201);
		expect((await revoke(claim.id, record.record_id)).status).toBe(409);
		expect((await revoke(claim.id, crypto.randomUUID())).status).toBe(404);
	});
});

describe("POST .../health/records/[recordId]/reinstatement", () => {
	it("restores a revoked record and keeps the revocation row", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id);
		await mockAuth(owner.id, owner.username, owner.email);
		expect((await revoke(claim.id, record.record_id)).status).toBe(201);
		vi.mocked(emitSSEEvent).mockClear();

		const response = await reinstate(claim.id, record.record_id);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.status).toMatchObject({
			verdict: "pass",
			record_id: record.record_id,
			stale: false,
		});
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({ claimId: claim.id })
		);
		const rows = await prisma.pluginHealthRevocation.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			reinstatedById: owner.id,
			reinstatementReason: "Run was fine",
		});
	});

	it("refuses a view-only person, a missing reason, and a record that is not revoked", async () => {
		const { owner, testCase, claim } = await setup();
		const record = await append(owner.id, claim.id);
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		await mockAuth(owner.id, owner.username, owner.email);
		expect((await reinstate(claim.id, record.record_id)).status).toBe(409);
		expect((await reinstate(claim.id, record.record_id, {})).status).toBe(400);
		expect((await revoke(claim.id, record.record_id)).status).toBe(201);

		await mockAuth(viewer.id, viewer.username, viewer.email);
		expect((await reinstate(claim.id, record.record_id)).status).toBe(404);
	});

	it("refuses with no session", async () => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id);

		expect((await reinstate(claim.id, record.record_id)).status).toBe(401);
	});
});

describe("PUT .../health/bound-check", () => {
	it("rebinds the claim for an editor, writes a history row, and flips which check is accepted", async () => {
		const { owner, claim } = await setup();
		await append(owner.id, claim.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await changeCheck(claim.id);

		expect(response.status).toBe(200);
		expect((await response.json()).status.bound_check).toBe(
			"Forecast Availability Checker"
		);
		const history = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id, source: "PERSON" },
		});
		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			fromCheckName: "Sensor Range Checker",
			toCheckName: "Forecast Availability Checker",
			reason: "Renamed",
			changedById: owner.id,
		});
		expect(emitSSEEvent).toHaveBeenCalled();

		const accepted = healthEvidenceRecordSchema.parse(
			buildHealthRecords(claim.id).wholeSystem
		);
		expectSuccess(await appendHealthEvidence(owner.id, claim.id, accepted));
		const refused = healthEvidenceRecordSchema.parse(
			buildHealthRecords(claim.id).marginalSummary
		);
		const result = await appendHealthEvidence(owner.id, claim.id, refused);
		expect("error" in result && result.error).toContain(
			"This claim is bound to check Forecast Availability Checker"
		);
	});

	it("refuses a missing reason, an unchanged name, a view-only person and no session", async () => {
		const { owner, testCase, claim } = await setup();
		await append(owner.id, claim.id);
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expect((await changeCheck(claim.id)).status).toBe(401);

		await mockAuth(viewer.id, viewer.username, viewer.email);
		expect((await changeCheck(claim.id)).status).toBe(404);

		await mockAuth(owner.id, owner.username, owner.email);
		expect((await changeCheck(claim.id, { name: "Other" })).status).toBe(400);
		expect(
			(
				await changeCheck(claim.id, {
					name: "Sensor Range Checker",
					reason: "Nothing to change",
				})
			).status
		).toBe(409);
		expect(
			await prisma.pluginHealthBindingChange.count({
				where: { claimId: claim.id, source: "PERSON" },
			})
		).toBe(0);
	});
});

describe("disabled plugin", () => {
	it("refuses all three routes cleanly (403, not a 500)", async () => {
		const { owner, claim } = await setup();
		const record = await append(owner.id, claim.id);
		await mockAuth(owner.id, owner.username, owner.email);
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");

		expect((await revoke(claim.id, record.record_id)).status).toBe(403);
		expect((await reinstate(claim.id, record.record_id)).status).toBe(403);
		expect((await changeCheck(claim.id)).status).toBe(403);
	});
});
