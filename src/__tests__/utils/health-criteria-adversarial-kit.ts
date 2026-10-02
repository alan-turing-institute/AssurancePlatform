import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";
import { registerIntegration } from "@/lib/services/integration-registry-service";
import {
	buildHealthCheckList,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "../fixtures/health-checks";
import { expectSuccess } from "./assertion-helpers";
import { mockAuth } from "./auth-helpers";
import { importMachineRoute, machinePost } from "./health-adversarial-kit";
import {
	addPipeline,
	callCriteriaGet,
	callCriteriaPut,
	callMachineClaimCriteria,
	itemSettings,
	saveBody,
	setupCriteriaCase,
} from "./health-criteria-kit";
import {
	addTeamMember,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "./prisma-factories";

export const NONEXISTENT = "00000000-0000-4000-8000-000000000999";

export type Role =
	| "owner"
	| "directEdit"
	| "teamEdit"
	| "comment"
	| "view"
	| "none"
	| "signedOut";

/** A case with a claim, a pipeline that published the demo list, and one person per role. */
export async function criteriaWorld() {
	const base = await setupCriteriaCase();
	const { owner, testCase } = base;
	const actors = {
		owner,
		directEdit: await createTestUser(),
		teamEdit: await createTestUser(),
		comment: await createTestUser(),
		view: await createTestUser(),
		none: await createTestUser(),
	};
	await createTestPermission(
		testCase.id,
		actors.directEdit.id,
		owner.id,
		"EDIT"
	);
	await createTestPermission(
		testCase.id,
		actors.comment.id,
		owner.id,
		"COMMENT"
	);
	await createTestPermission(testCase.id, actors.view.id, owner.id, "VIEW");
	const team = await createTestTeam(owner.id);
	await addTeamMember(team.id, actors.teamEdit.id, "MEMBER", owner.id);
	await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
	return { ...base, actors };
}

/** Signs in as `role` (or as nobody). */
export async function actAs(
	role: Role,
	actors: Record<string, { id: string }>
) {
	const { mockNoAuth } = await import("./auth-helpers");
	if (role === "signedOut") {
		await mockNoAuth();
		return;
	}
	await mockAuth(actors[role]?.id ?? "");
}

export async function json(response: Response) {
	return await response.json();
}

/** Saves through the route and returns status and body. */
export async function save(
	claimId: string,
	integrationId: string,
	settings: Record<string, unknown> = itemSettings(),
	accept = true
) {
	const response = await callCriteriaPut(
		claimId,
		saveBody(integrationId, settings, accept)
	);
	return { status: response.status, body: await response.json() };
}

export async function readView(claimId: string) {
	const response = await callCriteriaGet(claimId);
	return { status: response.status, body: await response.json() };
}

/** What the pipeline reads for one claim. */
export async function pipelineRead(claimId: string, secret: string) {
	const response = await callMachineClaimCriteria(claimId, secret);
	return { status: response.status, body: await response.json() };
}

/** Settings for the numeric per-item check (a threshold rule, no reduction). */
export function numericSettings(overrides: Record<string, unknown> = {}) {
	const check = buildHealthCheckList().checks.find(
		(entry) => entry.name === NUMERIC_CHECK_NAME
	);
	if (!check) {
		throw new Error("fixture check missing");
	}
	return {
		check: {
			name: check.name,
			version: check.version,
			scope: "item",
			params: { tolerance_profile: "standard" },
		},
		...check.recommended,
		...overrides,
	};
}

/** Settings for the whole-system check. */
export function systemSettings(overrides: Record<string, unknown> = {}) {
	const check = buildHealthCheckList().checks.find(
		(entry) => entry.name === SYSTEM_CHECK_NAME
	);
	if (!check) {
		throw new Error("fixture check missing");
	}
	return {
		check: {
			name: check.name,
			version: check.version,
			scope: "environment",
		},
		...check.recommended,
		...overrides,
	};
}

/** A deep copy of the item settings with `mutate` applied. */
export function itemSettingsWith(
	mutate: (settings: Record<string, any>) => void
) {
	const settings = JSON.parse(JSON.stringify(itemSettings()));
	mutate(settings);
	return settings as Record<string, unknown>;
}

/** An integration (and its system user) with NO permission on any case, with the demo list published. */
export async function addPipelineWithoutAccess(ownerId: string) {
	const { integration, systemUserId } = expectSuccess(
		await registerIntegration(
			{
				name: `crit-noaccess-${Math.random().toString(36).slice(2)}`,
				scopes: ["case:read", "health:checks:write"],
			},
			ownerId
		)
	);
	expectSuccess(
		await publishHealthCheckList(
			{ integrationId: integration.id, systemUserId },
			buildHealthCheckList() as never
		)
	);
	return { integration, systemUserId };
}

/** A pipeline, with EDIT on the case and a check list, for a second integration in the same case. */
export async function secondPipeline(ownerId: string, caseId: string) {
	return await addPipeline(ownerId, caseId);
}

/** The served settings from a machine read, narrowed to what a record echoes. */
export function echoFields(served: Record<string, unknown>) {
	const { check, rule, reduction, aggregation, window, valid_for } = served;
	return { check, rule, reduction, aggregation, window, valid_for };
}

let tick = 0;

/** Posts a result for `claimId` that echoes `served` (overridable), through the machine route. */
export async function postResult(
	claimId: string,
	secret: string,
	served: Record<string, unknown>,
	overrides: Record<string, unknown> = {}
) {
	const { wireRecord } = await import("./health-adversarial-kit");
	tick += 1;
	const body = wireRecord(claimId, "populationPass", {
		record_id: randomUUID(),
		timestamp: new Date(Date.now() - 60_000 + tick).toISOString(),
		...echoFields(served),
		...overrides,
	});
	const { POST } = await importMachineRoute();
	const response = await POST(machinePost(claimId, body, secret), {
		params: Promise.resolve({ id: claimId }),
	});
	return {
		status: response.status,
		body: await response.json(),
		recordId: body.record_id as string,
	};
}

/** The stored echo columns of a record. */
export async function storedEcho(recordId: string) {
	const row = await prisma.pluginHealthEvidence.findFirst({
		where: { recordId },
		select: {
			echoState: true,
			echoDifferences: true,
			criteriaRevision: true,
		},
	});
	return row;
}

export function deepClone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
