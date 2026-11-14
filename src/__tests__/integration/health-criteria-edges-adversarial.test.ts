import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { callStatus } from "../utils/health-adversarial-kit";
import {
	criteriaWorld,
	itemSettingsWith,
	pipelineRead,
	postResult,
	save,
} from "../utils/health-criteria-adversarial-kit";
import {
	callCaseChecks,
	callCriteriaGet,
	callCriteriaPut,
	callHygiene,
	callMachineCaseCriteria,
	callMachineCaseStatus,
	callMachineClaimCriteria,
	callMachineClaimStatus,
	callRetirement,
	itemSettings,
	saveBody,
} from "../utils/health-criteria-kit";

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

beforeEach(async () => {
	await mockNoAuth();
});

async function setup() {
	const world = await criteriaWorld();
	await mockAuth(world.owner.id, world.owner.username, world.owner.email);
	return world;
}

describe("odd requests", () => {
	it("answers a malformed id on a machine route with a client error, never a 500", async () => {
		const { secret } = await setup();
		const calls = [
			() => callMachineCaseCriteria("not-a-uuid", secret),
			() => callMachineClaimCriteria("not-a-uuid", secret),
			() => callMachineClaimStatus("not-a-uuid", secret),
			() => callMachineCaseStatus("not-a-uuid", secret),
		];
		for (const call of calls) {
			const status = (await call()).status;
			expect(status).toBeGreaterThanOrEqual(400);
			expect(status).toBeLessThan(500);
		}
	});

	it("answers a malformed id on a case route with a client error, never a 500", async () => {
		await setup();
		for (const call of [
			() => callCaseChecks("%00"),
			() => callHygiene("not-a-uuid"),
			() => callCaseChecks("00000000-0000-0000-0000-00000000000g"),
		]) {
			const status = (await call()).status;
			expect(status).toBeGreaterThanOrEqual(400);
			expect(status).toBeLessThan(500);
		}
	});

	it("refuses a body over 1 MiB as too large, and stores nothing", async () => {
		const { claim, integration } = await setup();
		const big = JSON.stringify({
			...saveBody(integration.id, itemSettings(), true),
			padding: "x".repeat(1024 * 1024 + 10),
		});
		const response = await callCriteriaPut(claim.id, big);
		expect(response.status).toBe(413);
		const huge = await callRetirement(
			claim.id,
			`{"reason":"${"x".repeat(2 * 1024 * 1024)}"}`
		);
		expect(huge.status).toBe(413);
		expect(
			await prisma.pluginHealthCriteria.count({ where: { claimId: claim.id } })
		).toBe(0);
	});

	it("refuses a check settings bag over 4 KB", async () => {
		const { claim, integration } = await setup();
		const response = await callCriteriaPut(
			claim.id,
			saveBody(
				integration.id,
				itemSettingsWith((settings) => {
					settings.check.params = { camera_line: "x".repeat(5000) };
				}),
				true
			)
		);
		expect(response.status).toBe(400);
	});

	it("accepts an upper-case claim id in the path and an upper-case integration id in the body, or refuses them cleanly", async () => {
		const { claim, integration } = await setup();
		const response = await callCriteriaPut(
			claim.id.toUpperCase(),
			saveBody(integration.id.toUpperCase(), itemSettings(), true)
		);
		expect([200, 400]).toContain(response.status);
		const read = await callCriteriaGet(claim.id.toUpperCase());
		expect([200, 400]).toContain(read.status);
	});

	it("refuses a request whose content type is not JSON, cleanly", async () => {
		const { claim, integration } = await setup();
		const { PUT } = await import(
			"@/app/api/elements/[id]/health/criteria/route"
		);
		const response = await PUT(
			new NextRequest(
				`http://localhost:3000/api/elements/${claim.id}/health/criteria`,
				{
					method: "PUT",
					headers: { "content-type": "text/plain" },
					body: JSON.stringify(saveBody(integration.id, itemSettings(), true)),
				}
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);
		expect(response.status).toBeLessThan(500);
	});
});

describe("removal of the things settings point at", () => {
	it("deleting the case removes the claim's settings and history without error", async () => {
		const { claim, testCase, integration } = await setup();
		await save(claim.id, integration.id);
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT3M";
			})
		);
		await prisma.assuranceElement.deleteMany({
			where: { caseId: testCase.id },
		});
		await prisma.assuranceCase.delete({ where: { id: testCase.id } });
		expect(
			await prisma.pluginHealthCriteria.count({ where: { claimId: claim.id } })
		).toBe(0);
		expect(
			await prisma.pluginHealthCriteriaRevision.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
	});

	it("names a deleted person as a deleted user, and keeps reading the settings", async () => {
		const { claim, integration, actors } = await setup();
		await mockAuth(actors.directEdit.id, actors.directEdit.username);
		await save(claim.id, integration.id);
		await mockAuth(actors.owner.id, actors.owner.username);
		await prisma.user.delete({ where: { id: actors.directEdit.id } });
		const view = await callCriteriaGet(claim.id);
		expect(view.status).toBe(200);
		const body = await view.json();
		expect(body.accepted_by.name).toBe("Deleted user");
		expect(body.last_change.by_name).toBe("Deleted user");
		const retired = await callRetirement(claim.id, { reason: "Tidy up" });
		expect(retired.status).toBe(200);
	});
});

