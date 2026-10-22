import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, saveMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
	saveMock: vi.fn(),
}));
vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: fetchMock,
	saveShowUnsupportedMarkers: saveMock,
}));

import { UnsupportedMarkersForm } from "../unsupported-markers-form";

const SAVED_TO_ACCOUNT = /saved to your account/i;
const SAVED_TO_BROWSER = /saved to your browser/i;

beforeEach(() => {
	fetchMock.mockReset();
	// The stored value cannot be read, so a failed save falls back on the last value known to be stored.
	fetchMock.mockResolvedValue(null);
	saveMock.mockReset();
});

describe("UnsupportedMarkersForm", () => {
	it("sits in a section of its own that says the choice is saved to the account", () => {
		render(<UnsupportedMarkersForm initialValue={true} />);

		expect(
			screen.getByRole("heading", { name: "Case diagram" })
		).toBeInTheDocument();
		expect(screen.getByText(SAVED_TO_ACCOUNT)).toBeInTheDocument();
		expect(screen.queryByText(SAVED_TO_BROWSER)).not.toBeInTheDocument();
	});

	it("shows the stored setting", () => {
		const { unmount } = render(<UnsupportedMarkersForm initialValue={false} />);
		expect(
			screen.getByRole("switch", { name: "Show unsupported markers" })
		).not.toBeChecked();
		unmount();

		render(<UnsupportedMarkersForm initialValue={true} />);
		expect(
			screen.getByRole("switch", { name: "Show unsupported markers" })
		).toBeChecked();
	});

	it("saves the choice, and puts it back when the save fails", async () => {
		saveMock.mockResolvedValueOnce(false).mockResolvedValueOnce(null);
		const person = userEvent.setup();
		render(<UnsupportedMarkersForm initialValue={true} />);
		const marker = screen.getByRole("switch", {
			name: "Show unsupported markers",
		});

		await person.click(marker);
		await waitFor(() => expect(saveMock).toHaveBeenLastCalledWith(false));
		expect(marker).not.toBeChecked();

		await person.click(marker);
		await waitFor(() => expect(saveMock).toHaveBeenLastCalledWith(true));
		await waitFor(() => expect(marker).not.toBeChecked());
	});

	it("cannot be pressed when the account could not be read", () => {
		render(<UnsupportedMarkersForm initialValue={null} />);

		expect(
			screen.getByRole("switch", { name: "Show unsupported markers" })
		).toBeDisabled();
	});
});
