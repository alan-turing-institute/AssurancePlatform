import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCreateCaseModal } from "@/hooks/modal-hooks";
import {
	mockPush,
	mockReplace,
	resetNavigationMocks,
	setMockSearchParams,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import UsePatternButton from "../use-pattern-button";

/**
 * "Use this pattern" on a published pattern's page, against the real dialog
 * store: who it opens the dialog for, where it sends a visitor who is not
 * signed in, and when the `use` flag in the address may open the dialog.
 */

const session = vi.hoisted(() => ({
	current: { data: null, status: "unauthenticated" } as {
		data: { user: { id?: string; name?: string } } | null;
		status: "authenticated" | "loading" | "unauthenticated";
	},
}));

vi.mock("next-auth/react", () => ({
	useSession: () => session.current,
}));

vi.mock(
	"@/hooks/modal-hooks",
	async (importOriginal) => await importOriginal()
);

const SIGNED_IN = { data: { user: { id: "user-1" } }, status: "authenticated" };
const SIGNED_OUT = { data: null, status: "unauthenticated" };
const LOADING = { data: null, status: "loading" };

const PATTERN: { description: string; slug: string; title: string } = {
	slug: "fairness-pattern",
	title: "Fairness pattern",
	description: "How a system treats groups alike",
};
const PAGE = "/discover/fairness-pattern";
const USE_BUTTON = { name: /Use this pattern/ };
const SITE = "https://tea.example";

function signInAs(next: typeof SIGNED_IN | typeof SIGNED_OUT | typeof LOADING) {
	session.current = next as typeof session.current;
}

function storeState() {
	return useCreateCaseModal.getState();
}

/** How many times the store was set to open: a second open is a second count. */
function countOpens() {
	const opens = { count: 0 };
	const stop = useCreateCaseModal.subscribe((state) => {
		if (state.isOpen) {
			opens.count += 1;
		}
	});
	return { opens, stop };
}

function renderButton(props: Partial<typeof PATTERN> = {}) {
	return render(<UsePatternButton {...PATTERN} {...props} />);
}

/** The address the visitor was sent to, as written. */
function pushedText() {
	if (mockPush.mock.calls.length !== 1) {
		throw new Error(`expected one push, saw ${mockPush.mock.calls.length}`);
	}
	return String(mockPush.mock.calls[0]?.[0]);
}

/** The address the visitor is sent to, taken apart. */
function pushedAddress() {
	const url = new URL(pushedText(), SITE);
	return { url, redirect: url.searchParams.get("redirect") ?? "" };
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
	signInAs(SIGNED_IN);
	act(() => {
		useCreateCaseModal.getState().onClose();
	});
});

afterEach(() => {
	window.history.replaceState({}, "", "/");
});

