/**
 * Reads from the techniques service. Its address is the operator's own, so it
 * is fetched directly rather than through the guard that protects
 * user-chosen addresses; this cap is what stops a faulty or compromised
 * service from answering with a body too large to hold.
 */

/** The most bytes read from one answer of the techniques service, a spec or a search. */
export const TECHNIQUES_SERVICE_MAX_BYTES = 1024 * 1024;

/** The answer was larger than the cap. */
export class ResponseTooLargeError extends Error {
	constructor() {
		super("The response is larger than the allowed size.");
		this.name = "ResponseTooLargeError";
	}
}

/**
 * Parses the response body as JSON, reading no more than `maxBytes`: the read
 * stops and the request is cancelled as soon as the cap is passed, and
 * `ResponseTooLargeError` is thrown. A response with no body stream has no
 * bytes to count and is left to `response.json()`.
 */
export async function readJsonWithin(
	response: Response,
	maxBytes: number
): Promise<unknown> {
	const { body } = response;
	if (!body) {
		return await response.json();
	}
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let text = "";
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		received += value.byteLength;
		if (received > maxBytes) {
			await reader.cancel().catch(() => undefined);
			throw new ResponseTooLargeError();
		}
		text += decoder.decode(value, { stream: true });
	}
	return JSON.parse(text + decoder.decode());
}
