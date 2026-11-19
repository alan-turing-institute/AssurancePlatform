import {
	type NextFetchEvent,
	NextRequest,
	type NextResponse,
} from "next/server";
import type { NextRequestWithAuth } from "next-auth/middleware";
import proxy from "@/proxy";

/**
 * Helpers for driving `proxy.ts` the way the server does: the URL carries the
 * address the server itself listens on, and the `Host` header carries the
 * address the visitor used.
 */

export const MAIN = "https://main.example.test";
export const MAIN_HOST = "main.example.test";
export const OLD_HOST = "old.example.test";
export const LISTENING = "http://localhost:8080";

export const PASSES_THROUGH = { status: 200, location: null };

export interface RequestOptions {
	headers?: Record<string, string>;
	host?: string | null;
	method?: string;
	signedIn?: boolean;
}

export type Settled = NextResponse | Response | undefined;

function buildRequest(path: string, options: RequestOptions): NextRequest {
	const { host = OLD_HOST, method = "GET", signedIn = true } = options;
	const headers: Record<string, string> = { ...options.headers };
	if (host !== null) {
		headers.host = host;
	}
	if (signedIn) {
		headers["x-test-signed-in"] = "1";
	}
	return new NextRequest(`${LISTENING}${path}`, { method, headers });
}

/** Sends one request through the proxy. A visitor is signed in unless the options say otherwise. */
export async function run(
	path: string,
	options: RequestOptions = {}
): Promise<Settled> {
	const request = buildRequest(path, options) as NextRequestWithAuth;
	// The proxy's declared result also admits `void`; it only ever answers or returns nothing.
	const answer = (await proxy(request, {} as NextFetchEvent)) as Settled | null;
	return answer ?? undefined;
}

/** Status and Location of what the proxy answered; no answer means the request carries on to the page. */
export function outcome(response: Settled): {
	status: number;
	location: string | null;
} {
	return {
		status: response?.status ?? 200,
		location: response?.headers.get("location") ?? null,
	};
}

export function permanentRedirect(location: string): {
	status: number;
	location: string;
} {
	return { status: 308, location };
}

/** Where the proxy sent the request, as a URL. */
export function targetOf(response: Settled): URL {
	return new URL(response?.headers.get("location") ?? "about:blank");
}

/** The path and query a URL parser keeps for a request path. */
export function normalised(path: string): string {
	const url = new URL(`${LISTENING}${path}`);
	return `${url.pathname}${url.search}`;
}
