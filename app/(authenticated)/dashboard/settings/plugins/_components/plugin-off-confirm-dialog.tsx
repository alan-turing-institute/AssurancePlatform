"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePluginConsequences } from "@/hooks/use-plugin-consequences";
import { cn } from "@/lib/utils";
import { buildPluginOffCopy } from "./plugin-off-copy";

export interface PluginOffConfirmDialogProps {
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** True while THIS plugin's toggle request is in flight. */
	pending: boolean;
	pluginId: string;
	pluginName: string;
}

interface PluginOffConfirmDialogBodyProps {
	onConfirm: () => void;
	pending: boolean;
	pluginId: string;
	pluginName: string;
}

/**
 * The consequence-fetching half of the dialog. `PluginOffConfirmDialog`
 * mounts this only while `open`, keyed by `pluginId` — opening the dialog is
 * therefore what starts `usePluginConsequences` fetching, and closing it
 * discards the fetch's state for free via unmount, rather than the hook
 * watching an "is the dialog open" prop and clearing itself.
 */
function PluginOffConfirmDialogBody({
	onConfirm,
	pending,
	pluginId,
	pluginName,
}: PluginOffConfirmDialogBodyProps) {
	const { consequences, loading } = usePluginConsequences(pluginId);
	const copy = buildPluginOffCopy({ consequences, pluginId, pluginName });

	return (
		<>
			<AlertDialogHeader>
				<AlertDialogTitle>{copy.title}</AlertDialogTitle>
				<AlertDialogDescription>{copy.introLine}</AlertDialogDescription>
			</AlertDialogHeader>

			<div className="space-y-2 text-muted-foreground text-sm">
				{/* Reserved while loading so the footer buttons don't jump once
				real content arrives. Sized from a direct measurement (nanaki,
				review round 2026-09-22): with the plugin's usual two variable
				lines present (evidence + an active integration, the common case
				for this deployment's one plugin), the dialog's own bounding box
				grew 246px to 314px against the previous min-h-10 (40px) reserve
				— so the loaded region is ~108px (40 + 68), not 40px. */}
				<div className={cn("space-y-2", loading && "min-h-[6.75rem]")}>
					{loading ? (
						<>
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</>
					) : (
						copy.variableLines.map((line) => <p key={line}>{line}</p>)
					)}
				</div>
				<p>{copy.closingLine}</p>
			</div>

			<AlertDialogFooter>
				<AlertDialogCancel disabled={pending}>Keep on</AlertDialogCancel>
				<AlertDialogAction
					className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					disabled={pending}
					onClick={onConfirm}
				>
					{pending ? "Turning off…" : "Turn off"}
				</AlertDialogAction>
			</AlertDialogFooter>
		</>
	);
}

/**
 * The confirmation dialog `PluginCard` opens when the user turns a plugin
 * OFF (TEA — Plugin management surface D3) — never for turning on. A failed
 * consequence read still lets the user confirm — only the two number-
 * dependent lines are dropped, never the switch itself.
 */
export function PluginOffConfirmDialog({
	onConfirm,
	onOpenChange,
	open,
	pending,
	pluginId,
	pluginName,
}: PluginOffConfirmDialogProps) {
	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			<AlertDialogContent>
				{open && (
					<PluginOffConfirmDialogBody
						key={pluginId}
						onConfirm={onConfirm}
						pending={pending}
						pluginId={pluginId}
						pluginName={pluginName}
					/>
				)}
			</AlertDialogContent>
		</AlertDialog>
	);
}
