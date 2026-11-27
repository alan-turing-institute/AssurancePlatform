import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import type { HealthEvidencePage } from "../health-types";
import { useHealthEvidence } from "../use-health-evidence";
import { item, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/hooks/use-case-events")>()),
	useCaseEvents: vi.fn(),
}));

const CLAIM: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};
const EVIDENCE_URL = "/api/machine/health/elements/claim-42/evidence";
const STATUS_URL = "/api/elements/claim-42/health";
const STATUS = status();

function row(id: string) {
	return item({ id });
}

function page(
	ids: string[],
	nextBefore: number | null = null
): HealthEvidencePage {
	return { evidence: ids.map(row), next_before: nextBefore };
}

const ids = (rows: { id: string }[] | null) => rows?.map((r) => r.id);

let requested: URLSearchParams[];
let pages: Map<string | null, HealthEvidencePage | number>;

function respond(before: string | null) {
	const answer = pages.get(before);
	if (typeof answer === "number") {
		return HttpResponse.json({ error: "no" }, { status: answer });
	}
	return HttpResponse.json(answer ?? page([]));
}

beforeEach(() => {
	requested = [];
	pages = new Map([[null, page(["a", "b"])]]);
	server.use(
		http.get(EVIDENCE_URL, ({ request }) => {
			const query = new URL(request.url).searchParams;
			requested.push(query);
			return respond(query.get("before"));
		}),
		http.get(STATUS_URL, () => HttpResponse.json({ status: STATUS }))
	);
});

async function ready() {
	const hook = renderHook(() => useHealthEvidence(CLAIM));
	await waitFor(() => expect(hook.result.current.status).toBe("ready"));
	return hook;
}

describe("a claim's evidence log, newest page", () => {
	it("is the newest 50, with the claim's status, and no older ones when there are none", async () => {
		const { result } = await ready();

		expect(ids(result.current.evidence)).toEqual(["a", "b"]);
		expect(result.current.healthStatus).toEqual(STATUS);
		expect(result.current.hasMore).toBe(false);
		expect(result.current.olderFailed).toBe(false);
		expect(result.current.loadingOlder).toBe(false);
		expect(requested[0]?.get("limit")).toBe("50");
		expect(requested[0]?.has("before")).toBe(false);
	});

	it("is loading, with no log, until it is read", () => {
		const { result } = renderHook(() => useHealthEvidence(CLAIM));

		expect(result.current.status).toBe("loading");
		expect(result.current.evidence).toBeNull();
	});

	it("still shows the log, without a header, when the status cannot be read", async () => {
		server.use(
			http.get(STATUS_URL, () => HttpResponse.json({}, { status: 500 }))
		);

		const { result } = await ready();

		expect(ids(result.current.evidence)).toEqual(["a", "b"]);
		expect(result.current.healthStatus).toBeNull();
	});

	it("is in the error state, with no log, when the log cannot be read", async () => {
		pages.set(null, 500);

		const { result } = renderHook(() => useHealthEvidence(CLAIM));

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.evidence).toBeNull();
		expect(result.current.hasMore).toBe(false);
	});

	it("is an empty, ready log, with no request, for an element that is not a claim", async () => {
		const { result } = renderHook(() =>
			useHealthEvidence({ ...CLAIM, elementType: "evidence" })
		);

		expect(result.current.status).toBe("ready");
		expect(result.current.evidence).toStrictEqual([]);
		expect(result.current.healthStatus).toBeNull();
		expect(result.current.hasMore).toBe(false);
		await act(() => result.current.loadOlder());
		expect(requested).toHaveLength(0);
	});
});

describe("loading older evidence", () => {
	it("appends each older page behind the ones shown and follows the cursor", async () => {
		pages.set(null, page(["a", "b"], 10));
		pages.set("10", page(["c"], 5));
		pages.set("5", page(["d"]));
		const { result } = await ready();
		expect(result.current.hasMore).toBe(true);

		await act(() => result.current.loadOlder());
		expect(ids(result.current.evidence)).toEqual(["a", "b", "c"]);
		expect(result.current.hasMore).toBe(true);

		await act(() => result.current.loadOlder());
		expect(ids(result.current.evidence)).toEqual(["a", "b", "c", "d"]);
		expect(result.current.hasMore).toBe(false);
		expect(requested.map((query) => query.get("before"))).toEqual([
			null,
			"10",
			"5",
		]);
		expect(requested[1]?.get("limit")).toBe("50");
	});

	it("asks for nothing when there is nothing older", async () => {
		const { result } = await ready();

		await act(() => result.current.loadOlder());

		expect(requested).toHaveLength(1);
		expect(result.current.loadingOlder).toBe(false);
		expect(result.current.olderFailed).toBe(false);
	});

	it("shows that it is loading until the older page arrives", async () => {
		pages.set(null, page(["a"], 10));
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		server.use(
			http.get(EVIDENCE_URL, async ({ request }) => {
				if (new URL(request.url).searchParams.has("before")) {
					await gate;
					return HttpResponse.json(page(["c"]));
				}
				return HttpResponse.json(page(["a"], 10));
			})
		);
		const { result } = await ready();

		let done: Promise<void> = Promise.resolve();
		act(() => {
			done = result.current.loadOlder();
		});
		await waitFor(() => expect(result.current.loadingOlder).toBe(true));
		release();
		await act(() => done);

		expect(result.current.loadingOlder).toBe(false);
		expect(ids(result.current.evidence)).toEqual(["a", "c"]);
	});

	it("reports a failed older page, keeps what is shown, and clears the report on the next try", async () => {
		pages.set(null, page(["a"], 10));
		pages.set("10", 500);
		const { result } = await ready();

		await act(() => result.current.loadOlder());
		expect(result.current.olderFailed).toBe(true);
		expect(result.current.loadingOlder).toBe(false);
		expect(ids(result.current.evidence)).toEqual(["a"]);
		expect(result.current.hasMore).toBe(true);

		pages.set("10", page(["c"]));
		await act(() => result.current.loadOlder());
		expect(result.current.olderFailed).toBe(false);
		expect(ids(result.current.evidence)).toEqual(["a", "c"]);
	});

	it("drops the older pages when the newest page is read again", async () => {
		pages.set(null, page(["a"], 10));
		pages.set("10", page(["c"]));
		const { result } = await ready();
		await act(() => result.current.loadOlder());
		expect(ids(result.current.evidence)).toEqual(["a", "c"]);
		pages.set(null, page(["z"], 7));

		await act(() => result.current.refetch());

		expect(ids(result.current.evidence)).toEqual(["z"]);
		expect(result.current.hasMore).toBe(true);
	});
});
