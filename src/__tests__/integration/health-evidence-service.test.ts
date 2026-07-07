import { afterEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	appendHealthEvidence,
	canonicalJSON,
	computeRecordHash,
	type HealthEvidenceInput,
	listHealthEvidence,
} from "@/lib/services/health-evidence-service";
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
	"appendHealthEvidence",
	"canonicalJSON",
	"computeRecordHash",
	"listHealthEvidence",
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

function evidenceInput(
	claimId: string,
	overrides: Partial<HealthEvidenceInput> = {}
): HealthEvidenceInput {
	return {
		claimId,
		metricName: "in-distribution-rate",
		value: 0.98,
		threshold: 0.95,
		verdict: "PASS",
		oddDimensions: ["traffic-density"],
		sourceSystem: "darter-pipeline",
		provenance: { check: "ood-monitor/kl-divergence", runId: "run-1" },
		evaluatedAt: new Date().toISOString(),
		...overrides,
	};
}

describe("health-evidence-service — module surface (append-only, structurally)", () => {
	it("exposes EXACTLY appendHealthEvidence, listHealthEvidence, and the two hash helpers — no update/delete/edit/remove path", async () => {
		const module = await import("@/lib/services/health-evidence-service");
		const exportedNames = Object.keys(module).sort();

		expect(exportedNames).toEqual(EXPECTED_EXPORTS);
	});
});

describe("appendHealthEvidence — hash-chain tamper-evidence (recomputed from STORED columns)", () => {
	it("recomputes to the SAME recordHash from the row fetched back via prisma — non-alphabetical provenance keys, no evaluatedAt milliseconds", async () => {
		const { owner, claim } = await setup();

		// Two deliberate stress cases in one append:
		// - provenance keys are supplied out of alphabetical order, so this
		//   only passes if canonicalJSON's key-sorting is actually applied on
		//   both the write path and this test's independent recompute.
		// - evaluatedAt has NO fractional seconds ("...07Z"). `Date.prototype
		//   .toISOString()` always emits exactly 3 fractional digits
		//   ("...07.000Z"), so hashing the producer's raw wire string but
		//   storing `new Date(wireString)` makes the hash unrecoverable from
		//   the record's own stored `evaluatedAt` column — this is the exact
		//   drift this test pins shut (health-evidence-service.ts's
		//   `evaluatedAtDate` handling).
		const appended = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					evaluatedAt: "2026-07-04T09:41:07Z",
					provenance: {
						runId: "run-9",
						zebra: "last-alphabetically",
						check: "ood-monitor/kl-divergence",
						alpha: "first-alphabetically",
					},
				})
			)
		);

		const stored = await prisma.pluginHealthEvidence.findUniqueOrThrow({
			where: { id: appended.evidence.id },
		});

		const recomputed = computeRecordHash(
			{
				claimId: stored.claimId,
				metricName: stored.metricName,
				value: stored.value,
				threshold: stored.threshold,
				verdict: stored.verdict,
				oddDimensions: stored.oddDimensions,
				// `stored.provenance` is Prisma's broader `JsonValue` type; the
				// service's own write path also treats provenance as a plain
				// object when it builds this same content shape (see
				// `HealthEvidenceInput.provenance`) — this mirrors that.
				provenance: stored.provenance as Record<string, unknown>,
				sourceSystem: stored.sourceSystem,
				evaluatedAt: stored.evaluatedAt.toISOString(),
				formatVersion: stored.formatVersion,
				createdById: stored.createdById,
				createdAt: stored.createdAt.toISOString(),
			},
			stored.previousRecordHash
		);

		expect(recomputed).toBe(stored.recordHash);
	});
});

describe("computeRecordHash — NUL-separator invariant", () => {
	it("assembles exactly one raw NUL byte in the hash payload, even when a provenance string contains an embedded NUL character", () => {
		// Mirrors computeRecordHash's own payload assembly
		// (`${previousRecordHash ?? ""}\u0000${canonicalJSON(content)}`) so
		// this test fails if that separator convention ever changes without a
		// matching change here.
		const previousRecordHash = "deadbeef";
		const content = {
			claimId: "00000000-0000-0000-0000-000000000000",
			metricName: "in-distribution-rate",
			value: 0.98,
			threshold: 0.95,
			verdict: "PASS",
			oddDimensions: ["traffic-density"],
			sourceSystem: "darter-pipeline",
			// A literal NUL character embedded in a provenance string — if
			// canonicalJSON ever stopped routing string serialization through
			// JSON.stringify's escaping, this would inject a SECOND raw NUL
			// byte into the payload, breaking the "no ambiguous
			// concatenation" guarantee the separator exists for.
			provenance: { check: "ood-monitor\u0000injected", runId: "run-1" },
			evaluatedAt: "2026-07-04T09:41:07.000Z",
			formatVersion: "0.1",
			createdById: "00000000-0000-0000-0000-000000000001",
			createdAt: "2026-07-04T09:41:08.000Z",
		};

		const payload = `${previousRecordHash}\u0000${canonicalJSON(content)}`;
		const rawNulBytes = Buffer.from(payload, "utf8").filter(
			(byte) => byte === 0
		);

		expect(rawNulBytes.length).toBe(1);
	});
});

