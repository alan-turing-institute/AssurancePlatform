import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { validateSession } from "@/lib/auth/validate-session";

/** See app/(auth)/login/__tests__/page.test.tsx for why this moved off proxy.ts (AP-QA-003). */
vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
	})),
	usePathname: vi.fn(() => "/register"),
	useSearchParams: vi.fn(() => new URLSearchParams()),
	useParams: vi.fn(() => ({})),
	notFound: vi.fn(),
	redirect: vi.fn(),
}));

import RegisterPage from "../page";

const SIGN_UP_HEADING_REGEX = /sign up today!/i;

describe("RegisterPage", () => {
	it("renders the registration form when there is no session", async () => {
		vi.mocked(validateSession).mockResolvedValue(null);

		render(await RegisterPage());

		expect(
			screen.getByRole("heading", { name: SIGN_UP_HEADING_REGEX })
		).toBeInTheDocument();
		expect(redirect).not.toHaveBeenCalled();
	});

	it("redirects a signed-in user to /dashboard", async () => {
		vi.mocked(validateSession).mockResolvedValue({
			userId: "1",
			username: "chris",
			email: "chris@example.com",
		});

		await RegisterPage();

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});
});
