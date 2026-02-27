import { vi } from "vitest";

/**
 * Mock auth helpers for integration tests.
 *
 * Usage in a test file:
 *
 * ```ts
 * vi.mock("@/lib/auth/validate-session");
 *
 * import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
 * ```
 *
 * The `vi.mock()` call must be at the top of the test file — vitest hoists it.
 * After that, use these helpers to configure what the mock returns per-test.
 */

export async function mockAuth(
	userId: string,
	username = "testuser",
	email = "test@example.com"
): Promise<void> {
	const mod = await import("@/lib/auth/validate-session");
	vi.mocked(mod.validateSession).mockResolvedValue({ userId, username, email });
}

export async function mockNoAuth(): Promise<void> {
	const mod = await import("@/lib/auth/validate-session");
	vi.mocked(mod.validateSession).mockResolvedValue(null);
}
