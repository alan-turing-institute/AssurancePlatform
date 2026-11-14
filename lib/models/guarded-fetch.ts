import { lookup as systemLookup } from "node:dns";
import { isIP, type LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { isBlockedAddress } from "@/lib/models/address-checks";
import { listLocalOrigins } from "@/lib/models/local-addresses";

/** The longest a whole exchange may take, streamed body included, when the caller sets no tighter limit. */
const DEFAULT_TIMEOUT_MS = 600_000;
/** The most bytes of response body read when the caller sets no tighter limit; sized for a streamed chat reply. */
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_CAUSE_DEPTH = 5;
const REDIRECT_REASON = "unexpected redirect";

/**
 * One text for an address that was refused and for one that could not be
 * reached. A name that resolves to a private address and a name that does not
 * resolve at all must look the same to the person who typed it, or the
 * connection test would tell them which internal names exist.
 */
export const NOT_REACHABLE_MESSAGE =
	"The model address could not be reached or is not allowed.";

const REASONS = {
	"invalid-url": "The model address is not a valid URL.",
	"unsupported-input": "Only a URL or a string can be fetched.",
	"credentials-in-url":
		"The model address must not contain a user name or password.",
	"insecure-url": "The model address must use https.",
	"blocked-address": NOT_REACHABLE_MESSAGE,
	redirect: "The model server answered with a redirect, which is not followed.",
	"response-too-large":
		"The model server's response is larger than the allowed size.",
	timeout: "The model server did not answer in time.",
	"request-failed": NOT_REACHABLE_MESSAGE,
	"invalid-response": "The model server's response could not be used.",
} as const;

export type GuardedFetchErrorCode = keyof typeof REASONS;

/**
 * Why the guard refused or cut off a request. The message is fixed text for
 * the code and never includes the address, headers or body, so it is safe to
 * log and to show.
 */
export class GuardedFetchError extends Error {
	readonly code: GuardedFetchErrorCode;

	constructor(code: GuardedFetchErrorCode) {
		super(REASONS[code]);
		this.name = "GuardedFetchError";
		this.code = code;
	}
}

export interface GuardedFetchOptions {
	/** Replaces the system resolver, so tests need no real DNS. */
	lookup?: LookupFunction;
	/** The most response-body bytes to read before the request is cut off. */
	maxBytes?: number;
	/** The longest the whole exchange may take, in milliseconds. */
	timeoutMs?: number;
}

/**
 * undici's fetch takes the same arguments and returns the same kind of
 * response as the platform's, but the package declares its own types for them,
 * which TypeScript does not treat as the platform's. This is the one place
 * the platform types are applied to it; `dispatcher` is how it is told which
 * agent to connect with.
 */
const fetchThrough = undiciFetch as unknown as (
	input: string,
	init: RequestInit & { dispatcher: Agent }
) => Promise<Response>;

type BlockCheck = (address: string) => boolean;

const allowEverything: BlockCheck = () => false;

/**
 * Wraps a resolver so that it resolves every address of a name once and
 * refuses the connection when any of them is blocked. The connection is made
 * to the addresses this returns, so a second DNS answer cannot redirect it.
 */
function createCheckedLookup(
	resolve: LookupFunction,
	isBlocked: BlockCheck = isBlockedAddress
): LookupFunction {
	return (hostname, options, callback) => {
		resolve(hostname, { ...options, all: true }, (error, resolved, family) => {
			if (error) {
				callback(error, []);
				return;
			}
			const addresses = Array.isArray(resolved)
				? resolved
				: [{ address: resolved, family: family ?? 0 }];
			const [first] = addresses;
			if (!first || addresses.some(({ address }) => isBlocked(address))) {
				callback(new GuardedFetchError("blocked-address"), []);
				return;
			}
			if (options.all === true) {
				callback(null, addresses);
			} else {
				callback(null, first.address, first.family);
			}
		});
	};
}

/** An undici Agent whose every connection goes to an address that `createCheckedLookup` approved. */
export function createGuardedAgent(
	resolve: LookupFunction,
	isBlocked: BlockCheck = isBlockedAddress
): Agent {
	return new Agent({
		connect: { lookup: createCheckedLookup(resolve, isBlocked) },
	});
}

/**
 * Ends an agent once, either by letting it finish what it has (`close`) or by
 * dropping its sockets at once (`destroy`). Calling it again does nothing.
 */
type ReleaseAgent = (how: "close" | "destroy") => void;

/**
 * An agent for one request, and the function that ends it. undici keeps one
 * connection pool per origin in an agent and never removes it, so a shared
 * agent would collect a pool for every address a user ever entered. One agent
 * per call goes away with the call, and costs one new connection per request.
 */
function agentForOneCall(
	resolve: LookupFunction,
	isBlocked: BlockCheck
): { agent: Agent; release: ReleaseAgent } {
	const agent = createGuardedAgent(resolve, isBlocked);
	let released = false;
	const release: ReleaseAgent = (how) => {
		if (released) {
			return;
		}
		released = true;
		const ending = how === "close" ? agent.close() : agent.destroy();
		ending.catch(() => undefined);
	};
	return { agent, release };
}

function parseUrl(input: RequestInfo | URL): URL {
	let text: string | undefined;
	if (typeof input === "string") {
		text = input;
	} else if (input instanceof URL) {
		text = input.href;
	}
	if (text === undefined) {
		throw new GuardedFetchError("unsupported-input");
	}
	if (!URL.canParse(text)) {
		throw new GuardedFetchError("invalid-url");
	}
	const url = new URL(text);
	if (url.username || url.password) {
		throw new GuardedFetchError("credentials-in-url");
	}
	return url;
}

/**
 * The rules for an address that is not on the operator's list: https only, and
 * a literal IP address is checked here because the connection step skips name
 * resolution for it. A name is checked when it is resolved.
 */
function requirePublicTarget(url: URL): void {
	if (url.protocol !== "https:") {
		throw new GuardedFetchError("insecure-url");
	}
	if (isLiteralAddress(url.hostname) && isBlockedAddress(url.hostname)) {
		throw new GuardedFetchError("blocked-address");
	}
}

/**
 * True for a host that is an IP address, which the connection step connects to
 * without resolving a name. It is the same test Node applies before it skips
 * the lookup; the URL parser writes an IPv6 host in brackets.
 */
function isLiteralAddress(hostname: string): boolean {
	const bare =
		hostname.startsWith("[") && hostname.endsWith("]")
			? hostname.slice(1, -1)
			: hostname;
	return isIP(bare) !== 0;
}

/** The guard's own refusal inside a failed request, a redirect reported by undici, or a timeout. */
function refusalFrom(
	error: unknown,
	timeout: AbortSignal,
	caller: AbortSignal | null | undefined
): GuardedFetchError | undefined {
	let current: unknown = error;
	for (
		let depth = 0;
		current instanceof Error && depth < MAX_CAUSE_DEPTH;
		depth += 1
	) {
		if (current instanceof GuardedFetchError) {
			return current;
		}
		if (current.message === REDIRECT_REASON) {
			return new GuardedFetchError("redirect");
		}
		current = current.cause;
	}
	if (timeout.aborted && !caller?.aborted) {
		return new GuardedFetchError("timeout");
	}
	return undefined;
}

/**
 * Passes the body through until it exceeds `maxBytes`, then errors the stream
 * and cancels the request. The request's agent is ended when the body ends,
 * fails or is cancelled.
 */
function limitBody(
	body: ReadableStream<Uint8Array>,
	maxBytes: number,
	translate: (error: unknown) => unknown,
	release: ReleaseAgent
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	let received = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
					release("close");
					return;
				}
				received += value.byteLength;
				if (received > maxBytes) {
					const refusal = new GuardedFetchError("response-too-large");
					controller.error(refusal);
					await reader.cancel(refusal).catch(() => undefined);
					release("destroy");
					return;
				}
				controller.enqueue(value);
			} catch (error) {
				controller.error(translate(error));
				release("destroy");
			}
		},
		async cancel(reason) {
			try {
				await reader.cancel(reason);
			} finally {
				release("destroy");
			}
		},
	});
}

