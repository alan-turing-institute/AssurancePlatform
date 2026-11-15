import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import { type ConnectionStatus, useCaseEvents } from "@/hooks/use-case-events";
import { fetchAndRefreshCase } from "@/lib/case";
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
 * What an editor that is open on a case does when its live stream has given
 * up, and when a connection comes back afterwards.
 */

const reconnect = vi.fn();
let onStatusChange: ((status: ConnectionStatus) => void) | undefined;

beforeEach(() => {
	reconnect.mockClear();
	vi.mocked(fetchAndRefreshCase).mockClear();
	onStatusChange = undefined;
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

function streamStatus(status: ConnectionStatus) {
	vi.mocked(useCaseEvents).mockImplementation((options) => {
		onStatusChange = options.onStatusChange;
		return {
			status,
			isConnected: status === "connected",
			lastEvent: null,
			reconnect,
			disconnect: vi.fn(),
		};
	});
}

describe("a case whose live updates have stopped", () => {
	it("shows the notice only when the stream has given up", async () => {
		streamStatus("connected");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");
		expect(screen.queryByRole("status")).toBeNull();

		streamStatus("connecting");
		view.rerender(<CaseContainer caseId="c1" />);
		expect(screen.queryByRole("status")).toBeNull();

		streamStatus("error");
		view.rerender(<CaseContainer caseId="c1" />);
		expect(screen.getByRole("status").textContent).toContain(
			"Live updates have stopped. Changes other people make will not appear until you reconnect."
		);
		expect(screen.getByTestId("flow")).toBeTruthy();
	});

	it("restarts the stream, without reloading, when Reconnect is pressed", async () => {
		streamStatus("error");
		render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");

		await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));

		expect(reconnect).toHaveBeenCalledTimes(1);
	});

	it("reads the case again once after a connection that follows the failure, and not after the first connection", async () => {
		streamStatus("connecting");
		render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");

		act(() => onStatusChange?.("connected"));
		expect(fetchAndRefreshCase).not.toHaveBeenCalled();

		act(() => onStatusChange?.("error"));
		act(() => onStatusChange?.("connecting"));
		act(() => onStatusChange?.("connected"));
		await waitFor(() => {
			expect(fetchAndRefreshCase).toHaveBeenCalledTimes(1);
		});

		act(() => onStatusChange?.("connected"));
		expect(fetchAndRefreshCase).toHaveBeenCalledTimes(1);
	});
});
