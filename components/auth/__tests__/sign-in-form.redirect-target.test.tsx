import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "@/components/auth/sign-in-form";
import { OFF_SITE_REDIRECT_VALUES } from "@/src/__tests__/fixtures/off-site-redirect-values";
import {
	mockPush,
	mockReplace,
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";

/**
 * After a successful password sign-in the form follows the `redirect` (or,
 * failing that, `callbackUrl`) query value only when it is a same-site path,
 * and replaces the sign-in page in the history instead of pushing onto it.
 * Targets other than /dashboard are used so that a refused value cannot pass
 * by being tidied into the default.
 */

type Query = ConstructorParameters<typeof URLSearchParams>[0];

const OK = { ok: true, error: undefined, status: 200, url: null };
const INVALID_CREDENTIALS = /Invalid credentials/;
const CONNECTION_ERROR = /Connection error/;

async function submitSignIn(query: Query) {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(query));
	const user = userEvent.setup();
	const { container } = render(<SignInForm />);
	await user.click(
		screen.getByPlaceholderText("alan.turing@example.com or aturing")
	);
	await user.paste("alan");
	const password = container.querySelector('input[type="password"]');
	if (!password) {
		throw new Error("the password field is missing");
	}
	await user.click(password);
	await user.paste("correct horse battery");
	await user.click(screen.getByRole("button", { name: "Login" }));
}

/** Signs in and reports every address the form navigated to, and how. */
async function navigation(query: Query) {
	await submitSignIn(query);
	await waitFor(() =>
		expect(
			mockReplace.mock.calls.length + mockPush.mock.calls.length
		).toBeGreaterThan(0)
	);
	return {
		replaced: mockReplace.mock.calls.map(([target]) => target),
		pushed: mockPush.mock.calls.map(([target]) => target),
	};
}

const DASHBOARD = { replaced: ["/dashboard"], pushed: [] };

beforeEach(() => {
	resetNavigationMocks();
	vi.mocked(signIn).mockReset();
	vi.mocked(signIn).mockResolvedValue(OK as never);
	vi.mocked(window.location.assign).mockClear();
	vi.mocked(window.location.replace).mockClear();
});

describe("sign-in form follows a same-site redirect", () => {
	it.each([
		"/cases/1",
		"/cases/1?tab=a#section-2",
		"/discover/some-slug?use=1",
		"/invites/0b5f6b7c-3f0e-4d3a-9a3e-6a1f2c9d8e47",
	])("replaces the sign-in page with %s", async (path) => {
		expect(await navigation({ redirect: path })).toEqual({
			replaced: [path],
			pushed: [],
		});
	});

	it("returns to the page named in callbackUrl when there is no redirect", async () => {
		const path = "/invites/0b5f6b7c-3f0e-4d3a-9a3e-6a1f2c9d8e47";
		expect(await navigation({ callbackUrl: path })).toEqual({
			replaced: [path],
			pushed: [],
		});
	});

	it("keeps the encodings of a path that arrives percent-encoded in the address", async () => {
		const query =
			"redirect=%2Fdiscover%2Fx%3Fuse%3D1%26next%3D%252F%252Fevil.example";
		expect(await navigation(query)).toEqual({
			replaced: ["/discover/x?use=1&next=%2F%2Fevil.example"],
			pushed: [],
		});
	});

	it("goes to the dashboard when no redirect is given", async () => {
		expect(await navigation({})).toEqual(DASHBOARD);
	});
});

describe("sign-in form refuses an off-site redirect", () => {
	it.each(
		OFF_SITE_REDIRECT_VALUES
	)("sends %j through redirect to the dashboard", async (value) => {
		expect(await navigation({ redirect: value })).toEqual(DASHBOARD);
	});

	it.each(
		OFF_SITE_REDIRECT_VALUES
	)("sends %j through callbackUrl to the dashboard", async (value) => {
		expect(await navigation({ callbackUrl: value })).toEqual(DASHBOARD);
	});

	it.each([
		["//evil.example", "redirect=%2F%2Fevil.example"],
		["/\\evil.example", "redirect=%2F%5Cevil.example"],
		["%2F%2Fevil.example", "redirect=%252F%252Fevil.example"],
		["a tab between slashes", "redirect=%2F%09%2Fevil.example"],
		["a line feed between slashes", "redirect=%2F%0A%2Fevil.example"],
		["a NUL in the path", "redirect=%2Fcases%2F%001"],
	])("sends the encoded form of %s to the dashboard", async (_label, query) => {
		expect(await navigation(query)).toEqual(DASHBOARD);
	});

	it("uses the first of several redirect values", async () => {
		expect(
			await navigation([
				["redirect", "https://evil.example"],
				["redirect", "/cases/1"],
			])
		).toEqual(DASHBOARD);
	});
});

describe("sign-in form chooses between redirect and callbackUrl", () => {
	it("prefers redirect when both are same-site paths", async () => {
		expect(
			await navigation({ redirect: "/cases/1", callbackUrl: "/cases/2" })
		).toEqual({ replaced: ["/cases/1"], pushed: [] });
	});

	it("does not fall back to callbackUrl when redirect is refused", async () => {
		expect(
			await navigation({
				redirect: "https://evil.example",
				callbackUrl: "/cases/2",
			})
		).toEqual(DASHBOARD);
	});

	it("falls through to callbackUrl when redirect is empty", async () => {
		expect(await navigation({ redirect: "", callbackUrl: "/cases/2" })).toEqual(
			{ replaced: ["/cases/2"], pushed: [] }
		);
	});

	it("refuses an off-site callbackUrl behind an empty redirect", async () => {
		expect(
			await navigation({ redirect: "", callbackUrl: "//evil.example" })
		).toEqual(DASHBOARD);
	});
});

describe("sign-in form navigation", () => {
	it("does not navigate when the sign-in fails", async () => {
		vi.mocked(signIn).mockResolvedValue({
			...OK,
			ok: false,
			error: "CredentialsSignin",
			status: 401,
		} as never);

		await submitSignIn({ redirect: "/cases/1" });

		await screen.findByText(INVALID_CREDENTIALS);
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("does not navigate when the sign-in request throws", async () => {
		vi.mocked(signIn).mockRejectedValue(new Error("network down"));

		await submitSignIn({ redirect: "/cases/1" });

		await screen.findByText(CONNECTION_ERROR);
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("keeps the target out of the sign-in request and the window location", async () => {
		await navigation({ redirect: "https://evil.example/x" });

		const [provider, options] = vi.mocked(signIn).mock.calls[0] ?? [];
		expect(provider).toBe("credentials");
		expect(options).toMatchObject({ redirect: false });
		expect(options).not.toHaveProperty("callbackUrl");
		expect(window.location.assign).not.toHaveBeenCalled();
		expect(window.location.replace).not.toHaveBeenCalled();
		expect(window.location.href).toBe("http://localhost:3000/");
	});
});
