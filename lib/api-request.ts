import type { z } from "zod";
import { payloadTooLarge, validationError } from "@/lib/errors";

/**
 * Default cap for a JSON request body. Matches Next's own server-action
 * default (`serverActions.bodySizeLimit`) and nginx's default
 * `client_max_body_size`, so a self-hoster behind a reverse proxy gets one
 * consistent story — see `content/technical-guide/deployment/docker-production.mdx`.
 */
export const DEFAULT_MAX_JSON_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB

/**
 * Per-route overrides for the few bodies that are legitimately larger than
 * the default cap. Named constants, not magic numbers scattered across
 * route files — see the "Request body size guard" issue's Design §3 for
 * why each figure was chosen.
 */
export const JSON_BODY_LIMITS = {
	caseImport: 10 * 1024 * 1024, // a whole case document
	batchUpdate: 5 * 1024 * 1024, // up to 1000 changes, each up to 5000 chars
	caseImage: 10 * 1024 * 1024, // base64 PNG of the canvas
} as const;

/**
 * Reads a JSON request body with a byte cap, before the body is ever
 * parsed. Throws `payloadTooLarge()` (413) if the body exceeds `maxBytes`,
 * or `validationError()` (400) if what is read is not valid JSON. Resolves
 * to `undefined` for a missing or empty body — callers that treat an
 * absent body as "use defaults" (e.g. `POST /api/cases/[id]/publish`) rely
 * on this.
 *
 * Enforcement has two layers, because either alone can be defeated by a
 * client:
 *  1. If `Content-Length` is present and already declares more than
 *     `maxBytes`, reject immediately without reading a single byte of the
 *     body.
 *  2. Otherwise, read the body stream in chunks, keeping a running byte
 *     count, and cancel the stream the moment the count passes `maxBytes`.
 *     This is what actually enforces the cap: a client can omit
 *     `Content-Length` (chunked transfer) or send a lying value, and step 1
 *     alone would let either through.
 *
 * Deliberately does not look at `Content-Type` — the canvas auto-screenshot
 * beacon (`hooks/use-auto-screenshot.ts`) sends its JSON body via
 * `navigator.sendBeacon`, which the browser labels `text/plain`.
 */
export async function readJsonBody(
	request: Request,
	options?: { maxBytes?: number }
): Promise<unknown> {
	const maxBytes = options?.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;

	const declaredLength = request.headers.get("content-length");
	if (declaredLength !== null) {
		const declared = Number(declaredLength);
		if (Number.isFinite(declared) && declared > maxBytes) {
			throw payloadTooLarge();
		}
	}

	if (!request.body) {
		return undefined;
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let receivedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		receivedBytes += value.byteLength;
		if (receivedBytes > maxBytes) {
			await reader.cancel();
			throw payloadTooLarge();
		}
		chunks.push(value);
	}

	if (receivedBytes === 0) {
		return undefined;
	}

	const bytes = new Uint8Array(receivedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const text = new TextDecoder("utf-8").decode(bytes);

	try {
		return JSON.parse(text);
	} catch {
		throw validationError("Request body must be valid JSON");
	}
}

/**
 * `readJsonBody` followed by `schema.safeParse`. Throws `validationError()`
 * with the schema's own first-issue message on failure — the same message
 * routes surface today via `schema.safeParse(...).error.issues[0]?.message`.
 */
export async function parseJsonBody<S extends z.ZodType>(
	request: Request,
	schema: S,
	options?: { maxBytes?: number }
): Promise<z.output<S>> {
	const raw = await readJsonBody(request, options);
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		throw validationError(parsed.error.issues[0]?.message ?? "Invalid input");
	}
	return parsed.data;
}
