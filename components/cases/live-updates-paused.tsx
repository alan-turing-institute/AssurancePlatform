"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveUpdatesPausedProps {
	onReconnect: () => void;
}

/**
 * A notice at the top right of the editor, under the header, that says the
 * live connection has given up and other people's changes will not appear
 * until it is restarted. It takes only the width of its text, so it leaves
 * the root of the argument, which sits at the top centre, uncovered.
 * Reconnecting restarts the connection without reloading the page.
 */
export function LiveUpdatesPaused({ onReconnect }: LiveUpdatesPausedProps) {
	return (
		<output
			className="pointer-events-auto fixed top-16 right-0 z-40 mx-4 mt-2 flex w-fit max-w-xs items-center gap-3 rounded-md border bg-card px-3 py-2 text-foreground text-sm shadow-sm"
			data-testid="live-updates-paused"
		>
			<WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" />
			<p>
				Live updates have stopped. Changes other people make will not appear
				until you reconnect.
			</p>
			<Button onClick={onReconnect} size="sm" type="button" variant="outline">
				Reconnect
			</Button>
		</output>
	);
}
