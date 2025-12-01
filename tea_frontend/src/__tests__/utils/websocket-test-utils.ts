/**
 * Enhanced WebSocket Testing Utilities
 *
 * This module provides comprehensive utilities for testing WebSocket connections,
 * real-time collaboration features, and optimistic updates in the TEA Platform.
 */

import type { Mock } from "vitest";
import { vi } from "vitest";
import type { AssuranceCase } from "@/types/domain";

/**
 * WebSocket ready states
 */
export const WS_READY_STATE = {
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3,
} as const;

export type WS_READY_STATE =
	(typeof WS_READY_STATE)[keyof typeof WS_READY_STATE];

/**
 * Message types used in the TEA Platform WebSocket communication
 */
export const MessageType = {
	PING: "ping",
	CASE_MESSAGE: "case_message",
	USER_UPDATE: "user_update",
	CURSOR_UPDATE: "cursor_update",
	PRESENCE_UPDATE: "presence_update",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/**
 * Mock WebSocket server configuration options
 */
export type MockWebSocketServerOptions = {
	url?: string;
	autoConnect?: boolean;
	connectionDelay?: number;
	reconnectAttempts?: number;
	reconnectDelay?: number;
};

/**
 * User presence information for collaboration features
 */
export type UserPresence = {
	id: string;
	username: string;
	cursor?: {
		x: number;
		y: number;
		elementId?: string;
	};
	lastActivity: Date;
	status: "active" | "idle" | "away";
};

/**
 * WebSocket message structure
 */
export type WebSocketMessage<T = unknown> = {
	type: string;
	content: T;
	timestamp?: number;
	userId?: string;
};

/**
 * Mock WebSocket instance with enhanced testing capabilities
 */
export class MockWebSocket implements Partial<WebSocket> {
	url: string;
	readyState: number = WS_READY_STATE.CONNECTING;

	private readonly eventListeners: Map<string, Set<EventListener>> = new Map();
	private sentMessages: WebSocketMessage[] = [];

	// Mock functions
	send: Mock;
	close: Mock;

	constructor(url: string) {
		this.url = url;
		this.send = vi.fn(this.handleSend.bind(this));
		this.close = vi.fn(this.handleClose.bind(this));
	}

	addEventListener(type: string, listener: EventListener): void {
		if (!this.eventListeners.has(type)) {
			this.eventListeners.set(type, new Set());
		}
		this.eventListeners.get(type)?.add(listener);
	}

	removeEventListener(type: string, listener: EventListener): void {
		this.eventListeners.get(type)?.delete(listener);
	}

	dispatchEvent(event: Event): boolean {
		const listeners = this.eventListeners.get(event.type);
		if (listeners) {
			for (const listener of listeners) {
				listener(event);
			}
		}
		return true;
	}

	private handleSend(
		data: string | ArrayBufferLike | Blob | ArrayBufferView
	): void {
		if (this.readyState !== WS_READY_STATE.OPEN) {
			throw new Error("WebSocket is not open");
		}

		try {
			const message = typeof data === "string" ? JSON.parse(data) : data;
			this.sentMessages.push(message);
		} catch {
			// Handle non-JSON messages
			this.sentMessages.push({ type: "raw", content: data });
		}
	}

	private handleClose(code?: number, reason?: string): void {
		this.readyState = WS_READY_STATE.CLOSING;

		setTimeout(() => {
			this.readyState = WS_READY_STATE.CLOSED;
			const closeEvent = new CloseEvent("close", { code, reason });
			this.dispatchEvent(closeEvent);
		}, 0);
	}

	/**
	 * Simulate receiving a message from the server
	 */
	receiveMessage(data: unknown): void {
		const messageEvent = new MessageEvent("message", {
			data: typeof data === "string" ? data : JSON.stringify(data),
		});
		this.dispatchEvent(messageEvent);
	}

	/**
	 * Simulate connection opening
	 */
	simulateOpen(): void {
		this.readyState = WS_READY_STATE.OPEN;
		const openEvent = new Event("open");
		this.dispatchEvent(openEvent);
	}

	/**
	 * Simulate connection error
	 */
	simulateError(error?: Error): void {
		const errorEvent = new ErrorEvent("error", { error });
		this.dispatchEvent(errorEvent);
	}

	/**
	 * Get all sent messages
	 */
	getSentMessages(): WebSocketMessage[] {
		return [...this.sentMessages];
	}

	/**
	 * Clear sent messages history
	 */
	clearSentMessages(): void {
		this.sentMessages = [];
	}
}

/**
 * Mock WebSocket server for simulating server-side behavior
 */
export class MockWebSocketServer {
	private readonly connections: Map<string, MockWebSocket> = new Map();
	private readonly options: Required<MockWebSocketServerOptions>;
	private readonly reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

	constructor(options: MockWebSocketServerOptions = {}) {
		this.options = {
			url: "ws://localhost:8000/ws",
			autoConnect: true,
			connectionDelay: 0,
			reconnectAttempts: 3,
			reconnectDelay: 1000,
			...options,
		};
	}

	/**
	 * Create a new WebSocket connection
	 */
	createConnection(id = "default"): MockWebSocket {
		const ws = new MockWebSocket(this.options.url);
		this.connections.set(id, ws);

		if (this.options.autoConnect) {
			setTimeout(() => {
				ws.simulateOpen();
			}, this.options.connectionDelay);
		}

		return ws;
	}

	/**
	 * Get a connection by ID
	 */
	getConnection(id = "default"): MockWebSocket | undefined {
		return this.connections.get(id);
	}

	/**
	 * Simulate broadcasting a message to all connected clients
	 */
	broadcast(message: WebSocketMessage, excludeId?: string): void {
		this.connections.forEach((ws, id) => {
			if (id !== excludeId && ws.readyState === WS_READY_STATE.OPEN) {
				ws.receiveMessage(message);
			}
		});
	}

	/**
	 * Simulate server sending a message to a specific client
	 */
	sendToClient(clientId: string, message: WebSocketMessage): void {
		const ws = this.connections.get(clientId);
		if (ws && ws.readyState === WS_READY_STATE.OPEN) {
			ws.receiveMessage(message);
		}
	}

	/**
	 * Simulate connection drop and reconnection
	 */
	async simulateReconnection(
		clientId = "default",
		dropDuration = 100
	): Promise<void> {
		const ws = this.connections.get(clientId);
		if (!ws) {
			return;
		}

		// Simulate connection drop
		ws.readyState = WS_READY_STATE.CLOSED;
		ws.simulateError(new Error("Connection lost"));
		const closeEvent = new CloseEvent("close", {
			code: 1006,
			reason: "Connection lost",
		});
		ws.dispatchEvent(closeEvent);

		// Wait for drop duration
		await new Promise((resolve) => setTimeout(resolve, dropDuration));

		// Simulate reconnection
		ws.readyState = WS_READY_STATE.CONNECTING;

		await new Promise((resolve) =>
			setTimeout(resolve, this.options.connectionDelay)
		);

		ws.simulateOpen();
	}

	/**
	 * Clean up all connections
	 */
	cleanup(): void {
		for (const timer of this.reconnectTimers.values()) {
			clearTimeout(timer);
		}
		this.reconnectTimers.clear();
		this.connections.clear();
	}
}

/**
 * Message queue for testing message ordering and buffering
 */
export class MessageQueue<T = unknown> {
	private queue: WebSocketMessage<T>[] = [];
	private processing = false;
	private readonly processor?: (message: WebSocketMessage<T>) => Promise<void>;

	constructor(processor?: (message: WebSocketMessage<T>) => Promise<void>) {
		this.processor = processor;
	}

	/**
	 * Add a message to the queue
	 */
	enqueue(message: WebSocketMessage<T>): void {
		this.queue.push(message);
		this.processQueue();
	}

	/**
	 * Process messages in the queue
	 */
	private async processQueue(): Promise<void> {
		if (this.processing || !this.processor) {
			return;
		}

		this.processing = true;

		while (this.queue.length > 0) {
			const message = this.queue.shift();
			if (!message) {
				continue;
			}
			// Sequential processing is required for message ordering
			// biome-ignore lint/nursery/noAwaitInLoop: sequential processing needed
			await this.processor(message);
		}

		this.processing = false;
	}

	/**
	 * Get current queue size
	 */
	size(): number {
		return this.queue.length;
	}

	/**
	 * Clear the queue
	 */
	clear(): void {
		this.queue = [];
	}

	/**
	 * Get all messages in queue
	 */
	getMessages(): WebSocketMessage<T>[] {
		return [...this.queue];
	}
}

/**
 * Collaboration testing utilities
 */
export class CollaborationTestUtils {
	private readonly presenceMap: Map<string, UserPresence> = new Map();
	private readonly cursorPositions: Map<string, { x: number; y: number }> =
		new Map();

	/**
	 * Simulate user joining the session
	 */
	simulateUserJoin(
		user: Omit<UserPresence, "lastActivity" | "status">
	): UserPresence {
		const presence: UserPresence = {
			...user,
			lastActivity: new Date(),
			status: "active",
		};

		this.presenceMap.set(user.id, presence);
		return presence;
	}

	/**
	 * Simulate user leaving the session
	 */
	simulateUserLeave(userId: string): void {
		this.presenceMap.delete(userId);
		this.cursorPositions.delete(userId);
	}

	/**
	 * Simulate cursor movement
	 */
	simulateCursorMove(
		userId: string,
		x: number,
		y: number,
		elementId?: string
	): void {
		const presence = this.presenceMap.get(userId);
		if (presence) {
			presence.cursor = { x, y, elementId };
			presence.lastActivity = new Date();
		}
		this.cursorPositions.set(userId, { x, y });
	}

	/**
	 * Get all active users
	 */
	getActiveUsers(): UserPresence[] {
		return Array.from(this.presenceMap.values()).filter(
			(user) => user.status === "active"
		);
	}

	/**
	 * Simulate user idle state
	 */
	simulateUserIdle(userId: string): void {
		const presence = this.presenceMap.get(userId);
		if (presence) {
			presence.status = "idle";
		}
	}

	/**
	 * Clear all presence data
	 */
	clearPresence(): void {
		this.presenceMap.clear();
		this.cursorPositions.clear();
	}
}

/**
 * Optimistic update testing utilities
 */
export class OptimisticUpdateTestUtils<T = unknown> {
	private readonly pendingUpdates: Map<string, T> = new Map();
	private confirmedState: T;
	private rollbackState: T;

	constructor(initialState: T) {
		this.confirmedState = initialState;
		this.rollbackState = initialState;
	}

	/**
	 * Apply an optimistic update
	 */
	applyOptimisticUpdate(updateId: string, update: Partial<T>): T {
		const newState = { ...this.confirmedState, ...update };
		this.pendingUpdates.set(updateId, newState);
		return newState;
	}

	/**
	 * Confirm an optimistic update
	 */
	confirmUpdate(updateId: string, serverState: T): T {
		this.pendingUpdates.delete(updateId);
		this.confirmedState = serverState;
		this.rollbackState = serverState;
		return this.confirmedState;
	}

	/**
	 * Rollback an optimistic update
	 */
	rollbackUpdate(updateId: string): T {
		this.pendingUpdates.delete(updateId);
		return this.rollbackState;
	}

	/**
	 * Get current state including pending updates
	 */
	getCurrentState(): T {
		if (this.pendingUpdates.size === 0) {
			return this.confirmedState;
		}

		// Return the most recent pending update
		const updates = Array.from(this.pendingUpdates.values());
		return updates.at(-1) as T;
	}

	/**
	 * Check if there are pending updates
	 */
	hasPendingUpdates(): boolean {
		return this.pendingUpdates.size > 0;
	}

	/**
	 * Clear all updates
	 */
	reset(state: T): void {
		this.pendingUpdates.clear();
		this.confirmedState = state;
		this.rollbackState = state;
	}
}

/**
 * WebSocket connection state assertions
 * These functions return assertions that should be called within test functions
 */
export const assertConnectionState = {
	/**
	 * Assert WebSocket is open
	 */
	isOpen(ws: MockWebSocket): boolean {
		return ws.readyState === WS_READY_STATE.OPEN;
	},

	/**
	 * Assert WebSocket is closed
	 */
	isClosed(ws: MockWebSocket): boolean {
		return ws.readyState === WS_READY_STATE.CLOSED;
	},

	/**
	 * Assert WebSocket is connecting
	 */
	isConnecting(ws: MockWebSocket): boolean {
		return ws.readyState === WS_READY_STATE.CONNECTING;
	},

	/**
	 * Check if message was sent
	 */
	hasSentMessage(
		ws: MockWebSocket,
		expectedMessage: Partial<WebSocketMessage>
	): boolean {
		const sentMessages = ws.getSentMessages();
		return sentMessages.some((msg) =>
			Object.entries(expectedMessage).every(([key, value]) => {
				const msgObj = msg as unknown as Record<string, unknown>;
				return msgObj[key] === value;
			})
		);
	},

	/**
	 * Check message count
	 */
	sentMessageCount(ws: MockWebSocket, count: number): boolean {
		return ws.getSentMessages().length === count;
	},

	/**
	 * Check if specific message type was sent
	 */
	hasSentMessageType(ws: MockWebSocket, messageType: string): boolean {
		const sentMessages = ws.getSentMessages();
		return sentMessages.some((msg) => msg.type === messageType);
	},

	/**
	 * Check if no messages were sent
	 */
	hasNoSentMessages(ws: MockWebSocket): boolean {
		return ws.getSentMessages().length === 0;
	},

	/**
	 * Check if messages were sent in specific order
	 */
	hasSentMessagesInOrder(ws: MockWebSocket, expectedTypes: string[]): boolean {
		const sentMessages = ws.getSentMessages();
		const sentTypes = sentMessages.map((msg) => msg.type);
		return JSON.stringify(sentTypes) === JSON.stringify(expectedTypes);
	},
};

/**
 * Create a mock WebSocket event
 */
export function createWebSocketEvent<T extends Event>(
	type: string,
	options?: EventInit
): T {
	return new Event(type, options) as T;
}

/**
 * Wait for WebSocket connection to open
 */
export async function waitForConnection(
	ws: MockWebSocket,
	timeout = 5000
): Promise<void> {
	const startTime = Date.now();

	while (ws.readyState !== WS_READY_STATE.OPEN) {
		if (Date.now() - startTime > timeout) {
			throw new Error("WebSocket connection timeout");
		}
		// biome-ignore lint/nursery/noAwaitInLoop: polling for connection state
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
}

/**
 * Create a mock assurance case update message
 */
export function createAssuranceCaseUpdate(
	assuranceCase: Partial<AssuranceCase>,
	userId?: string
): WebSocketMessage {
	return {
		type: MessageType.CASE_MESSAGE,
		content: { assuranceCase },
		timestamp: Date.now(),
		userId,
	};
}

/**
 * Create a mock user presence update message
 */
export function createPresenceUpdate(users: UserPresence[]): WebSocketMessage {
	return {
		type: MessageType.PRESENCE_UPDATE,
		content: { current_connections: users },
		timestamp: Date.now(),
	};
}

/**
 * Simulate a complete WebSocket lifecycle
 */
export async function simulateWebSocketLifecycle(
	setup: () => MockWebSocket,
	test: (ws: MockWebSocket) => Promise<void>,
	cleanup?: (ws: MockWebSocket) => void
): Promise<void> {
	const ws = setup();

	try {
		ws.simulateOpen();
		await waitForConnection(ws);
		await test(ws);
	} finally {
		if (cleanup) {
			cleanup(ws);
		}
		ws.close();
	}
}

/**
 * Enhanced concurrent user simulation utilities
 */
export class ConcurrentUserSimulator {
	private readonly users: Map<
		string,
		{ ws: MockWebSocket; presence: UserPresence }
	> = new Map();
	private readonly server: MockWebSocketServer;

	constructor(server: MockWebSocketServer) {
		this.server = server;
	}

	/**
	 * Add a concurrent user to the simulation
	 */
	addUser(
		userId: string,
		username: string
	): { ws: MockWebSocket; presence: UserPresence } {
		const ws = this.server.createConnection(userId);
		const presence: UserPresence = {
			id: userId,
			username,
			lastActivity: new Date(),
			status: "active",
		};

		this.users.set(userId, { ws, presence });
		return { ws, presence };
	}

	/**
	 * Simulate all users connecting
	 */
	async connectAllUsers(): Promise<void> {
		const connectionPromises = Array.from(this.users.values()).map(
			async ({ ws }) => {
				if (ws.readyState === WS_READY_STATE.CONNECTING) {
					ws.simulateOpen();
					await waitForConnection(ws);
				}
			}
		);

		await Promise.all(connectionPromises);
	}

	/**
	 * Simulate concurrent edits from multiple users
	 */
	async simulateConcurrentEdits(
		editCount = 5,
		delay = 100
	): Promise<WebSocketMessage[]> {
		const messages: WebSocketMessage[] = [];
		const users = Array.from(this.users.entries());

		for (let i = 0; i < editCount; i++) {
			const [userId, { ws }] = users[i % users.length];
			const message = createAssuranceCaseUpdate(
				{
					id: 1,
					name: `Updated by ${userId} - Edit ${i}`,
					updatedOn: new Date().toISOString(),
				},
				userId
			);

			ws.send(JSON.stringify(message));
			messages.push(message);

			// Broadcast to other users
			this.server.broadcast(message, userId);

			if (delay > 0) {
				// biome-ignore lint/nursery/noAwaitInLoop: simulating delays between edits
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		return messages;
	}

	/**
	 * Simulate cursor movements from all users
	 */
	simulateCursorMovements(): void {
		for (const [userId, { presence }] of this.users) {
			const x = Math.random() * 1000;
			const y = Math.random() * 800;

			presence.cursor = {
				x,
				y,
				elementId: `element-${Math.floor(Math.random() * 10)}`,
			};
			presence.lastActivity = new Date();

			const cursorMessage: WebSocketMessage = {
				type: MessageType.CURSOR_UPDATE,
				content: { userId, cursor: presence.cursor },
				timestamp: Date.now(),
				userId,
			};

			this.server.broadcast(cursorMessage, userId);
		}
	}

	/**
	 * Get all active users
	 */
	getActiveUsers(): UserPresence[] {
		return Array.from(this.users.values()).map((user) => user.presence);
	}

	/**
	 * Disconnect a specific user
	 */
	disconnectUser(userId: string): void {
		const user = this.users.get(userId);
		if (user) {
			user.ws.close();
			this.users.delete(userId);
		}
	}

	/**
	 * Clean up all users
	 */
	cleanup(): void {
		for (const { ws } of this.users.values()) {
			ws.close();
		}
		this.users.clear();
	}
}

/**
 * Network condition simulation utilities
 */
export class NetworkConditionSimulator {
	private readonly connections: Map<string, MockWebSocket> = new Map();

	constructor(connections: Map<string, MockWebSocket>) {
		this.connections = connections;
	}

	/**
	 * Simulate slow network conditions
	 */
	simulateSlowNetwork(delay = 2000): void {
		// Add artificial delay to all message processing
		const originalSend = MockWebSocket.prototype.send;

		MockWebSocket.prototype.send = vi.fn(function (
			this: MockWebSocket,
			data: string | ArrayBufferLike | Blob | ArrayBufferView
		) {
			setTimeout(() => {
				originalSend.call(this, data);
			}, delay);
		});
	}

	/**
	 * Simulate network instability
	 */
	simulateNetworkInstability(dropProbability = 0.2, duration = 5000): void {
		const originalReceiveMessage = MockWebSocket.prototype.receiveMessage;

		MockWebSocket.prototype.receiveMessage = function (data: unknown) {
			if (Math.random() > dropProbability) {
				originalReceiveMessage.call(this, data);
			}
			// Randomly drop messages based on probability
		};

		setTimeout(() => {
			// Restore normal behavior
			MockWebSocket.prototype.receiveMessage = originalReceiveMessage;
		}, duration);
	}

	/**
	 * Simulate connection timeout
	 */
	simulateConnectionTimeout(connectionId: string, timeout = 3000): void {
		const ws = this.connections.get(connectionId);
		if (ws) {
			setTimeout(() => {
				ws.simulateError(new Error("Connection timeout"));
				ws.readyState = WS_READY_STATE.CLOSED;
			}, timeout);
		}
	}
}

/**
 * Message integrity and ordering test utilities
 */
export class MessageIntegrityTester {
	private messageLog: Array<{
		timestamp: number;
		message: WebSocketMessage;
		source: string;
	}> = [];

	/**
	 * Log a message with timestamp and source
	 */
	logMessage(message: WebSocketMessage, source: string): void {
		this.messageLog.push({
			timestamp: Date.now(),
			message,
			source,
		});
	}

	/**
	 * Verify message ordering
	 */
	verifyMessageOrdering(expectedOrder: string[]): boolean {
		const actualOrder = this.messageLog.map((entry) => entry.message.type);
		return JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
	}

	/**
	 * Check for message duplication
	 */
	checkForDuplicates(): Array<{ message: WebSocketMessage; count: number }> {
		const messageMap = new Map<string, number>();
		const duplicates: Array<{ message: WebSocketMessage; count: number }> = [];

		for (const entry of this.messageLog) {
			const key = JSON.stringify(entry.message);
			const count = (messageMap.get(key) || 0) + 1;
			messageMap.set(key, count);

			if (count > 1) {
				duplicates.push({ message: entry.message, count });
			}
		}

		return duplicates;
	}

	/**
	 * Verify message integrity by checking required fields
	 */
	verifyMessageIntegrity(): Array<{
		message: WebSocketMessage;
		errors: string[];
	}> {
		const errors: Array<{ message: WebSocketMessage; errors: string[] }> = [];

		for (const entry of this.messageLog) {
			const messageErrors: string[] = [];
			const { message } = entry;

			if (!message.type) {
				messageErrors.push("Missing message type");
			}

			if (message.content === undefined || message.content === null) {
				messageErrors.push("Missing message content");
			}

			if (!message.timestamp) {
				messageErrors.push("Missing timestamp");
			}

			if (messageErrors.length > 0) {
				errors.push({ message, errors: messageErrors });
			}
		}

		return errors;
	}

	/**
	 * Get message statistics
	 */
	getMessageStats(): {
		total: number;
		byType: Record<string, number>;
		avgTimeBetweenMessages: number;
		timespan: number;
	} {
		const byType: Record<string, number> = {};

		for (const entry of this.messageLog) {
			byType[entry.message.type] = (byType[entry.message.type] || 0) + 1;
		}

		const timestamps = this.messageLog.map((entry) => entry.timestamp);
		const timespan =
			timestamps.length > 1
				? Math.max(...timestamps) - Math.min(...timestamps)
				: 0;
		const avgTimeBetweenMessages =
			timestamps.length > 1 ? timespan / (timestamps.length - 1) : 0;

		return {
			total: this.messageLog.length,
			byType,
			avgTimeBetweenMessages,
			timespan,
		};
	}

	/**
	 * Clear message log
	 */
	clearLog(): void {
		this.messageLog = [];
	}
}

/**
 * Reconnection strategy testing utilities
 */
export class ReconnectionTester {
	private attempts: Array<{
		timestamp: number;
		success: boolean;
		error?: Error;
	}> = [];
	private readonly maxRetries: number;
	private readonly baseDelay: number;

	constructor(maxRetries = 5, baseDelay = 1000) {
		this.maxRetries = maxRetries;
		this.baseDelay = baseDelay;
	}

	/**
	 * Simulate reconnection with exponential backoff
	 */
	async simulateReconnectionWithBackoff(
		createConnection: () => MockWebSocket,
		shouldFail?: (attempt: number) => boolean
	): Promise<MockWebSocket | null> {
		let attempt = 0;

		while (attempt < this.maxRetries) {
			const delay = this.baseDelay * 2 ** attempt;
			// Exponential backoff requires sequential delays
			// biome-ignore lint/nursery/noAwaitInLoop: exponential backoff requires sequential timing
			await new Promise((resolve) => setTimeout(resolve, delay));

			try {
				const ws = createConnection();

				if (shouldFail?.(attempt)) {
					const error = new Error(
						`Connection failed on attempt ${attempt + 1}`
					);
					this.attempts.push({ timestamp: Date.now(), success: false, error });
					ws.simulateError(error);
					throw error;
				}

				ws.simulateOpen();
				await waitForConnection(ws);

				this.attempts.push({ timestamp: Date.now(), success: true });
				return ws;
			} catch (error) {
				this.attempts.push({
					timestamp: Date.now(),
					success: false,
					error: error instanceof Error ? error : new Error("Unknown error"),
				});
				attempt++;

				if (attempt >= this.maxRetries) {
					throw new Error(
						`Failed to reconnect after ${this.maxRetries} attempts`
					);
				}
			}
		}

		return null;
	}

	/**
	 * Get reconnection statistics
	 */
	getReconnectionStats(): {
		totalAttempts: number;
		successfulAttempts: number;
		failedAttempts: number;
		averageDelay: number;
		lastError?: Error;
	} {
		const successfulAttempts = this.attempts.filter((a) => a.success).length;
		const failedAttempts = this.attempts.filter((a) => !a.success).length;

		const delays = this.attempts
			.slice(1)
			.map(
				(attempt, index) => attempt.timestamp - this.attempts[index].timestamp
			);
		const averageDelay =
			delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

		const lastFailedAttempt = this.attempts
			.slice()
			.reverse()
			.find((a) => !a.success);

		return {
			totalAttempts: this.attempts.length,
			successfulAttempts,
			failedAttempts,
			averageDelay,
			lastError: lastFailedAttempt?.error,
		};
	}

	/**
	 * Reset reconnection history
	 */
	reset(): void {
		this.attempts = [];
	}
}

/**
 * WebSocket event sequence testing utilities
 */
export function createEventSequenceTester() {
	const events: Array<{ type: string; timestamp: number; data?: unknown }> = [];

	return {
		/**
		 * Record an event
		 */
		recordEvent(type: string, data?: unknown): void {
			events.push({ type, timestamp: Date.now(), data });
		},

		/**
		 * Verify event sequence
		 */
		verifySequence(expectedSequence: string[]): boolean {
			const actualSequence = events.map((e) => e.type);
			return (
				JSON.stringify(actualSequence) === JSON.stringify(expectedSequence)
			);
		},

		/**
		 * Check timing between events
		 */
		checkEventTiming(
			event1: string,
			event2: string,
			maxDelay: number
		): boolean {
			const event1Index = events.findIndex((e) => e.type === event1);
			const event2Index = events.findIndex((e) => e.type === event2);

			if (event1Index === -1 || event2Index === -1) {
				return false;
			}

			const delay =
				events[event2Index].timestamp - events[event1Index].timestamp;
			return delay <= maxDelay;
		},

		/**
		 * Get all recorded events
		 */
		getEvents(): Array<{ type: string; timestamp: number; data?: unknown }> {
			return [...events];
		},

		/**
		 * Clear event history
		 */
		clear(): void {
			events.length = 0;
		},
	};
}

/**
 * Create comprehensive test scenario for WebSocket collaboration
 */
export async function createCollaborationTestScenario(options: {
	userCount?: number;
	messageCount?: number;
	simulateNetworkIssues?: boolean;
	testReconnection?: boolean;
}): Promise<{
	server: MockWebSocketServer;
	userSimulator: ConcurrentUserSimulator;
	messageIntegrityTester: MessageIntegrityTester;
	cleanup: () => void;
}> {
	const {
		userCount = 3,
		messageCount = 10,
		simulateNetworkIssues = false,
		testReconnection = false,
	} = options;

	const server = new MockWebSocketServer();
	const userSimulator = new ConcurrentUserSimulator(server);
	const messageIntegrityTester = new MessageIntegrityTester();

	// Add users
	for (let i = 0; i < userCount; i++) {
		userSimulator.addUser(`user${i}`, `User ${i}`);
	}

	// Connect all users
	await userSimulator.connectAllUsers();

	// Simulate collaboration activities
	const messages = await userSimulator.simulateConcurrentEdits(messageCount);
	userSimulator.simulateCursorMovements();

	// Log messages for integrity testing
	for (const msg of messages) {
		messageIntegrityTester.logMessage(msg, "user");
	}

	// Simulate network issues if requested
	if (simulateNetworkIssues) {
		const networkSim = new NetworkConditionSimulator(
			new Map<string, MockWebSocket>()
		);
		networkSim.simulateNetworkInstability(0.1, 2000);
	}

	// Test reconnection if requested
	if (testReconnection) {
		await server.simulateReconnection("user0", 500);
	}

	return {
		server,
		userSimulator,
		messageIntegrityTester,
		cleanup: () => {
			userSimulator.cleanup();
			server.cleanup();
			messageIntegrityTester.clearLog();
		},
	};
}
