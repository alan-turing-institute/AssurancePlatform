import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

/**
 * Drives next-auth's own credentials callback with plain request and response
 * objects, so a test sees what the browser is told: the redirect address that
 * carries the error, or the signed-in answer. The request headers are a plain
 * object with lower-case names, as next-auth hands them to `authorize`.
 */

const CSRF_COOKIE = "next-auth.csrf-token";
const SET_COOKIE = "set-cookie";

interface Sent {
	body: unknown;
	headers: Record<string, unknown>;
	status: number;
}

function fakeResponse(): { res: NextApiResponse; sent: Sent } {
	const sent: Sent = { status: 200, headers: {}, body: undefined };
	const res = {
		status(code: number) {
			sent.status = code;
			return res;
		},
		setHeader(name: string, value: unknown) {
			sent.headers[name.toLowerCase()] = value;
			return res;
		},
		getHeader(name: string) {
			return sent.headers[name.toLowerCase()];
		},
		json(body: unknown) {
			sent.body = body;
			return res;
		},
		send(body: unknown) {
			sent.body = body;
			return res;
		},
		end() {
			return res;
		},
	};
	return { res: res as unknown as NextApiResponse, sent };
}

async function call(request: {
	nextauth: string[];
	method: "GET" | "POST";
	body?: Record<string, string>;
	cookies?: Record<string, string>;
	headers?: Record<string, string>;
}): Promise<Sent> {
	const { res, sent } = fakeResponse();
	const req = {
		query: { nextauth: request.nextauth },
		body: request.body,
		cookies: request.cookies ?? {},
		headers: { host: "localhost:3000", ...request.headers },
		method: request.method,
	};
	await NextAuth(req as unknown as NextApiRequest, res, authOptions);
	return sent;
}

/** A form token and the cookie that goes with it, as the sign-in page gets them. */
async function csrf(): Promise<{ csrfToken: string; cookie: string }> {
	const sent = await call({ nextauth: ["csrf"], method: "GET" });
	const { csrfToken } = sent.body as { csrfToken: string };
	const [cookieHeader] = sent.headers[SET_COOKIE] as string[];
	const raw = (cookieHeader ?? "").split(";")[0]?.split("=")[1] ?? "";
	return { csrfToken, cookie: decodeURIComponent(raw) };
}

/**
 * Posts a password sign-in to next-auth's callback and returns the `error`
 * the browser's `signIn()` would report, or null when sign-in worked.
 */
export async function signInThroughNextAuth(
	username: string,
	password: string,
	headers: Record<string, string> = {}
): Promise<string | null> {
	const { csrfToken, cookie } = await csrf();
	const sent = await call({
		nextauth: ["callback", "credentials"],
		method: "POST",
		body: { csrfToken, username, password, json: "true" },
		cookies: { [CSRF_COOKIE]: cookie },
		headers,
	});
	const { url } = sent.body as { url: string };
	return new URL(url).searchParams.get("error");
}
