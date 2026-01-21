"use client";

import { Redo2, Undo2 } from "lucide-react";
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
				<button
					className="rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canUndo || isApplying}
					onClick={undo}
					type="button"
				>
					<Undo2 className="h-5 w-5" />
					<span className="sr-only">Undo</span>
				</button>
			</ActionTooltip>
			<ActionTooltip label="Redo (Cmd+Shift+Z)">
				<button
					className="rounded-full bg-indigo-700 p-3 transition-all hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canRedo || isApplying}
					onClick={redo}
					type="button"
				>
					<Redo2 className="h-5 w-5" />
					<span className="sr-only">Redo</span>
				</button>
			</ActionTooltip>
		</>
	);
}
