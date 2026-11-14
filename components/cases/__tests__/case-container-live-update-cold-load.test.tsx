import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCaseEventStreams } from "@/hooks/use-case-events";
import { mockReplace } from "@/src/__tests__/mocks/next-navigation-mocks";
import CaseContainer from "../case-container";

vi.mock("@/actions/unsupported-markers", () => ({
	fetchShowUnsupportedMarkers: vi.fn().mockResolvedValue(true),
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

/** An EventSource the test can refuse the way a browser does after a non-200 answer. */
class Source {
	static all: Source[] = [];
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readyState = 0;
	readonly url: string;

	constructor(url: string) {
		this.url = url;
		Source.all.push(this);
	}

	addEventListener() {
		// No events are delivered in these tests.
	}

	close() {
		this.readyState = 2;
	}

	refuse() {
		this.readyState = 2;
		this.onerror?.();
	}
}

let eventsStatus = 404;
let caseLoadStatus = 200;
const requested: string[] = [];

beforeEach(() => {
	resetCaseEventStreams();
	Source.all = [];
	requested.length = 0;
	mockReplace.mockClear();
	vi.stubGlobal("EventSource", Source);
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) => {
			requested.push(url);
			if (url.endsWith("/events")) {
				return Promise.resolve(new Response(null, { status: eventsStatus }));
			}
			if (url.endsWith("/sandbox")) {
				return Promise.resolve(Response.json([]));
			}
			return Promise.resolve(
				caseLoadStatus === 200
					? Response.json({
							id: "c1",
							name: "Case",
							goals: [],
							permissions: "manage",
						})
					: Response.json({ error: "Not found" }, { status: caseLoadStatus })
			);
		})
	);
});

afterEach(() => {
	resetCaseEventStreams();
	vi.unstubAllGlobals();
});

const settle = () => act(async () => undefined);

describe("opening a case page cold, with the real live-update hook", () => {
	it("shows the Case not found card, not the Access removed message, to someone who never had access", async () => {
		caseLoadStatus = 404;
		eventsStatus = 404;

		render(<CaseContainer caseId="c1" />);
		await screen.findByRole("heading", { name: "Case not found" });
		const source = Source.all[0];
		if (source) {
			act(() => source.refuse());
		}
		await settle();
		await settle();

		expect(
			screen.queryByRole("heading", { name: "Access removed" })
		).toBeNull();
		expect(
			screen.getByRole("heading", { name: "Case not found" })
		).toBeTruthy();
	});

	it("shows the Access removed message when access goes after the case was loaded and the closing event was missed", async () => {
		caseLoadStatus = 200;
		eventsStatus = 404;

		render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");
		const source = Source.all[0];
		expect(source).toBeTruthy();
		act(() => source?.refuse());
		await settle();
		await settle();

		expect(
			await screen.findByRole("heading", { name: "Access removed" })
		).toBeTruthy();
		expect(requested.filter((url) => url.endsWith("/events"))).toHaveLength(1);
	});

	it("sends the browser to the sign-in page when the events request is answered 401 after the case loaded", async () => {
		caseLoadStatus = 200;
		eventsStatus = 401;

		render(<CaseContainer caseId="c1" />);
		await screen.findByTestId("flow");
		act(() => Source.all[0]?.refuse());
		await settle();
		await settle();

		expect(mockReplace).toHaveBeenCalledWith("/login");
	});
});
