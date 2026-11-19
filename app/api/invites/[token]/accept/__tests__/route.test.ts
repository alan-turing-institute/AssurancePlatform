import { beforeEach, describe, expect, it, vi } from "vitest";

const { acceptInvite } = vi.hoisted(() => ({ acceptInvite: vi.fn() }));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(async () => ({ userId: "user-1" })),
}));
vi.mock("@/lib/auth/extract-client-ip", () => ({
	extractClientIp: vi.fn(() => "203.0.113.1"),
}));
vi.mock("@/lib/services/rate-limit-service", () => ({
	RATE_LIMIT_CONFIGS: { inviteAccept: {} },
	checkAndRecordRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/lib/services/case-invite-service", () => ({ acceptInvite }));

import { POST } from "../route";

const TOKEN =
	"a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

const accept = () =>
	POST(
		new Request("http://localhost/api/invites/x/accept", { method: "POST" }),
		{
			params: Promise.resolve({ token: TOKEN }),
		}
	);

describe("POST /api/invites/[token]/accept refusals", () => {
	beforeEach(() => acceptInvite.mockReset());

	it.each([
		["Invalid invite", 400],
		["Invite has expired", 400],
		["Invite was sent to a different email address", 403],
		["Invite has already been used", 409],
		["Failed to accept invite", 500],
	])("answers %j with %i and the same message", async (error, status) => {
		acceptInvite.mockResolvedValue({ error });

		const response = await accept();

		expect(response.status).toBe(status);
		expect((await response.json()).error).toBe(error);
	});

	it("answers 200 with the case to open when the invite is accepted", async () => {
		acceptInvite.mockResolvedValue({ data: { caseId: "c1" } });

		const response = await accept();

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ case_id: "c1" });
	});
});
