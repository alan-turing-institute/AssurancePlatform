"use client";

import { useNextStep } from "nextstepjs";
import { useCallback, useEffect, useRef } from "react";

type CheckTourClientProps = {
	tourId: string;
	enabled: boolean;
};

/**
 * Client-side tour checker that fetches the user's completed tours
 * and starts the specified tour if it hasn't been completed.
 *
 * Used for pages where completedTours isn't available from the server.
 */
const CheckTourClient = ({ tourId, enabled }: CheckTourClientProps) => {
	const { startNextStep, isNextStepVisible } = useNextStep();
	const hasStartedRef = useRef(false);
	const isCompletedRef = useRef(false);

	const markTourComplete = useCallback(async () => {
		if (isCompletedRef.current) {
			return;
		}
		isCompletedRef.current = true;

		try {
			await fetch("/api/user/tours", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tourId }),
			});
		} catch {
			// Silently fail — tour will re-show next visit if PATCH fails
		}
	}, [tourId]);

	useEffect(() => {
		if (!enabled || hasStartedRef.current) {
			return;
		}

		const checkAndStartTour = async () => {
			try {
				const response = await fetch("/api/user/tours");
				if (!response.ok) {
					return;
				}

				const data = await response.json();
				const completedTours: string[] = data.completedTours ?? [];

				if (completedTours.includes(tourId)) {
					isCompletedRef.current = true;
					return;
				}

				// Small delay to let the page settle
				setTimeout(() => {
					if (!(hasStartedRef.current || isCompletedRef.current)) {
						hasStartedRef.current = true;
						startNextStep(tourId);
					}
				}, 800);
			} catch {
				// Silently fail — don't block the user
			}
		};

		checkAndStartTour();
	}, [enabled, tourId, startNextStep]);

	// Track when tour becomes not visible (completed or skipped)
	useEffect(() => {
		if (hasStartedRef.current && !isNextStepVisible) {
			markTourComplete();
		}
	}, [isNextStepVisible, markTourComplete]);

	return null;
};

export default CheckTourClient;
