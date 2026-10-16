import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
	readStatuses: vi.fn(),
	readNodes: vi.fn(),
}));

vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: service.readStatuses,
	readClaimEvidenceNodes: service.readNodes,
}));

import {
	claim,
	exportOf,
	goal,
	NOW,
	type NodeInput,
	status,
	statusFor,
} from "@/src/__tests__/utils/claim-health-unit-kit";
import { createClaimHealthTool } from "../claim-health-tool";
import { unlimited } from "../tool-call-limit";

const CLAIM_CAP = 100;
const FIELD_CAP = 200;

type Result = Record<string, unknown> & {
	claims: Record<string, unknown>[];
	claimsWithoutResults: string[];
};

async function run(
	tree: NodeInput,
	statuses: { claim_ref: string; status: unknown }[]
): Promise<Result> {
	service.readStatuses.mockResolvedValue({ data: statuses });
	const tool = createClaimHealthTool(
		"user-1",
		"case-1",
		exportOf(tree),
		unlimited
	);
	return (await tool.execute?.(
		{},
		{ toolCallId: "t", messages: [] }
	)) as Result;
}

async function onlyClaim(overrides: Record<string, unknown>) {
	const result = await run(goal([claim("c1")]), [statusFor("c1", overrides)]);
	return result.claims[0] as Record<string, unknown>;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	service.readStatuses.mockReset();
	service.readNodes.mockReset();
	service.readNodes.mockResolvedValue([]);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("read_claim_health — the fields the model receives", () => {
	it("returns exactly the named result fields and claim fields, and nothing else", async () => {
		const result = await run(goal([claim("c1")]), [statusFor("c1")]);

		expect(Object.keys(result).sort()).toEqual([
			"checkedAt",
			"claims",
			"claimsTruncated",
			"claimsWithoutResults",
			"claimsWithoutResultsTruncated",
			"found",
		]);
		expect(Object.keys(result.claims[0] as object).sort()).toEqual([
			"check",
			"id",
			"label",
			"outOfDate",
			"outOfDateReason",
			"outOfDateSince",
			"result",
			"resultAt",
			"settings",
			"text",
			"validUntil",
		]);
		expect(result.found).toBe(true);
		expect(result.checkedAt).toBe("2026-10-15 12:00:00 UTC");
	});

	it("does not pass on a field the status service adds later, or its own record details", async () => {
		const result = await run(goal([claim("c1")]), [
			{
				claim_ref: "c1",
				status: {
					...status({
						mismatch: {
							state: "mismatch",
							differences: [
								{
									field: "window",
									declared: "PT1M",
									used: "PT5M",
									leaked: "LEAK-IN-DIFFERENCE",
								},
							],
						},
					}),
					provenance: { run: "LEAK-PROVENANCE" },
					comment: "LEAK-COMMENT",
					integration: "LEAK-INTEGRATION",
					username: "LEAK-USER",
				},
			},
		]);

		const text = JSON.stringify(result);
		for (const marker of [
			"LEAK-",
			"record-id-do-not-leak",
			"record_id",
			"bound_check",
		]) {
			expect(text).not.toContain(marker);
		}
	});

	it("maps a passing result with its check, time and validity, each time cut to the whole second", async () => {
		const entry = await onlyClaim({
			timestamp: "2026-10-15T11:00:00.999Z",
			expires_at: "2026-10-15T13:00:00.000Z",
		});

		expect(entry).toEqual({
			id: "c1",
			label: "c1",
			text: "Text of c1",
			check: "Sensor Range Checker",
			result: "pass",
			resultAt: "2026-10-15 11:00:00 UTC",
			validUntil: "2026-10-15 13:00:00 UTC",
			outOfDate: false,
			outOfDateReason: null,
			outOfDateSince: null,
			settings: "as accepted",
		});
	});

	it.each([
		"marginal",
		"fail",
		"indeterminate",
	] as const)("maps the %s verdict to result", async (verdict) => {
		expect((await onlyClaim({ verdict })).result).toBe(verdict);
	});

	it("maps an expired result", async () => {
		const entry = await onlyClaim({
			stale: true,
			stale_reason: "expired",
			stale_since: "2026-10-15T10:30:00.000Z",
			expires_at: "2026-10-15T10:30:00.000Z",
		});

		expect(entry).toMatchObject({
			result: "pass",
			outOfDate: true,
			outOfDateReason: "expired",
			outOfDateSince: "2026-10-15 10:30:00 UTC",
			validUntil: "2026-10-15 10:30:00 UTC",
		});
	});

	it("maps a result made out of date by a condition", async () => {
		const entry = await onlyClaim({
			stale: true,
			stale_reason: "condition",
			stale_since: "2026-10-15T10:45:00.000Z",
		});

		expect(entry).toMatchObject({
			outOfDate: true,
			outOfDateReason: "condition",
			outOfDateSince: "2026-10-15 10:45:00 UTC",
		});
	});

	it("maps a claim whose every result was withdrawn", async () => {
		const entry = await onlyClaim({
			verdict: null,
			timestamp: null,
			stale: true,
			stale_reason: "all-revoked",
			stale_since: "2026-10-15T10:00:00.000Z",
		});

		expect(entry).toMatchObject({
			result: null,
			resultAt: null,
			outOfDate: true,
			outOfDateReason: "all-revoked",
			outOfDateSince: "2026-10-15 10:00:00 UTC",
			settings: null,
			check: "Sensor Range Checker",
		});
	});

	it("maps a claim bound to a check with no result yet", async () => {
		const entry = await onlyClaim({
			verdict: null,
			timestamp: null,
			record_id: null,
		});

		expect(entry).toMatchObject({
			check: "Sensor Range Checker",
			result: null,
			resultAt: null,
			validUntil: null,
			outOfDate: false,
			outOfDateReason: null,
			outOfDateSince: null,
			settings: null,
		});
	});

	it("reports a null check when the claim has a record but is bound to no check", async () => {
		expect((await onlyClaim({ bound_check: null })).check).toBeNull();
	});

	it("uses a null label for a claim with no label, and the claim's own id", async () => {
		const result = await run(goal([claim("c1", null)]), [statusFor("c1")]);

		expect(result.claims[0]).toMatchObject({ id: "c1", label: null });
	});
});

describe("read_claim_health — settings", () => {
	it("says as accepted when a result matches the accepted settings", async () => {
		const entry = await onlyClaim({ mismatch: null });

		expect(entry.settings).toBe("as accepted");
		expect(entry).not.toHaveProperty("settingsDifferences");
	});

	it("says none accepted when the claim has no accepted settings", async () => {
		const entry = await onlyClaim({ mismatch: { state: "undeclared" } });

		expect(entry.settings).toBe("none accepted");
		expect(entry).not.toHaveProperty("settingsDifferences");
	});

	it("says different from accepted, and lists each difference", async () => {
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [
					{ field: "window", declared: "PT1M", used: "PT5M" },
					{
						field: "check.params",
						declared: { region: "ALL" },
						used: { region: "NORTH" },
					},
				],
			},
		});

		expect(entry.settings).toBe("different from accepted");
		expect(entry.settingsDifferences).toEqual([
			{ field: "window", declared: '"PT1M"', used: '"PT5M"' },
			{
				field: "check.params",
				declared: '{"region":"ALL"}',
				used: '{"region":"NORTH"}',
			},
		]);
	});

	it("gives no settings when there is no result and the mismatch is undeclared", async () => {
		const entry = await onlyClaim({
			verdict: null,
			timestamp: null,
			mismatch: { state: "undeclared" },
		});

		expect(entry.settings).toBeNull();
	});

	it("leaves out settingsDifferences when a mismatch lists no differences", async () => {
		const entry = await onlyClaim({
			mismatch: { state: "mismatch", differences: [] },
		});

		expect(entry).not.toHaveProperty("settingsDifferences");
	});

	it("keeps a difference value of exactly 200 characters of JSON whole", async () => {
		const exact = "x".repeat(FIELD_CAP - 2);
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [{ field: "check.params", declared: exact, used: exact }],
			},
		});
		const [difference] = entry.settingsDifferences as Record<string, string>[];

		expect(difference?.declared).toBe(JSON.stringify(exact));
		expect(difference?.declared).toHaveLength(FIELD_CAP);
		expect(difference?.used).toBe(JSON.stringify(exact));
	});

	it("cuts a difference value of 201 characters of JSON to 200, for declared and used alike", async () => {
		const over = "y".repeat(FIELD_CAP - 1);
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [{ field: "check.params", declared: over, used: over }],
			},
		});
		const [difference] = entry.settingsDifferences as Record<string, string>[];

		expect(difference?.declared).toHaveLength(FIELD_CAP);
		expect(difference?.declared).toBe(JSON.stringify(over).slice(0, FIELD_CAP));
		expect(difference?.used).toHaveLength(FIELD_CAP);
	});

	it("cuts a large object value as JSON text, not as an object", async () => {
		const big = Object.fromEntries(
			Array.from({ length: 50 }, (_, i) => [`key${i}`, `value-${i}`])
		);
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [{ field: "check.params", declared: big, used: {} }],
			},
		});
		const [difference] = entry.settingsDifferences as Record<string, string>[];

		expect(typeof difference?.declared).toBe("string");
		expect(difference?.declared).toHaveLength(FIELD_CAP);
		expect(difference?.used).toBe("{}");
	});

	it("writes a missing or null difference value as null", async () => {
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [{ field: "reduction", declared: "d1", used: null }],
			},
		});
		const [difference] = entry.settingsDifferences as Record<string, string>[];

		expect(difference).toEqual({
			field: "reduction",
			declared: '"d1"',
			used: "null",
		});
	});
});

