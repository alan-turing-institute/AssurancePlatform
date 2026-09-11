import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptToken } from "@/lib/auth/token-encryption";
import { getUserGoogleTokens } from "@/lib/services/google-drive-service";

// google-drive-service.ts imports @/lib/prisma at module scope, which
// throws at load without DATABASE_URL (same module-load dependency
// documented in case-import-service.test.ts). Mocking it at the boundary
// lets this file load and run standalone, with a controllable findUnique
// for these tests. vi.hoisted is required because the mock factory below
// references `findUnique` — vi.mock itself is hoisted above these imports.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

const TEST_KEY = Buffer.alloc(32, 5).toString("base64");
const FUTURE_EXPIRY = new Date(Date.now() + 60 * 60 * 1000);

describe("getUserGoogleTokens", () => {
	const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

	beforeEach(() => {
		process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
		findUnique.mockReset();
	});

	afterEach(() => {
		if (originalKey === undefined) {
			Reflect.deleteProperty(process.env, "TOKEN_ENCRYPTION_KEY");
		} else {
			process.env.TOKEN_ENCRYPTION_KEY = originalKey;
		}
	});

	it("returns decrypted access and refresh tokens for encrypted stored values", async () => {
		const plainAccess = "ya29.realaccesstoken";
		const plainRefresh = "1//realrefreshtoken";
		findUnique.mockResolvedValue({
			googleAccessToken: encryptToken(plainAccess),
			googleRefreshToken: encryptToken(plainRefresh),
			googleTokenExpiresAt: FUTURE_EXPIRY,
		});

		const result = await getUserGoogleTokens("user-1");
		expect(result).toEqual({
			accessToken: plainAccess,
			refreshToken: plainRefresh,
		});
	});

	it("returns legacy plaintext tokens unchanged", async () => {
		findUnique.mockResolvedValue({
			googleAccessToken: "ya29.legacyplaintext",
			googleRefreshToken: "1//legacyplaintext",
			googleTokenExpiresAt: FUTURE_EXPIRY,
		});

		const result = await getUserGoogleTokens("user-1");
		expect(result).toEqual({
			accessToken: "ya29.legacyplaintext",
			refreshToken: "1//legacyplaintext",
		});
	});

	it("reports NO_TOKEN when no access token is stored", async () => {
		findUnique.mockResolvedValue({
			googleAccessToken: null,
			googleRefreshToken: null,
			googleTokenExpiresAt: null,
		});

		await expect(getUserGoogleTokens("user-1")).resolves.toEqual({
			tokenError: "NO_TOKEN",
		});
	});
});
