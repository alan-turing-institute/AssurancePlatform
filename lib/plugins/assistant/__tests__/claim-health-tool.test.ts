import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { exportCase } from "@/lib/services/case-export-service";
import {
	caseHasHealthStatus,
	type HealthStatus,
	readClaimEvidenceNodes,
	readHealthStatusesForCase,
} from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { claimHealthAvailability } from "../claim-health-availability";
import { claimHealthPrompt } from "../claim-health-tool";
import { createCaseTools } from "../tools";

vi.mock("@/lib/services/case-export-service", () => ({ exportCase: vi.fn() }));
vi.mock("@/lib/services/health-status-service", () => ({
	caseHasHealthStatus: vi.fn(),
	readClaimEvidenceNodes: vi.fn(),
	readHealthStatusesForCase: vi.fn(),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));

const options = { toolCallId: "t", messages: [] };
const UNAVAILABLE = {
	found: false,
	message: "Claim health is not available for this case.",
};
const CUT = 200;
const UTC_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/;

function node(
	id: string,
	name: string | null,
	type = "PROPERTY_CLAIM",
	children: unknown[] = []
) {
	return { id, type, name, description: `Text of ${id}`, children };
}

function showTree(tree: unknown) {
	vi.mocked(exportCase).mockResolvedValue({
		data: {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "d" },
			tree: tree as never,
		},
	});
}

function goal(children: unknown[]) {
	return node("g1", "G1", "GOAL", children);
}

function status(overrides: Partial<HealthStatus> = {}): HealthStatus {
	return {
		bound_check: "Sensor Range Checker",
		expires_at: null,
		mismatch: null,
		record_id: "record-1",
		rejected_since_last_accept: 0,
		stale: false,
		stale_reason: null,
		stale_since: null,
		timestamp: "2030-01-01T10:00:00.000Z",
		verdict: "pass",
		...overrides,
	};
}

function showStatuses(entries: [string, HealthStatus][]) {
	vi.mocked(readHealthStatusesForCase).mockResolvedValue({
		data: entries.map(([claim_ref, entry]) => ({ claim_ref, status: entry })),
	});
}

async function read() {
	const tools = createCaseTools("u", "c", { claimHealth: true });
	return await tools.read_claim_health?.execute?.({}, options);
}

beforeEach(() => {
	vi.resetAllMocks();
	showTree(goal([node("p1", "P1")]));
	showStatuses([["p1", status()]]);
	vi.mocked(readClaimEvidenceNodes).mockResolvedValue([]);
});