describe("read_claim_health — refused records", () => {
	it("leaves refusedSinceLastAccepted out when no record was refused", async () => {
		const entry = await onlyClaim({ rejected_since_last_accept: 0 });

		expect(entry).not.toHaveProperty("refusedSinceLastAccepted");
	});

	it.each([1, 7])("reports %i refused records", async (count) => {
		const entry = await onlyClaim({ rejected_since_last_accept: count });

		expect(entry.refusedSinceLastAccepted).toBe(count);
	});
});

describe("read_claim_health — claim text", () => {
	it("keeps text of exactly 200 characters whole", async () => {
		const text = "t".repeat(FIELD_CAP);
		const result = await run(goal([claim("c1", "P1", text)]), [
			statusFor("c1"),
		]);

		expect(result.claims[0]?.text).toBe(text);
	});

	it("cuts text of 201 characters to 200", async () => {
		const text = "t".repeat(FIELD_CAP + 1);
		const result = await run(goal([claim("c1", "P1", text)]), [
			statusFor("c1"),
		]);

		expect(result.claims[0]?.text).toBe("t".repeat(FIELD_CAP));
	});
});

describe("read_claim_health — order and lists", () => {
	it("lists claims in the order the case shows them, not the order the statuses arrive", async () => {
		const tree = goal([
			claim("a", "P1", "first", [claim("c", "P3", "nested under first")]),
			claim("b", "P2", "second"),
		]);
		const result = await run(tree, [
			statusFor("b"),
			statusFor("c"),
			statusFor("a"),
		]);

		expect(result.claims.map((entry) => entry.label)).toEqual([
			"P1",
			"P3",
			"P2",
		]);
	});

	it("finds claims under a strategy and under another claim", async () => {
		const tree = goal([
			{
				id: "s1",
				type: "STRATEGY",
				name: "S1",
				description: "How",
				children: [claim("a", "P1", "t", [claim("b", "P2")])],
			},
		]);
		const result = await run(tree, [statusFor("b"), statusFor("a")]);

		expect(result.claims.map((entry) => entry.id)).toEqual(["a", "b"]);
	});

	it("does not list non-claim elements, even if the service returned a status for one", async () => {
		const tree = goal([
			claim("a", "P1"),
			{
				id: "e1",
				type: "EVIDENCE",
				name: "E1",
				description: "ev",
				children: [],
			},
		]);
		const result = await run(tree, [statusFor("a"), statusFor("e1")]);

		expect(result.claims.map((entry) => entry.id)).toEqual(["a"]);
		expect(result.claimsNotInTree).toBe(1);
	});

	it("names the claims in the tree that have no status, in tree order, by label", async () => {
		const tree = goal([claim("a", "P1"), claim("b", "P2"), claim("c", "P3")]);
		const result = await run(tree, [statusFor("b")]);

		expect(result.claimsWithoutResults).toEqual(["P1", "P3"]);
		expect(result.claims.map((entry) => entry.id)).toEqual(["b"]);
	});

	it("names an unlabelled claim without a status by its id", async () => {
		const result = await run(goal([claim("c-unlabelled", null)]), []);

		expect(result.claimsWithoutResults).toEqual(["c-unlabelled"]);
	});

	it("returns empty lists and zero counters for a case with no property claims", async () => {
		const result = await run(goal([]), []);

		expect(result).toMatchObject({
			found: true,
			claims: [],
			claimsTruncated: 0,
			claimsWithoutResults: [],
			claimsWithoutResultsTruncated: 0,
		});
		expect(result).not.toHaveProperty("claimsNotInTree");
	});
});

