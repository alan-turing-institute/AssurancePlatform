import type { SSEEvent } from "@/hooks/use-case-events";
import {
	CASE_RELOAD_EVENT_TYPES,
	subscribeToCaseEvents,
} from "@/hooks/use-case-events";
import type { HealthLiveEvidenceNode } from "./health-types";

/**
 * The live evidence nodes of each open case, kept once per case and shared by
 * every node, edge and badge that asks. The list is one request per case, not
 * one per node, and it is read again after every event that makes the canvas
 * reload the case (element, case, comment and permission events) and after
 * every health status change, so moving, trashing or restoring a node changes
 * its look at once. A node or edge that is not in the list asks for nothing:
 * the answer for it comes from what is already held.
 *
 * A case's store exists while something is subscribed to it. The last
 * subscriber to leave closes the case's event listener and drops what was read.
 */

const HEALTH_STATE_EVENT_TYPE = "tea.health/state-changed";

/** Whether the event can change which nodes are live or what their claims' statuses are. */
function changesLiveNodes(event: SSEEvent): boolean {
	return (
		event.type === HEALTH_STATE_EVENT_TYPE ||
		CASE_RELOAD_EVENT_TYPES.includes(event.type)
	);
}

/** The live nodes of a case, looked up by the node's id and by the claim's. */
export interface LiveNodeIndex {
	byClaimId: ReadonlyMap<string, HealthLiveEvidenceNode>;
	byNodeId: ReadonlyMap<string, HealthLiveEvidenceNode>;
	/** True once a read has finished, whatever it found. Before that, "no live nodes" only means none are known yet. */
	loaded: boolean;
}

export const NO_LIVE_NODES: LiveNodeIndex = {
	byNodeId: new Map(),
	byClaimId: new Map(),
	loaded: false,
};

const NONE_FOUND: LiveNodeIndex = { ...NO_LIVE_NODES, loaded: true };

function indexOf(nodes: HealthLiveEvidenceNode[]): LiveNodeIndex {
	if (nodes.length === 0) {
		return NONE_FOUND;
	}
	return {
		byNodeId: new Map(nodes.map((node) => [node.id, node])),
		byClaimId: new Map(nodes.map((node) => [node.claim_id, node])),
		loaded: true,
	};
}

/** How long after a failed read the one retry waits. */
const RETRY_DELAY_MS = 5000;

interface CaseStore {
	/** A read was asked for while another was running. */
	again: boolean;
	index: LiveNodeIndex;
	/** The text of the last answer, so an unchanged answer keeps the same index and wakes nobody. */
	lastBody: string;
	listeners: Set<() => void>;
	reading: boolean;
	/** The timer of a retry that is waiting to run, if there is one. */
	retryTimer: ReturnType<typeof setTimeout> | null;
	stopListening: () => void;
}

const stores = new Map<string, CaseStore>();

/**
 * What one read of the list came to: the answer, nothing live for this viewer
 * (the plugin is off, the case is gone or the viewer cannot see it), or a
 * failure that says nothing about what is live (no network, a server error,
 * an answer that is not a list).
 */
type ReadOutcome =
	| { kind: "answer"; body: string; nodes: HealthLiveEvidenceNode[] }
	| { kind: "failed" }
	| { kind: "none" };

function parseNodes(body: string): HealthLiveEvidenceNode[] | null {
	try {
		const parsed: unknown = JSON.parse(body);
		return Array.isArray(parsed) ? (parsed as HealthLiveEvidenceNode[]) : null;
	} catch {
		return null;
	}
}

async function fetchLiveNodes(caseId: string): Promise<ReadOutcome> {
	try {
		const response = await fetch(`/api/cases/${caseId}/health/evidence-nodes`);
		if (response.status === 403 || response.status === 404) {
			return { kind: "none" };
		}
		if (!response.ok) {
			return { kind: "failed" };
		}
		const body = await response.text();
		const nodes = parseNodes(body);
		return nodes ? { kind: "answer", body, nodes } : { kind: "failed" };
	} catch {
		return { kind: "failed" };
	}
}

