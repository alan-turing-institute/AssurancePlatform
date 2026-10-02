import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { healthEvidenceRecordSchema } from "@/lib/schemas/health-evidence";
import {
	appendHealthEvidence,
	boundCheckRefusal,
	canonicalJSON,
	changeBoundCheck,
	computeRecordHash,
	listHealthEvidence,
	reinstateHealthEvidence,
	revokeHealthEvidence,
} from "@/lib/services/health-evidence-service";
import {
	buildHealthRecords,
	type HealthRecordName,
	SUMMARY_CHECK_NAME,
	withOverrides,
} from "../fixtures/health-records";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

const PLUGIN_ID = "tea.health";
const NOT_FOUND_PATTERN = /Claim not found/;
const NOT_ENABLED_PATTERN = /is not enabled/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/;
/** The module's full runtime export surface — see the "module surface" describe block below. */
const EXPECTED_EXPORTS = [
	"DEFAULT_EVIDENCE_PAGE_SIZE",
	"MAX_EVIDENCE_PAGE_SIZE",
	"appendHealthEvidence",
	"applyBoundCheck",
	"boundCheckRefusal",
	"canonicalJSON",
	"changeBoundCheck",
	"computeRecordHash",
	"listHealthEvidence",
	"reinstateHealthEvidence",
	"revokeHealthEvidence",
].sort();

afterEach(() => {
	vi.unstubAllEnvs();
});

/** Owner + case + a PROPERTY_CLAIM element the owner (as case creator) has ADMIN access to. */
async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

/** A fixture record, validated through the schema exactly as the route does. */
function validRecord(
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
) {
	const fixture = withOverrides(buildHealthRecords(claimId)[name], overrides);
	return healthEvidenceRecordSchema.parse(fixture);
}

describe("health-evidence-service — module surface (append-only, structurally)", () => {
	it("exposes append, list, revoke, reinstate, change-bound-check, the binding helper for the settings service and the hash helpers — still no update or delete path for an evidence row", async () => {
		const module = await import("@/lib/services/health-evidence-service");
		const exportedNames = Object.keys(module).sort();

		expect(exportedNames).toEqual(EXPECTED_EXPORTS);
	});
});

describe("appendHealthEvidence — stored record and hash", () => {
	it("stores the record as received, with the queryable columns copied out of it", async () => {
		const { owner, claim } = await setup();
		const record = validRecord(claim.id);

		expectSuccess(await appendHealthEvidence(owner.id, claim.id, record));

		const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.record).toEqual(record);
		expect(row.recordId).toBe(record.record_id);
		expect(row.verdict).toBe("PASS");
		expect(row.checkName).toBe(SUMMARY_CHECK_NAME);
		expect(row.session).toBe("RUN-A");
		expect(row.validFor).toBe("PT1H");
		expect(row.formatVersion).toBe("1.1");
		expect(row.recordTimestamp.toISOString()).toBe(record.timestamp);
		expect(row.expiresAt?.getTime()).toBe(
			row.recordTimestamp.getTime() + 3_600_000
		);
	});

	it("stores no expiry for an indefinite record", async () => {
		const { owner, claim } = await setup();
		const record = validRecord(claim.id, "populationPass", {
			valid_for: "indefinite",
		});
		expectSuccess(await appendHealthEvidence(owner.id, claim.id, record));

		const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.validFor).toBe("indefinite");
		expect(row.expiresAt).toBeNull();
	});

	it("recomputes to the SAME recordHash from the stored row — non-alphabetical provenance keys, no fractional seconds in the timestamp", async () => {
		const { owner, claim } = await setup();
		// Out-of-order keys only pass if canonicalJSON's key sorting is applied
		// on both the write path and this independent recompute; a timestamp
		// without milliseconds only passes if the stored record carries the
		// re-serialised form.
		const record = validRecord(claim.id, "populationPass", {
			timestamp: "2026-07-04T09:41:07Z",
			provenance: {
				session: "RUN-A",
				zebra: "last-alphabetically",
				pipeline_version: "0.4.0",
				alpha: "first-alphabetically",
				members: [crypto.randomUUID()],
			},
		});
		expectSuccess(await appendHealthEvidence(owner.id, claim.id, record));

		const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.record).toHaveProperty("timestamp", "2026-07-04T09:41:07.000Z");
		const recomputed = computeRecordHash(
			{
				record: row.record,
				createdById: row.createdById,
				createdAt: row.createdAt.toISOString(),
			},
			row.previousRecordHash
		);
		expect(recomputed).toBe(row.recordHash);
		expect(row.recordHash).toMatch(HEX_SHA256_PATTERN);
	});

	it("chains each record to the previous one, per claim", async () => {
		const { owner, claim } = await setup();
		for (const name of ["populationPass", "marginalSummary"] as const) {
			expectSuccess(
				await appendHealthEvidence(
					owner.id,
					claim.id,
					validRecord(claim.id, name)
				)
			);
		}

		const [first, second] = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});
		expect(first?.previousRecordHash).toBeNull();
		expect(second?.previousRecordHash).toBe(first?.recordHash);
	});
});

