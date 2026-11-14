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
	statusFor,
} from "@/src/__tests__/utils/claim-health-unit-kit";
import { createClaimHealthTool } from "../claim-health-tool";
import { unlimited } from "../tool-call-limit";

const FIELD_CAP = 200;

type Result = Record<string, unknown> & { claims: Record<string, unknown>[] };

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

describe("read_claim_health — a claim with no result", () => {
	it("gives no settings and no differences when there is no result, even if a mismatch is present", async () => {
		const entry = await onlyClaim({
			verdict: null,
			timestamp: null,
			mismatch: {
				state: "mismatch",
				differences: [{ field: "window", declared: "PT1M", used: "PT5M" }],
			},
		});

		expect(entry.settings).toBeNull();
		expect(entry).not.toHaveProperty("settingsDifferences");
	});
});

describe("read_claim_health — cutting text at 200 characters", () => {
	it("does not leave half of a character at the cut of a claim's text", async () => {
		const text = `${"a".repeat(FIELD_CAP - 1)}\u{1F600}tail`;
		const result = await run(goal([claim("c1", "P1", text)]), [
			statusFor("c1"),
		]);

		expect((result.claims[0]?.text as string).isWellFormed()).toBe(true);
	});

	it("does not leave half of a character at the cut of a difference value", async () => {
		const value = `${"a".repeat(FIELD_CAP - 2)}\u{1F600}tail`;
		const entry = await onlyClaim({
			mismatch: {
				state: "mismatch",
				differences: [{ field: "check.params", declared: value, used: value }],
			},
		});
		const [difference] = entry.settingsDifferences as Record<string, string>[];

		expect(difference?.declared?.isWellFormed()).toBe(true);
		expect(difference?.used?.isWellFormed()).toBe(true);
	});
});
