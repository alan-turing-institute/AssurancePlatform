import { beforeEach, describe, expect, it, vi } from "vitest";
import { runRetentionSweep } from "@/lib/services/retention-service";
import { POST } from "./route";

vi.mock("@/lib/services/retention-service", () => ({
	runRetentionSweep: vi.fn(),
}));

beforeEach(() => {
	vi.mocked(runRetentionSweep).mockReset();
	vi.mocked(runRetentionSweep).mockResolvedValue({
		data: { warned30: 0, warned7: 0, deleted: 0, skipped: 0 },
	});
});

function request(query: string) {
	return new Request(`http://localhost/api/cron/retention-sweep${query}`, {
		method: "POST",
		headers: { authorization: "Bearer test-token" },
	});
}

describe("retention sweep query validation", () => {
	it.each([
		["?dryRun=1", true],
		["?dryRun=true", true],
		["?dryRun=0", false],
		["?dryRun=false", false],
		["", false],
	])("passes %s to the sweep as dryRun=%s", async (query, dryRun) => {
		const response = await POST(request(query));
		expect(response.status).toBe(200);
		expect(runRetentionSweep).toHaveBeenCalledExactlyOnceWith("test-token", {
			dryRun,
		});
		expect(await response.json()).toMatchObject({ success: true, dryRun });
	});

	it.each([
		"?dryRun=yes",
		"?dryRun=",
		"?dryRun=1&dryRun=0",
		"?dryRun=True",
	])("refuses %s without running the sweep", async (query) => {
		const response = await POST(request(query));
		expect(response.status).toBe(400);
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});
});
