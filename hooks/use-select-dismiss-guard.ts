import { useCallback, useEffect, useRef } from "react";

// Radix's Select and Dialog each open a DismissableLayer with
// disableOutsidePointerEvents: true. While a Select nested inside a Dialog
// is open, Radix sets pointer-events: none on the Dialog's own content (the
// lower-priority layer), so a click anywhere in the dialog body falls
// through to the Dialog's own overlay — which the Dialog's own outside-click
// detection then reads as a genuine outside click and closes on.
//
// The dismissing click is a single pointerdown event. Both DismissableLayers
// (Select's and Dialog's) react to it through their own document-level
// listeners registered in the bubbling phase: the Select's runs first and
// calls its onOpenChange(false), then the Dialog's runs and fires
// onPointerDownOutside/onInteractOutside. A document listener registered in
// the capture phase always runs before any bubbling-phase listener for the
// same event, so it can snapshot whether the Select was open at the start of
// this specific pointerdown — before either DismissableLayer has reacted to
// it — with no timer and no assumption about which bubble listener runs
// first.
//
// Extracted from node-edit-dialog.tsx (originally
// useAssertionSelectDismissGuard, PR #914) once a second Dialog+Select site
// needed the same guard (case-sharing-dialog.tsx's Permission Level Select).
export function useSelectDismissGuard() {
	const isOpenRef = useRef(false);
	const selectOpenAtPointerDownRef = useRef(false);

	const onSelectOpenChange = useCallback((nextOpen: boolean) => {
		isOpenRef.current = nextOpen;
	}, []);

	useEffect(() => {
		const handlePointerDownCapture = () => {
			selectOpenAtPointerDownRef.current = isOpenRef.current;
		};
		document.addEventListener("pointerdown", handlePointerDownCapture, {
			capture: true,
		});
		return () => {
			document.removeEventListener("pointerdown", handlePointerDownCapture, {
				capture: true,
			});
		};
	}, []);

	// Pointer dismissal: guard only on the per-event snapshot, so a click
	// that lands after the Select has genuinely closed is never swallowed.
	const shouldGuardPointerDismiss = useCallback(
		() => selectOpenAtPointerDownRef.current,
		[]
	);

	// Focus dismissal (e.g. Tab out of the Select) has no pointerdown to
	// snapshot, so it falls back to the Select's live open state. In
	// practice Radix already blocks focus-outside dismissal on a modal
	// DialogContent, so this branch is not known to be exercised — it's
	// kept for consistency with the pointer guard above.
	const shouldGuardFocusDismiss = useCallback(
		() => selectOpenAtPointerDownRef.current || isOpenRef.current,
		[]
	);

	return {
		onSelectOpenChange,
		shouldGuardFocusDismiss,
		shouldGuardPointerDismiss,
	};
}
