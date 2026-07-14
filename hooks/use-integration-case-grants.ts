"use client";

import { useCallback, useEffect, useState } from "react";
import { RequestJsonError, requestJson } from "@/lib/request-json";
import type {
	CaseGrantPermission,
	IntegrationCaseGrant,
} from "@/lib/schemas/integration";
import { toast } from "@/lib/toast";

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
	if (err instanceof RequestJsonError) {
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

	// No `cancelled`/AbortController guard here, unlike `GrantCaseAccessForm`'s
	// mount effect — deliberate, not an oversight (fix-batch item 6, G3
	// review 2026-07-13). That form's fetch is called from exactly one
	// effect, so a single `cancelled` flag cleanly scopes to "this mount is
	// gone." `load` here is shared across three call sites (the mount
	// effect AND both `grantAccess`/`removeAccess`), where a flag flipped by
	// the mount effect's cleanup would wrongly suppress a mutation's own
	// post-request refetch if the component happened to unmount in between.
	// A correct version needs a second, call-site-scoped guard, not a
	// straight port of the form's pattern — real added complexity for a
	// race that's a non-issue under React 19 (setState after unmount is a
	// silent no-op, confirmed by nanaki's unmount-during-flight probe,
	// G3 review UI test half).
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
