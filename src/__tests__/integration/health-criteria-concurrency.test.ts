import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	retireCriteria,
	saveCriteria,
} from "@/lib/services/health-criteria-service";
import {
	appendHealthEvidence,
	changeBoundCheck,
} from "@/lib/services/health-evidence-service";
import { deleteIntegrationRegistration } from "@/lib/services/integration-registry-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { wireRecord } from "../utils/health-adversarial-kit";
import { itemSettings, setupCriteriaCase } from "../utils/health-criteria-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/** A save or retirement succeeded; its failure variants carry no `data`. */
function expectSaved(result: object) {
	// biome-ignore lint/suspicious/noMisplacedAssertion: called only from within tests
	expect(result).toHaveProperty("data");
}

function saveInput(integrationId: string, accept = true) {
	return {
		integration_id: integrationId,
		accept,
		settings: itemSettings() as never,
	};
}

/** A record naming the demo check, ready for the service. */
function recordFor(claimId: string) {
	return healthEvidenceRecordSchema.parse(
		wireRecord(claimId, "populationPass", {
			check: { name: "Surface Finish Check", version: "0.3", scope: "item" },
		})
	);
}

describe("evidence settings take the claim lock", () => {
	/**
	 * Holds the claim's lock, queues the two calls behind it in the order given,
	 * then releases it, so the first in line always runs first.
	 */
	async function raceInOrder(first: "save" | "append") {
		const context = await setupCriteriaCase();
		const lock = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
		});
		const save = () =>
			saveCriteria(
				context.owner.id,
				context.claim.id,
				saveInput(context.integration.id)
			).then(expectSaved);
		const append = () =>
			appendHealthEvidence(
				context.systemUserId,
				context.claim.id,
				recordFor(context.claim.id)
			).then((result) => {
				expectSuccess(result);
			});
		const [startFirst, startSecond] =
			first === "save" ? [save, append] : [append, save];
		const running = [startFirst()];
		await waitForLockWait(undefined, 1);
		running.push(startSecond());
		await waitForLockWait(undefined, 2);
		await lock.release();
		await Promise.all(running);

		const claimId = context.claim.id;
		return {
			states: await prisma.pluginHealthClaimState.count({
				where: { claimId },
			}),
			changes: await prisma.pluginHealthBindingChange.findMany({
				where: { claimId },
			}),
			evidence: await prisma.pluginHealthEvidence.findFirstOrThrow({
				where: { claimId },
			}),
		};
	}

	it("an acceptance that reaches the claim first binds it, and the result is compared with its revision", async () => {
		const { states, changes, evidence } = await raceInOrder("save");
		expect(states).toBe(1);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.source).toBe("DECLARATION");
		expect(evidence.echoState).not.toBe("UNDECLARED");
		expect(evidence.criteriaRevision).toBe(1);
	});

	it("a result that reaches the claim first binds it, and is compared with no settings", async () => {
		const { states, changes, evidence } = await raceInOrder("append");
		expect(states).toBe(1);
		expect(changes).toHaveLength(1);
		expect(changes[0]?.source).toBe("FIRST_RECORD");
		expect(evidence.echoState).toBe("UNDECLARED");
		expect(evidence.criteriaRevision).toBeNull();
	});

	it("a save waits for a held claim lock and stores nothing until it is released", async () => {
		const context = await setupCriteriaCase();
		const lock = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
		});
		const saving = saveCriteria(
			context.owner.id,
			context.claim.id,
			saveInput(context.integration.id)
		);
		await waitForLockWait();
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
		await lock.release();
		expectSaved(await saving);
		expect(await prisma.pluginHealthCriteria.count()).toBe(1);
	});

	it("a retirement and a manual binding change each wait for a held claim lock", async () => {
		const context = await setupCriteriaCase();
		expectSaved(
			await saveCriteria(
				context.owner.id,
				context.claim.id,
				saveInput(context.integration.id, false)
			)
		);
		const lock = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
		});
		const retiring = retireCriteria(context.owner.id, context.claim.id, {});
		await waitForLockWait();
		const row = await prisma.pluginHealthCriteria.findUniqueOrThrow({
			where: { claimId: context.claim.id },
		});
		expect(row.state).toBe("SUGGESTED");
		await lock.release();
		expectSaved(await retiring);

		const holder = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
		});
		const binding = changeBoundCheck(context.owner.id, context.claim.id, {
			name: "Another Checker",
			reason: "Renamed",
		});
		await waitForLockWait();
		expect(await prisma.pluginHealthClaimState.count()).toBe(0);
		await holder.release();
		expectSuccess(await binding);
		expect(await prisma.pluginHealthClaimState.count()).toBe(1);
	});
});

describe("a save whose claim or integration changes after the list was read", () => {
	it("answers 'Claim not found' when the claim is soft-deleted while the save waits for its lock", async () => {
		const context = await setupCriteriaCase();
		const lock = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
			await tx.$executeRaw`UPDATE assurance_elements SET deleted_at = now() WHERE id = ${context.claim.id}`;
		});
		const saving = saveCriteria(
			context.owner.id,
			context.claim.id,
			saveInput(context.integration.id)
		);
		await waitForLockWait();
		await lock.release();
		expect(await saving).toEqual({ error: "Claim not found" });
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
		expect(await prisma.pluginHealthCriteriaRevision.count()).toBe(0);
	});

	it("answers 'Check not offered' when the integration is deleted while the save waits for the claim lock", async () => {
		const context = await setupCriteriaCase();
		const lock = await holdRowLock(async (tx) => {
			await tx.$queryRaw`SELECT id FROM assurance_elements WHERE id = ${context.claim.id} FOR UPDATE`;
		});
		const saving = saveCriteria(
			context.owner.id,
			context.claim.id,
			saveInput(context.integration.id)
		);
		// The save has read the list and is queued behind the lock.
		await waitForLockWait();
		expectSuccess(
			await deleteIntegrationRegistration(
				context.integration.id,
				context.owner.id
			)
		);
		await lock.release();
		const result = await saving;
		expect(result).toEqual({
			invalid: {
				message: "settings.check.name: Check not offered for this case",
				fieldErrors: {
					"settings.check.name": "Check not offered for this case",
				},
			},
		});
		expect(await prisma.pluginHealthCriteria.count()).toBe(0);
		expect(await prisma.pluginHealthCriteriaRevision.count()).toBe(0);
	});
});
