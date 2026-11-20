import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The sign-in route is called through its own exported handlers with the real
 * NextAuth handler behind it, so what a request makes GitHub's address look
 * like is observed end to end.
 */
vi.hoisted(() => {
	process.env.GITHUB_APP_CLIENT_ID = "scope-route-client-id";
	process.env.GITHUB_APP_CLIENT_SECRET = "scope-route-client-secret";
	process.env.NEXTAUTH_URL = "http://localhost:3000";
	process.env.NEXTAUTH_SECRET = "github-sign-in-scope-route-test-secret";
});

const { requestState } = vi.hoisted(() => ({
	requestState: { cookie: "" },
}));

/**
 * The library's route-handler entry needs Next's request scope, which a unit
 * run does not have. Its API-route entry is the same code path underneath, so
 * the handler the route builds is bridged onto that entry with the request's
 * query, form body and cookies.
 */
vi.mock("next-auth", async (importOriginal) => {
	const original = await importOriginal<typeof import("next-auth")>();
	const bridge = (options: Parameters<typeof original.default>[0]) =>
		async function handler(
			request: NextRequest,
			context: { params: Promise<{ nextauth: string[] }> }
		) {
			const { nextauth } = await context.params;
			const form = new URLSearchParams(await request.text());
			const cookies = Object.fromEntries(
				requestState.cookie
					.split("; ")
					.filter(Boolean)
					.map((pair) => {
						const at = pair.indexOf("=");
						return [pair.slice(0, at), decodeURIComponent(pair.slice(at + 1))];
					})
			);
			const req = {
				method: request.method,
				query: {
					...Object.fromEntries(request.nextUrl.searchParams),
					nextauth,
				},
				body: Object.fromEntries(form),
				cookies,
				headers: { host: "localhost:3000" },
			};
			return runLibrary(original.default, req, options);
		};
	return { ...original, default: bridge };
});

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

interface LibraryResult {
	body: unknown;
	headers: Headers;
	status: number;
}

async function runLibrary(
	library: (...args: never[]) => unknown,
	req: object,
	options: unknown
): Promise<Response> {
	const result: LibraryResult = {
		body: undefined,
		headers: new Headers(),
		status: 200,
	};
	const res = {
		status(code: number) {
			result.status = code;
			return res;
		},
		setHeader(name: string, value: string | string[]) {
			for (const item of [value].flat()) {
				result.headers.append(name, String(item));
			}
			return res;
		},
		getHeader: (name: string) => result.headers.get(name),
		json(body: unknown) {
			result.body = JSON.stringify(body);
		},
		send(body: unknown) {
			result.body = typeof body === "string" ? body : JSON.stringify(body);
		},
		end() {
			return res;
		},
	};
	await (library as (...a: unknown[]) => Promise<unknown>)(req, res, options);
	return new Response(result.status === 302 ? null : (result.body as string), {
		status: result.status,
		headers: result.headers,
	});
}

const BASE = "http://localhost:3000/api/auth";
const DEFAULT_SCOPE = "read:user user:email";
const GITHUB_AUTHORISE = "https://github.com/login/oauth/authorize";
const SCOPE_NAMES = ["scope", "%73cope", "sc%6Fpe"];

interface Csrf {
	cookie: string;
	csrfToken: string;
}

function params(path: string) {
	return { params: Promise.resolve({ nextauth: path.split("/") }) };
}

function cookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((header) => header.split(";")[0])
		.join("; ");
}

async function csrf(): Promise<Csrf> {
	requestState.cookie = "";
	const response = await GET(new NextRequest(`${BASE}/csrf`), params("csrf"));
	const { csrfToken } = (await response.json()) as { csrfToken: string };
	return { csrfToken, cookie: cookieHeader(response) };
}

