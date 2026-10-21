import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runRetentionSweep } from "@/lib/services/retention-service";
import { POST } from "./route";

vi.mock("@/lib/services/retention-service", () => ({
	runRetentionSweep: vi.fn(),
}));

beforeEach(() => {
	vi.stubEnv("CRON_SECRET", "test-token");
	vi.mocked(runRetentionSweep).mockReset();
	vi.mocked(runRetentionSweep).mockResolvedValue({
		data: { warned30: 0, warned7: 0, deleted: 0, skipped: 0 },
	});
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function request(query: string, token: string | null = "test-token") {
	return new Request(`http://localhost/api/cron/retention-sweep${query}`, {
		method: "POST",
		headers: token ? { authorization: `Bearer ${token}` } : {},
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
		expect(await response.json()).toEqual({
			error: "dryRun must be one of 1, true, 0 or false",
			code: "VALIDATION",
		});
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});

	it.each([
		["?dryRun=1&now=2026-01-01T00:00:00Z", "now"],
		["?now=2026-01-01T00:00:00Z", "now"],
		["?dryRun=1&limit=5", "limit"],
	])("refuses %s, which names a parameter the route does not take", async (query, key) => {
		const response = await POST(request(query));
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: `Unrecognized key: "${key}"`,
			code: "VALIDATION",
		});
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});
});

describe("retention sweep token check", () => {
	it.each([
		["no token", null],
		["a wrong token", "wrong-token"],
	])("answers 401 for %s, even when dryRun is invalid", async (_label, token) => {
		const response = await POST(request("?dryRun=yes", token));
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "Unauthorised",
			code: "UNAUTHORISED",
		});
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});

	it("answers 401 for a missing token on an otherwise valid request", async () => {
		const response = await POST(request("?dryRun=1", null));
		expect(response.status).toBe(401);
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});

	it("answers 500 when CRON_SECRET is not set, even when dryRun is invalid", async () => {
		vi.unstubAllEnvs();
		const response = await POST(request("?dryRun=yes"));
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Server configuration error",
			code: "INTERNAL",
		});
		expect(runRetentionSweep).not.toHaveBeenCalled();
	});
});