function cancelRetry(store: CaseStore): void {
	if (store.retryTimer !== null) {
		clearTimeout(store.retryTimer);
		store.retryTimer = null;
	}
}

function notify(store: CaseStore): void {
	for (const listener of [...store.listeners]) {
		listener();
	}
}

/** Shows `nodes` as the list, waking the listeners only when it differs from what is held. */
function showNodes(
	store: CaseStore,
	body: string,
	nodes: HealthLiveEvidenceNode[]
): void {
	if (body === store.lastBody) {
		return;
	}
	store.lastBody = body;
	store.index = indexOf(nodes);
	notify(store);
}

/**
 * Handles a failed read: the list read last stays as it is, so one failed
 * request does not turn every live node plain. Until a read has succeeded
 * there is nothing to keep, so the list is marked as read with no live nodes
 * (a claim's dot would otherwise wait for it for good). One retry is
 * scheduled; a retry that fails waits for the next event.
 */
function keepAfterFailure(
	store: CaseStore,
	caseId: string,
	isRetry: boolean
): void {
	if (store.index === NO_LIVE_NODES) {
		store.index = NONE_FOUND;
		notify(store);
	}
	if (isRetry || store.retryTimer !== null) {
		return;
	}
	store.retryTimer = setTimeout(() => {
		store.retryTimer = null;
		readNodes(caseId, true);
	}, RETRY_DELAY_MS);
}

/**
 * Reads the case's live nodes now; a read asked for while one is running runs
 * again when it ends, so the last answer is always from after the last ask. A
 * viewer who cannot have live nodes (a 403 or a 404) is shown none; any other
 * failure keeps what was read last and tries once more after a delay.
 */
async function readNodes(caseId: string, isRetry = false): Promise<void> {
	const store = stores.get(caseId);
	if (!store) {
		return;
	}
	if (store.reading) {
		store.again = true;
		return;
	}
	store.reading = true;
	const outcome = await fetchLiveNodes(caseId);
	store.reading = false;
	if (stores.get(caseId) !== store) {
		return;
	}
	if (outcome.kind === "failed") {
		keepAfterFailure(store, caseId, isRetry);
	} else {
		cancelRetry(store);
		if (outcome.kind === "none") {
			showNodes(store, "[]", []);
		} else {
			showNodes(store, outcome.body, outcome.nodes);
		}
	}
	if (store.again) {
		store.again = false;
		await readNodes(caseId);
	}
}

function openStore(caseId: string): CaseStore {
	const store: CaseStore = {
		again: false,
		index: NO_LIVE_NODES,
		lastBody: "",
		listeners: new Set(),
		reading: false,
		retryTimer: null,
		stopListening: () => undefined,
	};
	stores.set(caseId, store);
	store.stopListening = subscribeToCaseEvents(caseId, (event: SSEEvent) => {
		if (changesLiveNodes(event)) {
			readNodes(caseId);
		}
	});
	readNodes(caseId);
	return store;
}

/** The case's live nodes as last read; none until the first read finishes. */
export function readLiveNodes(caseId: string): LiveNodeIndex {
	return stores.get(caseId)?.index ?? NO_LIVE_NODES;
}

/**
 * Starts holding the case's live nodes (reading them if this is the first
 * subscriber) and calls `listener` whenever they change. Returns the function
 * that stops.
 */
export function subscribeToLiveNodes(
	caseId: string,
	listener: () => void
): () => void {
	const store = stores.get(caseId) ?? openStore(caseId);
	store.listeners.add(listener);
	return () => {
		store.listeners.delete(listener);
		if (store.listeners.size === 0 && stores.get(caseId) === store) {
			store.stopListening();
			cancelRetry(store);
			stores.delete(caseId);
		}
	};
}

/** Test-only. Drops every case's store and stops its listener. */
export function resetLiveNodesForTests(): void {
	for (const store of stores.values()) {
		store.stopListening();
		cancelRetry(store);
	}
	stores.clear();
}
