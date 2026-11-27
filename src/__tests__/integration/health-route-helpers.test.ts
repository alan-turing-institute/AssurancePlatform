import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	announceHealthChange,
	answerCriteriaChange,
	answerCriteriaRead,
	handleHealthRecordAction,
	parseHealthBody,
	requireClaimRequest,
} from "@/lib/health-route-helpers";
import { criteriaSaveRequestSchema } from "@/lib/schemas/health-criteria";
import {
	healthEvidenceRecordSchema,
	revocationRequestSchema,
} from "@/lib/schemas/health-evidence";
import {
	readCriteria,
	saveCriteria,
} from "@/lib/services/health-criteria-service";
import {
	appendHealthEvidence,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import type { HealthStatus } from "@/lib/services/health-status-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import type { ServiceResult } from "@/types/service";
import { buildHealthRecords } from "../fixtures/health-records";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "../utils/health-criteria-kit";
import {
	createTestElement,
	createTestPermission,
	createTestUser,
	enableTestPlugin,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const NON_BLANK = /\S/;
const MISSING_ID = "123e4567-e89b-42d3-a456-426614174000";
const URL_BASE = "http://localhost:3000/api/test";
const VALID_REVOCATION = { cause: "evidence-defect", reason: "Bad run" };

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface Person {
	email: string;
	id: string;
	username: string;
}

async function signIn(user: Person) {
	await mockAuth(user.id, user.username, user.email);
}

/** A user with the health plug-in on, optionally holding `level` on the case. */
async function personWith(
	caseId: string,
	grantedById: string,
	level: "VIEW" | "EDIT" | null,
	pluginOn = true
) {
	const user = await createTestUser();
	if (pluginOn) {
		await enableTestPlugin(user.id, "tea.health");
	}
	if (level) {
		await createTestPermission(caseId, user.id, grantedById, level);
	}
	return user;
}

function postRequest(body: string | undefined): NextRequest {
	return new NextRequest(URL_BASE, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	});
}

function jsonPost(body: unknown): NextRequest {
	return postRequest(JSON.stringify(body));
}

async function appendRecord(ownerId: string, claimId: string) {
	const record = healthEvidenceRecordSchema.parse(
		buildHealthRecords(claimId).populationPass
	);
	expectSuccess(await appendHealthEvidence(ownerId, claimId, record));
	return record;
}

async function caseWithClaim() {
	const context = await setupCriteriaCase();
	return context;
}

async function bodyOf(response: NextResponse) {
	return { status: response.status, body: await response.json() };
}

describe("announceHealthChange", () => {
	it("announces the claim's new status to its case and returns it", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		await appendRecord(owner.id, claim.id);

		const status = await announceHealthChange(claim.id, testCase.id);

		expect(status).toMatchObject({ verdict: "pass" });
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			{ claimId: claim.id, status }
		);
	});

	it("merges the extra payload into the announcement", async () => {
		const { testCase, claim } = await caseWithClaim();

		await announceHealthChange(claim.id, testCase.id, { reason: "retired" });

		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			{ claimId: claim.id, status: null, reason: "retired" }
		);
	});

	it("announces a null status, and returns null, for a claim with no evidence", async () => {
		const { testCase, claim } = await caseWithClaim();

		const status = await announceHealthChange(claim.id, testCase.id);

		expect(status).toBeNull();
		expect(vi.mocked(emitSSEEvent).mock.calls).toStrictEqual([
			[
				"tea.health/state-changed",
				testCase.id,
				{ claimId: claim.id, status: null },
			],
		]);
	});
});

