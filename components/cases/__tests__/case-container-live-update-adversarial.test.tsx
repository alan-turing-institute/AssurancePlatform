import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import { mockReplace } from "@/src/__tests__/mocks/next-navigation-mocks";
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

type Status =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error"
	| "access-removed"
	| "signed-out";

function streamStatus(status: Status) {
	vi.mocked(useCaseEvents).mockReturnValue({
		status,
		isConnected: status === "connected",
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	});
}

beforeEach(() => {
	mockReplace.mockClear();
	vi.mocked(useCaseEvents).mockReset();
	useStore.setState({ assuranceCase: null });
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

const DASHBOARD_LINK = /dashboard/i;
const RETRY_BUTTON = /try again/i;
const MESSAGE =
	"Your access to this case was removed. It may have been deleted, or the owner may have stopped sharing it with you.";

describe("the case page when the live stream says access was removed", () => {
	it("replaces the canvas with an Access removed message the user can reach by role", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		const heading = await screen.findByRole("heading", {
			name: "Access removed",
		});
		expect(heading).toBeTruthy();
		const alert = screen
			.getAllByRole("alert")
			.find((element) => element.textContent?.includes("Access removed"));
		expect(alert).toBeTruthy();
		expect(within(alert as HTMLElement).getByText(MESSAGE)).toBeTruthy();
		expect(screen.queryByTestId("flow")).toBeNull();
	});

	it("offers a way back to the dashboard", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		const link = await screen.findByRole("link", { name: DASHBOARD_LINK });
		expect(link.getAttribute("href")).toBe("/dashboard");
	});

	it("does not offer a retry, since nothing will change on its own", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		await screen.findByRole("heading", { name: "Access removed" });
		expect(screen.queryByRole("button", { name: RETRY_BUTTON })).toBeNull();
	});

	it("drops the case from the store so nothing drawn from it stays on screen", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		await screen.findByRole("heading", { name: "Access removed" });
		expect(useStore.getState().assuranceCase).toBeNull();
	});

	it("does not send the user to the sign-in page", async () => {
		streamStatus("access-removed");

		render(<CaseContainer caseId="c1" />);

		await screen.findByRole("heading", { name: "Access removed" });
		expect(mockReplace).not.toHaveBeenCalledWith("/login");
	});

	it("takes over the canvas when the status changes while the case is open", async () => {
		streamStatus("connected");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");

		streamStatus("access-removed");
		view.rerender(<CaseContainer caseId="c1" />);

		await screen.findByRole("heading", { name: "Access removed" });
		expect(screen.queryByTestId("flow")).toBeNull();
	});
});

describe("the case page when the live stream says the session ended", () => {
	it("sends the browser to the sign-in page", async () => {
		streamStatus("signed-out");

		render(<CaseContainer caseId="c1" />);

		await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
		expect(screen.queryByTestId("flow")).toBeNull();
		expect(
			screen.queryByRole("heading", { name: "Access removed" })
		).toBeNull();
	});

	it("goes to the sign-in page once, not on every render", async () => {
		streamStatus("signed-out");

		const view = render(<CaseContainer caseId="c1" />);
		await vi.waitFor(() => expect(mockReplace).toHaveBeenCalled());
		view.rerender(<CaseContainer caseId="c1" />);
		view.rerender(<CaseContainer caseId="c1" />);

		const logins = mockReplace.mock.calls.filter(
			(call) => call[0] === "/login"
		);
		expect(logins).toHaveLength(1);
	});

	it("drops the case from the store", async () => {
		streamStatus("signed-out");

		render(<CaseContainer caseId="c1" />);

		await vi.waitFor(() => expect(mockReplace).toHaveBeenCalled());
		expect(useStore.getState().assuranceCase).toBeNull();
	});

	it("leaves the open canvas until the status changes", async () => {
		streamStatus("connected");
		const view = render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");
		expect(mockReplace).not.toHaveBeenCalled();

		streamStatus("signed-out");
		view.rerender(<CaseContainer caseId="c1" />);

		await vi.waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
		expect(screen.queryByTestId("flow")).toBeNull();
	});
});

describe("the case page for every other stream status", () => {
	it.each([
		"connected",
		"connecting",
		"disconnected",
		"error",
	] as const)("keeps the canvas when the stream is %s", async (status) => {
		streamStatus(status);

		render(<CaseContainer caseId="c1" />);

		await screen.findByTestId("flow");
		expect(
			screen.queryByRole("heading", { name: "Access removed" })
		).toBeNull();
		expect(mockReplace).not.toHaveBeenCalledWith("/login");
	});
});
