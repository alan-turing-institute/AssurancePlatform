import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { SUMMARY_CHECK_NAME } from "../fixtures/health-records";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	addClaim,
	importMachineRoute,
	machinePost,
	setupClaim,
	setupMachineWriter,
	wireRecord,
} from "../utils/health-adversarial-kit";
import {
	createTestCase,
	createTestElement,
	createTestUser,
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

beforeEach(async () => {
	await mockNoAuth();
});

async function writer() {
	const ctx = await setupClaim();
	const { secret } = await setupMachineWriter(ctx.owner.id, ctx.testCase.id);
	const { POST } = await importMachineRoute();
	const post = (body: unknown, claimId = ctx.claim.id, token = secret) =>
		POST(machinePost(claimId, body, token), {
			params: Promise.resolve({ id: claimId }),
		});
	return { ...ctx, secret, post };
}

const stored = (claimId: string) =>
	prisma.pluginHealthEvidence.count({ where: { claimId } });

const minutesAhead = (minutes: number, extraSeconds = 0) =>
	new Date(Date.now() + minutes * 60_000 + extraSeconds * 1000).toISOString();

describe("ingest: refusals leave nothing stored", () => {
	type Mutate = (r: Record<string, unknown>) => Record<string, unknown>;
	const prov = (r: Record<string, unknown>) =>
		r.provenance as Record<string, unknown>;

	const REFUSALS: [string, string, Mutate][] = [
		["an unknown top-level field", "surprise", (r) => ({ ...r, surprise: 1 })],
		[
			"a producer-supplied hash",
			"record_hash",
			(r) => ({ ...r, record_hash: "abc" }),
		],
		[
			"format_version 0.1",
			"format_version",
			(r) => ({ ...r, format_version: "0.1" }),
		],
		[
			"format_version 1.0",
			"format_version",
			(r) => ({ ...r, format_version: "1.0" }),
		],
		[
			"a claim_ref that differs from the path",
			"claim_ref",
			(r) => ({ ...r, claim_ref: crypto.randomUUID() }),
		],
		[
			"no valid_for",
			"valid_for",
			(r) => {
				const { valid_for: _omit, ...rest } = r;
				return rest;
			},
		],
		[
			"no value on a pass",
			"value",
			(r) => {
				const { value: _omit, ...rest } = r;
				return rest;
			},
		],
		["a null value on a pass", "value", (r) => ({ ...r, value: null })],
		[
			"an indeterminate record with no comment",
			"comment",
			(r) => {
				const { value: _v, comment: _c, ...rest } = r;
				return { ...rest, verdict: "indeterminate" };
			},
		],
		[
			"an indeterminate record with a blank comment",
			"comment",
			(r) => {
				const { value: _v, ...rest } = r;
				return { ...rest, verdict: "indeterminate", comment: "   " };
			},
		],
		[
			"a summary with no members",
			"members",
			(r) => {
				const { members: _m, ...rest } = prov(r);
				return { ...r, provenance: rest };
			},
		],
		[
			"a summary with an empty members list",
			"members",
			(r) => ({ ...r, provenance: { ...prov(r), members: [] } }),
		],
		[
			"a summary with a subject",
			"subject",
			(r) => ({ ...r, subject: { kind: "unit", id: "U-1" } }),
		],
		[
			"a valid_while key missing from provenance",
			"valid_while",
			(r) => ({ ...r, valid_while: { not_there: "x" } }),
		],
		[
			"a valid_while key whose provenance value is not a string",
			"valid_while",
			(r) => ({
				...r,
				provenance: { ...prov(r), n: 5 },
				valid_while: { n: "5" },
			}),
		],
		[
			"uncertainty without judged",
			"judged",
			(r) => ({
				...r,
				aggregation: undefined,
				provenance: { ...prov(r), members: undefined },
				uncertainty: {
					kind: "std",
					params: { std: 0.1 },
					method: "m",
					nature: "predictive",
				},
			}),
		],
		[
			"a reduction kind outside the list",
			"reduction",
			(r) => ({
				...r,
				reduction: { ...(r.reduction as object), kind: "mode" },
			}),
		],
		[
			"an aggregation kind outside the list",
			"aggregation",
			(r) => ({
				...r,
				aggregation: { ...(r.aggregation as object), kind: "average" },
			}),
		],
		[
			"a threshold rule with no pass_values",
			"rule",
			(r) => ({
				...r,
				rule: { kind: "threshold", direction: "maximize", version: "r" },
			}),
		],
		[
			"a rule of an unknown kind",
			"rule",
			(r) => ({ ...r, rule: { kind: "target", version: "r" } }),
		],
		["a window in months", "window", (r) => ({ ...r, window: "P1M" })],
		["a valid_for in years", "valid_for", (r) => ({ ...r, valid_for: "P1Y" })],
		["a zero valid_for", "valid_for", (r) => ({ ...r, valid_for: "PT0S" })],
		[
			"a timestamp one second past the five-minute allowance",
			"timestamp",
			(r) => ({ ...r, timestamp: minutesAhead(5, 1) }),
		],
		[
			"a timestamp with a UTC offset",
			"timestamp",
			(r) => ({ ...r, timestamp: "2026-10-02T13:05:00+01:00" }),
		],
	];

	it.each(
		REFUSALS
	)("%s is refused with 400 naming %s", async (_name, field, mutate) => {
		const { claim, post } = await writer();
		const body = mutate(wireRecord(claim.id));

		const response = await post(JSON.parse(JSON.stringify(body)));

		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).toContain(field);
		expect(await stored(claim.id)).toBe(0);
		expect(
			await prisma.pluginHealthClaimState.count({
				where: { claimId: claim.id },
			})
		).toBe(0);
	});

	it("accepts a direction of target on a record's rule", async () => {
		const { claim, post } = await writer();

		const response = await post(
			wireRecord(claim.id, "singleSubject", {
				rule: {
					kind: "threshold",
					direction: "target",
					params: { pass_values: 0.5 },
					version: "r",
				},
			})
		);

		expect(response.status).toBe(201);
	});
});

