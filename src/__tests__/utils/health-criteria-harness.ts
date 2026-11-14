import { act } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { vi } from "vitest";
import { resetCaseEventStreams } from "@/hooks/use-case-events";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
	HealthEvidenceLogItem,
	HealthStatus,
} from "@/lib/plugins/health/health-types";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";

const CASE_ID = "case-1";
const CLAIM_ID = "claim-42";

export const CRITERIA_URL = `/api/elements/${CLAIM_ID}/health/criteria`;
const RETIREMENT_URL = `${CRITERIA_URL}/retirement`;
const CHECKS_URL = `/api/cases/${CASE_ID}/health/checks`;
const STATUS_URL = `/api/elements/${CLAIM_ID}/health`;
const EVIDENCE_URL = `/api/machine/health/elements/${CLAIM_ID}/evidence`;

export const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: CASE_ID,
	elementId: CLAIM_ID,
	elementType: "property",
	canEdit: true,
};

type Answer = Response | Promise<Response>;

export interface CriteriaServer {
	/** How many times the case's check lists were read. */
	checkListReads: number;
	/** Replaces the answer to a retirement. */
	retireAnswer: ((body: unknown) => Answer) | null;
	/** Every body sent to the retirement route. */
	retirements: unknown[];
	/** Replaces the answer to a save; the stored view answers by default. */
	saveAnswer: ((body: Record<string, unknown>) => Answer) | null;
	/** Every body sent with PUT to the criteria route. */
	saves: Record<string, unknown>[];
	/** What GET answers. */
	view: HealthCriteriaResponse;
}

interface ServeOptions {
	evidence?: HealthEvidenceLogItem[];
	lists: HealthCheckListOffer[];
	status?: HealthStatus | null;
	view: HealthCriteriaResponse;
}

/** Answers every route the Evidence tab calls, recording what is sent. */
export function serveHealth({
	evidence = [],
	lists,
	status = null,
	view,
}: ServeOptions): CriteriaServer {
	const state: CriteriaServer = {
		view,
		checkListReads: 0,
		saves: [],
		retirements: [],
		saveAnswer: null,
		retireAnswer: null,
	};
	server.use(
		http.get(CRITERIA_URL, () => HttpResponse.json(state.view)),
		http.get(CHECKS_URL, () => {
			state.checkListReads += 1;
			return HttpResponse.json(lists);
		}),
		http.get(STATUS_URL, () => HttpResponse.json({ status })),
		http.get(EVIDENCE_URL, () =>
			HttpResponse.json({ evidence, next_before: null })
		),
		http.put(CRITERIA_URL, async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			state.saves.push(body);
			return state.saveAnswer
				? await state.saveAnswer(body)
				: HttpResponse.json(state.view);
		}),
		http.post(RETIREMENT_URL, async ({ request }) => {
			const body = await request.json();
			state.retirements.push(body);
			return state.retireAnswer
				? await state.retireAnswer(body)
				: HttpResponse.json(state.view);
		})
	);
	return state;
}

/** A stand-in for the browser's event stream that records each connection and lets a test push events. */
interface FakeSource {
	addEventListener: (
		type: string,
		listener: (event: { data: string }) => void
	) => void;
	close: () => void;
	emit: (type: string, payload: Record<string, unknown>) => void;
	onerror: (() => void) | null;
	onopen: (() => void) | null;
	readyState: number;
	readonly url: string;
}

const CLOSED = 2;

function connect(url: string): FakeSource {
	const listeners = new Map<string, ((event: { data: string }) => void)[]>();
	const source: FakeSource = {
		readyState: 0,
		onerror: null,
		onopen: null,
		url,
		addEventListener(type, listener) {
			listeners.set(type, [...(listeners.get(type) ?? []), listener]);
		},
		close() {
			source.readyState = CLOSED;
		},
		emit(type, payload) {
			for (const listener of listeners.get(type) ?? []) {
				listener({ data: JSON.stringify({ type, payload }) });
			}
		},
	};
	FakeEventSource.instances.push(source);
	return source;
}

/** A stand-in for the browser's event stream that records each connection and lets a test push events. */
export const FakeEventSource = Object.assign(
	function FakeEventSourceConstructor(url: string) {
		return connect(url);
	},
	{ CONNECTING: 0, OPEN: 1, CLOSED, instances: [] as FakeSource[] }
);

export function installFakeEventSource() {
	resetCaseEventStreams();
	FakeEventSource.instances = [];
	vi.stubGlobal("EventSource", FakeEventSource);
}

/** The connections that are still open. */
export function openConnections(): FakeSource[] {
	return FakeEventSource.instances.filter(
		(source) => source.readyState !== CLOSED
	);
}

/** Tells every open connection that the claim's health state changed. */
export function emitStateChanged() {
	act(() => {
		for (const source of openConnections()) {
			source.emit("tea.health/state-changed", { claimId: CLAIM_ID });
		}
	});
}
