import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
	mockRefresh,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import { ArchivedCopiesList, type ArchivedCopy } from "../archived-copies-list";

const REMOVE_BUTTON_PATTERN = /Remove from Discover/;

const COPY: ArchivedCopy = {
	archivedAt: "2026-09-01T00:00:00.000Z",
	id: "copy-1",
	slug: "the-case",
	title: "The Case",
};

async function openRemoveDialog(): Promise<ReturnType<typeof userEvent.setup>> {
	const user = userEvent.setup();
	await user.click(screen.getByRole("button", { name: REMOVE_BUTTON_PATTERN }));
	await user.click(
		screen
			.getAllByRole("button", { name: REMOVE_BUTTON_PATTERN })
			.at(-1) as HTMLElement
	);
	return user;
}

describe("ArchivedCopiesList", () => {
	it("renders nothing when there are no archived copies", () => {
		const { container } = render(<ArchivedCopiesList copies={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	it("removes the copy and refreshes on success", async () => {
		resetNavigationMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve({ ok: true } as Response))
		);

		render(<ArchivedCopiesList copies={[COPY]} />);
		await openRemoveDialog();

		await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
		expect(fetch).toHaveBeenCalledWith("/api/cases/trash/archived/copy-1", {
			method: "DELETE",
		});
	});

	it("shows an error and keeps the row when the removal fails", async () => {
		resetNavigationMocks();
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve({
					ok: false,
					json: () => Promise.resolve({ error: "Archived copy not found" }),
				} as Response)
			)
		);

		render(<ArchivedCopiesList copies={[COPY]} />);
		await openRemoveDialog();

		await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
		expect(mockRefresh).not.toHaveBeenCalled();
		expect(screen.getByText("The Case")).toBeInTheDocument();
	});
});