async function post(
	path: string,
	query: string,
	extraBody: Record<string, string> = {}
): Promise<Response> {
	const { csrfToken, cookie } = await csrf();
	requestState.cookie = cookie;
	return POST(
		new NextRequest(`${BASE}/${path}${query}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				cookie,
			},
			body: new URLSearchParams({
				csrfToken,
				callbackUrl: "/dashboard",
				...extraBody,
			}),
		}),
		params(path)
	);
}

function authoriseScope(response: Response): string | null {
	const location = response.headers.get("location");
	if (!location?.startsWith(GITHUB_AUTHORISE)) {
		return null;
	}
	return new URL(location).searchParams.get("scope");
}

function wentToGitHubWithWiderScope(response: Response): boolean {
	const scope = authoriseScope(response);
	return scope !== null && scope !== DEFAULT_SCOPE;
}

describe("POST /api/auth/signin/github with a scope in the query", () => {
	it.each(
		SCOPE_NAMES
	)("refuses the name %s with 400 and no redirect", async (name) => {
		const response = await post("signin/github", `?${name}=repo`);

		expect(response.status).toBe(400);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.getSetCookie()).toEqual([]);
	});

	it("refuses an empty scope", async () => {
		expect((await post("signin/github", "?scope=")).status).toBe(400);
	});

	it("refuses a scope that sits among other parameters", async () => {
		const response = await post(
			"signin/github",
			"?callbackUrl=%2Fdashboard&scope=repo&x=1"
		);

		expect(response.status).toBe(400);
	});

	it("refuses a repeated scope", async () => {
		const response = await post("signin/github", "?scope=read:user&scope=repo");

		expect(response.status).toBe(400);
	});

	it("answers in the standard error shape", async () => {
		const body = await (await post("signin/github", "?scope=repo")).json();

		expect(body).toMatchObject({ code: "VALIDATION" });
		expect(typeof body.error).toBe("string");
	});
});

describe("a request without a scope query", () => {
	it("still starts GitHub sign-in with the profile and email scopes", async () => {
		const response = await post("signin/github", "");

		expect(authoriseScope(response)).toBe(DEFAULT_SCOPE);
	});

	it("keeps the default scope when the form body names a scope", async () => {
		const response = await post("signin/github", "", { scope: "repo" });

		expect(authoriseScope(response)).toBe(DEFAULT_SCOPE);
	});

	it.each([
		"?SCOPE=repo",
		"?Scope=repo",
		"?scopes=repo",
		"?scope[]=repo",
		"?x-scope=repo",
	])("keeps the default scope for the near miss %s", async (query) => {
		const response = await post("signin/github", query);

		expect(authoriseScope(response)).toBe(DEFAULT_SCOPE);
	});

	it.each([
		"signin/GitHub",
		"signin/GITHUB",
		"Signin/github",
	])("never reaches GitHub with a wider scope through the path %s", async (path) => {
		const response = await post(path, "?scope=repo");

		expect(wentToGitHubWithWiderScope(response)).toBe(false);
	});
});

describe("other requests carrying a scope", () => {
	it("does not let GET start GitHub sign-in with a scope", async () => {
		requestState.cookie = "";
		const response = await GET(
			new NextRequest(`${BASE}/signin/github?scope=repo`),
			params("signin/github")
		);

		expect(wentToGitHubWithWiderScope(response)).toBe(false);
		expect(response.status).not.toBe(400);
	});

	it("leaves the session endpoint alone", async () => {
		requestState.cookie = "";
		const response = await GET(
			new NextRequest(`${BASE}/session?scope=repo`),
			params("session")
		);

		expect(response.status).toBe(200);
	});

	it("leaves a scope query on the credentials callback to the library", async () => {
		const response = await post("callback/credentials", "?scope=repo");

		expect(response.status).not.toBe(400);
	});

	it("refuses only the sign-in action, not the GitHub callback", async () => {
		const response = await post("callback/github", "?scope=repo");

		expect(response.status).not.toBe(400);
	});

	it("does not refuse another provider's sign-in for a scope query", async () => {
		const response = await post("signin/google", "?scope=openid");

		expect(response.status).not.toBe(400);
	});
});