describe("read_claim_health: what a claim reports", () => {
	it("gives the named fields of a passing claim and nothing else of the status", async () => {
		const result = await read();

		expect(result).toEqual({
			found: true,
			checkedAt: expect.any(String),
			claims: [
				{
					id: "p1",
					label: "P1",
					text: "Text of p1",
					check: "Sensor Range Checker",
					result: "pass",
					resultAt: "2030-01-01 10:00:00 UTC",
					validUntil: null,
					outOfDate: false,
					outOfDateReason: null,
					outOfDateSince: null,
					settings: "as accepted",
				},
			],
			claimsTruncated: 0,
			claimsWithoutResults: [],
			claimsWithoutResultsTruncated: 0,
		});
		expect(JSON.stringify(result)).not.toContain("record-1");
	});

	it("gives the identifier of a claim's live evidence node, and none for a node that is not live", async () => {
		showTree(goal([node("p1", "P1"), node("p2", "P2")]));
		showStatuses([
			["p1", status()],
			["p2", status()],
		]);
		const entry = (claimId: string, live: boolean, name: string | null) => ({
			claimId,
			claimName: null,
			live,
			node: { id: `node-of-${claimId}`, name, state: "live" as const },
		});
		vi.mocked(readClaimEvidenceNodes).mockResolvedValue([
			entry("p1", true, "E4"),
			entry("p2", false, "E5"),
		]);

		const result = (await read()) as { claims: Record<string, unknown>[] };

		expect(result.claims[0]).toMatchObject({ id: "p1", evidenceNode: "E4" });
		expect(result.claims[1]).not.toHaveProperty("evidenceNode");
		expect(vi.mocked(readClaimEvidenceNodes)).toHaveBeenCalledWith({
			caseId: "c",
		});
	});

	it("answers without evidence node fields, and logs only the error's class, when the node read fails", async () => {
		const logged: LogEntry[] = [];
		setLogSink((entry) => logged.push(entry));
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.mocked(readClaimEvidenceNodes).mockRejectedValue(
			new TypeError("connection to db.internal refused")
		);

		let result: unknown;
		try {
			result = await read();
		} finally {
			resetLogSink();
			vi.unstubAllEnvs();
		}

		expect(result).toMatchObject({
			found: true,
			claims: [{ id: "p1", result: "pass" }],
		});
		expect((result as { claims: object[] }).claims[0]).not.toHaveProperty(
			"evidenceNode"
		);
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			level: "warn",
			component: "claim-health-tool",
			errorName: "TypeError",
		});
		expect(JSON.stringify(logged)).not.toContain("db.internal");
	});

	it("gives the time of the read as YYYY-MM-DD HH:MM:SS UTC", async () => {
		const before = Math.floor(Date.now() / 1000) * 1000;
		const result = (await read()) as { checkedAt: string };

		expect(result.checkedAt).toMatch(UTC_TIME);
		expect(
			Date.parse(result.checkedAt.replace(" UTC", "Z"))
		).toBeGreaterThanOrEqual(before);
	});

	it.each([
		"pass",
		"marginal",
		"fail",
		"indeterminate",
	] as const)("gives a %s verdict as the result", async (verdict) => {
		showStatuses([["p1", status({ verdict })]]);

		expect(await read()).toMatchObject({
			claims: [{ id: "p1", result: verdict, outOfDate: false }],
		});
	});

	it.each([
		["expired", "2030-01-01T11:00:00.000Z", "2030-01-01 11:00:00 UTC"],
		["condition", "2030-01-01T09:30:00.000Z", "2030-01-01 09:30:00 UTC"],
	] as const)("keeps the result of a claim that is out of date because of %s", async (reason, since, shown) => {
		showStatuses([
			[
				"p1",
				status({
					expires_at: "2030-01-01T11:00:00.000Z",
					stale: true,
					stale_reason: reason,
					stale_since: since,
				}),
			],
		]);

		expect(await read()).toMatchObject({
			claims: [
				{
					result: "pass",
					validUntil: "2030-01-01 11:00:00 UTC",
					outOfDate: true,
					outOfDateReason: reason,
					outOfDateSince: shown,
				},
			],
		});
	});

	it("gives a null result, no time and no settings for a claim whose every result was withdrawn", async () => {
		showStatuses([
			[
				"p1",
				status({
					verdict: null,
					timestamp: null,
					stale: true,
					stale_reason: "all-revoked",
					stale_since: "2030-01-01T12:00:00.000Z",
				}),
			],
		]);

		expect(await read()).toMatchObject({
			claims: [
				{
					result: null,
					resultAt: null,
					outOfDate: true,
					outOfDateReason: "all-revoked",
					outOfDateSince: "2030-01-01 12:00:00 UTC",
					settings: null,
				},
			],
		});
	});

	it("gives a claim bound to a check with no result a null result that is not out of date", async () => {
		showStatuses([["p1", status({ verdict: null, timestamp: null })]]);

		expect(await read()).toMatchObject({
			claims: [
				{
					check: "Sensor Range Checker",
					result: null,
					resultAt: null,
					outOfDate: false,
					settings: null,
				},
			],
		});
	});

	it("gives the check the claim is bound to now, which is null when it has none", async () => {
		showStatuses([["p1", status({ bound_check: null })]]);

		expect(await read()).toMatchObject({ claims: [{ check: null }] });
	});

	it("cuts a claim's text at 200 characters", async () => {
		showTree(goal([{ ...node("p1", "P1"), description: "x".repeat(500) }]));

		const result = (await read()) as { claims: { text: string }[] };

		expect(result.claims[0]?.text).toBe("x".repeat(CUT));
	});

	it("gives a null label as null", async () => {
		showTree(goal([node("p1", null)]));

		expect(await read()).toMatchObject({ claims: [{ id: "p1", label: null }] });
	});

	it("gives an empty label as null", async () => {
		showTree(goal([node("p1", "")]));

		expect(await read()).toMatchObject({ claims: [{ id: "p1", label: null }] });
	});
});

