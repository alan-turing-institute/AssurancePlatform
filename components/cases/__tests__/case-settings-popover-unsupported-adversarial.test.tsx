import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import useStore from "@/store/store";
import { CaseSettingsPopover } from "../case-settings-popover";

vi.mock("@/providers/theme-preset-provider", () => ({
	useThemePreset: () => ({
		preset: { id: "default", name: "Default", light: {}, dark: {} },
		setPreset: vi.fn(),
		availablePresets: [],
	}),
}));
vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn(),
	saveShowUnsupportedMarkers: vi.fn(),
}));

// The repo-wide Radix mocks are simple state containers; the switch and the
// popover are used here as the app uses them.
vi.unmock("@radix-ui/react-popover");
vi.unmock("@radix-ui/react-tooltip");

const save = vi.mocked(saveShowUnsupportedMarkers);

async function openSwitch() {
	const user = userEvent.setup();
	render(<CaseSettingsPopover />);
	await user.click(await screen.findByRole("button", { name: "Settings" }));
	const control = await screen.findByRole("switch", {
		name: "Show unsupported markers",
	});
	return { user, control };
}

beforeEach(() => {
	save.mockReset();
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
	);
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
		showUnsupportedMarkers: true,
	});
});

describe("CaseSettingsPopover — unsupported markers switch", () => {
	it("sends no request about the case: it is not a setting of the case", async () => {
		save.mockResolvedValue(false);
		const { user, control } = await openSwitch();

		await user.click(control);
		await waitFor(() => {
			expect(save).toHaveBeenCalled();
		});

		expect(fetch).not.toHaveBeenCalled();
	});

	it("does not touch the layout direction or the case when the markers are switched", async () => {
		save.mockResolvedValue(false);
		const { user, control } = await openSwitch();

		await user.click(control);

		expect(useStore.getState().layoutDirection).toBe("TB");
		expect(fetch).not.toHaveBeenCalled();
	});
});
