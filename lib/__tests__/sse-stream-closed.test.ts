import { describe, expect, it } from "vitest";
import {
	formatStreamClosedEvent,
	STREAM_CLOSED_EVENT,
	type StreamClosedReason,
} from "@/lib/sse-stream-closed";

/** Reads one server-sent event frame the way a browser does. */
function parseFrame(frame: string): { event: string; data: unknown } {
	const lines = frame.split("\n");
	const event = lines
		.find((line) => line.startsWith("event: "))
		?.slice("event: ".length);
	const data = lines
		.find((line) => line.startsWith("data: "))
		?.slice("data: ".length);
	return { event: event ?? "", data: JSON.parse(data ?? "null") };
}

describe("STREAM_CLOSED_EVENT", () => {
	it("is the event name the browser listens for", () => {
		expect(STREAM_CLOSED_EVENT).toBe("stream:closed");
	});
});

describe("formatStreamClosedEvent", () => {
	it.each([
		"access-removed",
		"signed-out",
	] as const satisfies readonly StreamClosedReason[])("writes a complete frame naming the event and carrying the %s reason", (reason) => {
		const frame = formatStreamClosedEvent(reason);

		expect(frame.endsWith("\n\n")).toBe(true);
		expect(frame.startsWith(`event: ${STREAM_CLOSED_EVENT}\n`)).toBe(true);
		expect(parseFrame(frame)).toStrictEqual({
			event: "stream:closed",
			data: { reason },
		});
	});

	it("writes exactly an event line, a data line and the blank line", () => {
		expect(formatStreamClosedEvent("signed-out")).toBe(
			'event: stream:closed\ndata: {"reason":"signed-out"}\n\n'
		);
	});
});
