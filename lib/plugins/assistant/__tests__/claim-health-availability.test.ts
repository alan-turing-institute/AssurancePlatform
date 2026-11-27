import { beforeEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";
import { caseHasHealthStatus } from "@/lib/services/health-status-service";
import { assertPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import { claimHealthAvailability } from "../claim-health-availability";

vi.mock("@/lib/services/health-status-service", () => ({
	caseHasHealthStatus: vi.fn(),
}));
vi.mock("@/lib/services/health-claim-access", () => ({
	HEALTH_PLUGIN_ID: "tea.health",
}));
vi.mock("@/lib/services/plugin-enablement-service", () => ({
	assertPluginEnabledForUser: vi.fn(),
}));

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(assertPluginEnabledForUser).mockResolvedValue({ data: true });
});

describe("claimHealthAvailability", () => {
	it("offers the tool, and logs the name unknown, when the claim query fails with something that is not an error", async () => {
		const logged: LogEntry[] = [];
		setLogSink((entry) => logged.push(entry));
		vi.stubEnv("LOG_LEVEL", "debug");
		vi.mocked(caseHasHealthStatus).mockRejectedValue("db.internal refused");

		try {
			expect(await claimHealthAvailability("u", "c")).toBe("available");
		} finally {
			resetLogSink();
			vi.unstubAllEnvs();
		}

		expect(logged).toHaveLength(1);
		expect(logged[0]).toMatchObject({
			level: "warn",
			errorName: "unknown",
		});
		expect(JSON.stringify(logged)).not.toContain("db.internal");
	});
});
