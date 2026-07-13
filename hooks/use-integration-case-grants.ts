"use client";

import { useCallback, useEffect, useState } from "react";
import type {
	CaseGrantPermission,
	IntegrationCaseGrant,
} from "@/lib/schemas/integration";
import { toast } from "@/lib/toast";

interface ApiErrorBody {
	error?: string;
}

/**
 * A failed `fetch` against the case-grants routes, carrying the HTTP status
 * alongside the envelope's `error` message — `useIntegrations`' own
 * `requestJson` discards the status code, which is fine for its callers
 * (every failure there gets the same generic toast treatment) but not for
 * this hook: the grant flow needs to tell a 409 (integration not ACTIVE)
 * from a 404 (case not found / not admin) apart, faithfully, per the
 * settings-page dispatch brief.
 */
class CaseGrantRequestError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "CaseGrantRequestError";
		this.status = status;
	}
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (!response.ok) {
		const body = (await response
			.json()
			.catch(() => null)) as ApiErrorBody | null;
		throw new CaseGrantRequestError(
			body?.error ?? "Something went wrong",
			response.status
		);
	}
	return (await response.json()) as T;
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Something went wrong";
}

/**
 * Maps a failed grant attempt to the fixed, faithful message the settings
 * UI should show — 409 always means "the integration isn't ACTIVE" (the
 * only conflict `POST .../case-grants` ever returns, per its own doc
 * comment), and 404 is deliberately generic: it covers a nonexistent case,
 * a soft-deleted one, AND the caller lacking case-ADMIN, all with the exact
 * same message server-side (no enumeration oracle) — this hook does not
 * try to tell those apart either, on purpose.
 */
function grantErrorMessage(err: unknown): string {
	if (err instanceof CaseGrantRequestError) {
		if (err.status === 409) {
			return "This integration must be ACTIVE before it can be granted access to a case. Reactivate it, then try again.";
		}
		if (err.status === 404) {
			return "Case not found. Check that the case still exists and that you hold admin access to it.";
		}
	}
	return errorMessage(err);
}

export interface UseIntegrationCaseGrantsResult {
	grantAccess: (
		caseId: string,
		permission: CaseGrantPermission
	) => Promise<boolean>;
	/** The faithfully-mapped message from the most recent failed grant attempt, or `null`. */
	grantError: string | null;
	/** True while a `POST` grant request is in flight. */
	granting: boolean;
	grants: IntegrationCaseGrant[];
	loadError: string | null;
	/** True while the initial (or a manually triggered) list fetch is in flight. */
	loading: boolean;
	refetch: () => Promise<void>;
	removeAccess: (caseId: string) => Promise<void>;
	/** The caseId currently mid-`DELETE`, or `null`. */
	removingCaseId: string | null;
}

/**
 * Fetches and manages one integration's case-access grants via
 * `/api/integrations/[id]/case-grants` — the "Case access" section's only
 * data source (house rule: data via the new routes only, no service/Prisma
 * import here). One instance of this hook is scoped to a single
 * integrationId, called directly from `IntegrationCard` (which already owns
 * exactly one integration per render, so this is one hook call per card
 * instance, not a hook-in-a-loop).
 *
 * Every mutation re-fetches the full list on success, same rationale as
 * `useIntegrations`: cheaper to re-resolve through the same GET the section
 * renders from than to hand-reconcile a nested array locally.
 */
export function useIntegrationCaseGrants(
	integrationId: string
): UseIntegrationCaseGrantsResult {
	const [grants, setGrants] = useState<IntegrationCaseGrant[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [granting, setGranting] = useState(false);
	const [grantError, setGrantError] = useState<string | null>(null);
	const [removingCaseId, setRemovingCaseId] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const body = await requestJson<{ grants: IntegrationCaseGrant[] }>(
				`/api/integrations/${integrationId}/case-grants`
			);
			setGrants(body.grants);
			setLoadError(null);
		} catch (err) {
			setLoadError(errorMessage(err));
		}
	}, [integrationId]);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	const grantAccess = useCallback(
		async (caseId: string, permission: CaseGrantPermission) => {
			setGranting(true);
			setGrantError(null);
			try {
				await requestJson(`/api/integrations/${integrationId}/case-grants`, {
					method: "POST",
					body: JSON.stringify({ caseId, permission }),
				});
				await load();
				return true;
			} catch (err) {
				setGrantError(grantErrorMessage(err));
				return false;
			} finally {
				setGranting(false);
			}
		},
		[integrationId, load]
	);

	const removeAccess = useCallback(
		async (caseId: string) => {
			setRemovingCaseId(caseId);
			try {
				await requestJson(
					`/api/integrations/${integrationId}/case-grants/${caseId}`,
					{ method: "DELETE" }
				);
				await load();
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't remove case access",
					description: errorMessage(err),
				});
			} finally {
				setRemovingCaseId(null);
			}
		},
		[integrationId, load]
	);

	return {
		grants,
		loading,
		loadError,
		refetch: load,
		granting,
		grantError,
		grantAccess,
		removingCaseId,
		removeAccess,
	};
}
