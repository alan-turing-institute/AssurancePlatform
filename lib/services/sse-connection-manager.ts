/**
 * SSE Connection Manager
 *
 * Manages Server-Sent Events connections for real-time updates.
 * Tracks active connections per case and broadcasts events to subscribers.
 */

export type SSEEventType =
	| "case:updated"
	| "comment:created"
	| "comment:updated"
	| "comment:deleted"
	| "element:created"
	| "element:updated"
	| "element:deleted"
	| "element:attached"
	| "element:detached"
	| "permission:changed"
	| "lock:acquired"
	| "lock:released";

export type SSEEvent = {
	type: SSEEventType;
	caseId: string;
	payload: Record<string, unknown>;
	timestamp: string;
	userId?: string;
};

type SSEConnection = {
	id: string;
	controller: ReadableStreamDefaultController<Uint8Array>;
	userId: string;
	createdAt: Date;
};

type CaseConnections = Map<string, SSEConnection>;

/**
 * SSE Connection Manager singleton.
 * Manages all active SSE connections grouped by case ID.
 */
class SSEConnectionManager {
	private readonly connections: Map<string, CaseConnections> = new Map();
	private readonly encoder = new TextEncoder();

	/**
	 * Adds a new SSE connection for a case.
	 */
	addConnection(
		caseId: string,
		connectionId: string,
		controller: ReadableStreamDefaultController<Uint8Array>,
		userId: string
	): void {
		if (!this.connections.has(caseId)) {
			this.connections.set(caseId, new Map());
		}

		const caseConnections = this.connections.get(caseId);
		if (caseConnections) {
			caseConnections.set(connectionId, {
				id: connectionId,
				controller,
				userId,
				createdAt: new Date(),
			});
		}

		console.log(
			`[SSE] Connection added: ${connectionId} for case ${caseId}. ` +
				`Total connections for case: ${caseConnections?.size ?? 0}`
		);
	}

	/**
	 * Removes an SSE connection.
	 */
	removeConnection(caseId: string, connectionId: string): void {
		const caseConnections = this.connections.get(caseId);
		if (caseConnections) {
			caseConnections.delete(connectionId);
			console.log(
				`[SSE] Connection removed: ${connectionId} from case ${caseId}. ` +
					`Remaining connections: ${caseConnections.size}`
			);

			// Clean up empty case entries
			if (caseConnections.size === 0) {
				this.connections.delete(caseId);
			}
		}
	}

	/**
	 * Broadcasts an event to all connections for a case.
	 * Optionally excludes the originating user.
	 */
	broadcast(event: SSEEvent, excludeUserId?: string): void {
		const caseConnections = this.connections.get(event.caseId);
		if (!caseConnections || caseConnections.size === 0) {
			return;
		}

		const eventData = this.formatEvent(event);
		const deadConnections: string[] = [];

		for (const [connectionId, connection] of caseConnections) {
			// Skip the user who triggered the event
			if (excludeUserId && connection.userId === excludeUserId) {
				continue;
			}

			try {
				connection.controller.enqueue(eventData);
			} catch {
				// Connection is dead, mark for removal
				deadConnections.push(connectionId);
			}
		}

		// Clean up dead connections
		for (const connectionId of deadConnections) {
			this.removeConnection(event.caseId, connectionId);
		}

		console.log(
			`[SSE] Broadcast event ${event.type} to case ${event.caseId}. ` +
				`Recipients: ${caseConnections.size - deadConnections.length}`
		);
	}

	/**
	 * Sends a heartbeat to all connections for a case.
	 */
	sendHeartbeat(caseId: string): void {
		const caseConnections = this.connections.get(caseId);
		if (!caseConnections) {
			return;
		}

		const heartbeat = this.encoder.encode(": heartbeat\n\n");
		const deadConnections: string[] = [];

		for (const [connectionId, connection] of caseConnections) {
			try {
				connection.controller.enqueue(heartbeat);
			} catch {
				deadConnections.push(connectionId);
			}
		}

		for (const connectionId of deadConnections) {
			this.removeConnection(caseId, connectionId);
		}
	}

	/**
	 * Gets the number of active connections for a case.
	 */
	getConnectionCount(caseId: string): number {
		return this.connections.get(caseId)?.size ?? 0;
	}

	/**
	 * Gets all connected user IDs for a case.
	 */
	getConnectedUsers(caseId: string): string[] {
		const caseConnections = this.connections.get(caseId);
		if (!caseConnections) {
			return [];
		}

		const userIds = new Set<string>();
		for (const connection of caseConnections.values()) {
			userIds.add(connection.userId);
		}
		return Array.from(userIds);
	}

	/**
	 * Formats an SSE event for transmission.
	 */
	private formatEvent(event: SSEEvent): Uint8Array {
		const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
		return this.encoder.encode(eventString);
	}
}

// Use globalThis to persist the singleton across module reloads in dev mode
const globalForSSE = globalThis as unknown as {
	sseConnectionManager: SSEConnectionManager | undefined;
};

// Export singleton instance (persisted across hot reloads)
export const sseConnectionManager =
	globalForSSE.sseConnectionManager ?? new SSEConnectionManager();

if (process.env.NODE_ENV !== "production") {
	globalForSSE.sseConnectionManager = sseConnectionManager;
}

/**
 * Helper function to emit an SSE event.
 * Use this from API routes when data changes.
 */
export function emitSSEEvent(
	type: SSEEventType,
	caseId: string,
	payload: Record<string, unknown>,
	userId?: string
): void {
	const event: SSEEvent = {
		type,
		caseId,
		payload,
		timestamp: new Date().toISOString(),
		userId,
	};

	sseConnectionManager.broadcast(event, userId);
}