describe("UsePatternButton clicked", () => {
	it("opens the dialog with the pattern's slug, title and description for a signed-in visitor", async () => {
		const user = userEvent.setup();
		renderButton();
		expect(storeState().isOpen).toBe(false);

		await user.click(screen.getByRole("button", USE_BUTTON));

		expect(storeState().isOpen).toBe(true);
		expect(storeState().preset).toEqual(PATTERN);
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("opens nothing on mount for a signed-in visitor when the address has no flag", () => {
		renderButton();

		expect(storeState().isOpen).toBe(false);
		expect(storeState().preset).toBeUndefined();
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("sends a signed-out visitor to sign-in with this page and the flag as the way back, and opens nothing", async () => {
		signInAs(SIGNED_OUT);
		const user = userEvent.setup();
		renderButton();

		await user.click(screen.getByRole("button", USE_BUTTON));

		const { url, redirect } = pushedAddress();
		expect(url.pathname).toBe("/login");
		expect([...url.searchParams.keys()]).toEqual(["redirect"]);
		expect(redirect).toBe(`${PAGE}?use=1`);
		expect(storeState().isOpen).toBe(false);
		expect(storeState().preset).toBeUndefined();
	});

	it("builds the way back from the slug, not from the address the visitor is on", async () => {
		signInAs(SIGNED_OUT);
		window.history.replaceState(
			{},
			"",
			"/discover/another-pattern?use=1&redirect=https://evil.example#top"
		);
		const user = userEvent.setup();
		renderButton();

		await user.click(screen.getByRole("button", USE_BUTTON));

		const { redirect } = pushedAddress();
		expect(redirect).toBe(`${PAGE}?use=1`);
		expect(pushedText()).not.toContain("evil");
		expect(pushedText()).not.toContain("another-pattern");
	});

	it.each([
		["an extra parameter", "a&redirect=https://evil.example"],
		["a query and a fragment", "x?y=1#z"],
		["a leading double slash", "//evil.example"],
		["a backslash", "\\evil.example"],
		["a space", "a b"],
		["an encoded dot segment", "%2e%2e/%2e%2e"],
		["a scheme", "https://evil.example"],
		["non-ASCII letters", "café"],
	])("keeps the sign-in address a single parameter that comes back to this site, for a slug with %s", async (_label, slug) => {
		signInAs(SIGNED_OUT);
		const user = userEvent.setup();
		renderButton({ slug });

		await user.click(screen.getByRole("button", USE_BUTTON));

		const { url, redirect } = pushedAddress();
		expect(url.origin).toBe(SITE);
		expect(url.pathname).toBe("/login");
		expect([...url.searchParams.keys()]).toEqual(["redirect"]);
		expect(redirect.startsWith("/discover/")).toBe(true);
		expect(redirect.endsWith("?use=1")).toBe(true);
		expect(new URL(redirect, SITE).origin).toBe(SITE);
	});

	it("treats a session that names no user id as signed out", async () => {
		session.current = {
			data: { user: { name: "No identifier" } },
			status: "authenticated",
		};
		const user = userEvent.setup();
		renderButton();

		await user.click(screen.getByRole("button", USE_BUTTON));

		expect(pushedAddress().redirect).toBe(`${PAGE}?use=1`);
		expect(storeState().isOpen).toBe(false);
	});

	it("is disabled while the session loads, and a click does nothing", async () => {
		signInAs(LOADING);
		const user = userEvent.setup();
		renderButton();

		const button = screen.getByRole("button", USE_BUTTON);
		expect(button).toBeDisabled();
		await user.click(button);

		expect(mockPush).not.toHaveBeenCalled();
		expect(storeState().isOpen).toBe(false);
	});

	it("tells only a signed-out visitor that sign-in comes first", () => {
		signInAs(SIGNED_OUT);
		const signedOut = renderButton();
		expect(
			screen.getByText("You will be asked to sign in first.")
		).toBeVisible();
		signedOut.unmount();

		signInAs(SIGNED_IN);
		const signedIn = renderButton();
		expect(
			screen.queryByText("asked to sign in", { exact: false })
		).not.toBeInTheDocument();
		signedIn.unmount();

		signInAs(LOADING);
		renderButton();
		expect(
			screen.queryByText("asked to sign in", { exact: false })
		).not.toBeInTheDocument();
	});

	it("still opens the dialog on a click after the flag has opened and the dialog was closed", async () => {
		setMockSearchParams({ use: "1" });
		const user = userEvent.setup();
		renderButton();
		expect(storeState().isOpen).toBe(true);
		act(() => {
			storeState().onClose();
		});
		expect(storeState().isOpen).toBe(false);

		await user.click(screen.getByRole("button", USE_BUTTON));

		expect(storeState().isOpen).toBe(true);
		expect(storeState().preset).toEqual(PATTERN);
	});
});

describe("UsePatternButton with the use flag in the address", () => {
	it("opens the dialog with the pattern chosen and removes the flag from the address", () => {
		setMockSearchParams({ use: "1" });

		renderButton();

		expect(storeState().isOpen).toBe(true);
		expect(storeState().preset).toEqual(PATTERN);
		expect(mockReplace).toHaveBeenCalledTimes(1);
		expect(mockReplace.mock.calls[0]?.[0]).toBe(PAGE);
		expect(mockPush).not.toHaveBeenCalled();
	});

	it.each([
		["a different value", { use: "2" }],
		["a value with a trailing letter", { use: "1x" }],
		["a value with a leading zero", { use: "01" }],
		["zero", { use: "0" }],
		["the word true", { use: "true" }],
		["an empty value", { use: "" }],
		["a leading space in the value", { use: " 1" }],
		["an upper-case name", { USE: "1" }],
		["a longer name", { used: "1" }],
		["a prefixed name", { utm_use: "1" }],
		["another parameter only", { page: "1" }],
		["no parameters", {}],
	])("does not open the dialog for %s", (_label, params) => {
		setMockSearchParams(params);

		renderButton();

		expect(storeState().isOpen).toBe(false);
		expect(storeState().preset).toBeUndefined();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("does nothing for a visitor who is not signed in, however often it re-renders", () => {
		signInAs(SIGNED_OUT);
		setMockSearchParams({ use: "1" });

		const view = renderButton();
		view.rerender(<UsePatternButton {...PATTERN} />);
		view.rerender(<UsePatternButton {...PATTERN} />);

		expect(storeState().isOpen).toBe(false);
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("opens the dialog once, however often it re-renders and whatever the props become", () => {
		setMockSearchParams({ use: "1" });
		const { opens, stop } = countOpens();

		const view = renderButton();
		view.rerender(<UsePatternButton {...PATTERN} />);
		view.rerender(<UsePatternButton {...PATTERN} description="Reworded" />);
		view.rerender(<UsePatternButton {...PATTERN} title="Renamed" />);
		setMockSearchParams({});
		view.rerender(<UsePatternButton {...PATTERN} />);
		setMockSearchParams({ use: "1" });
		view.rerender(<UsePatternButton {...PATTERN} />);
		stop();

		expect(opens.count).toBe(1);
		expect(mockReplace).toHaveBeenCalledTimes(1);
	});

	it("opens the dialog once when effects run twice", () => {
		setMockSearchParams({ use: "1" });
		const { opens, stop } = countOpens();

		render(
			<StrictMode>
				<UsePatternButton {...PATTERN} />
			</StrictMode>
		);
		stop();

		expect(opens.count).toBe(1);
		expect(mockReplace).toHaveBeenCalledTimes(1);
		expect(storeState().preset).toEqual(PATTERN);
	});

	it("waits for the session: it opens once the visitor is known to be signed in", () => {
		signInAs(LOADING);
		setMockSearchParams({ use: "1" });
		const { opens, stop } = countOpens();
		const view = renderButton();
		expect(storeState().isOpen).toBe(false);
		expect(mockReplace).not.toHaveBeenCalled();

		signInAs(SIGNED_IN);
		view.rerender(<UsePatternButton {...PATTERN} />);
		view.rerender(<UsePatternButton {...PATTERN} />);
		stop();

		expect(opens.count).toBe(1);
		expect(storeState().preset).toEqual(PATTERN);
		expect(mockReplace).toHaveBeenCalledTimes(1);
	});

	it("never opens when the session resolves to signed out", () => {
		signInAs(LOADING);
		setMockSearchParams({ use: "1" });
		const view = renderButton();

		signInAs(SIGNED_OUT);
		view.rerender(<UsePatternButton {...PATTERN} />);

		expect(storeState().isOpen).toBe(false);
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});
});
