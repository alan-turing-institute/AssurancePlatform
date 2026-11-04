/**
 * The event a case's live-update stream sends just before the server ends it
 * on purpose, and the reasons it can give. The module imports nothing, so the
 * events route and the browser hook can both use it.
 */

export const STREAM_CLOSED_EVENT = "stream:closed";

/** Why the server ended a stream. */
export type StreamClosedReason = "access-removed";

/** The closing event as it is written to the stream. */
export function formatStreamClosedEvent(reason: StreamClosedReason): string {
	return `event: ${STREAM_CLOSED_EVENT}\ndata: ${JSON.stringify({ reason })}\n\n`;
}
