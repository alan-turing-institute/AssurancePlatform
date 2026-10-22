import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShowUnsupportedMarkers } from "@/actions/unsupported-markers";
import { useCaseEvents } from "@/hooks/use-case-events";
import useStore from "@/store/store";
import CaseContainer from "../case-container";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn(),
}));
vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: ["element:created"],
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
	default: () => <div data-testid="flow" />,
}));
vi.mock("../header", () => ({ default: () => null }));
vi.mock("../case-details", () => ({ default: () => null }));

const fetchSetting = vi.mocked(fetchShowUnsupportedMarkers);

interface Held {
	reject: (reason: unknown) => void;
	resolve: (value: boolean | null) => void;
}

function holdSettingRequests(): Held[] {
	const held: Held[] = [];
	fetchSetting.mockImplementation(
		() =>
			new Promise<boolean | null>((resolve, reject) => {
				held.push({ resolve, reject });
			})
	);
	return held;
}

/** Answers one held request, inside `act` so the page takes the answer in. */
async function answer(
	request: Held | undefined,
	outcome: boolean | null | Error
): Promise<void> {
	if (!request) {
		throw new Error("the request being answered was never made");
	}
	await act(async () => {
		if (outcome instanceof Error) {
			request.reject(outcome);
		} else {
			request.resolve(outcome);
		}
		await Promise.resolve();
	});
}

async function settle(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
}

beforeEach(() => {
	fetchSetting.mockReset();
	vi.mocked(useCaseEvents).mockReset();
	useStore.setState({ showUnsupportedMarkers: null });
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) =>
			Promise.resolve(
				Response.json(
					url.endsWith("/sandbox")
						? []
						: { id: 1, name: "Case", goals: [], permissions: "manage" }
				)
			)
		)
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	useStore.setState({ showUnsupportedMarkers: null, assuranceCase: null });
});

describe("CaseContainer and the unsupported-marker setting", () => {
	it("starts from not loaded even when the store still holds an earlier visitor's value", () => {
		useStore.setState({ showUnsupportedMarkers: true });
		holdSettingRequests();

		render(<CaseContainer caseId="1" />);

		expect(useStore.getState().showUnsupportedMarkers).toBeNull();
	});

	it("keeps the setting not loaded while the request is out", async () => {
		holdSettingRequests();

		render(<CaseContainer caseId="1" />);
		await screen.findByTestId("flow");

		expect(useStore.getState().showUnsupportedMarkers).toBeNull();
	});

	it.each([
		[true, true],
		[false, false],
	])("holds the account's value %s once it arrives", async (value, expected) => {
		const held = holdSettingRequests();
		render(<CaseContainer caseId="1" />);

		await answer(held[0], value);

		await waitFor(() => {
			expect(useStore.getState().showUnsupportedMarkers).toBe(expected);
		});
	});

	it("leaves the setting not loaded when nobody is signed in or it cannot be read", async () => {
		const held = holdSettingRequests();
		render(<CaseContainer caseId="1" />);

		await answer(held[0], null);
		await settle();

		expect(useStore.getState().showUnsupportedMarkers).toBeNull();
	});

	it("leaves the setting not loaded, without an unhandled error, when the request throws", async () => {
		const held = holdSettingRequests();
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		render(<CaseContainer caseId="1" />);

		await answer(held[0], new Error("offline"));
		await settle();
		process.off("unhandledRejection", unhandled);

		expect(useStore.getState().showUnsupportedMarkers).toBeNull();
		expect(unhandled).not.toHaveBeenCalled();
		expect(await screen.findByTestId("flow")).toBeInTheDocument();
	});

	it("ignores an answer that arrives after the page has gone", async () => {
		const held = holdSettingRequests();
		const view = render(<CaseContainer caseId="1" />);
		view.unmount();

		await answer(held[0], true);
		await settle();

		expect(useStore.getState().showUnsupportedMarkers).toBeNull();
	});

	it("does not let a slow answer for an earlier page overwrite the next page's", async () => {
		const held = holdSettingRequests();
		const first = render(<CaseContainer caseId="1" />);
		first.unmount();
		render(<CaseContainer caseId="2" />);

		await answer(held[1], false);
		await answer(held[0], true);
		await settle();

		expect(useStore.getState().showUnsupportedMarkers).toBe(false);
	});

	it("asks once per page, not again when the case is refetched after another viewer's edit", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		try {
			fetchSetting.mockResolvedValue(true);
			render(<CaseContainer caseId="1" />);
			await screen.findByTestId("flow");
			const onEvent = vi.mocked(useCaseEvents).mock.calls.at(-1)?.[0].onEvent;
			expect(onEvent).toBeDefined();

			await act(async () => {
				onEvent?.({
					type: "element:created",
					caseId: "1",
					payload: {},
					timestamp: "now",
				} as never);
				await vi.advanceTimersByTimeAsync(600);
			});

			expect(fetchSetting).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not draw the setting back to on after the viewer has switched it off", async () => {
		fetchSetting.mockResolvedValue(true);
		render(<CaseContainer caseId="1" />);
		await waitFor(() => {
			expect(useStore.getState().showUnsupportedMarkers).toBe(true);
		});

		act(() => {
			useStore.getState().setShowUnsupportedMarkers(false);
		});
		await settle();

		expect(useStore.getState().showUnsupportedMarkers).toBe(false);
	});

	it("still loads under StrictMode, which runs the effect twice", async () => {
		fetchSetting.mockResolvedValue(false);

		render(
			<StrictMode>
				<CaseContainer caseId="1" />
			</StrictMode>
		);

		await waitFor(() => {
			expect(useStore.getState().showUnsupportedMarkers).toBe(false);
		});
	});
});
