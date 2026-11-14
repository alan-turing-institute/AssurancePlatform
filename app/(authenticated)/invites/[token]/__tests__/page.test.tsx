import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({
	notFound: vi.fn(),
	redirect: vi.fn(),
}));
vi.mock("../_components/invite-accept-card", () => ({
	InviteAcceptCard: () => null,
}));

import AcceptInvitePage from "../page";

const TOKEN = "0b0c58c3-6a6f-4f2b-9c63-0d2f3a1f6b11";

describe("AcceptInvitePage", () => {
	beforeEach(() => {
		vi.mocked(redirect).mockClear();
	});

	it("sends a signed-out visitor to sign in and back to the invitation", async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		await AcceptInvitePage({ params: Promise.resolve({ token: TOKEN }) });

		expect(redirect).toHaveBeenCalledWith(`/login?redirect=/invites/${TOKEN}`);
	});

	it("does not redirect a signed-in user", async () => {
		vi.mocked(getServerSession).mockResolvedValue({
			user: { id: "1" },
			expires: "2099-01-01T00:00:00.000Z",
		});

		await AcceptInvitePage({ params: Promise.resolve({ token: TOKEN }) });

		expect(redirect).not.toHaveBeenCalled();
	});
});
