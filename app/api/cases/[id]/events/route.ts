import { NextResponse } from "next/server";
import { requireAuthSession } from "@/lib/api-response";
import { getSessionVersion } from "@/lib/auth/session-version";
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
	/** Ends the stream; called when the user can no longer view the case or their session has ended. */
	endStream: (reason: StreamClosedReason) => void;
	/** True once the connection has been removed, for any reason. */
	isClosed: () => boolean;
	/** The user's session version when the stream opened. */
	sessionVersion: number;
	userId: string;
}

interface StreamIdentity {
	/** The user's session version, which a password change or reset raises. */
	sessionVersion: number;
	userId: string;
}

/**
 * Authenticates a request to open a stream, and reads the user's session
 * version to keep with it. The session is validated twice, with the version
 * read between: a password change that lands before the second validation
 * fails it, and one that lands after it leaves the version read here the
 * token's own, because versions only rise. Answers `null` when there is no
 * valid session.
 */
async function authenticateStream(): Promise<StreamIdentity | null> {
	let userId: string;
	try {
		userId = (await requireAuthSession()).userId;
	} catch {
		return null;
	}
	const sessionVersion = await getSessionVersion(userId);
	if (sessionVersion === null) {
		return null;
	}
	try {
		await requireAuthSession();
	} catch {
		return null;
	}
	return { userId, sessionVersion };
}

/** What asked for a re-check: the stream's heartbeat, or a change to someone's access. */
type RecheckTrigger = "heartbeat" | "requested";

/**
 * Says why the stream should end, or `null` if it should stay open. The case
 * access check runs first, and the session check only if access is still
 * there, so a case access check that stalls never reaches the second read.
 * The session has ended when the user's session version is no longer the one
 * read when the stream opened, or the user is gone.
 */
async function findReasonToEnd({
	caseId,
	isClosed,
	sessionVersion,
	userId,
}: AccessRecheckOptions): Promise<StreamClosedReason | null> {
	const allowed = await withTimeout(
		validateCaseAccess(userId, caseId),
		ACCESS_CHECK_TIMEOUT_MS
	);
	if (!allowed) {
		return "access-removed";
	}
	if (isClosed()) {
		return null;
	}
	const currentVersion = await withTimeout(
		getSessionVersion(userId),
		ACCESS_CHECK_TIMEOUT_MS
	);
	return currentVersion === sessionVersion ? null : "signed-out";
}

/**
 * Runs one check and ends the stream if the user can no longer view the case
 * or their session has ended. A check that fails, or does not settle within
 * `ACCESS_CHECK_TIMEOUT_MS`, keeps the stream open and is logged, so a passing
 * database error does not close every viewer's stream. Once the connection is
 * gone, a check's outcome is dropped without a log entry.
 */
async function checkAccessOnce(options: AccessRecheckOptions): Promise<void> {
	const { caseId, connectionId, endStream, isClosed } = options;
	try {
		const reason = await findReasonToEnd(options);
		if (isClosed() || !reason) {
			return;
		}
		log.info(
			reason === "signed-out"
				? "Closing stream: session ended"
				: "Closing stream: case access lost",
			{ connectionId, caseId }
		);
		endStream(reason);
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
 * once that check has finished. Every call returns a promise that settles when
 * the checks running for the stream have finished.
 */
function createAccessRecheck(
	options: AccessRecheckOptions
): (trigger: RecheckTrigger) => Promise<void> {
	let running: Promise<void> | undefined;
	let rerunQueued = false;
	// `running` is cleared in the same step that leaves the loop, so a re-check
	// requested after the last pass has started its own.
	const runChecks = async () => {
		try {
			do {
				rerunQueued = false;
				await checkAccessOnce(options);
			} while (rerunQueued && !options.isClosed());
		} finally {
			running = undefined;
		}
	};
	return (trigger) => {
		if (options.isClosed()) {
			return Promise.resolve();
		}
		if (running) {
			rerunQueued ||= trigger === "requested";
			return running;
		}
		running = runChecks();
		return running;
	};
}

/**
 * Stream live updates for a case
 *
 * @description Server-sent events for real-time case updates. Requires a session and VIEW access to the case; a missing case, a case in Trash and a case the caller cannot view all answer 404. The stream sends a heartbeat comment every 25 to 30 seconds and checks the caller's VIEW access and session again each time, and the server also checks straight after a change that may have removed that access. When access is lost, or the case is moved to Trash or deleted, the server sends a `stream:closed` event with data `{"reason":"access-removed"}` and then ends the stream. When the caller's session has ended because their password was changed or reset, it does the same with the reason `signed-out`.
 *
 * @pathParam id - Case ID (UUID)
 * @responseSet none
 * @add 401,404,500
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
	const identity = await authenticateStream();
	if (!identity) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}
	const { userId, sessionVersion } = identity;

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
				sessionVersion,
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

			// A change that removed this user's access may have committed after
			// the access check that let the stream open and before the connection
			// was registered, so no re-check requested for it reached this stream.
			recheckAccess("requested");
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
