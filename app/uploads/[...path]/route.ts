import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getMimeTypeFromExtension } from "@/lib/services/blob-storage-service";

/**
 * Serves locally-stored uploads (self-hosted / `USE_LOCAL_STORAGE=true`
 * deployments) at runtime.
 *
 * Next's standalone production server serves `public/` from a filesystem
 * path set it computes once at startup, so files written to
 * `public/uploads/` *after* the process has started 404 until the next
 * restart — verified empirically (file present on disk, URL 404, restart
 * flips it to 200). This route handler is a fallback: Next's static-file
 * check runs before app routing and still wins for anything present at
 * startup (unchanged behaviour), but for a path that check misses, the
 * request falls through to here and we stream the file straight off disk,
 * so uploads work without a restart.
 *
 * Not run through the envelope pattern (`apiSuccess`/`apiError`) — like the
 * SSE and health routes, this serves a binary payload, not JSON.
 */

const UPLOAD_ROOT = resolve(process.cwd(), "public", "uploads");

interface RouteParams {
	params: Promise<{ path: string[] }>;
}

/**
 * Resolves the requested path segments to an absolute filesystem path,
 * rejecting anything that could escape `UPLOAD_ROOT` — traversal segments
 * (`..`, `.`), empty segments, and segments carrying a raw separator or NUL
 * byte (which would only appear via a doubly-encoded or malformed path,
 * since Next has already URL-decoded each segment by this point). Returns
 * `null` for anything rejected, and re-checks containment on the resolved
 * path as a second, independent guard.
 */
function resolveSafePath(segments: string[]): string | null {
	if (segments.length === 0) {
		return null;
	}

	for (const segment of segments) {
		if (
			!segment ||
			segment === "." ||
			segment === ".." ||
			segment.includes("/") ||
			segment.includes("\\") ||
			segment.includes("\0")
		) {
			return null;
		}
	}

	const candidate = resolve(UPLOAD_ROOT, ...segments);
	const isWithinRoot =
		candidate === UPLOAD_ROOT || candidate.startsWith(UPLOAD_ROOT + sep);

	return isWithinRoot ? candidate : null;
}

function notFound(): NextResponse {
	return new NextResponse(null, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
	const { path: segments } = await params;
	const filePath = resolveSafePath(segments);

	if (!filePath) {
		return notFound();
	}

	let fileStat: Awaited<ReturnType<typeof stat>>;
	try {
		fileStat = await stat(filePath);
	} catch {
		return notFound();
	}

	if (!fileStat.isFile()) {
		return notFound();
	}

	const contentType = getMimeTypeFromExtension(extname(filePath));
	const stream = Readable.toWeb(
		createReadStream(filePath)
	) as ReadableStream<Uint8Array>;

	return new NextResponse(stream, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(fileStat.size),
			// Uploaded filenames are randomUUID-based, so a given URL's
			// content never changes; safe to cache aggressively.
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
