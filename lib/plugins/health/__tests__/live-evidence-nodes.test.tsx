import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEEvent } from "@/hooks/use-case-events";
import { server } from "@/src/__tests__/mocks/server";
import type { HealthLiveEvidenceNode } from "../health-types";
import { resetLiveNodesForTests } from "../live-evidence-nodes";
import { useLiveEvidenceNodes } from "../use-live-evidence-nodes";
import { liveNode } from "./health-test-data";

const listeners = new Map<string, Set<(event: SSEEvent) => void>>();
const stopped: string[] = [];

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	subscribeToCaseEvents: (
		caseId: string,
		onEvent: (event: SSEEvent) => void
	) => {
		const forCase = listeners.get(caseId) ?? new Set();
		forCase.add(onEvent);
		listeners.set(caseId, forCase);
		return () => {
			forCase.delete(onEvent);
			stopped.push(caseId);
		};
	},
}));

const CASE_ID = "case-1";
const LIST_URL = `/api/cases/${CASE_ID}/health/evidence-nodes`;

let requests = 0;
let answer: HealthLiveEvidenceNode[] = [];

function serve() {
	server.use(
		http.get(LIST_URL, () => {
			requests += 1;
			return HttpResponse.json(answer);
		})
	);
}

function emit(type: string) {
	for (const listener of listeners.get(CASE_ID) ?? []) {
		listener({ type } as SSEEvent);
	}
}

beforeEach(() => {
	requests = 0;
	answer = [liveNode()];
	serve();
});

afterEach(() => {
	resetLiveNodesForTests();
	listeners.clear();
	stopped.length = 0;
});

describe("the case's live evidence nodes", () => {
	it("are read once for any number of components that ask", async () => {
		const first = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		const second = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		const third = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));

		await waitFor(() => expect(first.result.current.loaded).toBe(true));

		expect(requests).toBe(1);
		for (const { result } of [first, second, third]) {
			expect(result.current.byNodeId.get("node-1")?.claim_id).toBe("claim-42");
			expect(result.current.byClaimId.get("claim-42")?.id).toBe("node-1");
		}
	});

	it("make no request, and hold nothing, for a component that is switched off", async () => {
		const { result } = renderHook(() => useLiveEvidenceNodes(CASE_ID, false));

		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(requests).toBe(0);
		expect(result.current.loaded).toBe(false);
		expect(listeners.get(CASE_ID)?.size ?? 0).toBe(0);
	});

	it("make no request when there is no case on the canvas", async () => {
		renderHook(() => useLiveEvidenceNodes("", true));

		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(requests).toBe(0);
	});

	it.each([
		"element:created",
		"element:updated",
		"element:deleted",
		"element:restored",
		"element:attached",
		"element:detached",
		"element:moved",
		"case:updated",
		"comment:created",
		"comment:updated",
		"comment:deleted",
		"permission:changed",
		"tea.health/state-changed",
	])("are read again after a %s event", async (type) => {
		const { result } = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		await waitFor(() => expect(result.current.loaded).toBe(true));
		answer = [liveNode({ id: "node-2", claim_id: "claim-43" })];

		act(() => emit(type));

		await waitFor(() =>
			expect(result.current.byNodeId.has("node-2")).toBe(true)
		);
		expect(result.current.byNodeId.has("node-1")).toBe(false);
		expect(requests).toBe(2);
	});

	it("are not read again for an event that cannot change them", async () => {
		const { result } = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		await waitFor(() => expect(result.current.loaded).toBe(true));

		act(() => emit("user:joined"));
		await new Promise((resolve) => setTimeout(resolve, 30));

		expect(requests).toBe(1);
	});

	it("are read once more, not many times, when a burst of events arrives while a read runs", async () => {
		const { result } = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		await waitFor(() => expect(result.current.loaded).toBe(true));

		act(() => {
			emit("element:created");
			emit("element:updated");
			emit("tea.health/state-changed");
		});
		await waitFor(() => expect(requests).toBeGreaterThanOrEqual(2));
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(requests).toBeLessThanOrEqual(3);
	});

	it("show no live nodes, but are loaded, when the read fails", async () => {
		server.use(
			http.get(LIST_URL, () =>
				HttpResponse.json({ error: "no" }, { status: 403 })
			)
		);

		const { result } = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));

		await waitFor(() => expect(result.current.loaded).toBe(true));
		expect(result.current.byNodeId.size).toBe(0);
	});

	it("stop listening to the case, and are dropped, when the last component leaves", async () => {
		const first = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		const second = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		await waitFor(() => expect(first.result.current.loaded).toBe(true));

		first.unmount();
		expect(stopped).toEqual([]);
		second.unmount();

		expect(stopped).toEqual([CASE_ID]);
		const again = renderHook(() => useLiveEvidenceNodes(CASE_ID, true));
		expect(again.result.current.loaded).toBe(false);
		await waitFor(() => expect(again.result.current.loaded).toBe(true));
	});
});
