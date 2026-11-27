import { describe, expect, it } from "vitest";
import { readJsonWithin } from "../capped-json";

const encoder = new TextEncoder();

/** A response whose body arrives in the given chunks, and a record of whether the reader gave up. */
function chunked(chunks: Uint8Array[]) {
	const state = { cancelled: false };
	let next = 0;
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			const chunk = chunks[next];
			next += 1;
			if (chunk) {
				controller.enqueue(chunk);
			} else {
				controller.close();
			}
		},
		cancel() {
			state.cancelled = true;
		},
	});
	return { response: new Response(body), state };
}

/** A body of exactly `bytes` bytes that is valid JSON. */
function jsonOfSize(bytes: number): string {
	const overhead = JSON.stringify({ a: "" }).length;
	return JSON.stringify({ a: "x".repeat(bytes - overhead) });
}

async function failureOf(promise: Promise<unknown>): Promise<Error> {
	try {
		await promise;
	} catch (error) {
		return error as Error;
	}
	throw new Error("The read did not fail");
}

describe("readJsonWithin", () => {
	it("parses a body that arrives in several chunks", async () => {
		const bytes = encoder.encode(JSON.stringify({ list: [1, 2, 3], ok: true }));
		const { response } = chunked([
			bytes.slice(0, 5),
			bytes.slice(5, 11),
			bytes.slice(11),
		]);

		expect(await readJsonWithin(response, 1000)).toStrictEqual({
			list: [1, 2, 3],
			ok: true,
		});
	});

	it("keeps a character whose bytes are split between two chunks", async () => {
		const bytes = encoder.encode(JSON.stringify({ name: "café 🔑" }));
		for (let cut = 1; cut < bytes.length; cut += 1) {
			const { response } = chunked([bytes.slice(0, cut), bytes.slice(cut)]);
			expect(await readJsonWithin(response, 1000)).toStrictEqual({
				name: "café 🔑",
			});
		}
	});

	it("accepts a body of exactly the cap, in one chunk or several", async () => {
		const bytes = encoder.encode(jsonOfSize(100));
		expect(bytes.length).toBe(100);

		const whole = chunked([bytes]).response;
		expect(await readJsonWithin(whole, 100)).toHaveProperty("a");

		const split = chunked([bytes.slice(0, 60), bytes.slice(60)]).response;
		expect(await readJsonWithin(split, 100)).toHaveProperty("a");
	});

	it("refuses a body one byte over the cap, and stops reading it", async () => {
		const bytes = encoder.encode(jsonOfSize(101));
		const { response, state } = chunked([bytes]);

		const error = await failureOf(readJsonWithin(response, 100));

		expect(error).toBeInstanceOf(Error);
		expect(error).not.toBeInstanceOf(SyntaxError);
		expect(state.cancelled).toBe(true);
	});

	it("refuses a body that passes the cap only with its last chunk", async () => {
		const bytes = encoder.encode(jsonOfSize(101));
		const { response, state } = chunked([
			bytes.slice(0, 50),
			bytes.slice(50, 100),
			bytes.slice(100),
		]);

		const error = await failureOf(readJsonWithin(response, 100));

		expect(error).not.toBeInstanceOf(SyntaxError);
		expect(state.cancelled).toBe(true);
	});

	it("does not read an endless body to its end", async () => {
		const state = { chunks: 0, cancelled: false };
		const endless = new ReadableStream<Uint8Array>({
			pull(controller) {
				state.chunks += 1;
				controller.enqueue(new Uint8Array(1024));
			},
			cancel() {
				state.cancelled = true;
			},
		});

		const error = await failureOf(
			readJsonWithin(new Response(endless), 10 * 1024)
		);

		expect(error).not.toBeInstanceOf(SyntaxError);
		expect(state.cancelled).toBe(true);
		expect(state.chunks).toBeLessThan(50);
	});

	it("throws a syntax error, not the size error, for a body that is not JSON", async () => {
		const { response } = chunked([encoder.encode("<html>not json</html>")]);

		const error = await failureOf(readJsonWithin(response, 1000));

		expect(error).toBeInstanceOf(SyntaxError);
	});

	it("leaves a response with no body stream to the response's own JSON reader", async () => {
		const error = await failureOf(
			readJsonWithin(new Response(null, { status: 200 }), 1000)
		);

		expect(error).toBeInstanceOf(SyntaxError);
	});
});
