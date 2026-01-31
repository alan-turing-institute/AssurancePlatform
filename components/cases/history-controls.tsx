"use client";

import { Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHistory } from "@/hooks/use-history";
import ActionTooltip from "../ui/action-tooltip";

/**
 * Undo/Redo controls for the diagram editor toolbar.
 * Shows two buttons for undo (Cmd+Z) and redo (Cmd+Shift+Z).
 */
export function HistoryControls() {
	const { undo, redo, canUndo, canRedo, isApplying } = useHistory();

	return (
		<>
			<ActionTooltip label="Undo (Cmd+Z)">
				<Button
					className="rounded-full p-3"
					disabled={!canUndo || isApplying}
					onClick={undo}
					size="icon"
					type="button"
				>
					<Undo2 className="h-5 w-5" />
					<span className="sr-only">Undo</span>
				</Button>
			</ActionTooltip>
			<ActionTooltip label="Redo (Cmd+Shift+Z)">
				<Button
					className="rounded-full p-3"
					disabled={!canRedo || isApplying}
					onClick={redo}
					size="icon"
					type="button"
				>
					<Redo2 className="h-5 w-5" />
					<span className="sr-only">Redo</span>
				</Button>
			</ActionTooltip>
		</>
	);
}
