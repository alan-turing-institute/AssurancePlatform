import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useStore from "@/store/store";
import { CaseSettingsPopover } from "../case-settings-popover";

// useThemePreset throws outside a ThemePresetProvider — stub it the same way
// action-buttons.test.tsx stubs the whole component, but here we're testing
// case-settings-popover itself, so only the preset context is stubbed.
vi.mock("@/providers/theme-preset-provider", () => ({
	useThemePreset: () => ({
		preset: { id: "default", name: "Default", light: {}, dark: {} },
		setPreset: vi.fn(),
		availablePresets: [],
	}),
}));

function resetStore(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
		layoutDirection: "TB",
		nodes: [],
		edges: [],
	});
}

describe("CaseSettingsPopover — layout direction persistence", () => {
	beforeEach(() => {
		resetStore();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
		);
	});

	it("PUTs a camelCase layoutDirection body when the direction is changed", async () => {
		const user = userEvent.setup();
		render(<CaseSettingsPopover />);

		const settingsTrigger = await screen.findByRole("button", {
			name: "Settings",
		});
		await user.click(settingsTrigger);

		const leftRightOption = await screen.findByRole("button", {
			name: "Left-right",
		});
		await user.click(leftRightOption);

		// Proof this fails on the pre-fix key: the assertion pins the exact
		// request body to `{"layoutDirection":"LR"}`. The pre-fix component
		// sent `JSON.stringify({ layout_direction: dir })` — a body that does
		// not match this string — so this expectation fails against the
		// pre-fix code and only passes once the client sends the camelCase key.
		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith(
				"/api/cases/case-1",
				expect.objectContaining({
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ layoutDirection: "LR" }),
				})
			);
		});
	});

	it("does not PUT when the clicked direction matches the current one", async () => {
		const user = userEvent.setup();
		render(<CaseSettingsPopover />);

		const settingsTrigger = await screen.findByRole("button", {
			name: "Settings",
		});
		await user.click(settingsTrigger);

		// Store starts at "TB" — clicking "Top-down" again is a no-op.
		const topDownOption = await screen.findByRole("button", {
			name: "Top-down",
		});
		await user.click(topDownOption);

		expect(fetch).not.toHaveBeenCalled();
	});
});
