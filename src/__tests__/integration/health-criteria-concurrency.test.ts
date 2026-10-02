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
import { expectSuccess } from "../utils/assertion-helpers";
import { addClaim, wireRecord } from "../utils/health-adversarial-kit";
import { itemSettings, setupCriteriaCase } from "../utils/health-criteria-kit";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const RACES = 8;

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
	it("an acceptance racing a claim's first result leaves one state row, one binding history and a consistent comparison", async () => {
		const context = await setupCriteriaCase();
		const claims = [context.claim];
		for (let i = 1; i < RACES; i++) {
			claims.push(await addClaim(context.testCase.id, context.owner.id));
		}

		const outcomes = await Promise.all(
			claims.map(async (claim) => {
				const [saved, appended] = await Promise.all([
					saveCriteria(
						context.owner.id,
						claim.id,
						saveInput(context.integration.id)
					),
					appendHealthEvidence(
						context.systemUserId,
						claim.id,
						recordFor(claim.id)
					),
				]);
				expectSaved(saved);
				expectSuccess(appended);
				return claim.id;
			})
		);

		for (const claimId of outcomes) {
			const states = await prisma.pluginHealthClaimState.count({
				where: { claimId },
			});
			const changes = await prisma.pluginHealthBindingChange.findMany({
				where: { claimId },
			});
			const evidence = await prisma.pluginHealthEvidence.findFirstOrThrow({
				where: { claimId },
			});
			expect(states).toBe(1);
			expect(changes).toHaveLength(1);
			if (evidence.echoState === "UNDECLARED") {
				// The result arrived first: it bound the claim, and was compared with no settings.
				expect(changes[0]?.source).toBe("FIRST_RECORD");
				expect(evidence.criteriaRevision).toBeNull();
			} else {
				// The acceptance came first: it bound the claim, and the result was compared with it.
				expect(changes[0]?.source).toBe("DECLARATION");
				expect(evidence.criteriaRevision).toBe(1);
			}
		}
	}, 60_000);

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