/**
 * Fetches a model server on the user's behalf, for use as the `fetch` of an AI
 * SDK provider. Unless the URL's origin is on `TEA_MODELS_LOCAL_ADDRESSES`:
 * the URL must be https, and the connection is refused when the name resolves
 * to any loopback, private, link-local, shared, unspecified, multicast or
 * reserved address. A redirect is never followed. The caller's `signal` and a
 * timeout both end the request, and a response body larger than the byte cap
 * is cut off. Every refusal is a `GuardedFetchError`. Each call connects with
 * its own agent, which is closed when the response body ends and dropped when
 * the call fails, the body is cancelled or errors, or the time limit passes.
 */
export async function guardedFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
	options: GuardedFetchOptions = {}
): Promise<Response> {
	const url = parseUrl(input);
	const isListed = listLocalOrigins().includes(url.origin);
	if (!isListed) {
		requirePublicTarget(url);
	}
	const { agent: dispatcher, release: releaseAgent } = agentForOneCall(
		options.lookup ?? systemLookup,
		isListed ? allowEverything : isBlockedAddress
	);

	const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
	const caller = init?.signal;
	const signal = caller ? AbortSignal.any([caller, timeout]) : timeout;
	// The timeout and the caller's abort also end the agent, so a body that is
	// never read does not keep its connection past the time limit.
	const onAbort = () => releaseAgent("destroy");
	signal.addEventListener("abort", onAbort, { once: true });
	const release: ReleaseAgent = (how) => {
		signal.removeEventListener("abort", onAbort);
		releaseAgent(how);
	};
	// A failure the guard did not cause is replaced by fixed text, because the
	// original can quote a header value or the address. Only the caller's own
	// abort is passed on as it was raised.
	const translate = (error: unknown): unknown => {
		const refusal = refusalFrom(error, timeout, caller);
		if (refusal) {
			return refusal;
		}
		return caller?.aborted ? error : new GuardedFetchError("request-failed");
	};

	let response: Response;
	try {
		response = await fetchThrough(url.href, {
			...init,
			dispatcher,
			redirect: "error",
			signal,
		});
	} catch (error) {
		release("destroy");
		throw translate(error);
	}

	const maxBytes = options.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
	const { body } = response;
	if (!body) {
		release("close");
		return response;
	}
	if (Number(response.headers.get("content-length")) > maxBytes) {
		await body.cancel().catch(() => undefined);
		release("destroy");
		throw new GuardedFetchError("response-too-large");
	}
	const limited = limitBody(body, maxBytes, translate, release);
	try {
		return new Response(limited, {
			status: response.status,
			statusText: response.statusText,
			headers: Array.from(response.headers.entries()),
		});
	} catch {
		// A status code or reason phrase that a Response cannot hold.
		await limited.cancel().catch(() => undefined);
		throw new GuardedFetchError("invalid-response");
	}
}
