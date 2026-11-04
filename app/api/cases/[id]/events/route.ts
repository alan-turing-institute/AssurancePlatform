import { NextResponse } from "next/server";
import { requireAuthSession } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { sseConnectionManager } from "@/lib/services/sse-connection-manager";
import { heartbeatPeriodMs } from "@/lib/sse-heartbeat";
import {
	formatStreamClosedEvent,
	type StreamClosedReason,
} from "@/lib/sse-stream-closed";

const log = logger.child({ component: "sse-route" });

/**
 * Validates case access for the user.
 */
async function validateCaseAccess(
	userId: string,
	caseId: string
): Promise<boolean> {
	const { canAccessCase } = await import("@/lib/permissions");
	return canAccessCase({ userId, caseId }, "VIEW");
}

/**
 * Generates a unique connection ID.
 */
function generateConnectionId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

const ACCESS_CHECK_TIMEOUT_MS = 10_000;

/**
 * Settles with `promise`, or rejects once `ms` have passed without it
 * settling, and clears its timer either way.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timedOut = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
	});
	return Promise.race([promise, timedOut]).finally(() => clearTimeout(timer));
}

interface AccessRecheckOptions {
	caseId: string;
	connectionId: string;
	/** Ends the stream; called when the user can no longer view the case. */
	endStream: (reason: StreamClosedReason) => void;
	/** True once the connection has been removed, for any reason. */
	isClosed: () => boolean;
	userId: string;
}

/** What asked for a re-check: the stream's heartbeat, or a change to someone's access. */
type RecheckTrigger = "heartbeat" | "requested";

/**
 * Runs one access check and ends the stream if the user can no longer view
 * the case. A check that fails, or does not settle within
 * `ACCESS_CHECK_TIMEOUT_MS`, keeps the stream open and is logged, so a passing
 * database error does not close every viewer's stream. Once the connection is
 * gone, a check's outcome is dropped without a log entry.
 */
async function checkAccessOnce({
	caseId,
	connectionId,
	endStream,
	isClosed,
	userId,
}: AccessRecheckOptions): Promise<void> {
	try {
		const allowed = await withTimeout(
			validateCaseAccess(userId, caseId),
			ACCESS_CHECK_TIMEOUT_MS
		);
		if (isClosed()) {
			return;
		}
		if (!allowed) {
			log.info("Closing stream: case access lost", { connectionId, caseId });
			endStream("access-removed");
		}
	} catch (error) {
		if (!isClosed()) {
			log.warn("Could not re-check case access; keeping stream open", {
				connectionId,
				caseId,
				error,
			});
		}
	}
}

/**
 * Builds the access re-check for one stream. It never holds up the heartbeat,
 * and starts nothing for a connection that has been removed. A heartbeat that
 * falls due while a check is running does not start another. A re-check
 * requested by a change to someone's access is not dropped in that case: the
 * running check may have read the data before the change, so it runs again
 * once that check has finished.
 */
function createAccessRecheck(
	options: AccessRecheckOptions
): (trigger: RecheckTrigger) => Promise<void> {
	let checking = false;
	let rerunQueued = false;
	return async (trigger) => {
		if (options.isClosed()) {
			return;
		}
		if (checking) {
			rerunQueued ||= trigger === "requested";
			return;
		}
		checking = true;
		try {
			do {
				rerunQueued = false;
				await checkAccessOnce(options);
			} while (rerunQueued && !options.isClosed());
		} finally {
			checking = false;
		}
	};
}

/**
 * Stream live updates for a case
 *
 * @description Server-sent events for real-time case updates. Requires a session and VIEW access to the case; a missing case, a case in Trash and a case the caller cannot view all answer 404. The stream sends a heartbeat comment every 25 to 30 seconds and checks the caller's VIEW access again each time, and the server also checks straight after a change that may have removed that access. When access is lost, or the case is moved to Trash or deleted, the server sends a `stream:closed` event with data `{"reason":"access-removed"}` and then ends the stream.
 *
 * @pathParam id - Case ID (UUID)
 * @responseSet none
 * @add 401,404
 * @auth SessionAuth
 * @tag Cases
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;

	// Validate session — SSE uses plain JSON responses (not standard apiError)
	// because clients consume this as a stream, not a JSON API.
	let userId: string;
	try {
		const session = await requireAuthSession();
		userId = session.userId;
	} catch {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Validate case access
	const hasAccess = await validateCaseAccess(userId, caseId);
	if (!hasAccess) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const connectionId = generateConnectionId();

	// Create the SSE stream. Every way it ends (the client closing it, the
	// request aborting, a failed write, the server closing it) removes its
	// connection from the manager, which clears the stream's heartbeat timer.
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (request.signal.aborted) {
				controller.close();
				return;
			}

			// Set when the connection is removed, whichever way that happens
			let closed = false;
			const encoder = new TextEncoder();

			// Ends the stream from the server side. Removing the connection also
			// clears the heartbeat timer, and does nothing if it is already gone.
			// With a reason, the stream says why just before it closes.
			const endStream = (reason?: StreamClosedReason) => {
				sseConnectionManager.removeConnection(caseId, connectionId);
				try {
					if (reason) {
						controller.enqueue(encoder.encode(formatStreamClosedEvent(reason)));
					}
					controller.close();
				} catch {
					// The stream is already closed or errored.
				}
			};

			const recheckAccess = createAccessRecheck({
				caseId,
				connectionId,
				endStream,
				isClosed: () => closed,
				userId,
			});

			const heartbeatInterval = setInterval(() => {
				sseConnectionManager.sendHeartbeat(caseId, connectionId);
				recheckAccess("heartbeat");
			}, heartbeatPeriodMs());

			// Register the connection; its removal clears the heartbeat timer
			sseConnectionManager.addConnection(
				caseId,
				connectionId,
				controller,
				userId,
				() => {
					closed = true;
					clearInterval(heartbeatInterval);
				},
				() => recheckAccess("requested")
			);
			request.signal.addEventListener("abort", () => endStream(), {
				once: true,
			});

			// Send initial connection event
			const connectEvent = encoder.encode(
				`event: connected\ndata: ${JSON.stringify({
					connectionId,
					caseId,
					timestamp: new Date().toISOString(),
				})}\n\n`
			);
			controller.enqueue(connectEvent);
		},
		cancel() {
			// This is called when the client disconnects
			sseConnectionManager.removeConnection(caseId, connectionId);
			log.info("Client disconnected", { connectionId });
		},
	});

	// Return the SSE response with appropriate headers
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
