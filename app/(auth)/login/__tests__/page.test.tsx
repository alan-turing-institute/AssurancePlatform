import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { validateSession } from "@/lib/auth/validate-session";

/**
 * AP-QA-003: this redirect used to live in `proxy.ts`, which cannot tell a
 * live token from one revoked by a password change or reset (it decodes the
 * cookie with `getToken` and never runs `callbacks.jwt`). It now lives here,
 * behind `validateSession()` — the same database-checked call every other
 * protected page uses — so a revoked cookie renders the sign-in form instead
 * of looping back to /dashboard.
 */
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
	})),
	usePathname: vi.fn(() => "/login"),
	useSearchParams: vi.fn(() => new URLSearchParams()),
	useParams: vi.fn(() => ({})),
	notFound: vi.fn(),
	redirect: vi.fn(),
}));

import SignInPage from "../page";

function searchParams(
	params: Record<string, string | string[] | undefined> = {}
): Promise<Record<string, string | string[] | undefined>> {
	return Promise.resolve(params);
}

describe("SignInPage", () => {
	it("renders the sign-in form when there is no session", async () => {
		vi.mocked(validateSession).mockResolvedValue(null);

		render(await SignInPage({ searchParams: searchParams() }));

		expect(
			screen.getByRole("heading", { name: /sign in to your account/i })
		).toBeInTheDocument();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("redirects a signed-in user to /dashboard when no redirect param is given", async () => {
		vi.mocked(validateSession).mockResolvedValue({
			userId: "1",
			username: "chris",
			email: "chris@example.com",
		});

		await SignInPage({ searchParams: searchParams() });

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});

	it("honours a safe, same-site ?redirect= value", async () => {
		vi.mocked(validateSession).mockResolvedValue({
			userId: "1",
			username: "chris",
			email: "chris@example.com",
		});

		await SignInPage({ searchParams: searchParams({ redirect: "/cases/42" }) });

		expect(redirect).toHaveBeenCalledWith("/cases/42");
	});

	it("falls back to /dashboard for an open-redirect ?redirect=//evil value", async () => {
		vi.mocked(validateSession).mockResolvedValue({
			userId: "1",
			username: "chris",
			email: "chris@example.com",
		});

		await SignInPage({
			searchParams: searchParams({ redirect: "//evil.example.com" }),
		});

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});
});
