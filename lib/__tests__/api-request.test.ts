import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	DEFAULT_MAX_JSON_BODY_BYTES,
	parseJsonBody,
	readJsonBody,
} from "../api-request";

const URL = "http://localhost:3000/api/__test__/body-size";

/**
 * A `ReadableStream` that yields one chunk per `pull()` invocation, with a
 * spy on `pull` — `reader.read()` maps roughly 1:1 to `pull()` for a
 * default (count) queuing strategy, so the spy shows exactly which chunks
 * the consumer actually asked for. Cancelling the reader stops further
 * `pull()` calls, which is what lets a test prove "chunks after the
 * crossing one were never pulled".
 */
function chunkedStream(chunks: Uint8Array[]) {
	let index = 0;
	const pull = vi.fn(() => {
		// no-op body; the spy call itself is the signal
	});
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) {
			pull();
			const chunk = chunks[index];
			if (chunk === undefined) {
				controller.close();
				return;
			}
			controller.enqueue(chunk);
			index += 1;
		},
	});
	return { stream, pull };
}

function encodeChunks(strings: string[]): Uint8Array[] {
	const encoder = new TextEncoder();
	return strings.map((s) => encoder.encode(s));
}

/**
 * Builds a POST `NextRequest` whose body is a multi-chunk stream (a string
 * body arrives as a single chunk with no `content-length` header — spike
 * finding, Design §1.1 — so it can't exercise the running byte count).
 */
function chunkedRequest(
	strings: string[],
	init?: { headers?: Record<string, string> }
) {
	const { stream, pull } = chunkedStream(encodeChunks(strings));
	const request = new NextRequest(URL, {
		method: "POST",
		body: stream,
		duplex: "half",
		headers: init?.headers,
	});
	return { request, pull };
}

