interface ApiErrorBody {
	error?: string;
}

/**
 * A failed `requestJson` call, carrying the HTTP status alongside the
 * envelope's `error` message. Most callers (`useIntegrations`) only need
 * `message` — every failure there gets the same generic toast treatment —
 * but a caller that must tell status codes apart (`useIntegrationCaseGrants`,
 * which maps 409 vs 404 to two different faithful messages) reads `status`
 * off the caught error via `instanceof RequestJsonError`.
 */
export class RequestJsonError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "RequestJsonError";
		this.status = status;
	}
}

/**
 * Shared client-side `fetch` + JSON wrapper for hooks under `hooks/` — always
 * sends `Content-Type: application/json`, and on a non-2xx response throws a
 * `RequestJsonError` carrying both the envelope's `error` message (falling
 * back to a generic one if the body isn't JSON or has no `error` field) and
 * the response's status code. Extracted from `useIntegrations` and
 * `useIntegrationCaseGrants`, which each carried a near-identical copy
 * (fallow-flagged clone, G3 review 2026-07-13) — this is the one definition
 * both import.
 */
export async function requestJson<T>(
	url: string,
	init?: RequestInit
): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		const body = (await response
			.json()
			.catch(() => null)) as ApiErrorBody | null;
		throw new RequestJsonError(
			body?.error ?? "Something went wrong",
			response.status
		);
	}
	return (await response.json()) as T;
}
