"use client";

import { useEffect, useRef, useState } from "react";
import { useMigrationModal } from "@/hooks/use-migration-modal";
import type { TourId } from "@/lib/tours";
import { useTourControls } from "@/lib/tours/tour-controls";

interface CheckTourProps {
	/**
	 * Tours the user has already completed. When omitted, the list is fetched
	 * from the server before deciding whether to start.
	 */
	completedTours?: string[];
	/** Set to false to hold the tour back, for example while a page loads. */
	enabled?: boolean;
	/**
	 * Narrowest window width, in pixels, at which the tour starts. On a
	 * narrower window the tour neither starts nor counts as completed, so it
	 * still runs on a later visit from a wider one.
	 */
	minWidth?: number;
	tourId: TourId;
	/**
	 * Set when the migration notice is due for this user. The tour then waits
	 * until the notice has opened and been closed, without recording the tour
	 * as completed.
	 */
	waitForMigrationNotice?: boolean;
}

/**
 * Starts a tour the first time a user reaches a page, and records it as
 * completed (through the `markTourCompleted` action) once the tour has been
 * shown and then finished or skipped.
 */
const CheckTour = ({
	completedTours,
	enabled = true,
	minWidth,
	tourId,
	waitForMigrationNotice = false,
}: CheckTourProps) => {
	const ready = useTourControls((state) => state.ready);
	const noticeOpen = useMigrationModal((state) => state.isOpen);
	const [noticeSeen, setNoticeSeen] = useState(false);
	useEffect(() => {
		if (noticeOpen) {
			setNoticeSeen(true);
		}
	}, [noticeOpen]);
	const heldForNotice = waitForMigrationNotice && !(noticeSeen && !noticeOpen);
	const showing = useTourControls(
		(state) => state.isTourVisible && state.activeTour === tourId
	);
	const hasStartedRef = useRef(false);
	const sawTourRef = useRef(false);
	const isCompletedRef = useRef(completedTours?.includes(tourId) ?? false);

	useEffect(() => {
		if (
			!(enabled && ready) ||
			heldForNotice ||
			hasStartedRef.current ||
			isCompletedRef.current
		) {
			return;
		}
		if (minWidth !== undefined && window.innerWidth < minWidth) {
			return;
		}

		let cancelled = false;
		const begin = async () => {
			if (completedTours === undefined) {
				try {
					const { fetchCompletedTours } = await import("@/actions/tours");
					if ((await fetchCompletedTours()).includes(tourId)) {
						isCompletedRef.current = true;
						return;
					}
				} catch {
					// Do not block the page if the lookup fails.
					return;
				}
			}
			if (cancelled || hasStartedRef.current) {
				return;
			}
			hasStartedRef.current = true;
			useTourControls.getState().startTour(tourId);
		};
		begin();

		return () => {
			cancelled = true;
		};
	}, [completedTours, enabled, heldForNotice, minWidth, ready, tourId]);

	useEffect(() => {
		if (minWidth !== undefined && window.innerWidth < minWidth) {
			return;
		}
		if (showing) {
			sawTourRef.current = true;
			return;
		}
		if (!sawTourRef.current || isCompletedRef.current) {
			return;
		}
		isCompletedRef.current = true;
		import("@/actions/tours")
			.then(({ markTourCompleted }) => markTourCompleted(tourId))
			.catch(() => {
				// The tour shows again next visit if recording fails.
			});
	}, [minWidth, showing, tourId]);

	return null;
};

export default CheckTour;