describe("parseHealthBody", () => {
	it("returns the parsed body for one that fits the schema", async () => {
		const parsed = await parseHealthBody(
			jsonPost(VALID_REVOCATION),
			revocationRequestSchema
		);

		expect(parsed).toStrictEqual(VALID_REVOCATION);
	});

	it("refuses a body that does not fit, naming the field", async () => {
		const error = await parseHealthBody(
			jsonPost({ cause: "evidence-defect" }),
			revocationRequestSchema
		).catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			statusCode: 400,
			code: "VALIDATION",
			fieldErrors: { reason: expect.any(String) },
		});
		expect((error as Error).message.startsWith("reason: ")).toBe(true);
	});

	it("lists every failing field", async () => {
		const error = await parseHealthBody(
			jsonPost({ cause: "no-such-cause" }),
			revocationRequestSchema
		).catch((caught: unknown) => caught);

		const fields = Object.keys(
			(error as { fieldErrors: Record<string, string> }).fieldErrors
		);
		expect(fields.sort()).toStrictEqual(["cause", "reason"]);
	});

	it("refuses a body that is not JSON with a 400", async () => {
		await expect(
			parseHealthBody(postRequest("{not json"), revocationRequestSchema)
		).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION" });
	});

	it("refuses an empty body with a 400 against a schema that needs fields", async () => {
		await expect(
			parseHealthBody(postRequest(undefined), revocationRequestSchema)
		).rejects.toMatchObject({
			statusCode: 400,
			code: "VALIDATION",
			fieldErrors: { "(record)": expect.any(String) },
		});
	});

	it("applies the size limit it is given and a larger default otherwise", async () => {
		const schema = z.object({ text: z.string() });
		const body = { text: "x".repeat(200) };

		await expect(
			parseHealthBody(jsonPost(body), schema, { maxBytes: 100 })
		).rejects.toMatchObject({ statusCode: 413 });
		await expect(
			parseHealthBody(jsonPost(body), schema)
		).resolves.toStrictEqual(body);
	});
});

describe("requireClaimRequest", () => {
	it("returns the signed-in user, their name and the claim id", async () => {
		await mockAuth(MISSING_ID, "ada", "ada@example.test");

		const result = await requireClaimRequest(
			Promise.resolve({ id: MISSING_ID })
		);

		expect(result).toStrictEqual({
			userId: MISSING_ID,
			username: "ada",
			claimId: MISSING_ID,
		});
	});

	it("returns the claim id in lower case", async () => {
		await mockAuth(MISSING_ID, "ada", "ada@example.test");

		const result = await requireClaimRequest(
			Promise.resolve({ id: MISSING_ID.toUpperCase() })
		);

		expect(result.claimId).toBe(MISSING_ID);
	});

	it.each([
		["a name", "ada", "ada@example.test", "ada"],
		["no name", "", "ada@example.test", "ada@example.test"],
		["neither name nor address", "", "", "Someone"],
	])("names the user from %s", async (_label, username, email, expected) => {
		await mockAuth(MISSING_ID, username, email);

		const result = await requireClaimRequest(
			Promise.resolve({ id: MISSING_ID })
		);

		expect(result.username).toBe(expected);
	});

	it("refuses an id that is not a UUID with a 400", async () => {
		await mockAuth(MISSING_ID, "ada", "ada@example.test");

		await expect(
			requireClaimRequest(Promise.resolve({ id: "not-a-uuid" }))
		).rejects.toMatchObject({
			statusCode: 400,
			code: "VALIDATION",
			message: expect.stringMatching(NON_BLANK),
		});
	});

	it("refuses a request with no session with a 401", async () => {
		await expect(
			requireClaimRequest(Promise.resolve({ id: MISSING_ID }))
		).rejects.toMatchObject({ statusCode: 401 });
	});

	it("refuses a request with no session before it looks at the id", async () => {
		await expect(
			requireClaimRequest(Promise.resolve({ id: "not-a-uuid" }))
		).rejects.toMatchObject({ statusCode: 401 });
	});
});

/** Reads a claim's settings the way the read route does, for whoever is signed in. */
async function readAs(claimId: string) {
	const { userId, claimId: id } = await requireClaimRequest(
		Promise.resolve({ id: claimId })
	);
	return await bodyOf(answerCriteriaRead(await readCriteria(userId, id)));
}

