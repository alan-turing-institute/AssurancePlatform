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

const REFRESH_EVENT_TYPES: ReadonlySet<string> = new Set([
	...CASE_RELOAD_EVENT_TYPES,
	HEALTH_STATE_EVENT_TYPE,
]);

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

interface CaseStore {
	/** A read was asked for while another was running. */
	again: boolean;
	index: LiveNodeIndex;
	/** The text of the last answer, so an unchanged answer keeps the same index and wakes nobody. */
	lastBody: string;
	listeners: Set<() => void>;
	reading: boolean;
	stopListening: () => void;
}

const stores = new Map<string, CaseStore>();

async function fetchLiveNodes(caseId: string): Promise<string | null> {
	try {
		const response = await fetch(`/api/cases/${caseId}/health/evidence-nodes`);
		return response.ok ? await response.text() : null;
	} catch {
		return null;
	}
}

function parseNodes(body: string): HealthLiveEvidenceNode[] | null {
	try {
		const parsed: unknown = JSON.parse(body);
		return Array.isArray(parsed) ? (parsed as HealthLiveEvidenceNode[]) : null;
	} catch {
		return null;
	}
}

/**
 * Reads the case's live nodes now; a read asked for while one is running runs
 * again when it ends, so the last answer is always from after the last ask. A
 * failed read leaves no live nodes, so nothing is drawn that was not confirmed.
 */
async function readNodes(caseId: string): Promise<void> {
	const store = stores.get(caseId);
	if (!store) {
		return;
	}
	if (store.reading) {
		store.again = true;
		return;
	}
	store.reading = true;
	const body = (await fetchLiveNodes(caseId)) ?? "[]";
	store.reading = false;
	if (stores.get(caseId) !== store) {
		return;
	}
	if (body !== store.lastBody) {
		store.lastBody = body;
		store.index = indexOf(parseNodes(body) ?? []);
		for (const listener of [...store.listeners]) {
			listener();
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
		stopListening: () => undefined,
	};
	stores.set(caseId, store);
	store.stopListening = subscribeToCaseEvents(caseId, (event: SSEEvent) => {
		if (REFRESH_EVENT_TYPES.has(event.type)) {
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
			stores.delete(caseId);
		}
	};
}

/** Test-only. Drops every case's store and stops its listener. */
export function resetLiveNodesForTests(): void {
	for (const store of stores.values()) {
		store.stopListening();
	}
	stores.clear();
}
