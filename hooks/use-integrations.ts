"use client";

import { useCallback, useEffect, useState } from "react";
import { requestJson } from "@/lib/request-json";
import type {
	IntegrationListItem,
	IssuedTokenResult,
	RegisterIntegrationBody,
	RotatedTokenResult,
} from "@/lib/schemas/integration";
import { toast } from "@/lib/toast";

async function requestIntegrations(): Promise<IntegrationListItem[]> {
	const body = await requestJson<{ integrations: IntegrationListItem[] }>(
		"/api/integrations"
	);
	return body.integrations;
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Something went wrong";
}

export interface UseIntegrationsResult {
	deleteIntegration: (id: string) => Promise<void>;
	/** The integrationId currently being deleted, or `null`. */
	deletingId: string | null;
	error: string | null;
	integrations: IntegrationListItem[];

	issueToken: (integrationId: string) => Promise<IssuedTokenResult | null>;
	loading: boolean;
	/** The integrationId currently mid lifecycle-action (suspend/reactivate/revoke), or `null`. */
	pendingIntegrationId: string | null;
	/** `${integrationId}:${tokenId}` currently mid rotate/revoke, or `${integrationId}` while issuing a fresh token, or `null`. */
	pendingTokenKey: string | null;
	reactivateIntegration: (id: string) => Promise<void>;
	refetch: () => Promise<void>;

	registerIntegration: (input: RegisterIntegrationBody) => Promise<boolean>;
	registering: boolean;
	revokeIntegration: (id: string) => Promise<void>;
	revokeToken: (integrationId: string, tokenId: string) => Promise<void>;
	rotateToken: (
		integrationId: string,
		tokenId: string
	) => Promise<RotatedTokenResult | null>;
	suspendIntegration: (id: string) => Promise<void>;
}

/**
 * Fetches and manages the session user's integrations via `/api/
 * integrations/**` — the Integrations settings pane's only data source
 * (house rule: data via the new routes only, no service/Prisma imports here).
 *
 * Every mutation re-fetches the full list on success rather than patching
 * local state from the mutation's response, same rationale as
 * `usePluginSettings`: a token action changes a nested `tokens[]` entry
 * whose derived state (e.g. which token is now the "current" one after a
 * rotation) is cheaper to re-resolve through the same GET the pane renders
 * from than to hand-reconcile locally.
 *
 * The plaintext token `secret` returned by `issueToken`/`rotateToken` is
 * handed straight back to the caller and never written to this hook's own
 * state — this hook has no `secret` field anywhere in `UseIntegrationsResult`.
 * The token-shown-once modal is responsible for holding it only as long as
 * it stays open (see `IntegrationCard`'s `tokenReveal` state).
 */
export function useIntegrations(): UseIntegrationsResult {
	const [integrations, setIntegrations] = useState<IntegrationListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [registering, setRegistering] = useState(false);
	const [pendingIntegrationId, setPendingIntegrationId] = useState<
		string | null
	>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [pendingTokenKey, setPendingTokenKey] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const data = await requestIntegrations();
			setIntegrations(data);
			setError(null);
		} catch (err) {
			setError(errorMessage(err));
		}
	}, []);

	useEffect(() => {
		setLoading(true);
		load().finally(() => setLoading(false));
	}, [load]);

	const registerIntegration = useCallback(
		async (input: RegisterIntegrationBody) => {
			setRegistering(true);
			try {
				await requestJson("/api/integrations", {
					method: "POST",
					body: JSON.stringify(input),
				});
				await load();
				toast({
					variant: "success",
					title: "Integration registered",
					description: `"${input.name}" is ready to issue tokens for.`,
				});
				return true;
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't register integration",
					description: errorMessage(err),
				});
				return false;
			} finally {
				setRegistering(false);
			}
		},
		[load]
	);

	const runLifecycleAction = useCallback(
		async (
			id: string,
			path: "" | "/suspend" | "/reactivate" | "/revoke",
			method: "POST" | "DELETE",
			successTitle: string,
			errorTitle: string
		) => {
			setPendingIntegrationId(id);
			try {
				await requestJson(`/api/integrations/${id}${path}`, { method });
				await load();
				toast({ variant: "success", title: successTitle });
			} catch (err) {
				toast({
					variant: "destructive",
					title: errorTitle,
					description: errorMessage(err),
				});
			} finally {
				setPendingIntegrationId(null);
			}
		},
		[load]
	);

	const suspendIntegration = useCallback(
		(id: string) =>
			runLifecycleAction(
				id,
				"/suspend",
				"POST",
				"Integration suspended",
				"Couldn't suspend integration"
			),
		[runLifecycleAction]
	);

	const reactivateIntegration = useCallback(
		(id: string) =>
			runLifecycleAction(
				id,
				"/reactivate",
				"POST",
				"Integration reactivated",
				"Couldn't reactivate integration"
			),
		[runLifecycleAction]
	);

	const revokeIntegration = useCallback(
		(id: string) =>
			runLifecycleAction(
				id,
				"/revoke",
				"POST",
				"Integration revoked",
				"Couldn't revoke integration"
			),
		[runLifecycleAction]
	);

	const deleteIntegration = useCallback(
		async (id: string) => {
			setDeletingId(id);
			try {
				await requestJson(`/api/integrations/${id}`, { method: "DELETE" });
				await load();
				toast({ variant: "success", title: "Integration deleted" });
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't delete integration",
					description: errorMessage(err),
				});
			} finally {
				setDeletingId(null);
			}
		},
		[load]
	);

	const issueToken = useCallback(
		async (integrationId: string): Promise<IssuedTokenResult | null> => {
			setPendingTokenKey(integrationId);
			try {
				const result = await requestJson<IssuedTokenResult>(
					`/api/integrations/${integrationId}/tokens`,
					{ method: "POST", body: JSON.stringify({}) }
				);
				await load();
				return result;
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't issue token",
					description: errorMessage(err),
				});
				return null;
			} finally {
				setPendingTokenKey(null);
			}
		},
		[load]
	);

	const rotateToken = useCallback(
		async (
			integrationId: string,
			tokenId: string
		): Promise<RotatedTokenResult | null> => {
			const key = `${integrationId}:${tokenId}`;
			setPendingTokenKey(key);
			try {
				const result = await requestJson<RotatedTokenResult>(
					`/api/integrations/${integrationId}/tokens/${tokenId}/rotate`,
					{ method: "POST" }
				);
				await load();
				return result;
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't rotate token",
					description: errorMessage(err),
				});
				return null;
			} finally {
				setPendingTokenKey(null);
			}
		},
		[load]
	);

	const revokeToken = useCallback(
		async (integrationId: string, tokenId: string) => {
			const key = `${integrationId}:${tokenId}`;
			setPendingTokenKey(key);
			try {
				await requestJson(
					`/api/integrations/${integrationId}/tokens/${tokenId}`,
					{ method: "DELETE" }
				);
				await load();
				toast({ variant: "success", title: "Token revoked" });
			} catch (err) {
				toast({
					variant: "destructive",
					title: "Couldn't revoke token",
					description: errorMessage(err),
				});
			} finally {
				setPendingTokenKey(null);
			}
		},
		[load]
	);

	return {
		integrations,
		loading,
		error,
		refetch: load,
		registering,
		pendingIntegrationId,
		deletingId,
		pendingTokenKey,
		registerIntegration,
		suspendIntegration,
		reactivateIntegration,
		revokeIntegration,
		deleteIntegration,
		issueToken,
		rotateToken,
		revokeToken,
	};
}
