import { NextRequest } from "next/server";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";
import {
	issueToken,
	registerIntegration,
} from "@/lib/services/integration-registry-service";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "./assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "./prisma-factories";

export const HEALTH_SCOPES = [
	"case:read",
	"health:checks:write",
	"health:criteria:read",
	"health:evidence:read",
	"health:evidence:write",
];

const BASE = "http://localhost:3000/api";

/** A case with a claim, and a pipeline integration (with a token) that holds EDIT on it and has published the demo check list. */
export async function setupCriteriaCase(
	options: { publish?: boolean; scopes?: string[] } = {}
) {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	const pipeline = await addPipeline(owner.id, testCase.id, options);
	return { owner, testCase, claim, ...pipeline };
}

/** Registers another pipeline integration owned by `ownerId` with EDIT on `caseId`. */
export async function addPipeline(
	ownerId: string,
	caseId: string,
	options: { publish?: boolean; scopes?: string[] } = {}
) {
	const { integration, systemUserId } = expectSuccess(
		await registerIntegration(
			{
				name: `crit-pipeline-${Math.random().toString(36).slice(2)}`,
				scopes: options.scopes ?? HEALTH_SCOPES,
			},
			ownerId
		)
	);
	const { secret } = expectSuccess(await issueToken(integration.id, ownerId));
	await createTestPermission(caseId, systemUserId, ownerId, "EDIT");
	if (options.publish !== false) {
		expectSuccess(
			await publishHealthCheckList(
				{ integrationId: integration.id, systemUserId },
				// The fixture is plain data; the route parses the same shape.
				buildHealthCheckList() as never
			)
		);
	}
	return { integration, systemUserId, secret };
}

/** Complete settings for the demo yes-or-no check: its own recommendation, with `overrides` applied. */
export function itemSettings(overrides: Record<string, unknown> = {}) {
	const check = buildHealthCheckList().checks.find(
		(entry) => entry.name === ITEM_CHECK_NAME
	);
	if (!check) {
		throw new Error("fixture check missing");
	}
	return {
		check: {
			name: check.name,
			version: check.version,
			scope: "item",
			params: { camera_line: "ALL" },
		},
		...check.recommended,
		...overrides,
	};
}

export function saveBody(
	integrationId: string,
	settings: Record<string, unknown> = itemSettings(),
	accept = false
) {
	return { integration_id: integrationId, settings, accept };
}

export function jsonRequest(
	url: string,
	method: string,
	body?: unknown,
	headers: Record<string, string> = {}
) {
	return new NextRequest(url, {
		method,
		headers: { "content-type": "application/json", ...headers },
		...(body === undefined
			? {}
			: { body: typeof body === "string" ? body : JSON.stringify(body) }),
	});
}

const bearer = (token?: string): Record<string, string> =>
	token ? { authorization: `Bearer ${token}` } : {};

export const criteriaUrl = (claimId: string) =>
	`${BASE}/elements/${claimId}/health/criteria`;

export async function callCriteriaGet(claimId: string, token?: string) {
	const { GET } = await import("@/app/api/elements/[id]/health/criteria/route");
	return await GET(
		jsonRequest(criteriaUrl(claimId), "GET", undefined, bearer(token)),
		{
			params: Promise.resolve({ id: claimId }),
		}
	);
}

export async function callCriteriaPut(
	claimId: string,
	body: unknown,
	token?: string
) {
	const { PUT } = await import("@/app/api/elements/[id]/health/criteria/route");
	return await PUT(
		jsonRequest(criteriaUrl(claimId), "PUT", body, bearer(token)),
		{
			params: Promise.resolve({ id: claimId }),
		}
	);
}

export async function callRetirement(
	claimId: string,
	body: unknown = { reason: "Superseded by new settings" },
	token?: string
) {
	const { POST } = await import(
		"@/app/api/elements/[id]/health/criteria/retirement/route"
	);
	return await POST(
		jsonRequest(
			`${criteriaUrl(claimId)}/retirement`,
			"POST",
			body,
			bearer(token)
		),
		{ params: Promise.resolve({ id: claimId }) }
	);
}

export async function callCaseChecks(caseId: string) {
	const { GET } = await import("@/app/api/cases/[id]/health/checks/route");
	return await GET(
		jsonRequest(`${BASE}/cases/${caseId}/health/checks`, "GET"),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

export async function callHygiene(caseId: string) {
	const { GET } = await import("@/app/api/cases/[id]/health/hygiene/route");
	return await GET(
		jsonRequest(`${BASE}/cases/${caseId}/health/hygiene`, "GET"),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

export async function callPublishChecks(body: unknown, token?: string) {
	const { PUT } = await import("@/app/api/machine/health/checks/route");
	return await PUT(
		jsonRequest(`${BASE}/machine/health/checks`, "PUT", body, bearer(token))
	);
}

export async function callMachineCaseCriteria(caseId: string, token?: string) {
	const { GET } = await import(
		"@/app/api/machine/health/cases/[id]/criteria/route"
	);
	return await GET(
		jsonRequest(
			`${BASE}/machine/health/cases/${caseId}/criteria`,
			"GET",
			undefined,
			bearer(token)
		),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

export async function callMachineClaimCriteria(
	claimId: string,
	token?: string
) {
	const { GET } = await import(
		"@/app/api/machine/health/elements/[id]/criteria/route"
	);
	return await GET(
		jsonRequest(
			`${BASE}/machine/health/elements/${claimId}/criteria`,
			"GET",
			undefined,
			bearer(token)
		),
		{ params: Promise.resolve({ id: claimId }) }
	);
}

export async function callMachineClaimStatus(claimId: string, token?: string) {
	const { GET } = await import(
		"@/app/api/machine/health/elements/[id]/status/route"
	);
	return await GET(
		jsonRequest(
			`${BASE}/machine/health/elements/${claimId}/status`,
			"GET",
			undefined,
			bearer(token)
		),
		{ params: Promise.resolve({ id: claimId }) }
	);
}

export async function callMachineCaseStatus(caseId: string, token?: string) {
	const { GET } = await import(
		"@/app/api/machine/health/cases/[id]/status/route"
	);
	return await GET(
		jsonRequest(
			`${BASE}/machine/health/cases/${caseId}/status`,
			"GET",
			undefined,
			bearer(token)
		),
		{ params: Promise.resolve({ id: caseId }) }
	);
}
