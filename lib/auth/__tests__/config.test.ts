import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureLogs } from "@/src/__tests__/helpers/capture-logs";

// config.ts reaches @/lib/prisma via a dynamic `await import(...)`, which
// vi.mock intercepts the same way it would a static import. Mocking it at
// the boundary (same pattern as case-import-service.test.ts) lets this file
// load and run standalone, with controllable Prisma calls for this test.
// vi.hoisted is required because the mock factory references the fns below.
const { findFirst, update } = vi.hoisted(() => ({
	findFirst: vi.fn(),
	update: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst, update } } }));

const { authenticateGoogleWithPrisma } = await import("@/lib/auth/config");

interface UpdateCall {
	data: Record<string, unknown>;
	where: { id: string };
}

describe("authenticateGoogleWithPrisma — production key-absent path", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		vi.stubEnv("NODE_ENV", "production");
		findFirst.mockReset();
		update.mockReset();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		if (originalKey !== undefined) {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	it("does not persist the token, still signs the user in, and logs the failure", async () => {
		findFirst.mockResolvedValue({ id: "existing-user-id" });
		update.mockResolvedValue({});

		const logs = captureLogs();
		try {
			const result = await authenticateGoogleWithPrisma(
				{ sub: "google-sub-1", email: "user@example.com" },
				"ya29.newaccesstoken",
				"1//newrefreshtoken",
				Math.floor(Date.now() / 1000) + 3600
			);

			expect(result).toEqual({ id: "existing-user-id" });
			expect(update).toHaveBeenCalledTimes(1);

			// Cast explained: `update` is our own test double declared above, so
			// its call shape is known even though vi.fn()'s generic call-args
			// type is `unknown[]`.
			const [call] = update.mock.calls as unknown as [[UpdateCall]];
			expect(call[0].data).not.toHaveProperty("googleAccessToken");
			expect(call[0].data).not.toHaveProperty("googleRefreshToken");

			const errorLog = logs.entries.find(
				(entry) =>
					entry.level === "error" && entry.component === "token-encryption"
			);
			expect(errorLog).toBeDefined();
		} finally {
			logs.restore();
		}
	});
});
