import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import { useCaseEvents } from "@/hooks/use-case-events";
import { toastInfo } from "@/lib/toast";
import CaseContainer from "../case-container";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: [],
	useCaseEvents: vi.fn(() => ({ status: "connected" })),
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

// The signed-in user in the shared next-auth mock has the id "1".
const SELF = "1";

beforeEach(() => {
	vi.mocked(toastInfo).mockReset();
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

async function send(type: string, payload: Record<string, unknown>) {
	render(<CaseContainer caseId="c1" />);
	await screen.findByTestId("flow");
	const onEvent = vi.mocked(useCaseEvents).mock.calls.at(-1)?.[0].onEvent;
	act(() => {
		onEvent?.({
			type,
			caseId: "c1",
			payload,
			timestamp: "now",
			// The connection manager copies the payload's user id onto the event.
			userId: payload.userId,
		} as never);
	});
}

describe("the toast for a case:updated event", () => {
	it("names who turned the case into a pattern", async () => {
		await send("case:updated", {
			action: "kind-changed",
			kind: "PATTERN",
			userId: "2",
			username: "alice",
		});

		expect(toastInfo).toHaveBeenCalledWith(
			"alice converted this case to a pattern",
			{ duration: 4000 }
		);
	});

	it("names who turned the pattern back into a case", async () => {
		await send("case:updated", {
			action: "kind-changed",
			kind: "CASE",
			userId: "2",
			username: "alice",
		});

		expect(toastInfo).toHaveBeenCalledWith(
			"alice converted this pattern to a case",
			{ duration: 4000 }
		);
	});

	it("shows nothing to the person who made the change", async () => {
		await send("case:updated", {
			action: "kind-changed",
			kind: "PATTERN",
			userId: SELF,
			username: "me",
		});

		expect(toastInfo).not.toHaveBeenCalled();
	});

	it("keeps the generic message for any other case update", async () => {
		await send("case:updated", { userId: "2", username: "alice" });

		expect(toastInfo).toHaveBeenCalledWith("alice updated the case details", {
			duration: 4000,
		});
	});
});
