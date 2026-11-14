/**
 * SSE Connection Manager
 *
 * Manages Server-Sent Events connections for real-time updates.
 * Tracks active connections per case and broadcasts events to subscribers.
 */

import { logger } from "@/lib/logger";

const log = logger.child({ component: "sse-connection-manager" });

export type SSEEventType =
	| "case:updated"
	| "comment:created"
	| "comment:updated"
	| "comment:deleted"
	| "element:created"
	| "element:updated"
	| "element:deleted"
	| "element:restored"
	| "element:attached"
	| "element:detached"
	| "element:moved"
	| "permission:changed"
	// Plugin-emitted events are namespaced (ADR 0002 v2 §2.5). The health
	// plugin emits this AFTER its evidence-append write transaction commits,
	// never from inside it, and never on a failed write.
	| "tea.health/state-changed";

export interface SSEEvent {
	caseId: string;
	payload: Record<string, unknown>;
	timestamp: string;
	type: SSEEventType;
	userId?: string;
}

interface SSEConnection {
	controller: ReadableStreamDefaultController<Uint8Array>;
	createdAt: Date;
	id: string;
	/** Runs once, when the connection is removed by any route to removal. */
	onRemove?: () => void;
	/** Checks again whether the connection's user may still view the case. */
	recheck?: () => void | Promise<void>;
	userId: string;
}

/**
 * Which connections `recheckConnections` acts on. It must name a case, a
 * user, or both; there is no way to ask for every connection.
 */
export type RecheckFilter =
	| { caseId: string; userId?: string }
	| { caseId?: string; userId: string };

type CaseConnections = Map<string, SSEConnection>;

/**
 * SSE Connection Manager singleton.
 * Manages all active SSE connections grouped by case ID.
 */
class SSEConnectionManager {
	private readonly connections: Map<string, CaseConnections> = new Map();
	private readonly encoder = new TextEncoder();

	/**
	 * Adds a new SSE connection for a case. `onRemove` runs once when the
	 * connection leaves the manager, whether the client closed it, the server
	 * ended it or a write to it failed. `recheck` is what
	 * `recheckConnections` calls to have the connection's access checked again.
	 */
	addConnection(
		caseId: string,
		connectionId: string,
		controller: ReadableStreamDefaultController<Uint8Array>,
		userId: string,
		onRemove?: () => void,
		recheck?: () => void | Promise<void>
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
				onRemove,
				recheck,
			});
		}

		log.info("SSE connection added", {
			connectionId,
			caseId,
			totalConnectionsForCase: caseConnections?.size ?? 0,
		});
	}

	/**
	 * Removes an SSE connection and runs its `onRemove` callback. Removing a
	 * connection that is not registered does nothing, so every path that ends a
	 * stream can call this without checking whether another already has.
	 */
	removeConnection(caseId: string, connectionId: string): void {
		const caseConnections = this.connections.get(caseId);
		const connection = caseConnections?.get(connectionId);
		if (!(caseConnections && connection)) {
			return;
		}

		caseConnections.delete(connectionId);
		log.info("SSE connection removed", {
			connectionId,
			caseId,
			remainingConnections: caseConnections.size,
		});

		// Clean up empty case entries
		if (caseConnections.size === 0) {
			this.connections.delete(caseId);
		}

		connection.onRemove?.();
	}

	/**
	 * Broadcasts an event to all connections for a case.
	 */
	broadcast(event: SSEEvent): void {
		const caseConnections = this.connections.get(event.caseId);
		if (!caseConnections || caseConnections.size === 0) {
			return;
		}

		const eventData = this.formatEvent(event);
		const deadConnections: string[] = [];
		let recipients = 0;

		for (const [connectionId, connection] of caseConnections) {
			try {
				connection.controller.enqueue(eventData);
				recipients += 1;
			} catch {
				// Connection is dead, mark for removal
				deadConnections.push(connectionId);
			}
		}

		// Clean up dead connections
		for (const connectionId of deadConnections) {
			this.removeConnection(event.caseId, connectionId);
		}

		log.info("SSE broadcast event", {
			eventType: event.type,
			caseId: event.caseId,
			recipients,
		});
	}

	/**
	 * Sends a heartbeat to one connection, and removes it if the write fails.
	 * Each stream runs its own heartbeat timer, so a heartbeat never goes to
	 * the case's other connections.
	 */
	sendHeartbeat(caseId: string, connectionId: string): void {
		const connection = this.connections.get(caseId)?.get(connectionId);
		if (!connection) {
			return;
		}

		try {
			connection.controller.enqueue(this.encoder.encode(": heartbeat\n\n"));
		} catch {
			this.removeConnection(caseId, connectionId);
		}
	}

	/**
	 * Has the access of the matching connections checked again now, rather than
	 * at their next heartbeat. Call it after a change that may have taken away
	 * someone's access has committed, and wait for it: a stream that has lost
	 * access is then closed before anything that follows the change, such as an
	 * event announcing it, is sent. It acts only on the connections held by this
	 * process, and settles once every check it started has finished. A check
	 * that fails is logged, never thrown. A filter that names neither a case nor
	 * a user matches nothing.
	 */
	async recheckConnections(filter: RecheckFilter): Promise<void> {
		const { caseId, userId } = filter;
		if (!(caseId || userId)) {
			return;
		}

		const matching = this.connectionsMatching(caseId, userId);
		if (matching.length === 0) {
			return;
		}
		log.info("SSE access re-check requested", {
			caseId,
			userId,
			connections: matching.length,
		});
		await Promise.all(
			matching.map((connection) => this.runRecheck(connection))
		);
	}

	/** The connections on `caseId` (or on every case) that belong to `userId` (or to anyone). */
	private connectionsMatching(
		caseId: string | undefined,
		userId: string | undefined
	): SSEConnection[] {
		const cases = caseId
			? [this.connections.get(caseId)]
			: [...this.connections.values()];
		return cases.flatMap((caseConnections) =>
			[...(caseConnections?.values() ?? [])].filter(
				(connection) => !userId || connection.userId === userId
			)
		);
	}

	/** Runs one connection's re-check; one that fails is logged and does not reach the caller. */
	private async runRecheck(connection: SSEConnection): Promise<void> {
		try {
			await connection.recheck?.();
		} catch (error) {
			log.warn("SSE access re-check failed", {
				connectionId: connection.id,
				error,
			});
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

// Keep the singleton on globalThis. A production build bundles server actions
// and route handlers separately, so each bundle evaluates this module on its
// own; without a shared instance, an event emitted from a server action
// reaches no connection opened by the events route.
const globalForSSE = globalThis as unknown as {
	sseConnectionManager: SSEConnectionManager | undefined;
};

// Export singleton instance (shared across bundles and hot reloads)
export const sseConnectionManager =
	globalForSSE.sseConnectionManager ?? new SSEConnectionManager();

globalForSSE.sseConnectionManager = sseConnectionManager;

/**
 * Helper function to emit an SSE event.
 * Use this from API routes when data changes.
 */
export function emitSSEEvent(
	type: SSEEventType,
	caseId: string,
	payload: Record<string, unknown>
): void {
	const event: SSEEvent = {
		type,
		caseId,
		payload,
		timestamp: new Date().toISOString(),
		userId: typeof payload.userId === "string" ? payload.userId : undefined,
	};

	sseConnectionManager.broadcast(event);
}
