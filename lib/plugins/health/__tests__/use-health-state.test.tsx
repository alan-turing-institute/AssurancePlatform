import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { useHealthState } from "../use-health-state";
import { status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));

const CLAIM: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};
const HEALTH_URL = "/api/elements/claim-42/health";
const STATUS = status();

describe("a claim's health status", () => {
	it("is the status the server gives", async () => {
		server.use(
			http.get(HEALTH_URL, () => HttpResponse.json({ status: STATUS }))
		);

		const { result } = renderHook(() => useHealthState(CLAIM));

		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.healthStatus).toEqual(STATUS);
	});

	it("is ready with no status when the claim has none", async () => {
		server.use(http.get(HEALTH_URL, () => HttpResponse.json({ status: null })));

		const { result } = renderHook(() => useHealthState(CLAIM));

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.healthStatus).toBeNull();
	});

	it("is in the error state, with no status, when the server refuses, whatever the body says", async () => {
		server.use(
			http.get(HEALTH_URL, () =>
				HttpResponse.json({ status: status() }, { status: 500 })
			)
		);

		const { result } = renderHook(() => useHealthState(CLAIM));

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.healthStatus).toBeNull();
	});

	it("is ready with no status, and asks for nothing, for an element that is not a claim", () => {
		const { result } = renderHook(() =>
			useHealthState({ ...CLAIM, elementType: "evidence" })
		);

		expect(result.current.status).toBe("ready");
		expect(result.current.healthStatus).toBeNull();
	});
});