describe("read_claim_health — claims detached from the tree", () => {
	it("counts a status whose claim is not in the tree, and does not list it", async () => {
		const result = await run(goal([claim("a", "P1")]), [
			statusFor("a"),
			statusFor("detached-1", { bound_check: "DETACHED-CHECK" }),
			statusFor("detached-2"),
		]);

		expect(result.claimsNotInTree).toBe(2);
		expect(result.claims.map((entry) => entry.id)).toEqual(["a"]);
		expect(JSON.stringify(result)).not.toContain("DETACHED-CHECK");
		expect(JSON.stringify(result)).not.toContain("detached-1");
	});

	it("leaves claimsNotInTree out when every status is for a claim in the tree", async () => {
		const result = await run(goal([claim("a")]), [statusFor("a")]);

		expect(result).not.toHaveProperty("claimsNotInTree");
	});

	it("counts detached claims beyond the list cap without using the cap", async () => {
		const detached = Array.from({ length: CLAIM_CAP + 5 }, (_, i) =>
			statusFor(`detached-${i}`)
		);
		const result = await run(goal([claim("a", "P1")]), [
			statusFor("a"),
			...detached,
		]);

		expect(result.claimsNotInTree).toBe(CLAIM_CAP + 5);
		expect(result.claimsTruncated).toBe(0);
		expect(result.claims).toHaveLength(1);
	});
});

