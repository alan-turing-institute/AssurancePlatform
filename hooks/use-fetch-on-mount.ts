"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiErrorBody {
	error?: string;
}

/**
 * Parses `{ error: string }` from a failed response body — the shape every
 * route in this app returns on failure (`apiError`, `lib/api-response.ts`).
 * Falls back to a generic message when the body isn't JSON or carries no
 * `error` field, so a network-level failure (no body at all) still
 * surfaces something readable rather than throwing from inside a `catch`.
 *
 * Previously declared verbatim in each of `use-plugin-enablement.ts`,
 * `use-plugin-settings.ts` and `use-plugin-consequences.ts` (fallow
 * introduced-duplication `dup:e773faa3`) — moved here since all three are
 * this module's only callers, and a request function built for
 * `useFetchOnMount` needs exactly this to turn a failed `Response` into the
 * `Error` the hook's `catch` expects.
 */
export async function parseErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
	return body?.error ?? "Something went wrong";
}

export interface UseFetchOnMountResult<T> {
	data: T | null;
	error: string | null;
	loading: boolean;
	/** Re-runs `fetcher` — e.g. after a mutation the caller wants reflected in `data`. */
	reload: () => Promise<void>;
}

/**
 * The fetch-on-mount shape three plugin hooks each grew independently
 * (`useEnabledPluginIds`/`usePluginSettings` in `use-plugin-enablement.ts`/
 * `use-plugin-settings.ts`, and `usePluginConsequences`): a
 * `useState`-held loading/error/data trio, a `useCallback`-wrapped `load`,
 * and a `useEffect` that runs it on mount (and again whenever `fetcher`
 * changes identity). Extracted to one place rather than a third copy
 * (fallow introduced-duplication finding, review round 2026-09-22).
 *
 * `fetcher` must be a stable, named callable — memoised with `useCallback`
 * by the caller when it closes over anything (see `usePluginConsequences`)
 * — built and invoked as its own function, not as a `.then()` chain
 * written directly inside a `useEffect` body (the shape react-doctor's
 * `no-fetch-in-effect` rule flags).
 *
 * Deliberately minimal: no caching, no de-duping of concurrent callers
 * (`fetchPlugins`'s `inFlightFetch` guard stays local to
 * `use-plugin-enablement.ts` — it answers a question specific to that one
 * endpoint being read from several places at once, not a general
 * fetch-on-mount concern every caller needs).
 */
export function useFetchOnMount<T>(
	fetcher: () => Promise<T>
): UseFetchOnMountResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const result = await fetcher();
			setData(result);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		}
	}, [fetcher]);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	return { data, error, loading, reload: load };
}