describe("read_claim_health: the settings a result was judged with", () => {
	it("says none accepted when the claim has no accepted settings", async () => {
		showStatuses([["p1", status({ mismatch: { state: "undeclared" } })]]);

		const result = (await read()) as { claims: object[] };

		expect(result.claims[0]).toMatchObject({ settings: "none accepted" });
		expect(result.claims[0]).not.toHaveProperty("settingsDifferences");
	});

	it("says different from accepted, and lists each difference as JSON text", async () => {
		showStatuses([
			[
				"p1",
				status({
					mismatch: {
						state: "mismatch",
						differences: [
							{ field: "check.version", declared: "1.2", used: "1.3" },
							{ field: "check.params", declared: { region: "ALL" }, used: {} },
							{ field: "reduction", declared: "d1", used: null },
						],
					},
				}),
			],
		]);

		const result = (await read()) as { claims: object[] };

		expect(result.claims[0]).toMatchObject({
			settings: "different from accepted",
			settingsDifferences: [
				{ field: "check.version", declared: '"1.2"', used: '"1.3"' },
				{ field: "check.params", declared: '{"region":"ALL"}', used: "{}" },
				{ field: "reduction", declared: '"d1"', used: "null" },
			],
		});
	});

	it("cuts each value of a difference at 200 characters of JSON, and gives a missing value as null", async () => {
		showStatuses([
			[
				"p1",
				status({
					mismatch: {
						state: "mismatch",
						differences: [
							{
								field: "check.params",
								declared: { note: "y".repeat(500) },
								used: undefined,
							},
						],
					},
				}),
			],
		]);

		const result = (await read()) as {
			claims: { settingsDifferences: { declared: string; used: string }[] }[];
		};
		const [difference] = result.claims[0]?.settingsDifferences ?? [];

		expect(difference?.declared).toHaveLength(CUT);
		expect(difference?.declared.startsWith('{"note":"yyy')).toBe(true);
		expect(difference?.used).toBe("null");
	});

	it("gives refusedSinceLastAccepted only when more than none were refused", async () => {
		showStatuses([["p1", status({ rejected_since_last_accept: 3 })]]);
		const refused = (await read()) as { claims: object[] };
		showStatuses([["p1", status({ rejected_since_last_accept: 0 })]]);
		const none = (await read()) as { claims: object[] };

		expect(refused.claims[0]).toMatchObject({ refusedSinceLastAccepted: 3 });
		expect(none.claims[0]).not.toHaveProperty("refusedSinceLastAccepted");
	});
});

