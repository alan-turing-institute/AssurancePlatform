"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
	SSEEvent,
	SSEEventType,
} from "@/lib/services/sse-connection-manager";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type UseCaseEventsOptions = {
	/** Case ID to subscribe to */
	caseId: string;
	/** Whether the hook is enabled */
	enabled?: boolean;
	/** Event handlers for specific event types */
	onEvent?: (event: SSEEvent) => void;
	/** Handler for connection status changes */
	onStatusChange?: (status: ConnectionStatus) => void;
	/** Maximum number of reconnection attempts */
	maxReconnectAttempts?: number;
	/** Base delay between reconnection attempts (ms) */
	reconnectDelay?: number;
};

type UseCaseEventsReturn = {
	/** Current connection status */
	status: ConnectionStatus;
	/** Whether currently connected */
	isConnected: boolean;
	/** Last received event */
	lastEvent: SSEEvent | null;
	/** Manually reconnect */
	reconnect: () => void;
	/** Manually disconnect */
	disconnect: () => void;
};

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_DELAY = 1000;

/**
 * React hook for subscribing to real-time case events via SSE.
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

	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Stable callback refs
	const onEventRef = useRef(onEvent);
	const onStatusChangeRef = useRef(onStatusChange);

	// Update refs when callbacks change
	useEffect(() => {
		onEventRef.current = onEvent;
	}, [onEvent]);

	useEffect(() => {
		onStatusChangeRef.current = onStatusChange;
	}, [onStatusChange]);

	const updateStatus = useCallback((newStatus: ConnectionStatus) => {
		setStatus(newStatus);
		onStatusChangeRef.current?.(newStatus);
	}, []);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		updateStatus("disconnected");
	}, [updateStatus]);

	const connect = useCallback(() => {
		// Don't connect if already connected or connecting
		if (
			eventSourceRef.current?.readyState === EventSource.OPEN ||
			eventSourceRef.current?.readyState === EventSource.CONNECTING
		) {
			return;
		}

		updateStatus("connecting");

		const eventSource = new EventSource(`/api/cases/${caseId}/events`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			reconnectAttemptsRef.current = 0;
			updateStatus("connected");
		};

		eventSource.onerror = () => {
			eventSource.close();
			eventSourceRef.current = null;

			// Attempt to reconnect with exponential backoff
			if (reconnectAttemptsRef.current < maxReconnectAttempts) {
				updateStatus("connecting");
				const delay = reconnectDelay * 2 ** reconnectAttemptsRef.current;
				reconnectAttemptsRef.current += 1;

				reconnectTimeoutRef.current = setTimeout(() => {
					connect();
				}, delay);
			} else {
				updateStatus("error");
			}
		};

		// Listen for the connected event
		eventSource.addEventListener("connected", (e) => {
			try {
				const data = JSON.parse(e.data);
				console.log("[SSE] Connected:", data);
			} catch {
				// Ignore parsing errors for connection event
			}
		});

		// Set up event type handlers
		const eventTypes: SSEEventType[] = [
			"case:updated",
			"comment:created",
			"comment:updated",
			"comment:deleted",
			"element:created",
			"element:updated",
			"element:deleted",
			"element:attached",
			"element:detached",
			"permission:changed",
			"lock:acquired",
			"lock:released",
		];

		for (const eventType of eventTypes) {
			eventSource.addEventListener(eventType, (e) => {
				try {
					const event = JSON.parse(e.data) as SSEEvent;
					setLastEvent(event);
					onEventRef.current?.(event);
				} catch (error) {
					console.error("[SSE] Failed to parse event:", error);
				}
			});
		}
	}, [caseId, maxReconnectAttempts, reconnectDelay, updateStatus]);

	const reconnect = useCallback(() => {
		disconnect();
		reconnectAttemptsRef.current = 0;
		connect();
	}, [disconnect, connect]);

	// Set up connection when enabled
	useEffect(() => {
		if (enabled && caseId) {
			connect();
		} else {
			disconnect();
		}

		return () => {
			disconnect();
		};
	}, [enabled, caseId, connect, disconnect]);

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
