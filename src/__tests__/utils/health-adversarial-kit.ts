import { NextRequest } from "next/server";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import { appendHealthEvidence } from "@/lib/services/health-evidence-service";
import {
	issueToken,
	registerIntegration,
} from "@/lib/services/integration-registry-service";
import {
	buildHealthRecords,
	type HealthRecordFixture,
	type HealthRecordName,
	withOverrides,
} from "../fixtures/health-records";
import { expectSuccess } from "./assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "./prisma-factories";

export const MINUTE = 60_000;

export async function setupClaim() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

/** A second property claim in an existing case. */
export function addClaim(caseId: string, ownerId: string) {
	return createTestElement(caseId, ownerId, {
		elementType: "PROPERTY_CLAIM",
	});
}

/** A wire-shape record (not yet validated) for `claimId`. */
export function wireRecord(
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
): HealthRecordFixture {
	return withOverrides(buildHealthRecords(claimId)[name], overrides);
}

/** Validated record, as the routes hand it to the service. */
function parsedRecord(
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
) {
	return healthEvidenceRecordSchema.parse(wireRecord(claimId, name, overrides));
}

/** Appends through the service and returns the stored record. */
export async function appendRecord(
	userId: string,
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
) {
	const record = parsedRecord(claimId, name, overrides);
	expectSuccess(await appendHealthEvidence(userId, claimId, record));
	return record;
}

export const isoAgo = (ms: number, from = Date.now()) =>
	new Date(from - ms).toISOString();

export async function setupMachineWriter(
	ownerId: string,
	caseId: string,
	scopes: string[] = ["health:evidence:write", "health:evidence:read"],
	permission: "VIEW" | "EDIT" | null = "EDIT"
) {
	const { integration, systemUserId } = expectSuccess(
		await registerIntegration(
			{
				name: `adv-health-${ownerId}-${Math.random().toString(36).slice(2)}`,
				scopes,
			},
			ownerId
		)
	);
	const { secret } = expectSuccess(await issueToken(integration.id, ownerId));
	if (permission) {
		await createTestPermission(caseId, systemUserId, ownerId, permission);
	}
	return { secret, systemUserId };
}

const EVIDENCE = (claimId: string) =>
	`http://localhost:3000/api/machine/health/elements/${claimId}/evidence`;

export function machinePost(claimId: string, body: unknown, token?: string) {
	return new NextRequest(EVIDENCE(claimId), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: typeof body === "string" ? body : JSON.stringify(body),
	});
}

export function machineGet(claimId: string, token?: string, query = "") {
	return new NextRequest(`${EVIDENCE(claimId)}${query}`, {
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});
}

export const importMachineRoute = () =>
	import("@/app/api/machine/health/elements/[id]/evidence/route");

export function sessionJson(
	url: string,
	method: "POST" | "PUT",
	body: unknown,
	headers: Record<string, string> = {}
) {
	return new NextRequest(url, {
		method,
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

const BASE = "http://localhost:3000/api/elements";

export const revocationUrl = (claimId: string, recordId: string) =>
	`${BASE}/${claimId}/health/records/${recordId}/revocation`;
const reinstatementUrl = (claimId: string, recordId: string) =>
	`${BASE}/${claimId}/health/records/${recordId}/reinstatement`;
const boundCheckUrl = (claimId: string) =>
	`${BASE}/${claimId}/health/bound-check`;
const statusUrl = (claimId: string) => `${BASE}/${claimId}/health`;

export async function callRevoke(
	claimId: string,
	recordId: string,
	body: unknown = { cause: "evidence-defect", reason: "Bad run" }
) {
	const { POST } = await import(
		"@/app/api/elements/[id]/health/records/[recordId]/revocation/route"
	);
	return await POST(
		sessionJson(revocationUrl(claimId, recordId), "POST", body),
		{ params: Promise.resolve({ id: claimId, recordId }) }
	);
}

export async function callReinstate(
	claimId: string,
	recordId: string,
	body: unknown = { reason: "Run was fine" }
) {
	const { POST } = await import(
		"@/app/api/elements/[id]/health/records/[recordId]/reinstatement/route"
	);
	return await POST(
		sessionJson(reinstatementUrl(claimId, recordId), "POST", body),
		{ params: Promise.resolve({ id: claimId, recordId }) }
	);
}

export async function callBoundCheck(
	claimId: string,
	body: unknown = { name: "Another Checker", reason: "Renamed" }
) {
	const { PUT } = await import(
		"@/app/api/elements/[id]/health/bound-check/route"
	);
	return await PUT(sessionJson(boundCheckUrl(claimId), "PUT", body), {
		params: Promise.resolve({ id: claimId }),
	});
}

export async function callStatus(claimId: string) {
	const { GET } = await import("@/app/api/elements/[id]/health/route");
	return await GET(new NextRequest(statusUrl(claimId)), {
		params: Promise.resolve({ id: claimId }),
	});
}
