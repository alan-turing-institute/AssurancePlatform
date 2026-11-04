import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import { useCaseEvents } from "@/hooks/use-case-events";
import useStore from "@/store/store";
import CaseContainer from "../case-container";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: [],
	useCaseEvents: vi.fn(),
}));
vi.mock("@/lib/case", () => ({
	addHiddenProp: (value: unknown) => value,
	fetchAndRefreshCase: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/toast", () => ({
	toast: vi.fn(),
	toastError: vi.fn(),
	toastInfo: vi.fn(),
}));
vi.mock("@/components/tour/check-tour", () => ({ default: () => null }));
vi.mock("../flow", () => ({ default: () => <div data-testid="flow" /> }));
vi.mock("../header", () => ({ default: () => null }));
vi.mock("../case-details", () => ({ default: () => null }));

/**
 * What an editor that is open on a case does when the server ends its live
 * stream because the viewer's access to the case has gone.
 */

beforeEach(() => {
	useStore.setState({ assuranceCase: null });
	vi.mocked(fetchShowUnsupportedMarkers).mockResolvedValue(true);
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) =>
			Promise.resolve(
				Response.json(
					url.endsWith("/sandbox")
						? []
						: { id: "c1", name: "Case", goals: [], permissions: "manage" }
				)
			)
		)
	);
});

function streamStatus(status: "connected" | "access-removed") {
	vi.mocked(useCaseEvents).mockReturnValue({
		status,
		isConnected: status === "connected",
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	});
}

describe("a case whose access was removed while it was open", () => {
	it("replaces the canvas with a message in an alert, keeps the dashboard link and clears the case", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText("Access removed")).toBeTruthy();
		expect(
			within(alert).getByText(
				"Your access to this case was removed. It may have been deleted, or the owner may have stopped sharing it with you."
			)
		).toBeTruthy();
		expect(
			within(alert)
				.getByRole("link", { name: "Go to dashboard" })
				.getAttribute("href")
		).toBe("/dashboard");
		expect(screen.queryByTestId("flow")).toBeNull();
		await waitFor(() => {
			expect(useStore.getState().assuranceCase).toBeNull();
		});
	});

	it("keeps showing the canvas while the stream is connected", async () => {
		streamStatus("connected");

		render(<CaseContainer caseId="c1" />);

		await screen.findByTestId("flow");
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