describe("readJsonBody", () => {
	it("rejects immediately when Content-Length declares more than the cap, without reading the stream", async () => {
		const { request, pull } = chunkedRequest(['{"a":1}'], {
			headers: { "content-length": String(10 * 1024 * 1024) },
		});

		// Node's Request implementation (undici) does its own one-off,
		// asynchronous readiness probe of a streaming body on construction —
		// independent of anything our code does — so the baseline is taken
		// after that settles, rather than asserting zero calls ever. What
		// this proves is the thing that matters: our header-reject path
		// causes no ADDITIONAL pulls beyond that runtime baseline, i.e.
		// readJsonBody itself never touches the stream once it has decided
		// to reject on Content-Length alone.
		await new Promise((resolve) => setTimeout(resolve, 30));
		const baseline = pull.mock.calls.length;

		await expect(
			readJsonBody(request, { maxBytes: 1024 })
		).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", statusCode: 413 });
		expect(pull.mock.calls.length).toBe(baseline);
	});

	it("rejects once the running byte count crosses the cap, and never pulls chunks after the crossing one", async () => {
		const chunkText = "0123456789"; // 10 bytes
		const { request, pull } = chunkedRequest([chunkText, chunkText, chunkText]);

		await expect(readJsonBody(request, { maxBytes: 15 })).rejects.toMatchObject(
			{ code: "PAYLOAD_TOO_LARGE", statusCode: 413 }
		);
		// 1st chunk (10 bytes, under cap) then the 2nd (crosses 15) — the 3rd
		// chunk is never pulled.
		expect(pull).toHaveBeenCalledTimes(2);
	});

	it("rejects when Content-Length under-declares but the actual body exceeds the cap (lying header)", async () => {
		const { request } = chunkedRequest(["0".repeat(20)], {
			headers: { "content-length": "5" },
		});

		await expect(readJsonBody(request, { maxBytes: 10 })).rejects.toMatchObject(
			{ code: "PAYLOAD_TOO_LARGE" }
		);
	});

	it("parses a body exactly at the cap", async () => {
		const payload = JSON.stringify({ ok: true });
		const maxBytes = new TextEncoder().encode(payload).byteLength;
		const { request } = chunkedRequest([payload]);

		await expect(readJsonBody(request, { maxBytes })).resolves.toEqual({
			ok: true,
		});
	});

	it("passes at the exact byte boundary (maxBytes), split across multiple stream chunks", async () => {
		const digits = "1234567890123456"; // 16 bytes, a valid JSON number
		const maxBytes = new TextEncoder().encode(digits).byteLength;
		const { request } = chunkedRequest([digits.slice(0, 8), digits.slice(8)]);

		await expect(readJsonBody(request, { maxBytes })).resolves.toBe(
			1_234_567_890_123_456
		);
	});

	it("rejects one byte past the boundary (maxBytes + 1), split across multiple stream chunks", async () => {
		const digits = "12345678901234567"; // 17 bytes
		const maxBytes = new TextEncoder().encode(digits).byteLength - 1;
		const { request } = chunkedRequest([digits.slice(0, 8), digits.slice(8)]);

		await expect(readJsonBody(request, { maxBytes })).rejects.toMatchObject({
			code: "PAYLOAD_TOO_LARGE",
			statusCode: 413,
		});
	});

	it("resolves to undefined for an empty body", async () => {
		const request = new NextRequest(URL, { method: "POST" });

		await expect(readJsonBody(request)).resolves.toBeUndefined();
	});

	it("defaults to a 1 MiB cap when no maxBytes is given", () => {
		expect(DEFAULT_MAX_JSON_BODY_BYTES).toBe(1024 * 1024);
	});

	it("returns emptyBodyAs for a missing body when given, instead of undefined", async () => {
		const request = new NextRequest(URL, { method: "POST" });

		await expect(readJsonBody(request, { emptyBodyAs: {} })).resolves.toEqual(
			{}
		);
	});

	it("still returns undefined for a missing body when emptyBodyAs is not given", async () => {
		const request = new NextRequest(URL, { method: "POST" });

		await expect(readJsonBody(request)).resolves.toBeUndefined();
	});

	it("does not apply emptyBodyAs to a non-empty body that fails to parse as JSON", async () => {
		const { request } = chunkedRequest(["not json"]);

		await expect(
			readJsonBody(request, { emptyBodyAs: {} })
		).rejects.toMatchObject({
			code: "VALIDATION",
			message: "Request body must be valid JSON",
		});
	});

	it("throws a 400 validation error for malformed JSON", async () => {
		const { request } = chunkedRequest(["not json"]);

		await expect(readJsonBody(request)).rejects.toMatchObject({
			code: "VALIDATION",
			message: "Request body must be valid JSON",
		});
	});

	it("parses a JSON body regardless of a non-JSON declared Content-Type (the sendBeacon path)", async () => {
		const { request } = chunkedRequest(['{"ok":true}'], {
			headers: { "content-type": "text/plain" },
		});

		await expect(readJsonBody(request)).resolves.toEqual({ ok: true });
	});
});

describe("parseJsonBody", () => {
	const schema = z.strictObject({ name: z.string() });

	it("returns the schema's parsed data on success", async () => {
		const { request } = chunkedRequest([JSON.stringify({ name: "Ada" })]);

		await expect(parseJsonBody(request, schema)).resolves.toEqual({
			name: "Ada",
		});
	});

	it("throws a 400 validation error with the schema's first issue message on failure", async () => {
		const { request } = chunkedRequest([JSON.stringify({})]);

		await expect(parseJsonBody(request, schema)).rejects.toMatchObject({
			code: "VALIDATION",
			message: "Invalid input: expected string, received undefined",
		});
	});

	it("propagates a payloadTooLarge rejection from readJsonBody", async () => {
		const { request } = chunkedRequest(["0".repeat(50)]);

		await expect(
			parseJsonBody(request, schema, { maxBytes: 10 })
		).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
	});
});
