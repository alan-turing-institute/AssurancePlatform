"use client";

import { useEffect, useState } from "react";

/** Largest delay `setTimeout` accepts; a longer wait is taken in steps. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * Re-renders the caller once `expiresAt` has passed on this device's clock,
 * so what shows a result's age (the dot's ring, a node's badge and fade)
 * changes without waiting for the next server push.
 */
export function useRerenderAtExpiry(expiresAt: string | null): void {
	const [tick, setTick] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `tick` re-arms the timer after each step of a long wait.
	useEffect(() => {
		if (expiresAt === null) {
			return;
		}
		const remaining = Date.parse(expiresAt) - Date.now();
		if (Number.isNaN(remaining) || remaining <= 0) {
			return;
		}
		const timer = setTimeout(
			() => setTick((value) => value + 1),
			Math.min(remaining + 50, MAX_TIMER_MS)
		);
		return () => clearTimeout(timer);
	}, [expiresAt, tick]);
}
