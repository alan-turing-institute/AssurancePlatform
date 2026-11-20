import { type RefObject, useCallback, useMemo, useRef } from "react";

interface ReturnFocusHandlers {
	onCloseAutoFocus: (event: Event) => void;
	onOpenAutoFocus: (event: Event) => void;
}

/**
 * Returns focus to whatever opened a Radix dialog or sheet when it closes.
 *
 * Radix restores focus only to its own trigger element. A dialog opened by
 * state has none, so focus would otherwise fall to the page body. Spread the
 * returned handlers onto `DialogContent`, `AlertDialogContent` or
 * `SheetContent`. The opener is recorded as the dialog opens, before Radix
 * moves focus inside. If the opener has since left the document, `fallback`
 * receives focus instead. When there is nothing to focus the default Radix
 * behaviour is left alone.
 */
export function useReturnFocus(
	fallback?: RefObject<HTMLElement | null>
): ReturnFocusHandlers {
	const openerRef = useRef<HTMLElement | null>(null);

	const onOpenAutoFocus = useCallback((_event: Event) => {
		const active = document.activeElement;
		openerRef.current =
			active instanceof HTMLElement && active !== document.body ? active : null;
	}, []);

	const onCloseAutoFocus = useCallback(
		(event: Event) => {
			const opener = openerRef.current;
			openerRef.current = null;
			const target = opener?.isConnected ? opener : (fallback?.current ?? null);
			if (target?.isConnected) {
				event.preventDefault();
				target.focus();
			}
		},
		[fallback]
	);

	return useMemo(
		() => ({ onOpenAutoFocus, onCloseAutoFocus }),
		[onOpenAutoFocus, onCloseAutoFocus]
	);
}
