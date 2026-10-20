import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	exportCase: vi.fn(),
	readStatuses: vi.fn(),
	readNodes: vi.fn(),
}));

vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: mocks.exportCase,
}));
vi.mock("@/lib/services/health-status-service", () => ({
	readHealthStatusesForCase: mocks.readStatuses,
	readClaimEvidenceNodes: mocks.readNodes,
}));

import {
	MAX_TOOL_CALLS_PER_REPLY,
	TOO_MANY_TOOL_CALLS,
} from "../tool-call-limit";
import { createCaseTools } from "../tools";

const OPTIONS = { toolCallId: "t", messages: [] };

function exported(labels: string[]) {
	return {
		data: {
			version: "1.0",
			exportedAt: "2026-10-15T09:00:00.000Z",
			case: { name: "Case", description: "A case" },
			tree: {
				id: "g1",
				type: "GOAL",
				name: "G1",
				description: "Goal",
				children: labels.map((label) => ({
					id: `id-${label}`,
					type: "PROPERTY_CLAIM",
					name: label,
					description: `Text of ${label}`,
					children: [],
				})),
			},
		},
	};
}

function statusOf(verdict: string, timestamp: string) {
	return {
		bound_check: "Sensor Range Checker",
		expires_at: null,
		mismatch: null,
		record_id: "r",
		rejected_since_last_accept: 0,
		stale: false,
		stale_reason: null,
		stale_since: null,
		timestamp,
		verdict,
	};
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-10-15T12:00:00.000Z"));
	mocks.exportCase.mockReset();
	mocks.readStatuses.mockReset();
	mocks.readNodes.mockReset();
	mocks.readNodes.mockResolvedValue([]);
	mocks.exportCase.mockResolvedValue(exported(["P1"]));
	mocks.readStatuses.mockResolvedValue({
		data: [
			{
				claim_ref: "id-P1",
				status: statusOf("pass", "2026-10-15T11:00:00.000Z"),
			},
		],
	});
});

afterEach(() => {
	vi.useRealTimers();
});

function health(tools: ReturnType<typeof createCaseTools>) {
	const tool = (
		tools as Record<string, { execute?: (...a: unknown[]) => unknown }>
	).read_claim_health;
	if (!tool?.execute) {
		throw new Error("read_claim_health is not registered");
	}
	return () => tool.execute?.({}, OPTIONS) as Promise<Record<string, unknown>>;
}