describe("appendHealthEvidence — hash chain", () => {
	it("appends a first record with previousRecordHash null and a valid hex recordHash", async () => {
		const { owner, claim } = await setup();

		const result = expectSuccess(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id))
		);

		expect(result.caseId).toBe(claim.caseId);
		expect(result.evidence.previousRecordHash).toBeNull();
		expect(result.evidence.recordHash).toMatch(HEX_SHA256_PATTERN);
		expect(result.evidence.formatVersion).toBe("0.1");
		expect(result.evidence.claimId).toBe(claim.id);
	});

	it("chains a second record's previousRecordHash to the first's recordHash", async () => {
		const { owner, claim } = await setup();

		const first = expectSuccess(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id))
		);
		const second = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "FAIL", value: 0.5 })
			)
		);

		expect(second.evidence.previousRecordHash).toBe(first.evidence.recordHash);
		expect(second.evidence.recordHash).not.toBe(first.evidence.recordHash);
	});

	it("produces distinct hashes for otherwise-identical content on different claims (claimId is part of the hashed content)", async () => {
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
		const sharedEvaluatedAt = new Date().toISOString();

		const resultA = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claimA.id, { evaluatedAt: sharedEvaluatedAt })
			)
		);
		const resultB = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claimB.id, { evaluatedAt: sharedEvaluatedAt })
			)
		);

		expect(resultA.evidence.recordHash).not.toBe(resultB.evidence.recordHash);
	});

	it("preserves provenance verbatim, including keys beyond check/runId", async () => {
		const { owner, claim } = await setup();

		const result = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, {
					provenance: {
						check: "ood-monitor/kl-divergence",
						runId: "gh-run-9241775533",
						checkVersion: "1.4.2",
						twinVersion: "bluebird-atc-2.1.0",
					},
				})
			)
		);

		expect(result.evidence.provenance).toEqual({
			check: "ood-monitor/kl-divergence",
			runId: "gh-run-9241775533",
			checkVersion: "1.4.2",
			twinVersion: "bluebird-atc-2.1.0",
		});
	});
});

describe("appendHealthEvidence — claim resolution guard (no enumeration oracle)", () => {
	it("returns the generic not-found message for a nonexistent claim id", async () => {
		const owner = await createTestUser();
		expectError(
			await appendHealthEvidence(
				owner.id,
				evidenceInput("00000000-0000-0000-0000-000000000000")
			),
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
			await appendHealthEvidence(owner.id, evidenceInput(goal.id)),
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
			await appendHealthEvidence(owner.id, evidenceInput(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the SAME generic message when the caller lacks case access", async () => {
		const { claim } = await setup();
		const outsider = await createTestUser();

		expectError(
			await appendHealthEvidence(outsider.id, evidenceInput(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("refuses a write for a caller with only VIEW access (write requires EDIT)", async () => {
		const { owner, testCase, claim } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await appendHealthEvidence(viewer.id, evidenceInput(claim.id)),
			NOT_FOUND_PATTERN
		);
	});

	it("succeeds for a caller with EDIT access via a direct share (not just the case creator)", async () => {
		const { owner, testCase, claim } = await setup();
		const editor = await createTestUser();
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		expectSuccess(
			await appendHealthEvidence(editor.id, evidenceInput(claim.id))
		);
	});
});

describe("appendHealthEvidence / listHealthEvidence — plugin enablement gate", () => {
	it("refuses to append when the plugin is disabled at the deployment level", async () => {
		const { owner, claim } = await setup();
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);

		expectError(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id)),
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
			await appendHealthEvidence(owner.id, evidenceInput(claim.id)),
			NOT_ENABLED_PATTERN
		);
	});

	it("refuses to list evidence when the plugin is disabled at the deployment level", async () => {
		const { owner, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id))
		);
		vi.stubEnv("TEA_PLUGINS_DISABLED", PLUGIN_ID);

		expectError(
			await listHealthEvidence(owner.id, claim.id),
			NOT_ENABLED_PATTERN
		);
	});
});

describe("listHealthEvidence", () => {
	it("returns the log in append (chainSequence) order, oldest first", async () => {
		const { owner, claim } = await setup();
		const first = expectSuccess(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id))
		);
		const second = expectSuccess(
			await appendHealthEvidence(
				owner.id,
				evidenceInput(claim.id, { verdict: "DEGRADED" })
			)
		);

		const log = expectSuccess(await listHealthEvidence(owner.id, claim.id));

		expect(log.map((record) => record.id)).toEqual([
			first.evidence.id,
			second.evidence.id,
		]);
	});

	it("allows a VIEW-only caller to read the log (read requires only VIEW)", async () => {
		const { owner, testCase, claim } = await setup();
		expectSuccess(
			await appendHealthEvidence(owner.id, evidenceInput(claim.id))
		);
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const log = expectSuccess(await listHealthEvidence(viewer.id, claim.id));
		expect(log).toHaveLength(1);
	});
});

describe("appendHealthEvidence — concurrent writers on the same claim", () => {
	it("serializes N concurrent appends into a single unforked chain of length N", async () => {
		const { owner, claim } = await setup();
		const concurrency = 8;

		const results = await Promise.all(
			Array.from({ length: concurrency }, (_, index) =>
				appendHealthEvidence(
					owner.id,
					evidenceInput(claim.id, { metricName: `writer-${index}` })
				)
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

		// Every hash is unique.
		const hashes = records.map((record) => record.recordHash);
		expect(new Set(hashes).size).toBe(concurrency);

		// Exactly one root (previousRecordHash null).
		const roots = records.filter(
			(record) => record.previousRecordHash === null
		);
		expect(roots).toHaveLength(1);

		// No two records share the same previousRecordHash (a fork would mean
		// two records both claiming the same predecessor), and every non-root
		// previousRecordHash resolves to a hash that actually exists in the set
		// — i.e. the chain is a single unbroken singly-linked list.
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
			appendHealthEvidence(owner.id, evidenceInput(claimA.id)),
			appendHealthEvidence(owner.id, evidenceInput(claimB.id)),
		]);

		expectSuccess(resultA);
		expectSuccess(resultB);
	});
});
