import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sseConnectionManager } from "@/lib/services/sse-connection-manager";

/**
 * Validates the user session and returns the user ID.
 */
async function validateSession(): Promise<
	{ valid: true; userId: string } | { valid: false }
> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return { valid: false };
	}
	return { valid: true, userId: session.user.id };
}

/**
 * Validates case access for the user.
 */
async function validateCaseAccess(
	userId: string,
	caseId: string
): Promise<boolean> {
	const { getCasePermission } = await import("@/lib/permissions");

	const permission = await getCasePermission({ userId, caseId });
	return permission.hasAccess;
}

/**
 * Generates a unique connection ID.
 */
function generateConnectionId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * GET /api/cases/[id]/events
 *
 * Server-Sent Events endpoint for real-time case updates.
 * Clients connect here to receive live updates when the case changes.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;

	// Validate session
	const sessionResult = await validateSession();
	if (!sessionResult.valid) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Validate case access
	const hasAccess = await validateCaseAccess(sessionResult.userId, caseId);
	if (!hasAccess) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const connectionId = generateConnectionId();
	const { userId } = sessionResult;

	// Create the SSE stream
	const stream = new ReadableStream({
		start(controller) {
			// Register the connection
			sseConnectionManager.addConnection(
				caseId,
				connectionId,
				controller,
				userId
			);

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

			// Set up heartbeat interval (every 30 seconds)
			const heartbeatInterval = setInterval(() => {
				sseConnectionManager.sendHeartbeat(caseId);
			}, 30_000);

			// Clean up on close
			const cleanup = () => {
				clearInterval(heartbeatInterval);
				sseConnectionManager.removeConnection(caseId, connectionId);
			};

			// Store cleanup function for later use
			// Note: The actual cleanup happens when the stream is cancelled
			(controller as unknown as { cleanup: () => void }).cleanup = cleanup;
		},
		cancel() {
			// This is called when the client disconnects
			sseConnectionManager.removeConnection(caseId, connectionId);
			console.log(`[SSE] Client disconnected: ${connectionId}`);
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
