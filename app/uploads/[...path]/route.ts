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

function serverError(): NextResponse {
	return new NextResponse(null, { status: 500 });
}

/**
 * Opens a read stream and waits for it to actually open (or fail) before
 * returning. `stat()` succeeding is not a guarantee the file is still there
 * by the time we read it — it can be deleted, or become unreadable, in the
 * window between the two calls. Resolving/rejecting on the stream's `open`/
 * `error` event (rather than handing back a lazily-opened stream) lets the
 * caller still choose a clean status code for that race, because nothing has
 * been written to the response yet.
 */
async function openReadStream(
	filePath: string
): Promise<ReturnType<typeof createReadStream>> {
	return await new Promise((resolvePromise, rejectPromise) => {
		const readStream = createReadStream(filePath);
		const onError = (err: unknown) => {
			readStream.destroy();
			rejectPromise(err);
		};
		readStream.once("error", onError);
		readStream.once("open", () => {
			readStream.off("error", onError);
			resolvePromise(readStream);
		});
	});
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

	let nodeStream: Awaited<ReturnType<typeof openReadStream>>;
	try {
		nodeStream = await openReadStream(filePath);
	} catch (err) {
		// Opening still failed even though stat() just succeeded — most
		// commonly the file was deleted in between. Nothing has been sent to
		// the client yet, so we can still return a clean status instead of
		// letting the stream surface an unhandled error later.
		const code = (err as NodeJS.ErrnoException).code;
		return code === "ENOENT" ? notFound() : serverError();
	}

	// From here on the stream is open and NextResponse below commits status
	// 200 — headers are sent as soon as the framework starts consuming the
	// body, so a failure past this point (e.g. a mid-read disk error) can no
	// longer change the status code. Without an error listener, that failure
	// would be an unhandled 'error' event; the best we can do is destroy the
	// stream so the connection aborts/truncates instead of hanging or
	// crashing the process.
	nodeStream.on("error", (err) => {
		// No structured logger exists in this codebase yet (CLAUDE.md names
		// one; other server code paths without one use console.error too) —
		// this is the same prevailing pattern, not a deviation introduced
		// here.
		console.error("[uploads] stream error after response started:", err);
		nodeStream.destroy();
	});

	const contentType = getMimeTypeFromExtension(extname(filePath));
	const stream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

	return new NextResponse(stream, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(fileStat.size),
			"X-Content-Type-Options": "nosniff",
			// Every upload is written under a freshly-minted URL (a random
			// UUID on the /information/image path, a caseId+timestamp on the
			// screenshot local-fallback path) — whichever scheme, a given
			// URL's content never changes, so it's safe to cache
			// aggressively.
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
