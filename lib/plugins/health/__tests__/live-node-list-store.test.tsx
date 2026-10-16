import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCaseEventStreams } from "@/hooks/use-case-events";
import { liveNodeItem as liveNode } from "@/src/__tests__/utils/live-node-ui-kit";
import type { HealthLiveEvidenceNode } from "../health-types";
import { resetLiveNodesForTests } from "../live-evidence-nodes";
import { useLiveEvidenceNodes } from "../use-live-evidence-nodes";

/**
 * The case's list of live evidence nodes is read once per case and shared by
 * every node, edge and badge. These tests drive it through the hook the canvas
 * uses, over a stand-in for the browser's event stream and a stand-in for the
 * list request, so what is counted is requests and open listeners.
 */

class FakeSource {
	static all: FakeSource[] = [];
	closed = false;
	onerror: (() => void) | null = null;
	onopen: (() => void) | null = null;
	readonly url: string;
	private readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();

	constructor(url: string) {
		this.url = url;
		FakeSource.all.push(this);
	}

	addEventListener(type: string, listener: (e: MessageEvent) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	close() {
		this.closed = true;
	}

	/** Delivers an event on the named channel whose body says it has type `type`. */
	emit(channel: string, type = channel) {
		const body = { type, caseId: "case-1", payload: {}, timestamp: "now" };
		for (const listener of this.listeners.get(channel) ?? []) {
			listener({ data: JSON.stringify(body) } as MessageEvent);
		}
	}
}

const open = () => FakeSource.all.filter((source) => !source.closed);

interface Pending {
	reject: (reason: unknown) => void;
	resolve: (response: Response) => void;
	url: string;
}

let requests: Pending[];
let answers: (url: string) => Promise<Response> | Response;

function listResponse(nodes: HealthLiveEvidenceNode[], status = 200) {
	return new Response(JSON.stringify(nodes), { status });
}

/** Lets every promise the store is waiting on run. */
async function settle() {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

beforeEach(() => {
	FakeSource.all = [];
	requests = [];
	answers = () => listResponse([]);
	vi.stubGlobal("EventSource", FakeSource);
	vi.stubGlobal(
		"fetch",
		vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			requests.push({ url, resolve: () => undefined, reject: () => undefined });
			return Promise.resolve(answers(url));
		})
	);
});

afterEach(() => {
	resetLiveNodesForTests();
	resetCaseEventStreams();
	vi.unstubAllGlobals();
});

const urls = () => requests.map((request) => request.url);
const LIST_URL = "/api/cases/case-1/health/evidence-nodes";

describe("the case's live evidence nodes: one shared read", () => {
	it("makes one request for a case however many nodes and edges ask", async () => {
		const hooks = Array.from({ length: 12 }, () =>
			renderHook(() => useLiveEvidenceNodes("case-1", true))
		);
		await settle();

		expect(urls()).toEqual([LIST_URL]);

		const late = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(urls()).toEqual([LIST_URL]);
		for (const hook of [...hooks, late]) {
			expect(hook.result.current.loaded).toBe(true);
		}
	});

	it("makes one request per case, each for its own list", async () => {
		renderHook(() => useLiveEvidenceNodes("case-1", true));
		renderHook(() => useLiveEvidenceNodes("case-2", true));
		await settle();

		expect(urls().sort()).toEqual([
			"/api/cases/case-1/health/evidence-nodes",
			"/api/cases/case-2/health/evidence-nodes",
		]);
	});

	it("looks a node up by its own id and by the id of the claim it reports on", async () => {
		const node = liveNode({ id: "n1", claim_id: "c1" });
		answers = () => listResponse([node]);
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		expect(result.current.loaded).toBe(false);
		await settle();

		expect(result.current.byNodeId.get("n1")).toEqual(node);
		expect(result.current.byClaimId.get("c1")).toEqual(node);
		expect(result.current.byNodeId.get("c1")).toBeUndefined();
	});
});

describe("the case's live evidence nodes: under React's strict mode", () => {
	it("ends with the answer, one open listener, and no stale answer from the first mount", async () => {
		answers = () => listResponse([liveNode({ id: "n1" })]);
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true), {
			wrapper: StrictMode,
		});
		await settle();

		expect(result.current.loaded).toBe(true);
		expect([...result.current.byNodeId.keys()]).toEqual(["n1"]);
		expect(open()).toHaveLength(1);
		expect(requests.length).toBeLessThanOrEqual(2);
	});
});

