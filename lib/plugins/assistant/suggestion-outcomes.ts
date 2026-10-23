import { useSyncExternalStore } from "react";
import type { SuggestionOutcome } from "./suggestion";

/**
 * What the user did with each suggestion card of one chat, by tool call id.
 * The chat store holds only the SDK's own message objects, so this sits beside
 * it. The panel sends a copy with each request, so the model knows which
 * suggestions were applied and which were dismissed.
 */
interface SuggestionOutcomes {
	/** Forgets every outcome; the chat has been cleared. */
	clear(): void;
	get(toolCallId: string): SuggestionOutcome | undefined;
	record(toolCallId: string, outcome: SuggestionOutcome): void;
	/** The outcomes as a plain object, for the request body. */
	snapshot(): Record<string, SuggestionOutcome>;
	subscribe(listener: () => void): () => void;
	/** A number that changes whenever an outcome is recorded or cleared. */
	version(): number;
}

function createOutcomes(): SuggestionOutcomes {
	const outcomes = new Map<string, SuggestionOutcome>();
	const listeners = new Set<() => void>();
	let version = 0;
	const changed = () => {
		version += 1;
		for (const listener of listeners) {
			listener();
		}
	};
	return {
		clear() {
			if (outcomes.size > 0) {
				outcomes.clear();
				changed();
			}
		},
		get: (toolCallId) => outcomes.get(toolCallId),
		record(toolCallId, outcome) {
			outcomes.set(toolCallId, outcome);
			changed();
		},
		snapshot: () => Object.fromEntries(outcomes),
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		version: () => version,
	};
}

const stores = new Map<string, SuggestionOutcomes>();

/**
 * The outcomes of one user's chat on one case, held at module level beside the
 * chat so that closing the panel keeps them. Keyed like the chat, by user and
 * case.
 */
export function getCaseOutcomes(
	userId: string,
	caseId: string
): SuggestionOutcomes {
	const key = `${userId}:${caseId}`;
	let store = stores.get(key);
	if (!store) {
		store = createOutcomes();
		stores.set(key, store);
	}
	return store;
}

/** Re-renders the component when an outcome is recorded or cleared. */
export function useSuggestionOutcomes(
	outcomes: SuggestionOutcomes
): SuggestionOutcomes {
	useSyncExternalStore(outcomes.subscribe, outcomes.version, outcomes.version);
	return outcomes;
}