describe("createCaseTools — registering read_claim_health", () => {
	it("registers the tool only when asked to, and leaves the other tools alone", () => {
		const without = createCaseTools("u", "c");
		const withHealth = createCaseTools(
			"u",
			"c",
			null,
			undefined,
			undefined,
			true
		);

		expect(Object.keys(without)).not.toContain("read_claim_health");
		expect(Object.keys(withHealth)).toContain("read_claim_health");
		for (const name of ["read_case", "read_element", "lint_case"]) {
			expect(Object.keys(without)).toContain(name);
			expect(Object.keys(withHealth)).toContain(name);
		}
	});

	it("does not register the tool when the flag is false", () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, false);

		expect(Object.keys(tools)).not.toContain("read_claim_health");
	});

	it("keeps the techniques selection, deadline and model access in the same positions", () => {
		vi.stubEnv("TECHNIQUES_MCP_URL", "https://techniques.example/mcp");
		try {
			const tools = createCaseTools(
				"u",
				"c",
				{ id: "x", label: "P1", type: "PROPERTY_CLAIM", text: "t" } as never,
				Date.now() + 60_000,
				undefined,
				true
			);

			expect(Object.keys(tools).sort()).toEqual([
				"lint_case",
				"read_case",
				"read_claim_health",
				"read_element",
				"suggest_techniques",
			]);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

describe("read_claim_health — a reply with more than one call", () => {
	it("reads the statuses again on every call and shows what changed between them", async () => {
		const call = health(
			createCaseTools("u", "c", null, undefined, undefined, true)
		);

		const first = await call();
		mocks.readStatuses.mockResolvedValue({
			data: [
				{
					claim_ref: "id-P1",
					status: statusOf("fail", "2026-10-15T11:59:00.000Z"),
				},
			],
		});
		vi.setSystemTime(new Date("2026-10-15T12:05:00.000Z"));
		const second = await call();

		expect(mocks.readStatuses).toHaveBeenCalledTimes(2);
		expect(mocks.readStatuses).toHaveBeenNthCalledWith(1, "u", "c");
		expect(mocks.readStatuses).toHaveBeenNthCalledWith(2, "u", "c");
		expect((first.claims as Record<string, unknown>[])[0]).toMatchObject({
			result: "pass",
			resultAt: "2026-10-15 11:00:00 UTC",
		});
		expect((second.claims as Record<string, unknown>[])[0]).toMatchObject({
			result: "fail",
			resultAt: "2026-10-15 11:59:00 UTC",
		});
		expect(first.checkedAt).toBe("2026-10-15 12:00:00 UTC");
		expect(second.checkedAt).toBe("2026-10-15 12:05:00 UTC");
	});

	it("does not serve an earlier result when a later read returns an error", async () => {
		const call = health(
			createCaseTools("u", "c", null, undefined, undefined, true)
		);
		await call();
		mocks.readStatuses.mockResolvedValue({ error: "Case not found" });

		const second = await call();

		expect(second).toEqual({
			found: false,
			message: "Claim health is not available for this case.",
		});
	});

	it("exports the case once for the whole reply, whichever tools read it", async () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		const call = health(tools);

		await tools.read_case.execute?.({}, OPTIONS);
		await call();
		await call();
		await tools.read_element.execute?.({ elementId: "id-P1" }, OPTIONS);

		expect(mocks.exportCase).toHaveBeenCalledTimes(1);
		expect(mocks.readStatuses).toHaveBeenCalledTimes(2);
	});

	it("leaves the shared export as it was for the other tools", async () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		const before = JSON.stringify(await tools.read_case.execute?.({}, OPTIONS));

		await health(tools)();
		const after = JSON.stringify(await tools.read_case.execute?.({}, OPTIONS));

		expect(after).toBe(before);
	});

	it("does not read the statuses when the other tools run", async () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);

		await tools.read_case.execute?.({}, OPTIONS);
		await tools.read_element.execute?.({ elementId: "id-P1" }, OPTIONS);
		await tools.lint_case.execute?.({}, OPTIONS);

		expect(mocks.readStatuses).not.toHaveBeenCalled();
	});

	it("reads the export again after a failed export, as the other tools do", async () => {
		mocks.exportCase.mockRejectedValueOnce(new Error("database down"));
		const call = health(
			createCaseTools("u", "c", null, undefined, undefined, true)
		);

		const first = await call();
		const second = await call();

		expect(first).toMatchObject({ found: false });
		expect(JSON.stringify(first)).not.toContain("database down");
		expect(second.found).toBe(true);
	});
});

describe("read_claim_health — the reply's cap on tool calls", () => {
	it("returns the fixed limit error, and reads nothing, once the cap is used up by other tools", async () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		for (let i = 0; i < MAX_TOOL_CALLS_PER_REPLY; i += 1) {
			await tools.read_case.execute?.({}, OPTIONS);
		}

		const result = await health(tools)();

		expect(result).toEqual(TOO_MANY_TOOL_CALLS);
		expect(mocks.readStatuses).not.toHaveBeenCalled();
	});

	it("counts its own calls towards the cap the other tools share", async () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		const call = health(tools);
		for (let i = 0; i < MAX_TOOL_CALLS_PER_REPLY; i += 1) {
			await call();
		}

		const result = await call();
		const other = await tools.read_case.execute?.({}, OPTIONS);

		expect(result).toEqual(TOO_MANY_TOOL_CALLS);
		expect(other).toEqual(TOO_MANY_TOOL_CALLS);
		expect(mocks.readStatuses).toHaveBeenCalledTimes(MAX_TOOL_CALLS_PER_REPLY);
	});
});

describe("read_claim_health — what the model is told about the tool", () => {
	it("takes no input", () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		const schema = (
			tools.read_claim_health as unknown as {
				inputSchema: { safeParse: (v: unknown) => { success: boolean } };
			}
		).inputSchema;

		expect(schema.safeParse({}).success).toBe(true);
	});

	it("says that claimsWithoutResults names a claim by its id when it has no label", () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);

		expect(tools.read_claim_health?.description).toContain(
			"naming a claim by its id when it has no label"
		);
	});

	it("describes every field the tool can return", () => {
		const tools = createCaseTools("u", "c", null, undefined, undefined, true);
		const description = tools.read_claim_health?.description ?? "";

		for (const field of [
			"checkedAt",
			"claims",
			"claimsTruncated",
			"claimsWithoutResults",
			"claimsWithoutResultsTruncated",
			"claimsNotInTree",
			"id",
			"label",
			"text",
			"check",
			"result",
			"resultAt",
			"validUntil",
			"outOfDate",
			"outOfDateReason",
			"outOfDateSince",
			"settings",
			"settingsDifferences",
			"refusedSinceLastAccepted",
			"evidenceNode",
		]) {
			expect(description).toContain(field);
		}
	});
});