describe("read_claim_health: which claims, in what order", () => {
	it("lists the property claims in the order the case shows them, whatever order the statuses come in", async () => {
		showTree(
			goal([
				node("s1", "S1", "STRATEGY", [
					node("p2", "P2", "PROPERTY_CLAIM", [node("p3", "P3")]),
				]),
				node("p1", "P1"),
				node("e1", "E1", "EVIDENCE"),
			])
		);
		showStatuses([
			["p1", status()],
			["p3", status()],
			["p2", status()],
		]);

		const result = (await read()) as { claims: { label: string }[] };

		expect(result.claims.map((claim) => claim.label)).toEqual([
			"P2",
			"P3",
			"P1",
		]);
	});

	it("names the property claims in the tree that have no status, and does not list them as claims", async () => {
		showTree(goal([node("p1", "P1"), node("p2", "P2"), node("p3", "P3")]));
		showStatuses([["p2", status()]]);

		expect(await read()).toMatchObject({
			claims: [{ id: "p2" }],
			claimsWithoutResults: ["P1", "P3"],
		});
	});

	it("names a claim without a status by its id when it has no label", async () => {
		showTree(goal([node("p1", null)]));
		showStatuses([]);

		expect(await read()).toMatchObject({ claimsWithoutResults: ["p1"] });
	});

	it("names a claim without a status by its id when its label is empty", async () => {
		showTree(goal([node("p1", "")]));
		showStatuses([]);

		expect(await read()).toMatchObject({ claimsWithoutResults: ["p1"] });
	});

	it("counts a claim with a status that is not in the tree, and leaves it out of the list", async () => {
		showStatuses([
			["p1", status()],
			["detached", status()],
		]);

		const result = await read();

		expect(result).toMatchObject({
			claims: [{ id: "p1" }],
			claimsNotInTree: 1,
		});
		expect(JSON.stringify(result)).not.toContain("detached");
	});

	it("leaves claimsNotInTree out when every status belongs to a claim in the tree", async () => {
		expect(await read()).not.toHaveProperty("claimsNotInTree");
	});

	it("lists 100 claims and counts the rest, and does the same for claims without results, each separately", async () => {
		const withStatus = Array.from({ length: 103 }, (_, i) => `a${i}`);
		const without = Array.from({ length: 105 }, (_, i) => `b${i}`);
		showTree(goal([...withStatus, ...without].map((id) => node(id, id))));
		showStatuses(withStatus.map((id) => [id, status()]));

		const result = (await read()) as {
			claims: { id: string }[];
			claimsTruncated: number;
			claimsWithoutResults: string[];
			claimsWithoutResultsTruncated: number;
		};

		expect(result.claims).toHaveLength(100);
		expect(result.claims.at(-1)?.id).toBe("a99");
		expect(result.claimsTruncated).toBe(3);
		expect(result.claimsWithoutResults).toHaveLength(100);
		expect(result.claimsWithoutResults.at(-1)).toBe("b99");
		expect(result.claimsWithoutResultsTruncated).toBe(5);
	});
});

describe("read_claim_health: when it cannot answer", () => {
	it("says so, and reads no statuses, when the case export is not available", async () => {
		vi.mocked(exportCase).mockResolvedValue({ error: "Permission denied" });

		expect(await read()).toEqual(UNAVAILABLE);
		expect(readHealthStatusesForCase).not.toHaveBeenCalled();
	});

	it("says so when the health service refuses, for example because the plugin was switched off", async () => {
		vi.mocked(readHealthStatusesForCase).mockResolvedValue({
			error: "Plugin 'tea.health' is not enabled",
		});

		const result = await read();

		expect(result).toEqual(UNAVAILABLE);
		expect(JSON.stringify(result)).not.toContain("tea.health");
	});

	it.each([
		[
			"the case export",
			() =>
				vi
					.mocked(exportCase)
					.mockRejectedValue(new TypeError("connect to db.internal refused")),
		],
		[
			"the status read",
			() =>
				vi
					.mocked(readHealthStatusesForCase)
					.mockRejectedValue(new TypeError("connect to db.internal refused")),
		],
	])("says so, never gives the error's message, and logs only its class, when %s throws", async (_label, fail) => {
		const logged: LogEntry[] = [];
		setLogSink((entry) => logged.push(entry));
		vi.stubEnv("LOG_LEVEL", "debug");
		fail();

		let result: unknown;
		try {
			result = await read();
		} finally {
			resetLogSink();
			vi.unstubAllEnvs();
		}

		expect(result).toEqual(UNAVAILABLE);
		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			level: "warn",
			component: "claim-health-tool",
			errorName: "TypeError",
		});
		expect(JSON.stringify(logged)).not.toContain("db.internal");
	});
});