describe("answerCriteriaRead", () => {
	it("answers 200 with the settings view for an owner and a viewer", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const viewer = await personWith(testCase.id, owner.id, "VIEW");

		for (const person of [owner, viewer]) {
			await signIn(person);
			const { status, body } = await readAs(claim.id);
			expect(status).toBe(200);
			expect(body.criteria).toBeNull();
		}
	});

	it("gives the same answer for a missing claim, a non-claim element, and a caller with no access", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const stranger = await personWith(testCase.id, owner.id, null);

		await signIn(stranger);
		const noAccess = await readAs(claim.id);
		await signIn(owner);
		const missing = await readAs(MISSING_ID);
		const notClaim = await readAs(goal.id);

		expect(noAccess.status).toBe(404);
		expect(noAccess.body.code).toBe("NOT_FOUND");
		expect(missing).toStrictEqual(noAccess);
		expect(notClaim).toStrictEqual(noAccess);
	});

	it("answers 403 when the plug-in is off for the caller", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const off = await personWith(testCase.id, owner.id, "VIEW", false);
		await signIn(off);

		const { status } = await readAs(claim.id);

		expect(status).toBe(403);
	});
});

/** Saves settings the way the change route does, for whoever is signed in. */
async function saveAs(claimId: string, body: unknown) {
	const {
		userId,
		username,
		claimId: id,
	} = await requireClaimRequest(Promise.resolve({ id: claimId }));
	const parsed = await parseHealthBody(
		jsonPost(body),
		criteriaSaveRequestSchema
	);
	const result = await saveCriteria(userId, id, parsed);
	return await bodyOf(
		await answerCriteriaChange(result, id, { userId, username })
	);
}

/** The `index`th live event sent so far. */
function emitted(index: number) {
	const call = vi.mocked(emitSSEEvent).mock.calls[index];
	if (!call) {
		throw new Error(`no event at ${index}`);
	}
	return call;
}

function acceptBody(
	integrationId: string,
	extra: Record<string, unknown> = {}
) {
	return { ...saveBody(integrationId, itemSettings(), true), ...extra };
}

