import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	changeBoundCheck,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	addClaim,
	appendRecord,
	isoAgo,
	MINUTE,
	setupClaim,
} from "../utils/health-adversarial-kit";

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return { ...actual, emitSSEEvent: vi.fn() };
});

const CRON_SECRET = "test-cron-secret";

beforeEach(() => {
	vi.mocked(emitSSEEvent).mockReset();
	vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

const sweep = async () =>
	expectSuccess(await sweepHealthStaleness(CRON_SECRET));

const notifiedFor = (claimId: string) =>
	vi
		.mocked(emitSSEEvent)
		.mock.calls.filter(
			(call) => (call[2] as { claimId?: string }).claimId === claimId
		);

const expiredRecord = (ownerId: string, claimId: string) =>
	appendRecord(ownerId, claimId, "populationPass", {
		timestamp: isoAgo(3 * MINUTE),
		valid_for: "PT1M",
	});

const marker = async (claimId: string) =>
	(
		await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId },
		})
	).staleNotifiedAt;

describe("staleness sweep", () => {
	it("announces an expired claim once, however many sweeps run", async () => {
		const { owner, claim } = await setupClaim();
		await expiredRecord(owner.id, claim.id);

		expect((await sweep()).staleClaimsNotified).toBe(1);
		expect((await sweep()).staleClaimsNotified).toBe(0);
		expect((await sweep()).staleClaimsNotified).toBe(0);

		expect(notifiedFor(claim.id)).toHaveLength(1);
		expect(await marker(claim.id)).not.toBeNull();
	});

	it("announces nothing for a claim whose record is current, and sets no marker", async () => {
		const { owner, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id, "populationPass");

		expect((await sweep()).staleClaimsNotified).toBe(0);

		expect(notifiedFor(claim.id)).toHaveLength(0);
		expect(await marker(claim.id)).toBeNull();
	});

	it("re-arms after a fresh record and announces again when the claim goes stale again", async () => {
		const { owner, claim } = await setupClaim();
		await expiredRecord(owner.id, claim.id);
		await sweep();

		const fresh = await appendRecord(owner.id, claim.id, "failingSummary", {
			timestamp: isoAgo(1 * MINUTE),
			valid_for: "PT1H",
		});
		expect((await sweep()).staleClaimsNotified).toBe(0);
		expect(await marker(claim.id)).toBeNull();

		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, fresh.record_id, {
				cause: "other",
				reason: "x",
			})
		);
		expect((await sweep()).staleClaimsNotified).toBe(1);

		expect(notifiedFor(claim.id)).toHaveLength(2);
	});

	it("announces a claim made stale by a condition, with the reason in the status", async () => {
		const { owner, testCase, claim } = await setupClaim();
		await appendRecord(owner.id, claim.id, "singleSubject", {
			timestamp: isoAgo(5 * MINUTE),
			valid_for: "indefinite",
		});
		await sweep();
		expect(notifiedFor(claim.id)).toHaveLength(0);

		const other = await addClaim(testCase.id, owner.id);
		await appendRecord(owner.id, other.id, "wholeSystem", {
			timestamp: isoAgo(1 * MINUTE),
			provenance: {
				session: "RUN-A",
				pipeline_version: "0.4.0",
				twin_version: "9.9",
			},
		});
		await sweep();

		const calls = notifiedFor(claim.id);
		expect(calls).toHaveLength(1);
		expect(
			(calls[0]?.[2] as { status: { stale_reason: string } }).status.stale_reason
		).toBe("condition");
	});

	it("announces a claim whose records are all revoked", async () => {
		const { owner, claim } = await setupClaim();
		const record = await appendRecord(owner.id, claim.id);
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "other",
				reason: "x",
			})
		);

		await sweep();

		expect(notifiedFor(claim.id)).toHaveLength(1);
	});

	it("does not announce a claim a person bound that has no record yet", async () => {
		const { owner, claim } = await setupClaim();
		expectSuccess(
			await changeBoundCheck(owner.id, claim.id, {
				name: "Planned Checker",
				reason: "Planned",
			})
		);

		expect((await sweep()).staleClaimsNotified).toBe(0);

		expect(notifiedFor(claim.id)).toHaveLength(0);
		expect(await marker(claim.id)).toBeNull();
	});

	it("refuses a wrong or missing secret", async () => {
		expect("error" in (await sweepHealthStaleness("wrong"))).toBe(true);
		expect("error" in (await sweepHealthStaleness(null))).toBe(true);
	});
});