describe("read_claim_health — the 100 caps", () => {
	function manyClaims(withStatus: number, without: number) {
		const claims = Array.from({ length: withStatus + without }, (_, i) =>
			claim(`c${i}`, `P${i}`)
		);
		const statuses = claims.slice(0, withStatus).map((c) => statusFor(c.id));
		return { tree: goal(claims), statuses };
	}

	it.each([
		[99, 0, 99],
		[100, 0, 100],
		[101, 1, 100],
		[150, 50, 100],
	])("with %i claims with results: counts %i left out (listed %i)", async (withStatus, expectedTruncated, expectedListed) => {
		const { tree, statuses } = manyClaims(withStatus, 0);
		const result = await run(tree, statuses);

		expect(result.claims).toHaveLength(expectedListed);
		expect(result.claimsTruncated).toBe(expectedTruncated);
		expect(result.claimsWithoutResultsTruncated).toBe(0);
	});

	it.each([
		[99, 0, 99],
		[100, 0, 100],
		[101, 1, 100],
		[130, 30, 100],
	])("with %i claims without results: counts %i left out (listed %i)", async (without, expectedTruncated, expectedListed) => {
		const { tree, statuses } = manyClaims(0, without);
		const result = await run(tree, statuses);

		expect(result.claimsWithoutResults).toHaveLength(expectedListed);
		expect(result.claimsWithoutResultsTruncated).toBe(expectedTruncated);
		expect(result.claimsTruncated).toBe(0);
	});

	it("counts the two lists separately when both pass the cap", async () => {
		const { tree, statuses } = manyClaims(120, 107);
		const result = await run(tree, statuses);

		expect(result.claims).toHaveLength(CLAIM_CAP);
		expect(result.claimsTruncated).toBe(20);
		expect(result.claimsWithoutResults).toHaveLength(CLAIM_CAP);
		expect(result.claimsWithoutResultsTruncated).toBe(7);
	});

	it("keeps the first 100 in tree order and drops the later ones", async () => {
		const { tree, statuses } = manyClaims(103, 0);
		const result = await run(tree, [...statuses].reverse());

		expect(result.claims.map((entry) => entry.label)).toEqual(
			Array.from({ length: CLAIM_CAP }, (_, i) => `P${i}`)
		);
	});
});

describe("read_claim_health — when claim health cannot be read", () => {
	it("returns found false and the fixed message for a case export that is not available", async () => {
		service.readStatuses.mockResolvedValue({ data: [statusFor("c1")] });
		const tool = createClaimHealthTool(
			"user-1",
			"case-1",
			() => Promise.resolve(null),
			unlimited
		);

		const result = await tool.execute?.({}, { toolCallId: "t", messages: [] });

		expect(result).toEqual({
			found: false,
			message: "Claim health is not available for this case.",
		});
	});

	it("returns found false, with no claims, when the status service reports an error", async () => {
		service.readStatuses.mockResolvedValue({ error: "Case not found" });
		const tool = createClaimHealthTool(
			"user-1",
			"case-1",
			exportOf(goal([claim("c1")])),
			unlimited
		);

		const result = await tool.execute?.({}, { toolCallId: "t", messages: [] });

		expect(result).toEqual({
			found: false,
			message: "Claim health is not available for this case.",
		});
		expect(JSON.stringify(result)).not.toContain("Text of c1");
	});

	it("asks the status service on behalf of the signed-in user and the open case", async () => {
		await run(goal([claim("c1")]), [statusFor("c1")]);

		expect(service.readStatuses).toHaveBeenCalledWith("user-1", "case-1");
	});
});
