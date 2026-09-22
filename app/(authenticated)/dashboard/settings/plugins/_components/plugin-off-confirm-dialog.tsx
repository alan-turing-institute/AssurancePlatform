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
				{/* Reserved to roughly two lines while loading so the footer
				buttons don't jump once the real (0-2 line) content arrives —
				before this, a single thin skeleton line grew by ~80px when the
				consequence numbers landed. */}
				<div className={cn("space-y-2", loading && "min-h-10")}>
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
