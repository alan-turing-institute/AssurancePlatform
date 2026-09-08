"use client";

import { useCallback, useEffect, useState } from "react";
import { RequestJsonError, requestJson } from "@/lib/request-json";
import type {
	CaseGrantPermission,
	IntegrationCaseGrant,
	IntegrationStatus,
} from "@/lib/schemas/integration";
import { toast } from "@/lib/toast";

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Something went wrong";
}

// The two distinct, server-disclosed 409 bodies `POST .../case-grants` now
// returns (fix/integration-delete-orphan @ 8a413d5b, landing alongside this
// branch) — verbatim, so a change to either wording is a loud test failure
// here rather than a silently-wrong fallback match.
const SUSPENDED_409_MESSAGE =
	"Cannot grant case access for a suspended integration";
const REVOKED_409_MESSAGE =
	"Cannot grant case access for a revoked integration";

const REACTIVATE_COPY =
	"This integration must be ACTIVE before it can be granted access to a case. Reactivate it, then try again.";
const REVOKED_COPY =
	"Revoked integrations cannot be restored — register a new integration and grant it access instead.";

/**
 * Maps a failed grant attempt to the fixed, faithful message the settings
 * UI should show. The two non-ACTIVE statuses need different advice, because
 * only one of them is reversible: SUSPENDED can be reactivated, so "reactivate
 * it" is genuinely actionable there; REVOKED is permanent by design (the
 * revoke confirmation dialog itself says so), so telling a REVOKED integration
 * to "reactivate" is impossible advice. 404 is deliberately generic: it
 * covers a nonexistent case, a soft-deleted one, AND the caller lacking
 * case-ADMIN, all with the exact same message server-side (no enumeration
 * oracle) — this hook does not try to tell those apart either, on purpose.
 *
 * Server truth wins over the client-held `integrationStatus` prop: the 409
 * body's own `error` string is matched first against the two verbatim
 * messages above, because the prop can be stale (another tab, or another
 * admin, revokes/suspends the integration while this card's grant form is
 * still open and still believes the old status — a real probe caught the
 * prop-keyed version giving the impossible "Reactivate it" advice for an
 * integration the server had already told it was revoked). The prop is only
 * a fallback, for the old uniform 409 message ("...for a non-active
 * integration") that production keeps serving until both branches land
 * together — once the server discloses which status it actually is, that
 * disclosure is authoritative.
 */
function grantErrorMessage(
	err: unknown,
	integrationStatus: IntegrationStatus
): string {
	if (err instanceof RequestJsonError) {
		if (err.status === 409) {
			if (err.message === REVOKED_409_MESSAGE) {
				return REVOKED_COPY;
			}
			if (err.message === SUSPENDED_409_MESSAGE) {
				return REACTIVATE_COPY;
			}
			return integrationStatus === "REVOKED" ? REVOKED_COPY : REACTIVATE_COPY;
		}
		if (err.status === 404) {
			return "Case not found. Check that the case still exists and that you hold admin access to it.";
		}
	}
	return errorMessage(err);
}

export interface UseIntegrationCaseGrantsResult {
	/** Clears a mapped grant error without a new attempt — called when the grant form closes or reopens, so a past failure's copy (e.g. a stale "Reactivate it") never resurfaces on an unrelated later open. */
	clearGrantError: () => void;
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
 *
 * `integrationStatus` is threaded in (rather than read once at mount) so a
 * 409 raised after the card's own status has just changed — e.g. the user
 * revokes the integration while this card's grant form is still open — maps
 * to the status-appropriate copy, not a stale one from first render.
 */
export function useIntegrationCaseGrants(
	integrationId: string,
	integrationStatus: IntegrationStatus
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
				setGrantError(grantErrorMessage(err, integrationStatus));
				return false;
			} finally {
				setGranting(false);
			}
		},
		[integrationId, integrationStatus, load]
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

	// Deliberately not folded into `grantAccess`'s own `setGrantError(null)`
	// at the start of an attempt: this clears the banner on the form
	// closing/reopening, i.e. specifically WITHOUT a new attempt — the two
	// call sites are the section's open-trigger click and its Cancel, not
	// this hook's own request lifecycle (`grantAccess` already owns clearing
	// for the "new attempt" case).
	const clearGrantError = useCallback(() => setGrantError(null), []);

	return {
		grants,
		loading,
		loadError,
		refetch: load,
		granting,
		grantError,
		clearGrantError,
		grantAccess,
		removingCaseId,
		removeAccess,
	};
}
