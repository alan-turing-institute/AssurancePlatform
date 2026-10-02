"use client";

import { useEffect, useRef, useState } from "react";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { CriteriaDraft } from "./criteria-draft";

/** Accepted settings moved to another version of their check, held until they are saved or abandoned. */
export interface MovedSettings {
	check: HealthCheck;
	draft: CriteriaDraft;
}

/**
 * The state of moving accepted settings to a newer check version: whether the
 * comparison is showing, and the moved settings once the person has continued
 * from it. Cancelling the comparison returns focus to the button that opened
 * it, which stays in the form the comparison hides.
 */
export function useVersionMove() {
	const [comparing, setComparing] = useState(false);
	const [moved, setMoved] = useState<MovedSettings | null>(null);
	const opener = useRef<HTMLButtonElement>(null);
	const refocusOpener = useRef(false);

	useEffect(() => {
		if (!comparing && refocusOpener.current) {
			refocusOpener.current = false;
			opener.current?.focus();
		}
	}, [comparing]);

	return {
		cancel: () => {
			refocusOpener.current = true;
			setComparing(false);
		},
		clear: () => setMoved(null),
		comparing,
		continueWith: (next: MovedSettings) => {
			setMoved(next);
			setComparing(false);
		},
		moved,
		open: () => setComparing(true),
		opener,
	};
}

export type VersionMove = ReturnType<typeof useVersionMove>;