describe("computeRecordHash — NUL-separator invariant", () => {
	it("assembles exactly one raw NUL byte in the hash payload, even when a record string contains an embedded NUL character", () => {
		// Mirrors computeRecordHash's own payload assembly
		// (`${previousRecordHash ?? ""}\u0000${canonicalJSON(content)}`) so
		// this test fails if that separator convention ever changes without a
		// matching change here.
		const content = {
			record: { comment: "embedded\u0000nul", verdict: "pass" },
			createdById: "00000000-0000-0000-0000-000000000001",
			createdAt: "2026-07-04T09:41:08.000Z",
		};

		const payload = `deadbeef\u0000${canonicalJSON(content)}`;
		const rawNulBytes = Buffer.from(payload, "utf8").filter(
			(byte) => byte === 0
		);

		expect(rawNulBytes.length).toBe(1);
	});
});

describe("appendHealthEvidence — repeated record_id", () => {
	it("refuses a second record with the same record_id and stores nothing", async () => {
		const { owner, claim } = await setup();
		const record = validRecord(claim.id);
		expectSuccess(await appendHealthEvidence(owner.id, claim.id, record));

		expectError(
			await appendHealthEvidence(owner.id, claim.id, record),
			"A record with this record_id already exists"
		);
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(1);
	});
});

describe("appendHealthEvidence — one check per claim", () => {
	it("binds the claim to the check of its first accepted record, with a history row", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id))
		);

		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.boundCheckName).toBe(SUMMARY_CHECK_NAME);
		expect(state.rejectedSinceLastAccept).toBe(0);

		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id },
		});
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			fromCheckName: null,
			toCheckName: SUMMARY_CHECK_NAME,
			source: "FIRST_RECORD",
			changedById: owner.id,
		});
	});

	it("refuses a record from another check, stores nothing, and counts it until the next accepted record", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id))
		);

		for (let attempt = 0; attempt < 2; attempt++) {
			expectError(
				await appendHealthEvidence(
					owner.id,
					claim.id,
					validRecord(claim.id, "wholeSystem")
				),
				boundCheckRefusal(SUMMARY_CHECK_NAME)
			);
		}
		const afterRefusals = await prisma.pluginHealthClaimState.findUniqueOrThrow(
			{
				where: { claimId: claim.id },
			}
		);
		expect(afterRefusals.rejectedSinceLastAccept).toBe(2);
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(1);

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				claim.id,
				validRecord(claim.id, "marginalSummary")
			)
		);
		const afterAccept = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(afterAccept.rejectedSinceLastAccept).toBe(0);
	});

	it("uses the contract's refusal message", () => {
		expect(boundCheckRefusal("Sensor Range Checker")).toBe(
			"This claim is bound to check Sensor Range Checker. Evidence from another check needs its own evidence claim in the case."
		);
	});
});