describe("ingest: timestamps and durations at the edge", () => {
	it("accepts a timestamp exactly five minutes ahead", async () => {
		const { claim, post } = await writer();

		const response = await post(
			wireRecord(claim.id, "populationPass", { timestamp: minutesAhead(5) })
		);

		expect(response.status).toBe(201);
	});

	it("refuses a timestamp ten minutes ahead, even on a claim that already has a current record", async () => {
		const { claim, post } = await writer();
		expect((await post(wireRecord(claim.id))).status).toBe(201);

		const response = await post(
			wireRecord(claim.id, "populationPass", { timestamp: minutesAhead(10) })
		);

		expect(response.status).toBe(400);
		expect(await stored(claim.id)).toBe(1);
	});

	it.each([
		["P1W2D", 201],
		["PT90S", 201],
		["P1DT12H", 201],
		["PT0S", 400],
		["P0D", 400],
		["P1M", 400],
		["P1Y", 400],
		["PT", 400],
		["P", 400],
		["pt5m", 400],
		["PT5M ", 400],
		["PT1.5H", 400],
		["-PT5M", 400],
		["", 400],
		["INDEFINITE", 400],
	])("valid_for %j gives %i", async (validFor, expected) => {
		const { claim, post } = await writer();

		const response = await post(
			wireRecord(claim.id, "populationPass", { valid_for: validFor })
		);

		expect(response.status).toBe(expected);
	});

	it("does not accept indefinite as a window", async () => {
		const { claim, post } = await writer();

		const response = await post(
			wireRecord(claim.id, "populationPass", { window: "indefinite" })
		);

		expect(response.status).toBe(400);
	});
});

describe("ingest: size limits and null handling", () => {
	const members = (count: number) =>
		Array.from({ length: count }, () => crypto.randomUUID());

	it.each([
		[5000, 201],
		[5001, 400],
	])("provenance.members with %i entries gives %i", async (count, expected) => {
		const { claim, post } = await writer();
		const base = wireRecord(claim.id);

		const response = await post({
			...base,
			provenance: { ...(base.provenance as object), members: members(count) },
		});

		expect(response.status).toBe(expected);
		expect(await stored(claim.id)).toBe(expected === 201 ? 1 : 0);
	});

	it.each([
		"reduction",
		"aggregation",
		"uncertainty",
		"judged",
		"subject",
		"payload",
		"valid_while",
		"comment",
	])("a null %s is a clean refusal or an absent field, never a server error", async (field) => {
		const { claim, post } = await writer();

		const response = await post({ ...wireRecord(claim.id), [field]: null });

		expect(response.status).toBeLessThan(500);
		if (response.status === 201) {
			const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
				where: { claimId: claim.id },
			});
			expect(JSON.stringify(row.record)).not.toContain("null");
		}
	});

	it.each([
		["a NUL character", "before\u0000after"],
		["a lone surrogate", "before\ud800after"],
	])("a comment containing %s is a clean answer, never a server error", async (_name, comment) => {
		const { claim, post } = await writer();

		const response = await post(
			wireRecord(claim.id, "populationPass", { comment })
		);

		expect(response.status).toBeLessThan(500);
	});
});

