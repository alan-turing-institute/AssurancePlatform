import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
vi.mock("../flow", () => ({
	default: ({ liveUpdatesNotice }: { liveUpdatesNotice?: ReactNode }) => (
		<div data-testid="flow">{liveUpdatesNotice}</div>
	),
}));
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
		expect(screen.queryByTestId("live-updates-paused")).toBeNull();

		streamStatus("connecting");
		view.rerender(<CaseContainer caseId="c1" />);
		expect(screen.queryByTestId("live-updates-paused")).toBeNull();

		streamStatus("error");
		view.rerender(<CaseContainer caseId="c1" />);
		expect(screen.getByRole("status").textContent).toContain(
			"Live updates have stopped. Changes other people make will not appear until you reconnect."
		);
		expect(screen.getByTestId("flow")).toBeTruthy();
	});

	it("keeps a named status region in the page whether or not the notice shows", async () => {
		streamStatus("connected");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");
		const region = screen.getByRole("status", { name: "Live updates stopped" });
		expect(region.textContent).toBe("");

		streamStatus("error");
		view.rerender(<CaseContainer caseId="c1" />);

		expect(screen.getByRole("status", { name: "Live updates stopped" })).toBe(
			region
		);
		expect(region.textContent).toContain("Live updates have stopped.");
		expect(region.querySelector("p")).toBeNull();
	});

	it("moves focus to the status region when Reconnect is pressed, not the page body", async () => {
		streamStatus("error");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");

		await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
		streamStatus("connecting");
		view.rerender(<CaseContainer caseId="c1" />);

		expect(screen.queryByRole("button", { name: "Reconnect" })).toBeNull();
		expect(document.activeElement).toBe(screen.getByRole("status"));
	});

	it("does not read the case again when the connection after the failure ends in removed access", async () => {
		streamStatus("connecting");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");

		act(() => onStatusChange?.("error"));
		act(() => onStatusChange?.("connecting"));
		streamStatus("access-removed");
		view.rerender(<CaseContainer caseId="c1" />);
		act(() => onStatusChange?.("access-removed"));

		expect(await screen.findByText("Access removed")).toBeTruthy();
		expect(fetchAndRefreshCase).not.toHaveBeenCalled();
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