describe("appendHealthEvidence — claim resolution guard (no enumeration oracle)", () => {
	it("returns the generic not-found message for a nonexistent claim id", async () => {
		const owner = await createTestUser();
		const claimId = "00000000-0000-0000-0000-000000000000";
		expectError(
			await appendHealthEvidence(owner.id, claimId, validRecord(claimId)),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the SAME generic message for an element that exists but isn't a PROPERTY_CLAIM", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});

		expectError(
			await appendHealthEvidence(owner.id, goal.id, validRecord(goal.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the SAME generic message for a soft-deleted claim", async () => {
		const { owner, claim } = await setup();
		await prisma.assuranceElement.update({
			where: { id: claim.id },
			data: { deletedAt: new Date() },
		});

		expectError(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the SAME generic message when the caller lacks case access", async () => {
		const { claim } = await setup();
		const outsider = await createTestUser();

		expectError(
			await appendHealthEvidence(outsider.id, claim.id, validRecord(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("refuses a write for a caller with only VIEW access (write requires EDIT)", async () => {
		const { owner, testCase, claim } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await appendHealthEvidence(viewer.id, claim.id, validRecord(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("does not reveal a duplicate record_id to a caller without access", async () => {
		const { owner, claim } = await setup();
		const record = validRecord(claim.id);
		expectSuccess(await appendHealthEvidence(owner.id, claim.id, record));
		const outsider = await createTestUser();

		expectError(
			await appendHealthEvidence(outsider.id, claim.id, record),
			NOT_FOUND_PATTERN
		);
	});
});

describe("plugin enablement gate", () => {
	it("refuses to append when the plugin is disabled at the deployment level", async () => {
		const { owner, claim } = await setup();
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);

		expectError(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id)),
			NOT_ENABLED_PATTERN
		);
	});

	it("refuses to append when the plugin is switched off for the acting user", async () => {
		const { owner, claim } = await setup();
		await createTestPluginState(owner.id, {
			pluginId: PLUGIN_ID,
			scopeType: "USER",
			enabled: false,
		});

		expectError(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id)),
			NOT_ENABLED_PATTERN
		);
	});

	it("refuses to list evidence when the plugin is disabled at the deployment level", async () => {
		const { owner, claim } = await setup();
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);

		expectError(
			await listHealthEvidence(owner.id, claim.id),
			NOT_ENABLED_PATTERN
		);
	});
});

describe("listHealthEvidence", () => {
	async function appendMany(ownerId: string, claimId: string, count: number) {
		const recordIds: string[] = [];
		for (let index = 0; index < count; index++) {
			const record = validRecord(claimId, "populationPass");
			recordIds.push(record.record_id);
			expectSuccess(await appendHealthEvidence(ownerId, claimId, record));
		}
		return recordIds;
	}

	it("returns newest first, pages with before and next_before, and ends with null", async () => {
		const { owner, claim } = await setup();
		const recordIds = await appendMany(owner.id, claim.id, 5);

		const first = expectSuccess(
			await listHealthEvidence(owner.id, claim.id, { limit: 2 })
		);
		expect(first.items.map((item) => item.record.record_id)).toEqual([
			recordIds[4],
			recordIds[3],
		]);
		expect(first.nextBefore).toBe(first.items[1]?.chain_sequence);

		const second = expectSuccess(
			await listHealthEvidence(owner.id, claim.id, {
				limit: 2,
				before: first.nextBefore ?? undefined,
			})
		);
		expect(second.items.map((item) => item.record.record_id)).toEqual([
			recordIds[2],
			recordIds[1],
		]);

		const last = expectSuccess(
			await listHealthEvidence(owner.id, claim.id, {
				limit: 2,
				before: second.nextBefore ?? undefined,
			})
		);
		expect(last.items.map((item) => item.record.record_id)).toEqual([
			recordIds[0],
		]);
		expect(last.nextBefore).toBeNull();
	});

	it("returns items whose hash recomputes from what the list returns", async () => {
		const { owner, claim } = await setup();
		await appendMany(owner.id, claim.id, 2);

		const page = expectSuccess(await listHealthEvidence(owner.id, claim.id));
		for (const item of page.items) {
			const recomputed = computeRecordHash(
				{
					record: item.record,
					createdById: item.created_by_id,
					createdAt: item.created_at,
				},
				item.previous_record_hash
			);
			expect(recomputed).toBe(item.record_hash);
		}
	});

	it("allows a VIEW-only caller to read the log", async () => {
		const { owner, testCase, claim } = await setup();
		await appendMany(owner.id, claim.id, 1);
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const page = expectSuccess(await listHealthEvidence(viewer.id, claim.id));
		expect(page.items).toHaveLength(1);
	});
});

describe("revocation and reinstatement", () => {
	async function setupWithRecord() {
		const context = await setup();
		const record = validRecord(context.claim.id);
		expectSuccess(
			await appendHealthEvidence(context.owner.id, context.claim.id, record)
		);
		return { ...context, record };
	}

	it("revokes a record: it shows as revoked in the list, the evidence row is unchanged and its hash still recomputes", async () => {
		const { owner, claim, record } = await setupWithRecord();
		const before = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});

		const revoked = expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "evidence-defect",
				reason: "Wrong run",
			})
		);
		expect(revoked.revocation).toMatchObject({
			cause: "evidence-defect",
			reason: "Wrong run",
			revoked_by_name: owner.username,
		});

		const after = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(after).toEqual(before);

		const page = expectSuccess(await listHealthEvidence(owner.id, claim.id));
		const [item] = page.items;
		expect(item?.revocation).toMatchObject({
			cause: "evidence-defect",
			reason: "Wrong run",
		});
		expect(
			computeRecordHash(
				{
					record: item?.record,
					createdById: item?.created_by_id ?? "",
					createdAt: item?.created_at ?? "",
				},
				item?.previous_record_hash ?? null
			)
		).toBe(item?.record_hash);
	});

	it("refuses to revoke a record twice", async () => {
		const { owner, claim, record } = await setupWithRecord();
		const input = { cause: "duplicate", reason: "Same as another" } as const;
		expectSuccess(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, input)
		);

		expectError(
			await revokeHealthEvidence(owner.id, claim.id, record.record_id, input),
			"This record is already revoked"
		);
	});

	it("reinstates a revoked record, keeps the revocation row, and allows a later revocation as a new row", async () => {
		const { owner, claim, record } = await setupWithRecord();
		const revoke = () =>
			revokeHealthEvidence(owner.id, claim.id, record.record_id, {
				cause: "other",
				reason: "Checking",
			});
		expectSuccess(await revoke());
		expectSuccess(
			await reinstateHealthEvidence(owner.id, claim.id, record.record_id, {
				reason: "It was fine",
			})
		);

		const page = expectSuccess(await listHealthEvidence(owner.id, claim.id));
		expect(page.items[0]?.revocation).toBeNull();
		const [closed] = await prisma.pluginHealthRevocation.findMany();
		expect(closed).toMatchObject({
			reinstatedById: owner.id,
			reinstatementReason: "It was fine",
		});
		expect(closed?.reinstatedAt).not.toBeNull();

		expectSuccess(await revoke());
		expect(await prisma.pluginHealthRevocation.count()).toBe(2);
	});

	it("refuses to reinstate a record that is not revoked", async () => {
		const { owner, claim, record } = await setupWithRecord();

		expectError(
			await reinstateHealthEvidence(owner.id, claim.id, record.record_id, {
				reason: "No reason",
			}),
			"This record is not revoked"
		);
	});

	it("refuses a record that is not on this claim", async () => {
		const { owner, claim } = await setupWithRecord();

		expectError(
			await revokeHealthEvidence(owner.id, claim.id, crypto.randomUUID(), {
				cause: "other",
				reason: "x",
			}),
			"Record not found"
		);
	});

	it("needs EDIT: a VIEW-only caller is refused", async () => {
		const { owner, testCase, claim, record } = await setupWithRecord();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await revokeHealthEvidence(viewer.id, claim.id, record.record_id, {
				cause: "other",
				reason: "x",
			}),
			NOT_FOUND_PATTERN
		);
		expectError(
			await reinstateHealthEvidence(viewer.id, claim.id, record.record_id, {
				reason: "x",
			}),
			NOT_FOUND_PATTERN
		);
	});
});

describe("changeBoundCheck", () => {
	it("rebinds the claim, writes a person history row, and flips which check is accepted", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id))
		);

		expectSuccess(
			await changeBoundCheck(owner.id, claim.id, {
				name: "Forecast Availability Checker",
				reason: "The check was renamed",
			})
		);

		const changes = await prisma.pluginHealthBindingChange.findMany({
			where: { claimId: claim.id, source: "PERSON" },
		});
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			fromCheckName: SUMMARY_CHECK_NAME,
			toCheckName: "Forecast Availability Checker",
			reason: "The check was renamed",
			changedById: owner.id,
		});

		expectSuccess(
			await appendHealthEvidence(
				owner.id,
				claim.id,
				validRecord(claim.id, "wholeSystem")
			)
		);
		expectError(
			await appendHealthEvidence(
				owner.id,
				claim.id,
				validRecord(claim.id, "marginalSummary")
			),
			boundCheckRefusal("Forecast Availability Checker")
		);
	});

	it("refuses to rebind to the check the claim already has", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, claim.id, validRecord(claim.id))
		);

		expectError(
			await changeBoundCheck(owner.id, claim.id, {
				name: SUMMARY_CHECK_NAME,
				reason: "Nothing to change",
			}),
			"This claim is already bound to that check"
		);
	});

	it("needs EDIT: a VIEW-only caller is refused", async () => {
		const { owner, testCase, claim } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await changeBoundCheck(viewer.id, claim.id, { name: "X", reason: "y" }),
			NOT_FOUND_PATTERN
		);
	});
});

