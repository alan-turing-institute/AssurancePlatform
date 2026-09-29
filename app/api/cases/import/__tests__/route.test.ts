import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidatedSession } from "@/lib/auth/validate-session";

/**
 * POST /api/cases/import's error envelope (walkthrough finding 16): when
 * the import service rejects a file on schema grounds, the validator's own
 * "path: message" strings must reach the response as a top-level
 * `validationErrors` array — the shared `apiError`/`AppError` envelope only
 * carries `fieldErrors` (a `Record<string, string>`), which the import
 * dialog's `extractErrorMessage` never reads (`use-case-import.test.ts`
 * covers that side). `importCase` is mocked rather than hit through a real
 * import, since this test is about the route's envelope mapping only.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));

vi.mock("@/lib/services/case-import-service", () => ({
	importCase: vi.fn(),
}));

import { POST } from "@/app/api/cases/import/route";
import { validateSession } from "@/lib/auth/validate-session";
import { importCase } from "@/lib/services/case-import-service";

const VALID_SESSION: ValidatedSession = {
	userId: "user-1",
	username: "chris",
	email: "chris@example.com",
};

function importRequest(body: unknown): Request {
	return new Request("http://localhost/api/cases/import", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/cases/import", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(validateSession).mockResolvedValue(VALID_SESSION);
	});

	it("returns the validator's path+message strings as a top-level validationErrors array", async () => {
		vi.mocked(importCase).mockResolvedValue({
			error: "Invalid import data",
			validationErrors: [
				"tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid",
			],
		});

		const response = await POST(importRequest({ some: "json" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.validationErrors).toEqual([
			"tree.children[0].children[0].children[0].defeatsElementId: Invalid uuid",
		]);
	});

	it("falls back to the plain error envelope when there are no validationErrors", async () => {
		vi.mocked(importCase).mockResolvedValue({ error: "not a valid case" });

		const response = await POST(importRequest({ some: "json" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("not a valid case");
		expect(body.validationErrors).toBeUndefined();
	});
});