describe("status for a claim whose current result has expired", () => {
	it("is stale and still carries the comparison with the settings as they are now", async () => {
		const { claim, integration, secret, owner } = await setup();
		await save(claim.id, integration.id);
		const served = (await pipelineRead(claim.id, secret)).body;
		await postResult(claim.id, secret, served, {
			valid_for: "PT1M",
			timestamp: new Date(Date.now() - 10 * 60_000).toISOString(),
		});
		await mockAuth(owner.id);
		const before = (await (await callStatus(claim.id)).json()).status;
		expect(before.stale).toBe(true);
		expect(before.stale_reason).toBe("expired");
		expect(before.mismatch).toEqual({
			state: "mismatch",
			differences: [{ field: "valid_for", declared: "PT5M", used: "PT1M" }],
		});
		await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.valid_for = "PT1M";
			})
		);
		const after = (await (await callStatus(claim.id)).json()).status;
		expect(after.stale).toBe(true);
		expect(after.mismatch).toBeNull();
	});

	it("carries no comparison when every record of the claim has been revoked", async () => {
		const { claim, integration, secret, owner } = await setup();
		await save(claim.id, integration.id);
		const served = (await pipelineRead(claim.id, secret)).body;
		const posted = await postResult(claim.id, secret, served);
		const { callRevoke } = await import("../utils/health-adversarial-kit");
		await mockAuth(owner.id);
		await callRevoke(claim.id, posted.recordId);
		const status = (await (await callStatus(claim.id)).json()).status;
		expect(status.stale_reason).toBe("all-revoked");
		expect(status.mismatch).toBeNull();
	});
});

describe("who accepted, and the scope of the check", () => {
	it("keeps the accepting person and time through a later edit by someone else", async () => {
		const { claim, integration, actors } = await setup();
		await save(claim.id, integration.id);
		const first = await (await callCriteriaGet(claim.id)).json();
		await mockAuth(actors.directEdit.id, actors.directEdit.username);
		const edited = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.window = "PT3M";
			})
		);
		expect(edited.status).toBe(200);
		expect(edited.body.accepted_by).toEqual(first.accepted_by);
		expect(edited.body.criteria.accepted_at).toBe(first.criteria.accepted_at);
		expect(edited.body.last_change).toMatchObject({
			action: "edited",
			by_name: actors.directEdit.username,
		});
		expect(edited.body.criteria.updated_at).not.toBe(first.criteria.updated_at);
	});

	it("copies the check's scope from the list when the browser leaves it out", async () => {
		const { claim, integration } = await setup();
		const saved = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.check.scope = undefined;
			})
		);
		expect(saved.status).toBe(200);
		expect(saved.body.criteria.check.scope).toBe("item");
		const wrong = await save(
			claim.id,
			integration.id,
			itemSettingsWith((s) => {
				s.check.scope = "environment";
			})
		);
		expect(wrong.status).toBe(400);
	});
});