describe("the case's live evidence nodes: when they are read again", () => {
	it.each([
		"case:updated",
		"comment:created",
		"comment:updated",
		"comment:deleted",
		"element:created",
		"element:updated",
		"element:deleted",
		"element:restored",
		"element:attached",
		"element:detached",
		"element:moved",
		"permission:changed",
		"tea.health/state-changed",
	])("reads the list again after a %s event", async (type) => {
		renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(requests).toHaveLength(1);

		act(() => open()[0]?.emit(type));
		await settle();

		expect(requests).toHaveLength(2);
	});

	it("reads again once for each event, however many nodes are listening", async () => {
		for (let count = 0; count < 6; count++) {
			renderHook(() => useLiveEvidenceNodes("case-1", true));
		}
		await settle();

		act(() => open()[0]?.emit("element:moved"));
		await settle();
		act(() => open()[0]?.emit("tea.health/state-changed"));
		await settle();

		expect(requests).toHaveLength(3);
		expect(open()).toHaveLength(1);
	});

	it("does not read again for an event that changes neither the elements nor a status", async () => {
		renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();

		act(() => open()[0]?.emit("comment:created", "heartbeat"));
		act(() => open()[0]?.emit("connected"));
		act(() => open()[0]?.emit("case:updated", "typing"));
		await settle();

		expect(requests).toHaveLength(1);
	});

	it("shows the answer to the latest read when events arrive while a read is running", async () => {
		const first = liveNode({ id: "old", claim_id: "c1" });
		const second = liveNode({ id: "new", claim_id: "c1" });
		const waiting: ((response: Response) => void)[] = [];
		answers = () =>
			new Promise<Response>((resolve) => {
				waiting.push(resolve);
			});
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(requests).toHaveLength(1);

		act(() => {
			open()[0]?.emit("element:moved");
			open()[0]?.emit("element:updated");
			open()[0]?.emit("tea.health/state-changed");
		});
		await settle();
		expect(requests).toHaveLength(1);

		waiting[0]?.(listResponse([first]));
		await settle();
		expect(requests).toHaveLength(2);

		waiting[1]?.(listResponse([second]));
		await settle();

		expect(requests).toHaveLength(2);
		expect([...result.current.byNodeId.keys()]).toEqual(["new"]);
	});

	it("ends on the latest answer even when the older read finishes last", async () => {
		const waiting: ((response: Response) => void)[] = [];
		answers = () =>
			new Promise<Response>((resolve) => {
				waiting.push(resolve);
			});
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		act(() => open()[0]?.emit("element:created"));
		await settle();

		// The first read is still waiting; the newest answer is what must remain.
		waiting[0]?.(listResponse([liveNode({ id: "stale" })]));
		await settle();
		waiting[1]?.(listResponse([liveNode({ id: "fresh" })]));
		await settle();

		expect([...result.current.byNodeId.keys()]).toEqual(["fresh"]);
	});

	it("keeps the same list, and wakes nobody, when the answer has not changed", async () => {
		const same = [liveNode({ id: "n1" })];
		answers = () => listResponse(same);
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		const before = result.current;

		act(() => open()[0]?.emit("element:updated"));
		await settle();

		expect(requests).toHaveLength(2);
		expect(result.current).toBe(before);
	});
});

describe("the case's live evidence nodes: a read that fails", () => {
	it.each([
		["the request cannot be made", () => Promise.reject(new Error("offline"))],
		["the server answers with an error", () => listResponse([], 500)],
		["the answer is not a list", () => new Response('{"nodes": 1}')],
		["the answer is not JSON", () => new Response("<html>")],
	])("finishes with no live nodes when %s", async (_name, answer) => {
		answers = answer;
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();

		expect(result.current.loaded).toBe(true);
		expect(result.current.byNodeId.size).toBe(0);
		expect(result.current.byClaimId.size).toBe(0);
	});

	it("reads again after a failure when the next event arrives", async () => {
		answers = () => listResponse([], 503);
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(result.current.byNodeId.size).toBe(0);

		answers = () => listResponse([liveNode({ id: "n1" })]);
		act(() => open()[0]?.emit("tea.health/state-changed"));
		await settle();

		expect(result.current.byNodeId.has("n1")).toBe(true);
	});

	it("leaves no node drawn as live when a later read fails", async () => {
		answers = () => listResponse([liveNode({ id: "n1" })]);
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(result.current.byNodeId.has("n1")).toBe(true);

		answers = () => listResponse([], 500);
		act(() => open()[0]?.emit("element:deleted"));
		await settle();

		expect(result.current.byNodeId.size).toBe(0);
	});
});