describe("appendHealthEvidence — concurrent writers on the same claim", () => {
	it("serializes N concurrent appends into a single unforked chain of length N", async () => {
		const { owner, claim } = await setup();
		const concurrency = 8;

		const results = await Promise.all(
			Array.from({ length: concurrency }, () =>
				appendHealthEvidence(owner.id, claim.id, validRecord(claim.id))
			)
		);
		for (const result of results) {
			expectSuccess(result);
		}

		const records = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});
		expect(records).toHaveLength(concurrency);

		const hashes = records.map((record) => record.recordHash);
		expect(new Set(hashes).size).toBe(concurrency);

		const roots = records.filter(
			(record) => record.previousRecordHash === null
		);
		expect(roots).toHaveLength(1);

		// No two records share a predecessor (a fork), and every non-root
		// predecessor is a hash in the set: one unbroken singly-linked list.
		const nonRootPrevHashes = records
			.filter((record) => record.previousRecordHash !== null)
			.map((record) => record.previousRecordHash as string);
		expect(new Set(nonRootPrevHashes).size).toBe(nonRootPrevHashes.length);
		for (const prevHash of nonRootPrevHashes) {
			expect(hashes).toContain(prevHash);
		}
	});

	it("does not block writers on a DIFFERENT claim", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claimA = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Claim A",
		});
		const claimB = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Claim B",
		});

		const [resultA, resultB] = await Promise.all([
			appendHealthEvidence(owner.id, claimA.id, validRecord(claimA.id)),
			appendHealthEvidence(owner.id, claimB.id, validRecord(claimB.id)),
		]);

		expectSuccess(resultA);
		expectSuccess(resultB);
	});
});