describe("answerCriteriaChange", () => {
	it("announces the new element, then the claim's health, and answers with the view", async () => {
		const { owner, testCase, claim, integration } = await caseWithClaim();
		await signIn(owner);

		const { status, body } = await saveAs(
			claim.id,
			acceptBody(integration.id, { add_evidence_node: true })
		);

		expect(status).toBe(200);
		expect(body.criteria.state).toBe("accepted");
		const calls = vi.mocked(emitSSEEvent).mock.calls;
		expect(calls.map((call) => call[0])).toStrictEqual([
			"element:created",
			"tea.health/state-changed",
		]);
		const [, eventCase, payload] = emitted(0);
		expect(eventCase).toBe(testCase.id);
		expect(payload).toMatchObject({
			username: owner.username,
			userId: owner.id,
			elementId: expect.any(String),
			element: { id: expect.any(String) },
		});
		expect(emitted(1)[1]).toBe(testCase.id);
		expect(emitted(1)[2]).toMatchObject({ claimId: claim.id });
	});

	it("announces only the claim's health when no element changed", async () => {
		const { owner, testCase, claim, integration } = await caseWithClaim();
		await signIn(owner);

		const { status } = await saveAs(claim.id, acceptBody(integration.id));

		expect(status).toBe(200);
		expect(
			vi.mocked(emitSSEEvent).mock.calls.map((call) => call[0])
		).toStrictEqual(["tea.health/state-changed"]);
		expect(emitted(0)[1]).toBe(testCase.id);
	});

	it("sends an element announcement without an element field when none is given", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const view = expectSuccess(await readCriteria(owner.id, claim.id));

		await answerCriteriaChange(
			{
				data: {
					caseId: testCase.id,
					view,
					elementEvent: {
						kind: "deleted",
						elementId: MISSING_ID,
						elementName: "Gone",
					},
				},
			},
			claim.id,
			{ userId: owner.id, username: "ada" }
		);

		expect(emitted(0)).toStrictEqual([
			"element:deleted",
			testCase.id,
			{
				elementId: MISSING_ID,
				elementName: "Gone",
				username: "ada",
				userId: owner.id,
			},
		]);
	});

	it("answers a refused save with the mapped error and announces nothing", async () => {
		const { owner, testCase, claim, integration } = await caseWithClaim();
		const viewer = await personWith(testCase.id, owner.id, "VIEW");
		await signIn(viewer);

		const refused = await saveAs(claim.id, acceptBody(integration.id));
		await signIn(owner);
		const missing = await saveAs(MISSING_ID, acceptBody(integration.id));

		expect(refused.status).toBe(404);
		expect(refused.body.code).toBe("NOT_FOUND");
		expect(missing).toStrictEqual(refused);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("answers a refused save by someone without the plug-in with 403", async () => {
		const { owner, testCase, claim, integration } = await caseWithClaim();
		const off = await personWith(testCase.id, owner.id, "EDIT", false);
		await signIn(off);

		const { status } = await saveAs(claim.id, acceptBody(integration.id));

		expect(status).toBe(403);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("answers invalid settings with a 400 that names the fields", async () => {
		const { claim } = await caseWithClaim();

		const response = await answerCriteriaChange(
			{
				invalid: {
					message: "settings.rule: is wrong",
					fieldErrors: { "settings.rule": "is wrong" },
				},
			},
			claim.id,
			{ userId: MISSING_ID, username: "ada" }
		);

		expect(await bodyOf(response)).toStrictEqual({
			status: 400,
			body: {
				error: "settings.rule: is wrong",
				code: "VALIDATION",
				fieldErrors: { "settings.rule": "is wrong" },
			},
		});
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("answers a service error with the mapped status", async () => {
		const response = await answerCriteriaChange(
			{ error: "Claim not found" },
			MISSING_ID,
			{ userId: MISSING_ID, username: "ada" }
		);

		expect(response.status).toBe(404);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});
});

interface Args {
	body: unknown;
	claimId: string;
	recordId: string;
	userId: string;
}

/** An action that records its arguments and succeeds for `caseId`. */
function recordingAction(caseId: string) {
	const seen: Args[] = [];
	const action = (
		userId: string,
		claimId: string,
		recordId: string,
		body: unknown
	) => {
		seen.push({ userId, claimId, recordId, body });
		return Promise.resolve({ data: { caseId } });
	};
	return { seen, action };
}

const respondOk = (data: { caseId: string }, status: unknown) =>
	Response.json({ data, status }, { status: 202 }) as NextResponse;

type RevocationBody = z.output<typeof revocationRequestSchema>;

function runRecordAction<D extends { caseId: string }>(
	ids: { id: string; recordId: string },
	body: unknown,
	action: (
		userId: string,
		claimId: string,
		recordId: string,
		body: RevocationBody
	) => ServiceResult<D>,
	respond: (data: D, status: HealthStatus | null) => NextResponse
) {
	return handleHealthRecordAction(
		jsonPost(body),
		Promise.resolve(ids),
		revocationRequestSchema,
		action,
		respond
	);
}

function runRecording(
	ids: { id: string; recordId: string },
	body: unknown,
	action: (
		userId: string,
		claimId: string,
		recordId: string,
		body: RevocationBody
	) => ServiceResult<{ caseId: string }>
) {
	return runRecordAction(ids, body, action, respondOk);
}

describe("handleHealthRecordAction with a recording action", () => {
	it("runs the action with the user, the lower-cased ids and the parsed body, then announces and responds", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		await appendRecord(owner.id, claim.id);
		await signIn(owner);
		const { seen, action } = recordingAction(testCase.id);
		const recordId = "ABCDEF12-e89b-42d3-a456-426614174000";

		const response = await runRecording(
			{ id: claim.id.toUpperCase(), recordId },
			VALID_REVOCATION,
			action
		);

		expect(seen).toStrictEqual([
			{
				userId: owner.id,
				claimId: claim.id,
				recordId: recordId.toLowerCase(),
				body: VALID_REVOCATION,
			},
		]);
		const { status, body } = await bodyOf(response);
		expect(status).toBe(202);
		expect(body.data).toStrictEqual({ caseId: testCase.id });
		expect(body.status).toMatchObject({ verdict: "pass" });
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			{ claimId: claim.id, status: body.status }
		);
	});

	it.each([
		["the claim id", { id: "nope", recordId: MISSING_ID }],
		["the record id", { id: MISSING_ID, recordId: "nope" }],
		["both ids", { id: "nope", recordId: "nope" }],
	])("refuses a bad %s with a 400 and runs nothing", async (_label, ids) => {
		await signIn(await createTestUser());
		const { seen, action } = recordingAction(MISSING_ID);

		const response = await runRecording(ids, VALID_REVOCATION, action);

		expect(await bodyOf(response)).toStrictEqual({
			status: 400,
			body: {
				error: expect.stringMatching(NON_BLANK),
				code: "VALIDATION",
			},
		});
		expect(seen).toHaveLength(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("refuses a body that does not fit with a 400 naming the field, and runs nothing", async () => {
		await signIn(await createTestUser());
		const { seen, action } = recordingAction(MISSING_ID);

		const response = await runRecording(
			{ id: MISSING_ID, recordId: MISSING_ID },
			{ cause: "evidence-defect" },
			action
		);

		const { status, body } = await bodyOf(response);
		expect(status).toBe(400);
		expect(body.code).toBe("VALIDATION");
		expect(seen).toHaveLength(0);
	});

	it("answers 401 with no session and runs nothing", async () => {
		const { seen, action } = recordingAction(MISSING_ID);

		const response = await runRecording(
			{ id: MISSING_ID, recordId: MISSING_ID },
			VALID_REVOCATION,
			action
		);

		expect(response.status).toBe(401);
		expect(seen).toHaveLength(0);
	});

	it("answers an unexpected failure of the action with a 500 and announces nothing", async () => {
		await signIn(await createTestUser());

		const response = await runRecording(
			{ id: MISSING_ID, recordId: MISSING_ID },
			VALID_REVOCATION,
			() => Promise.reject(new Error("boom"))
		);

		const { status, body } = await bodyOf(response);
		expect(status).toBe(500);
		expect(body.code).toBe("INTERNAL");
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});
});

describe("handleHealthRecordAction access with the revocation service", () => {
	async function revokeAs(claimId: string, recordId: string) {
		const response = await runRecordAction(
			{ id: claimId, recordId },
			VALID_REVOCATION,
			revokeHealthEvidence,
			(data, status) =>
				Response.json(
					{ revocation: data.revocation, status },
					{ status: 201 }
				) as NextResponse
		);
		return await bodyOf(response);
	}

	it("lets the owner and a person with EDIT revoke", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const editor = await personWith(testCase.id, owner.id, "EDIT");
		const first = await appendRecord(owner.id, claim.id);
		await signIn(editor);

		const { status, body } = await revokeAs(claim.id, first.record_id);

		expect(status).toBe(201);
		expect(body.revocation.cause).toBe("evidence-defect");
		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
	});

	it("gives a view-only caller, a stranger, a missing claim and a non-claim element the same answer", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const record = await appendRecord(owner.id, claim.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const viewer = await personWith(testCase.id, owner.id, "VIEW");
		const stranger = await personWith(testCase.id, owner.id, null);

		await signIn(viewer);
		const asViewer = await revokeAs(claim.id, record.record_id);
		await signIn(stranger);
		const asStranger = await revokeAs(claim.id, record.record_id);
		await signIn(owner);
		const missing = await revokeAs(MISSING_ID, record.record_id);
		const notClaim = await revokeAs(goal.id, record.record_id);

		expect(asViewer.status).toBe(404);
		expect(asViewer.body.code).toBe("NOT_FOUND");
		for (const other of [asStranger, missing, notClaim]) {
			expect(other).toStrictEqual(asViewer);
		}
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("answers 403 and revokes nothing when the plug-in is off for the caller", async () => {
		const { owner, testCase, claim } = await caseWithClaim();
		const record = await appendRecord(owner.id, claim.id);
		const off = await personWith(testCase.id, owner.id, "EDIT", false);
		await signIn(off);

		const { status } = await revokeAs(claim.id, record.record_id);

		expect(status).toBe(403);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("answers 404 for a record that does not exist on the claim", async () => {
		const { owner, claim } = await caseWithClaim();
		await signIn(owner);

		const { status } = await revokeAs(claim.id, MISSING_ID);

		expect(status).toBe(404);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});
});
