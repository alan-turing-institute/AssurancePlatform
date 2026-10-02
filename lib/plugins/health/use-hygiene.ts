"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface HygieneFigure {
	count: number;
	of: number;
}

/** The body of `GET /api/cases/[id]/health/hygiene`. */
export interface HygieneFigures {
	checks_without_time_limit: HygieneFigure;
	claims_without_time_limit: HygieneFigure;
	settings_as_recommended: HygieneFigure;
}

export interface HygieneState {
	figures: HygieneFigures | null;
	/** Reads the figures again; the previous ones stay on show until the new ones arrive. */
	refresh: () => void;
	status: "error" | "loading" | "ready";
}

async function fetchHygiene(caseId: string): Promise<HygieneFigures> {
	const response = await fetch(`/api/cases/${caseId}/health/hygiene`);
	if (!response.ok) {
		throw new Error(`Failed to fetch evidence health (${response.status})`);
	}
	return (await response.json()) as HygieneFigures;
}

/**
 * The case's evidence health figures, read once when the panel opens and
 * again on request. There is no live connection: the figures are a snapshot.
 */
export function useHygiene(caseId: string): HygieneState {
	const [figures, setFigures] = useState<HygieneFigures | null>(null);
	const [status, setStatus] = useState<HygieneState["status"]>("loading");
	const latest = useRef(0);

	const refresh = useCallback(() => {
		latest.current += 1;
		const mine = latest.current;
		setStatus("loading");
		fetchHygiene(caseId)
			.then((next) => {
				if (latest.current === mine) {
					setFigures(next);
					setStatus("ready");
				}
			})
			.catch(() => {
				if (latest.current === mine) {
					setFigures(null);
					setStatus("error");
				}
			});
	}, [caseId]);

	useEffect(() => {
		refresh();
		return () => {
			latest.current += 1;
		};
	}, [refresh]);

	return { figures, refresh, status };
}
