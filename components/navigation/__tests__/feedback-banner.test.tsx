import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithoutProviders,
	screen,
	userEvent,
	waitFor,
} from "@/src/__tests__/utils/test-utils";
import FeedbackBanner from "../feedback-banner";

const DISMISSED_STORAGE_KEY = "tea.feedback-banner.dismissed";
const DISMISS_REGEX = /dismiss/i;

// jsdom in this workspace doesn't provide a working `localStorage` (Node
// starts it with `--localstorage-file` unset, so the global throws/is
// undefined) — stub a minimal in-memory implementation for the duration of
// each test instead of relying on the real one.
function createMemoryStorage(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	} as Storage;
}

beforeEach(() => {
	vi.stubGlobal("localStorage", createMemoryStorage());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("FeedbackBanner", () => {
	it("dismisses via the button, not the icon, and persists across remount", async () => {
		const user = userEvent.setup();
		const { unmount } = renderWithoutProviders(<FeedbackBanner />);

		const dismissButton = await screen.findByRole("button", {
			name: DISMISS_REGEX,
		});

		await user.click(dismissButton);

		// The banner is gone immediately after clicking the button.
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: DISMISS_REGEX })).toBeNull()
		);
		expect(localStorage.getItem(DISMISSED_STORAGE_KEY)).toBe("true");

		unmount();

		// A fresh mount reads the persisted flag and never renders the banner.
		renderWithoutProviders(<FeedbackBanner />);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: DISMISS_REGEX })
			).not.toBeInTheDocument()
		);
	});

	it("stays visible until the button is actually clicked", async () => {
		renderWithoutProviders(<FeedbackBanner />);

		const dismissButton = await screen.findByRole("button", {
			name: DISMISS_REGEX,
		});

		expect(dismissButton).toBeInTheDocument();
		expect(localStorage.getItem(DISMISSED_STORAGE_KEY)).toBeNull();
	});
});
