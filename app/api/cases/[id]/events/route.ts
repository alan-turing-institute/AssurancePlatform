import { NextResponse } from "next/server";
import { requireAuthSession } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { sseConnectionManager } from "@/lib/services/sse-connection-manager";

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

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * GET /api/cases/[id]/events
 *
 * Server-Sent Events endpoint for real-time case updates.
 * Clients connect here to receive live updates when the case changes.
 *
 * Every way a stream ends (the client closing it, the request aborting, a
 * failed write, the server closing it) removes its connection from the
 * manager, which clears the stream's heartbeat timer. At each heartbeat the
 * user's VIEW access to the case is checked again, and the stream is closed
 * once they no longer have it or the case is trashed or deleted.
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

	// Create the SSE stream
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			if (request.signal.aborted) {
				controller.close();
				return;
			}

			// Ends the stream from the server side. Removing the connection also
			// clears the heartbeat timer, and does nothing if it is already gone.
			const endStream = () => {
				sseConnectionManager.removeConnection(caseId, connectionId);
				try {
					controller.close();
				} catch {
					// The stream is already closed or errored.
				}
			};

			// Re-checks access without holding up the heartbeat. A check that is
			// still running when the next heartbeat falls due is not repeated, and
			// a failed check keeps the stream open so that a passing database
			// error does not close every viewer's stream.
			let checkingAccess = false;
			const endStreamIfAccessLost = async () => {
				if (checkingAccess) {
					return;
				}
				checkingAccess = true;
				try {
					if (!(await validateCaseAccess(userId, caseId))) {
						log.info("Closing stream: case access lost", {
							connectionId,
							caseId,
						});
						endStream();
					}
				} catch (error) {
					log.warn("Could not re-check case access; keeping stream open", {
						connectionId,
						caseId,
						error,
					});
				} finally {
					checkingAccess = false;
				}
			};

			const heartbeatInterval = setInterval(() => {
				sseConnectionManager.sendHeartbeat(caseId);
				endStreamIfAccessLost();
			}, HEARTBEAT_INTERVAL_MS);

			// Register the connection; its removal clears the heartbeat timer
			sseConnectionManager.addConnection(
				caseId,
				connectionId,
				controller,
				userId,
				() => clearInterval(heartbeatInterval)
			);
			request.signal.addEventListener("abort", endStream, { once: true });

			// Send initial connection event
			const encoder = new TextEncoder();
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
