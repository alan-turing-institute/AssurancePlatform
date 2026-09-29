import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * A private- or public-media route's result: bytes to serve, or a reason to
 * refuse that a caller never has to distinguish in the response — a missing
 * file and a caller without access both become the identical empty 404
 * `mediaResponse` produces below.
 */
export type MediaFetchResult =
	| {
			status: "ok";
			data: Buffer;
			contentType: string;
			etag: string;
	  }
	| { status: "forbidden" | "not-found" };

function keyHash(key: string): string {
	return createHash("sha1").update(key).digest("hex");
}

/** A short, stable ETag derived from the storage key — the key changes with every upload, so this is exact. */
export function mediaEtag(key: string): string {
	return `"${keyHash(key)}"`;
}

/**
 * A short cache-busting token for a private-media route address's `?v=`
 * query — the first 12 hex characters of the same hash `mediaEtag` derives
 * from the key. Included in the route address a caller is shown so the
 * address itself changes on every re-upload, rather than staying the same
 * address a browser (or `next/image`, with `unoptimized`) has already
 * cached bytes for. The routes themselves ignore the query; it exists only
 * to change the address.
 */
export function mediaVersionToken(key: string): string {
	return keyHash(key).slice(0, 12);
}

/**
 * Serves a media-fetch result as raw bytes, outside the JSON envelope — like
 * the SSE and health routes. `forbidden` and `not-found` both become the
 * same empty 404: nothing about the response tells a caller which one
 * happened, so probing this route reveals nothing about whether the case or
 * the image exists. When `ifNoneMatch` matches the result's own ETag, the
 * bytes are withheld and a bare 304 is returned instead — the caller's
 * cached copy is already current.
 */
export function mediaResponse(
	result: MediaFetchResult,
	options?: { cacheControl?: string; ifNoneMatch?: string | null }
): NextResponse {
	if (result.status !== "ok") {
		return new NextResponse(null, { status: 404 });
	}

	const cacheControl = options?.cacheControl ?? "private, no-cache";

	if (options?.ifNoneMatch && options.ifNoneMatch === result.etag) {
		return new NextResponse(null, {
			status: 304,
			headers: { "Cache-Control": cacheControl, ETag: result.etag },
		});
	}

	// Buffer is a Uint8Array at runtime, but its generic type doesn't
	// structurally match `BodyInit` — wrapping it in a plain `Uint8Array`
	// satisfies the type without changing what's sent (images here are
	// capped at MAX_FILE_SIZE, so the copy this makes is small).
	return new NextResponse(new Uint8Array(result.data), {
		status: 200,
		headers: {
			"Content-Type": result.contentType,
			"Content-Length": String(result.data.byteLength),
			"X-Content-Type-Options": "nosniff",
			"Cache-Control": cacheControl,
			ETag: result.etag,
		},
	});
}
