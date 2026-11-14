import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("sseConnectionManager", () => {
	it("is one instance across separate evaluations of the module, in production too", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const first = await import("../sse-connection-manager");

		// A production build evaluates the module once per bundle.
		vi.resetModules();
		const second = await import("../sse-connection-manager");

		expect(second).not.toBe(first);
		expect(second.sseConnectionManager).toBe(first.sseConnectionManager);
	});
});