describe("read_claim_health: freshness", () => {
	it("reads the statuses for the user and the case on every call, and the case once", async () => {
		const tools = createCaseTools("u", "c", { claimHealth: true });

		await tools.read_claim_health?.execute?.({}, options);
		showStatuses([["p1", status({ verdict: "fail" })]]);
		const second = await tools.read_claim_health?.execute?.({}, options);

		expect(readHealthStatusesForCase).toHaveBeenCalledTimes(2);
		expect(readHealthStatusesForCase).toHaveBeenCalledWith("u", "c");
		expect(exportCase).toHaveBeenCalledTimes(1);
		expect(second).toMatchObject({ claims: [{ result: "fail" }] });
	});
});

describe("read_claim_health: calls at the same time", () => {
	it("makes one read for calls that overlap, and gives each the same result", async () => {
		const tools = createCaseTools("u", "c", { claimHealth: true });

		const [first, second] = await Promise.all([
			tools.read_claim_health?.execute?.({}, options),
			tools.read_claim_health?.execute?.({}, options),
		]);

		expect(readHealthStatusesForCase).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
	});
});

describe("claimHealthAvailability", () => {
	it("is plugin-off, and queries no claims, when the health plugin is off for the user", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({
			error: "Plugin 'tea.health' is not enabled",
		});

		expect(await claimHealthAvailability("u", "c")).toBe("plugin-off");
		expect(assertPluginEnabledForUser).toHaveBeenCalledWith("tea.health", "u");
		expect(caseHasHealthStatus).not.toHaveBeenCalled();
	});

	it("is available when the plugin is on and the case has a claim with a status", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
		vi.mocked(caseHasHealthStatus).mockResolvedValue(true);

		expect(await claimHealthAvailability("u", "c")).toBe("available");
		expect(caseHasHealthStatus).toHaveBeenCalledWith("c");
	});

	it("is available, and logs the error's class but not its message, when the claim query fails", async () => {
		const logged: LogEntry[] = [];
		setLogSink((entry) => logged.push(entry));
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
		vi.mocked(caseHasHealthStatus).mockRejectedValue(
			new TypeError("connection to db.internal refused")
		);

		try {
			expect(await claimHealthAvailability("u", "c")).toBe("available");
		} finally {
			resetLogSink();
			vi.unstubAllEnvs();
		}

		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			level: "warn",
			component: "claim-health-availability",
			errorName: "TypeError",
		});
		expect(JSON.stringify(logged)).not.toContain("db.internal");
	});

	it("is no-results when the plugin is on and no claim in the case has a status", async () => {
		vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
		vi.mocked(caseHasHealthStatus).mockResolvedValue(false);

		expect(await claimHealthAvailability("u", "c")).toBe("no-results");
	});
});

describe("claimHealthPrompt", () => {
	it("tells the model to call the tool again for each question and to give the checkedAt time", () => {
		const prompt = claimHealthPrompt("available");

		expect(prompt).toContain("read_claim_health returns the latest result");
		expect(prompt).toContain(
			"call read_claim_health again, even if you called it earlier in this conversation"
		);
		expect(prompt).toContain("giving its checkedAt time");
		expect(prompt).toContain("Never say whether the case is adequate.");
	});

	it("says the case has no results when no claim has a status", () => {
		expect(claimHealthPrompt("no-results")).toBe(
			"\n\nThis case has no claims with automated check results. If asked whether claims pass their checks, say so; do not infer results from the case text."
		);
	});

	it("says the results are not available when the plugin is off", () => {
		expect(claimHealthPrompt("plugin-off")).toBe(
			"\n\nAutomated check results are not available to you, because the Claim/Evidence Health plugin is off. If asked, say so; do not infer results from the case text."
		);
	});
});