describe("ingest: identifiers and the one-check rule", () => {
	it("refuses a record_id already used on another claim of the same case, and stores nothing on the second claim", async () => {
		const { owner, testCase, claim, post } = await writer();
		const second = await addClaim(testCase.id, owner.id);
		const first = wireRecord(claim.id);
		expect((await post(first)).status).toBe(201);

		const response = await post(
			{ ...wireRecord(second.id), record_id: first.record_id },
			second.id
		);

		expect(response.status).toBe(409);
		expect(await stored(second.id)).toBe(0);
		expect(
			await prisma.pluginHealthClaimState.count({
				where: { claimId: second.id },
			})
		).toBe(0);
	});

	it("refuses a record_id already used in another case", async () => {
		const { owner, secret, post, claim } = await writer();
		const otherCase = await createTestCase(owner.id);
		const otherClaim = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const { systemUserId } = await setupMachineWriter(owner.id, otherCase.id);
		expect(systemUserId).toBeTruthy();
		const first = wireRecord(claim.id);
		expect((await post(first)).status).toBe(201);
		// The first token has no grant on the other case; use a token that has.
		const { secret: otherSecret } = await setupMachineWriter(
			owner.id,
			otherCase.id
		);

		const response = await post(
			{ ...wireRecord(otherClaim.id), record_id: first.record_id },
			otherClaim.id,
			otherSecret
		);

		expect(secret).toBeTruthy();
		expect(response.status).toBe(409);
		expect(await stored(otherClaim.id)).toBe(0);
	});

	it("binds on the first record, refuses another check with 422 and counts refusals until an accepted record resets the count", async () => {
		const { claim, post } = await writer();
		expect((await post(wireRecord(claim.id))).status).toBe(201);

		const refused = await post(wireRecord(claim.id, "wholeSystem"));
		const refusedAgain = await post(wireRecord(claim.id, "wholeSystem"));

		expect(refused.status).toBe(422);
		expect(JSON.stringify(await refused.json())).toContain(
			`This claim is bound to check ${SUMMARY_CHECK_NAME}. Evidence from another check needs its own evidence claim in the case.`
		);
		expect(refusedAgain.status).toBe(422);
		expect(await stored(claim.id)).toBe(1);
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.rejectedSinceLastAccept).toBe(2);

		const accepted = await post(wireRecord(claim.id, "marginalSummary"));
		expect(accepted.status).toBe(201);
		expect((await accepted.json()).status.rejected_since_last_accept).toBe(0);
	});

	it("a check name that differs only by case or whitespace is a different check", async () => {
		const { claim, post } = await writer();
		expect((await post(wireRecord(claim.id))).status).toBe(201);

		const response = await post(
			wireRecord(claim.id, "populationPass", {
				check: {
					name: SUMMARY_CHECK_NAME.toLowerCase(),
					version: "1",
					scope: "s",
				},
			})
		);

		expect(response.status).toBe(422);
	});

	it("two first records naming different checks sent together: one wins, the other gets 422, and one binding row exists", async () => {
		const { claim, post } = await writer();

		const [a, b] = await Promise.all([
			post(wireRecord(claim.id, "populationPass")),
			post(wireRecord(claim.id, "wholeSystem")),
		]);

		expect([a.status, b.status].sort()).toEqual([201, 422]);
		expect(await stored(claim.id)).toBe(1);
		expect(
			await prisma.pluginHealthBindingChange.count({
				where: { claimId: claim.id },
			})
		).toBe(1);
		const winner = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.boundCheckName).toBe(winner.checkName);
	});

	it("two identical records sent together: one 201 and one 409, one row", async () => {
		const { claim, post } = await writer();
		const record = wireRecord(claim.id);

		const [a, b] = await Promise.all([post(record), post(record)]);

		expect([a.status, b.status].sort()).toEqual([201, 409]);
		expect(await stored(claim.id)).toBe(1);
	});

	it("many records sent together for one claim keep a single unforked chain", async () => {
		const { claim, post } = await writer();

		const results = await Promise.all(
			Array.from({ length: 12 }, () => post(wireRecord(claim.id)))
		);

		expect(results.every((r) => r.status === 201)).toBe(true);
		const rows = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});
		expect(rows).toHaveLength(12);
		expect(rows[0]?.previousRecordHash).toBeNull();
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i]?.previousRecordHash).toBe(rows[i - 1]?.recordHash);
		}
		expect(new Set(rows.map((r) => r.previousRecordHash)).size).toBe(12);
	});
});

describe("ingest: who may post", () => {
	it("refuses a token without the write scope, a token with only VIEW on the case, and no token", async () => {
		const { owner, testCase, claim } = await setupClaim();
		const readOnlyScope = await setupMachineWriter(owner.id, testCase.id, [
			"health:evidence:read",
		]);
		const viewOnly = await setupMachineWriter(
			owner.id,
			testCase.id,
			["health:evidence:write"],
			"VIEW"
		);
		const { POST } = await importMachineRoute();
		const send = (token?: string) =>
			POST(machinePost(claim.id, wireRecord(claim.id), token), {
				params: Promise.resolve({ id: claim.id }),
			});

		expect((await send(readOnlyScope.secret)).status).toBe(401);
		expect((await send(viewOnly.secret)).status).toBe(404);
		expect((await send()).status).toBe(401);
		expect(await stored(claim.id)).toBe(0);
	});

	it("answers a missing claim, a non-claim element and an ungranted claim identically", async () => {
		const { owner, testCase, post } = await writer();
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const stranger = await createTestUser();
		const foreignCase = await createTestCase(stranger.id);
		const foreign = await createTestElement(foreignCase.id, stranger.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const missingId = crypto.randomUUID();

		const missing = await post(wireRecord(missingId), missingId);
		const notClaim = await post(wireRecord(goal.id), goal.id);
		const ungranted = await post(wireRecord(foreign.id), foreign.id);

		expect(missing.status).toBe(404);
		const body = await missing.json();
		expect(await notClaim.json()).toEqual(body);
		expect(await ungranted.json()).toEqual(body);
	});
});
