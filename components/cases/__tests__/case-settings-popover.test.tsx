import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// The repo-wide Radix mocks (src/__tests__/setup/component-mocks.tsx) are
// simplified state containers that don't implement real dismiss behaviour
// (outside click / Escape), so this whole file needs the actual primitives —
// the dismiss-behaviour tests below would be false-green against the mocks.
vi.unmock("@radix-ui/react-popover");
vi.unmock("@radix-ui/react-tooltip");

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

describe("CaseSettingsPopover — dismiss on outside click / Escape", () => {
	beforeEach(() => {
		resetStore();
	});

	it("closes on Escape", async () => {
		const user = userEvent.setup();
		render(<CaseSettingsPopover />);

		await user.click(await screen.findByRole("button", { name: "Settings" }));
		await screen.findByText("Mode");

		await user.keyboard("{Escape}");

		await waitFor(() => {
			expect(screen.queryByText("Mode")).not.toBeInTheDocument();
		});
	});

	it("the trigger still toggles the popover open and closed", async () => {
		const user = userEvent.setup();
		render(<CaseSettingsPopover />);
		const trigger = await screen.findByRole("button", { name: "Settings" });

		await user.click(trigger);
		await screen.findByText("Mode");

		// `modal` sets `body.style.pointerEvents = "none"` while open, so a
		// full realistic press-and-release (userEvent.click) on the trigger
		// legitimately fails jsdom's hit-testing partway through — the same
		// way a real browser would redirect the click elsewhere for the
		// duration the CSS override is in effect. `fireEvent.click` exercises
		// the trigger's actual composed onClick (open-toggle) handler without
		// that pointer-events pre-check, which is what actually determines
		// whether re-clicking still closes it.
		fireEvent.click(trigger);
		await waitFor(() => {
			expect(screen.queryByText("Mode")).not.toBeInTheDocument();
		});
	});

	it("closes on an outside click even when the click target stops event propagation — the exact ReactFlow-canvas scenario that defeated the pre-fix non-modal popover", async () => {
		render(
			<div>
				{/* Stands in for ReactFlow's pane: d3-zoom attaches native
				 * pointerdown/mousedown handlers there that stop propagation
				 * for its own pan-gesture handling. A non-modal Popover's
				 * outside-click dismiss listens on `document` in the bubble
				 * phase, so that stopPropagation() silently swallowed the
				 * dismiss pre-fix. */}
				<div data-testid="canvas-pane">canvas</div>
				<CaseSettingsPopover />
			</div>
		);
		const pane = screen.getByTestId("canvas-pane");
		pane.addEventListener("pointerdown", (e) => e.stopPropagation());
		pane.addEventListener("mousedown", (e) => e.stopPropagation());

		fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
		await screen.findByText("Mode");

		// `modal` sets `document.body.style.pointerEvents = "none"` while
		// open, so a real click over the canvas never reaches `pane` at all —
		// confirm that's actually in effect, then dispatch where the click
		// would really land (fireEvent skips CSS hit-testing, unlike a real
		// browser or user-event, so we simulate the redirect explicitly).
		expect(document.body.style.pointerEvents).toBe("none");
		fireEvent.pointerDown(document.body);
		fireEvent.mouseDown(document.body);
		fireEvent.mouseUp(document.body);
		fireEvent.click(document.body);

		await waitFor(() => {
			expect(screen.queryByText("Mode")).not.toBeInTheDocument();
		});
	});
});
