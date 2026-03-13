"use client";

import { useNextStep } from "nextstepjs";
import { useCallback, useEffect, useRef } from "react";

interface CheckTourProps {
	completedTours: string[];
	tourId: string;
}

/**
 * Checks whether a tour should be shown and starts it if needed.
 * On tour completion or skip, marks the tour as completed via API.
 */
const CheckTour = ({ completedTours, tourId }: CheckTourProps) => {
	const { startNextStep, isNextStepVisible } = useNextStep();
	const hasStartedRef = useRef(false);
	const isCompletedRef = useRef(completedTours.includes(tourId));

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

	// Start tour if not completed
	useEffect(() => {
		if (hasStartedRef.current || isCompletedRef.current) {
			return;
		}

		// Small delay to let the page settle before starting the tour
		const timeout = setTimeout(() => {
			if (!(hasStartedRef.current || isCompletedRef.current)) {
				hasStartedRef.current = true;
				startNextStep(tourId);
			}
		}, 500);

		return () => clearTimeout(timeout);
	}, [tourId, startNextStep]);

	// Track when tour becomes not visible (completed or skipped)
	useEffect(() => {
		if (hasStartedRef.current && !isNextStepVisible) {
			markTourComplete();
		}
	}, [isNextStepVisible, markTourComplete]);

	return null;
};

export default CheckTour;
