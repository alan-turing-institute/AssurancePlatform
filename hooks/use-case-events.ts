"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type {
	SSEEvent,
	SSEEventType,
} from "@/lib/services/sse-connection-manager";

const log = logger.child({ component: "use-case-events" });

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface UseCaseEventsOptions {
	/** Case ID to subscribe to */
	caseId: string;
	/** Whether the hook is enabled */
	enabled?: boolean;
	/** Maximum number of reconnection attempts */
	maxReconnectAttempts?: number;
	/** Event handlers for specific event types */
	onEvent?: (event: SSEEvent) => void;
	/** Handler for connection status changes */
	onStatusChange?: (status: ConnectionStatus) => void;
	/** Base delay between reconnection attempts (ms) */
	reconnectDelay?: number;
}

interface UseCaseEventsReturn {
	/** Manually disconnect */
	disconnect: () => void;
	/** Whether currently connected */
	isConnected: boolean;
	/** Last received event */
	lastEvent: SSEEvent | null;
	/** Manually reconnect */
	reconnect: () => void;
	/** Current connection status */
	status: ConnectionStatus;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_DELAY = 1000;

/**
 * Every event type this hook registers an `EventSource.addEventListener` for
 * — exported (rather than kept function-local) so a test can assert
 * registration coverage against the SAME list the hook actually uses,
 * instead of a hand-copied second list that could silently drift.
 * Plugin-emitted events are namespaced (ADR 0002 v2 §2.5) but still flow
 * through this generic case-event stream — `EventSource` only fires for
 * event names it has a registered listener for, so a namespaced type omitted
 * here is silently dropped even though the connection manager broadcasts it.
 * This hook stays plugin-neutral (it doesn't know what
 * "tea.health/state-changed" MEANS, only that the closed `SSEEventType`
 * union names it) — see the health plugin's UI module (`lib/plugins/
 * health/`) for the consumer.
 */
export const CASE_EVENT_TYPES: SSEEventType[] = [
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
];

interface Subscriber {
	onEvent: (event: SSEEvent) => void;
	onStatus: (status: ConnectionStatus) => void;
}

interface CaseStream {
	attempts: number;
	closeTimer: ReturnType<typeof setTimeout> | null;
	maxReconnectAttempts: number;
	reconnectDelay: number;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	source: EventSource | null;
	status: ConnectionStatus;
	subscribers: Set<Subscriber>;
}

/**
 * One stream per case, shared by every `useCaseEvents` caller for that case.
 * Browsers allow about six HTTP/1.1 connections per host, and each open
 * `EventSource` holds one for as long as it lives, so a stream per component
 * starves ordinary requests.
 */
const streams = new Map<string, CaseStream>();

/** Closes every stream and forgets it. Tests call this between cases so a stream left by one test is not reused by the next. */
export function resetCaseEventStreams() {
	for (const stream of streams.values()) {
		if (stream.closeTimer) {
			clearTimeout(stream.closeTimer);
		}
		closeStream(stream);
	}
	streams.clear();
}

function setStreamStatus(stream: CaseStream, status: ConnectionStatus) {
	stream.status = status;
	for (const subscriber of [...stream.subscribers]) {
		subscriber.onStatus(status);
	}
}

function connectStream(caseId: string, stream: CaseStream) {
	if (stream.source) {
		return;
	}
	setStreamStatus(stream, "connecting");

	const source = new EventSource(`/api/cases/${caseId}/events`);
	stream.source = source;

	source.onopen = () => {
		stream.attempts = 0;
		setStreamStatus(stream, "connected");
	};

	source.onerror = () => {
		source.close();
		stream.source = null;

		// Reconnect with exponential backoff, once for the whole case.
		if (stream.attempts < stream.maxReconnectAttempts) {
			setStreamStatus(stream, "connecting");
			const delay = stream.reconnectDelay * 2 ** stream.attempts;
			stream.attempts += 1;
			stream.reconnectTimer = setTimeout(() => {
				stream.reconnectTimer = null;
				connectStream(caseId, stream);
			}, delay);
		} else {
			setStreamStatus(stream, "error");
		}
	};

	source.addEventListener("connected", (e) => {
		try {
			JSON.parse(e.data);
		} catch {
			// Ignore parsing errors for connection event
		}
	});

	// Set up event type handlers — see `CASE_EVENT_TYPES`'s doc comment.
	for (const eventType of CASE_EVENT_TYPES) {
		source.addEventListener(eventType, (e) => {
			try {
				const event = JSON.parse(e.data) as SSEEvent;
				for (const subscriber of [...stream.subscribers]) {
					subscriber.onEvent(event);
				}
			} catch (error) {
				log.error("Failed to parse SSE event", { error });
			}
		});
	}
}

function closeStream(stream: CaseStream) {
	if (stream.reconnectTimer) {
		clearTimeout(stream.reconnectTimer);
		stream.reconnectTimer = null;
	}
	if (stream.source) {
		stream.source.close();
		stream.source = null;
	}
}

function disconnectStream(stream: CaseStream) {
	closeStream(stream);
	setStreamStatus(stream, "disconnected");
}

function reconnectStream(caseId: string, stream: CaseStream) {
	disconnectStream(stream);
	stream.attempts = 0;
	connectStream(caseId, stream);
}

/**
 * Adds a subscriber to the case's stream, opening it if this is the first.
 * The reconnect settings are those of the first subscriber; later
 * subscribers' values are ignored while the stream is open. Returns the
 * unsubscribe function, which closes the stream on the next tick once the
 * last subscriber has left (so a remount in the same tick keeps it open).
 */
function subscribe(
	caseId: string,
	subscriber: Subscriber,
	maxReconnectAttempts: number,
	reconnectDelay: number
): () => void {
	let stream = streams.get(caseId);
	if (!stream) {
		stream = {
			attempts: 0,
			closeTimer: null,
			maxReconnectAttempts,
			reconnectDelay,
			reconnectTimer: null,
			source: null,
			status: "disconnected",
			subscribers: new Set(),
		};
		streams.set(caseId, stream);
	}
	const shared = stream;
	if (shared.closeTimer) {
		clearTimeout(shared.closeTimer);
		shared.closeTimer = null;
	}
	shared.subscribers.add(subscriber);
	subscriber.onStatus(shared.status);
	if (!(shared.source || shared.reconnectTimer)) {
		shared.attempts = 0;
		connectStream(caseId, shared);
	}

	return () => {
		shared.subscribers.delete(subscriber);
		if (shared.subscribers.size > 0 || shared.closeTimer) {
			return;
		}
		shared.closeTimer = setTimeout(() => {
			shared.closeTimer = null;
			if (shared.subscribers.size === 0) {
				closeStream(shared);
				if (streams.get(caseId) === shared) {
					streams.delete(caseId);
				}
			}
		}, 0);
	};
}

/**
 * React hook for subscribing to real-time case events via SSE. All callers
 * for the same case share one `EventSource`; `disconnect` and `reconnect`
 * act on that shared stream, so one caller's `reconnect` reconnects everyone.
 * With `enabled: false` the hook is not subscribed and holds no stream open.
 *
 * @example
 * ```tsx
 * const { status, isConnected, lastEvent } = useCaseEvents({
 *   caseId: "abc123",
 *   onEvent: (event) => {
 *     if (event.type === "comment:created") {
 *       refreshComments();
 *     }
 *   },
 * });
 * ```
 */
export function useCaseEvents({
	caseId,
	enabled = true,
	onEvent,
	onStatusChange,
	maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
	reconnectDelay = DEFAULT_RECONNECT_DELAY,
}: UseCaseEventsOptions): UseCaseEventsReturn {
	const [status, setStatus] = useState<ConnectionStatus>("disconnected");
	const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

	// Stable callback refs
	const onEventRef = useRef(onEvent);
	const onStatusChangeRef = useRef(onStatusChange);
	const reconnectSettingsRef = useRef({ maxReconnectAttempts, reconnectDelay });

	useEffect(() => {
		onEventRef.current = onEvent;
	}, [onEvent]);

	useEffect(() => {
		onStatusChangeRef.current = onStatusChange;
	}, [onStatusChange]);

	useEffect(() => {
		reconnectSettingsRef.current = { maxReconnectAttempts, reconnectDelay };
	}, [maxReconnectAttempts, reconnectDelay]);

	const disconnect = useCallback(() => {
		const stream = streams.get(caseId);
		if (stream) {
			disconnectStream(stream);
		}
	}, [caseId]);

	const reconnect = useCallback(() => {
		const stream = streams.get(caseId);
		if (stream) {
			reconnectStream(caseId, stream);
		}
	}, [caseId]);

	useEffect(() => {
		if (!(enabled && caseId)) {
			setStatus("disconnected");
			return;
		}
		const settings = reconnectSettingsRef.current;
		return subscribe(
			caseId,
			{
				onEvent: (event) => {
					setLastEvent(event);
					onEventRef.current?.(event);
				},
				onStatus: (next) => {
					setStatus(next);
					onStatusChangeRef.current?.(next);
				},
			},
			settings.maxReconnectAttempts,
			settings.reconnectDelay
		);
	}, [enabled, caseId]);

	return {
		status,
		isConnected: status === "connected",
		lastEvent,
		reconnect,
		disconnect,
	};
}

export type { ConnectionStatus };
export type {
	SSEEvent,
	SSEEventType,
} from "@/lib/services/sse-connection-manager";
