import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateInviteToken } from "@/lib/services/case-invite-service";

vi.mock("@/lib/prisma", () => ({ prisma: {}, default: {} }));
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

const TOKEN =
	"a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";

describe("AcceptInvitePage", () => {
	beforeEach(() => {
		vi.mocked(redirect).mockClear();
		vi.mocked(notFound).mockClear();
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

	it("opens a token made by the invitation generator", async () => {
		vi.mocked(getServerSession).mockResolvedValue({
			user: { id: "1" },
			expires: "2099-01-01T00:00:00.000Z",
		});

		await AcceptInvitePage({
			params: Promise.resolve({ token: generateInviteToken() }),
		});

		expect(notFound).not.toHaveBeenCalled();
	});
});
