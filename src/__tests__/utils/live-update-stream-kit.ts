import { GET } from "@/app/api/cases/[id]/events/route";
import { mockAuth } from "./auth-helpers";

/** The longest time between two heartbeats on a stream. */
export const HEARTBEAT_MS = 30_000;

const EVENT_LINE = /^event: (.+)$/gm;
const DATA_LINE = /^data: (.+)$/m;
const HEARTBEAT_CHUNK = ": heartbeat\n\n";
const CLOSING_EVENT = "stream:closed";

/** One open live-update stream, as the browser on the other end sees it. */
export interface Viewer {
	abort: () => void;
	cancel: () => Promise<void>;
	caseId: string;
	/** Every chunk the server wrote, in order. */
	chunks: string[];
	isClosed: () => boolean;
	userId: string;
}

/**
 * Opens a stream through the real events route and reads it in the
 * background. `authenticate` makes the session mock answer for `userId`.
 */
export async function openViewer(
	userId: string,
	caseId: string,
	authenticate: (userId: string) => Promise<void> = (id) => mockAuth(id)
): Promise<Viewer> {
	const abortController = new AbortController();
	const request = new Request(
		`http://localhost:3000/api/cases/${caseId}/events`,
		{ signal: abortController.signal }
	);
	await authenticate(userId);
	const response = await GET(request, {
		params: Promise.resolve({ id: caseId }),
	});
	if (response.status !== 200 || !response.body) {
		throw new Error(`Expected an open stream, got ${response.status}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let closed = false;
	const pump = async () => {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) {
				closed = true;
				return;
			}
			chunks.push(decoder.decode(value));
		}
	};
	pump().catch(() => {
		closed = true;
	});

	return {
		userId,
		caseId,
		chunks,
		isClosed: () => closed,
		abort: () => abortController.abort(),
		cancel: () => reader.cancel().catch(() => undefined),
	};
}

/** The status the events route answers a request to open a stream with. */
export async function openStatus(
	userId: string,
	caseId: string,
	authenticate: (userId: string) => Promise<void> = (id) => mockAuth(id)
): Promise<number> {
	const abortController = new AbortController();
	await authenticate(userId);
	const response = await GET(
		new Request(`http://localhost:3000/api/cases/${caseId}/events`, {
			signal: abortController.signal,
		}),
		{ params: Promise.resolve({ id: caseId }) }
	);
	if (response.status === 200) {
		abortController.abort();
		await response.body?.cancel().catch(() => undefined);
	}
	return response.status;
}

export const heartbeatsSeen = (viewer: Viewer): number =>
	viewer.chunks.filter((chunk) => chunk === HEARTBEAT_CHUNK).length;

/** The names of the events the viewer has received, in order. */
export const eventsSeen = (viewer: Viewer): string[] =>
	viewer.chunks.flatMap((chunk) =>
		[...chunk.matchAll(EVENT_LINE)].flatMap((match) =>
			match[1] ? [match[1]] : []
		)
	);

/** The reason in the closing event the viewer received, or null if none. */
export function closingReason(viewer: Viewer): string | null {
	const chunk = viewer.chunks.find((candidate) =>
		candidate.startsWith(`event: ${CLOSING_EVENT}\n`)
	);
	const data = chunk ? DATA_LINE.exec(chunk)?.[1] : undefined;
	return data ? (JSON.parse(data) as { reason: string }).reason : null;
}

/** True when the viewer's last chunk is the closing event. */
export const endsWithClosingEvent = (viewer: Viewer): boolean =>
	viewer.chunks.at(-1)?.startsWith(`event: ${CLOSING_EVENT}\n`) ?? false;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Lets queued promise work and I/O callbacks run. */
export async function flushAll(rounds = 6): Promise<void> {
	for (let i = 0; i < rounds; i += 1) {
		await flush();
	}
}

/** Polls, in real time, until `condition` holds. */
export async function until(
	condition: () => boolean | Promise<boolean>,
	what: string,
	timeoutMs = 5000
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!(await condition())) {
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for ${what}`);
		}
		await new Promise<void>((resolve) => setTimeout(resolve, 5));
	}
}

/** A promise that is settled by hand. */
export function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
