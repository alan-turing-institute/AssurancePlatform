"use client";

import { useEffect, useState } from "react";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthCriteriaSettings } from "@/lib/schemas/health-criteria";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
} from "./health-types";
import { useClaimScopedFetch } from "./use-claim-scoped-fetch";

async function fetchCriteria(
	elementId: string
): Promise<HealthCriteriaResponse> {
	const response = await fetch(`/api/elements/${elementId}/health/criteria`);
	if (!response.ok) {
		throw new Error(`Failed to fetch evidence settings (${response.status})`);
	}
	return (await response.json()) as HealthCriteriaResponse;
}

/**
 * A claim's evidence settings with everything around them, fetched once and
 * again whenever `tea.health/state-changed` arrives for the claim. `replace`
 * shows the server's answer to a save without another request.
 */
export function useCriteria({
	caseId,
	elementId,
	elementType,
}: ElementSlotContext) {
	return useClaimScopedFetch<HealthCriteriaResponse | null>({
		caseId,
		elementId,
		elementType,
		fetchFn: fetchCriteria,
		errorValue: null,
		notApplicableValue: null,
	});
}

export type CriteriaOutcome =
	| { ok: true; view: HealthCriteriaResponse }
	| { fieldErrors: Record<string, string>; message: string; ok: false };

const SETTINGS_PREFIX = "settings.";

interface ErrorBody {
	error?: unknown;
	fieldErrors?: unknown;
}

function fieldErrorsOf(value: unknown): Record<string, string> {
	if (typeof value !== "object" || value === null) {
		return {};
	}
	const errors: Record<string, string> = {};
	for (const [path, message] of Object.entries(value)) {
		if (typeof message === "string") {
			errors[
				path.startsWith(SETTINGS_PREFIX)
					? path.slice(SETTINGS_PREFIX.length)
					: path
			] = message;
		}
	}
	return errors;
}

async function outcomeOf(response: Response): Promise<CriteriaOutcome> {
	if (response.ok) {
		return {
			ok: true,
			view: (await response.json()) as HealthCriteriaResponse,
		};
	}
	let body: ErrorBody = {};
	try {
		body = (await response.json()) as ErrorBody;
	} catch {
		// Not JSON: the generic message below stands.
	}
	return {
		ok: false,
		message:
			typeof body.error === "string" && body.error
				? body.error
				: `The server refused the change (${response.status}).`,
		fieldErrors: fieldErrorsOf(body.fieldErrors),
	};
}

async function send(
	url: string,
	method: "POST" | "PUT",
	body: unknown
): Promise<CriteriaOutcome> {
	try {
		return await outcomeOf(
			await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			})
		);
	} catch {
		return {
			ok: false,
			message: "The request could not be sent. Check your connection.",
			fieldErrors: {},
		};
	}
}

export interface SaveCriteriaRequest {
	accept: boolean;
	integrationId: string;
	settings: HealthCriteriaSettings;
}

/** Saves a claim's settings, as accepted or as a suggestion. */
export function saveCriteria(
	claimId: string,
	request: SaveCriteriaRequest
): Promise<CriteriaOutcome> {
	return send(`/api/elements/${claimId}/health/criteria`, "PUT", {
		integration_id: request.integrationId,
		settings: request.settings,
		accept: request.accept,
	});
}

/** Stops the use of a claim's settings, or discards a suggestion when no reason is given. */
export function retireCriteria(
	claimId: string,
	reason?: string
): Promise<CriteriaOutcome> {
	return send(
		`/api/elements/${claimId}/health/criteria/retirement`,
		"POST",
		reason === undefined ? {} : { reason }
	);
}

export interface CaseChecksState {
	lists: HealthCheckListOffer[] | null;
	status: "error" | "idle" | "loading" | "ready";
}

/** The check lists a person can choose from for the case, fetched the first time `enabled` is true. */
export function useCaseChecks(
	caseId: string,
	enabled: boolean
): CaseChecksState {
	const [state, setState] = useState<CaseChecksState>({
		lists: null,
		status: "idle",
	});

	useEffect(() => {
		if (!(enabled && caseId)) {
			return;
		}
		let cancelled = false;
		setState((current) => ({ ...current, status: "loading" }));
		fetch(`/api/cases/${caseId}/health/checks`)
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Failed to fetch check lists (${response.status})`);
				}
				return (await response.json()) as HealthCheckListOffer[];
			})
			.then((lists) => {
				if (!cancelled) {
					setState({ lists, status: "ready" });
				}
			})
			.catch(() => {
				if (!cancelled) {
					setState({ lists: null, status: "error" });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [caseId, enabled]);

	return state;
}
