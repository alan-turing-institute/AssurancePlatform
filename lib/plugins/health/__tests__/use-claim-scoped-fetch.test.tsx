import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEEvent, UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { useClaimScopedFetch } from "../use-claim-scoped-fetch";

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));

const HEALTH_EVENT = "tea.health/state-changed";
const ERROR_VALUE = "failed";
const NOT_APPLICABLE = "not-applicable";

const CLAIM: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};

const fetchFn = vi.fn<(elementId: string) => Promise<string>>();

function render(
	context: ElementSlotContext = CLAIM,
	extra: { onStateChanged?: () => void; subscribe?: boolean } = {}
) {
	return renderHook(
		(props: ElementSlotContext) =>
			useClaimScopedFetch<string>({
				...props,
				...extra,
				errorValue: ERROR_VALUE,
				fetchFn,
				notApplicableValue: NOT_APPLICABLE,
			}),
		{ initialProps: context }
	);
}

function subscription(): UseCaseEventsOptions {
	const options = vi.mocked(useCaseEvents).mock.lastCall?.[0];
	if (!options) {
		throw new Error("the hook did not subscribe");
	}
	return options;
}

function emit(event: Partial<SSEEvent>) {
	act(() => subscription().onEvent?.(event as SSEEvent));
}

beforeEach(() => {
	fetchFn.mockReset();
	fetchFn.mockResolvedValue("answer");
	vi.mocked(useCaseEvents).mockClear();
});

describe("a claim's fetch", () => {
	it("is loading with the error value, then ready with what was fetched", async () => {
		const { result } = render();

		expect(result.current.status).toBe("loading");
		expect(result.current.data).toBe(ERROR_VALUE);
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.data).toBe("answer");
		expect(fetchFn).toHaveBeenCalledExactlyOnceWith("claim-42");
	});

	it("is in the error state, holding the error value, when the fetch throws", async () => {
		fetchFn.mockRejectedValue(new Error("down"));

		const { result } = render();

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.data).toBe(ERROR_VALUE);
	});

	it("is ready again, with the data, when a refetch follows a failure", async () => {
		fetchFn.mockRejectedValueOnce(new Error("down"));
		const { result } = render();
		await waitFor(() => expect(result.current.status).toBe("error"));

		await act(() => result.current.refetch());

		expect(result.current.status).toBe("ready");
		expect(result.current.data).toBe("answer");
	});

	it("fetches again for another claim", async () => {
		const { result, rerender } = render();
		await waitFor(() => expect(result.current.status).toBe("ready"));
		fetchFn.mockResolvedValue("other answer");

		rerender({ ...CLAIM, elementId: "claim-43" });

		await waitFor(() => expect(result.current.data).toBe("other answer"));
		expect(fetchFn).toHaveBeenLastCalledWith("claim-43");
	});

	it("shows a value it is handed as ready, even after a failure", async () => {
		fetchFn.mockRejectedValue(new Error("down"));
		const { result } = render();
		await waitFor(() => expect(result.current.status).toBe("error"));

		act(() => result.current.replace("handed"));

		expect(result.current.status).toBe("ready");
		expect(result.current.data).toBe("handed");
	});
});

describe("an element that is not a claim", () => {
	it("is ready with the not-applicable value, makes no request and opens no subscription", async () => {
		const { result } = render({ ...CLAIM, elementType: "evidence" });
		await act(() => result.current.refetch());

		expect(result.current.status).toBe("ready");
		expect(result.current.data).toBe(NOT_APPLICABLE);
		expect(fetchFn).not.toHaveBeenCalled();
		expect(subscription().enabled).toBe(false);
	});
});

describe("the live subscription", () => {
	it("is open for a claim in a case", async () => {
		const { result } = render();
		await waitFor(() => expect(result.current.status).toBe("ready"));

		expect(subscription()).toMatchObject({ caseId: "case-1", enabled: true });
	});

	it("is not opened when the caller asks for none", async () => {
		const { result } = render(CLAIM, { subscribe: false });
		await waitFor(() => expect(result.current.status).toBe("ready"));

		expect(subscription().enabled).toBe(false);
	});

	it("is not opened when there is no case", async () => {
		const { result } = render({ ...CLAIM, caseId: "" });
		await waitFor(() => expect(result.current.status).toBe("ready"));

		expect(subscription().enabled).toBe(false);
	});
});

describe("a health state event", () => {
	it("fetches again and tells the caller, when it is for this claim", async () => {
		const onStateChanged = vi.fn();
		const { result } = render(CLAIM, { onStateChanged });
		await waitFor(() => expect(result.current.status).toBe("ready"));
		fetchFn.mockResolvedValue("newer answer");

		emit({ type: HEALTH_EVENT, payload: { claimId: "claim-42" } });

		await waitFor(() => expect(result.current.data).toBe("newer answer"));
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(onStateChanged).toHaveBeenCalledTimes(1);
	});

	it.each([
		["is for another claim", { type: HEALTH_EVENT, payload: { claimId: "x" } }],
		[
			"is another kind of event that names this claim",
			{ type: "element:updated", payload: { claimId: "claim-42" } },
		],
		["carries no payload", { type: HEALTH_EVENT }],
	])("changes nothing when it %s", async (_name, event) => {
		const onStateChanged = vi.fn();
		const { result } = render(CLAIM, { onStateChanged });
		await waitFor(() => expect(result.current.status).toBe("ready"));

		emit(event as Partial<SSEEvent>);
		await act(async () => undefined);

		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(onStateChanged).not.toHaveBeenCalled();
	});
});