describe("the case's live evidence nodes: when nobody is listening", () => {
	it("closes the event listener when the last subscriber leaves, and not before", async () => {
		const first = renderHook(() => useLiveEvidenceNodes("case-1", true));
		const second = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(open()).toHaveLength(1);

		first.unmount();
		await settle();
		expect(open()).toHaveLength(1);
		act(() => open()[0]?.emit("element:moved"));
		await settle();
		expect(requests).toHaveLength(2);

		second.unmount();
		await settle();
		expect(open()).toHaveLength(0);
	});

	it("makes no request for an event that arrives after the last subscriber left", async () => {
		const { unmount } = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		const source = FakeSource.all[0];
		unmount();
		await settle();

		act(() => source?.emit("element:moved"));
		await settle();

		expect(requests).toHaveLength(1);
	});

	it("reads afresh when a subscriber comes back after all had left", async () => {
		const first = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		first.unmount();
		await settle();

		const again = renderHook(() => useLiveEvidenceNodes("case-1", true));
		expect(again.result.current.loaded).toBe(false);
		await settle();

		expect(requests).toHaveLength(2);
		expect(open()).toHaveLength(1);
	});

	it("drops a read that finishes after the last subscriber left", async () => {
		const waiting: ((response: Response) => void)[] = [];
		answers = () =>
			new Promise<Response>((resolve) => {
				waiting.push(resolve);
			});
		const first = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		first.unmount();
		await settle();

		const again = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		waiting[0]?.(listResponse([liveNode({ id: "from-the-closed-store" })]));
		await settle();
		expect(again.result.current.byNodeId.has("from-the-closed-store")).toBe(
			false
		);

		waiting[1]?.(listResponse([liveNode({ id: "current" })]));
		await settle();
		expect([...again.result.current.byNodeId.keys()]).toEqual(["current"]);
	});
});

describe("the case's live evidence nodes: a closed store's read", () => {
	it("does not ask for another read on behalf of the store that was closed", async () => {
		const waiting: ((response: Response) => void)[] = [];
		answers = () =>
			new Promise<Response>((resolve) => {
				waiting.push(resolve);
			});
		const first = renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		act(() => open()[0]?.emit("element:moved"));
		first.unmount();
		await settle();
		renderHook(() => useLiveEvidenceNodes("case-1", true));
		await settle();
		expect(requests).toHaveLength(2);

		waiting[0]?.(listResponse([liveNode({ id: "from-the-closed-store" })]));
		await settle();
		waiting[1]?.(listResponse([liveNode({ id: "current" })]));
		await settle();

		expect(requests).toHaveLength(2);
	});
});

describe("the case's live evidence nodes: no request when there is nothing to ask for", () => {
	it("asks for nothing, and opens no listener, when the plugin is off", async () => {
		const { result } = renderHook(() => useLiveEvidenceNodes("case-1", false));
		await settle();

		expect(requests).toHaveLength(0);
		expect(FakeSource.all).toHaveLength(0);
		expect(result.current.loaded).toBe(false);
		expect(result.current.byNodeId.size).toBe(0);
	});

	it("asks for nothing when there is no case id", async () => {
		renderHook(() => useLiveEvidenceNodes("", true));
		await settle();

		expect(requests).toHaveLength(0);
		expect(FakeSource.all).toHaveLength(0);
	});

	it("moves to the new case's list when the canvas shows another case, and leaves the old case's listener", async () => {
		answers = (url) =>
			listResponse([
				liveNode({ id: url.includes("case-2") ? "of-case-2" : "of-case-1" }),
			]);
		const { result, rerender } = renderHook(
			({ caseId }) => useLiveEvidenceNodes(caseId, true),
			{ initialProps: { caseId: "case-1" } }
		);
		await settle();
		expect([...result.current.byNodeId.keys()]).toEqual(["of-case-1"]);

		rerender({ caseId: "case-2" });
		await settle();

		expect([...result.current.byNodeId.keys()]).toEqual(["of-case-2"]);
		expect(urls()).toEqual([
			"/api/cases/case-1/health/evidence-nodes",
			"/api/cases/case-2/health/evidence-nodes",
		]);
		expect(open().map((source) => source.url)).toEqual([
			"/api/cases/case-2/events",
		]);
	});

	it("starts when the plugin is turned on and stops when it is turned off", async () => {
		const { rerender } = renderHook(
			({ enabled }) => useLiveEvidenceNodes("case-1", enabled),
			{ initialProps: { enabled: false } }
		);
		await settle();
		expect(requests).toHaveLength(0);

		rerender({ enabled: true });
		await settle();
		expect(requests).toHaveLength(1);
		expect(open()).toHaveLength(1);

		rerender({ enabled: false });
		await settle();
		expect(open()).toHaveLength(0);
	});
});
