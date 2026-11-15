"use client";

import { WifiOff } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface LiveUpdatesPausedProps {
	onReconnect: () => void;
	/** True while the live connection has given up. */
	stopped: boolean;
}

/**
 * A notice in the editor's overlay stack, under the header, that says the
 * live connection has given up and other people's changes will not appear
 * until it is restarted. It sits in the flow below the other banners, so it
 * never covers their controls, takes only the width of its text (at most
 * 28rem) and wraps on narrow screens. On a canvas that is fitted to the
 * screen it clears the root of the argument at tablet and desktop widths; on
 * a phone the notice can overlap the top edge of the root's card, though not
 * its text. The status region stays in the page and only its content comes
 * and goes, so screen readers announce the notice when it appears.
 * Reconnecting restarts the connection without reloading the page, and moves
 * focus to the region so it is not left on the page body when the button
 * goes.
 */
export function LiveUpdatesPaused({
	stopped,
	onReconnect,
}: LiveUpdatesPausedProps) {
	const region = useRef<HTMLOutputElement>(null);

	return (
		<output
			aria-label="Live updates"
			className="block outline-none"
			ref={region}
			tabIndex={-1}
		>
			{stopped && (
				<span
					className="pointer-events-auto mx-4 mt-2 flex w-fit flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-card px-3 py-2 text-foreground text-sm shadow-sm sm:max-w-md"
					data-testid="live-updates-paused"
				>
					<WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
					<span className="min-w-0 flex-1">
						Live updates have stopped. Changes other people make will not appear
						until you reconnect.
					</span>
					<Button
						onClick={() => {
							onReconnect();
							region.current?.focus();
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						Reconnect
					</Button>
				</span>
			)}
		</output>
	);
}
