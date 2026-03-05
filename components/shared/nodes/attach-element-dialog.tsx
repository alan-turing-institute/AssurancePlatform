"use client";

import { Database, FolderOpenDot, Loader2, Route } from "lucide-react";
import { useState } from "react";
import type { Node } from "reactflow";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { attachCaseElement } from "@/lib/case";
import {
	getCompatibleChildTypes,
	normaliseOrphanType,
} from "@/lib/element-compatibility";
import { recordAttach } from "@/lib/services/history-service";
import { toastError, toastSuccess } from "@/lib/toast";
import useStore from "@/store/store";
import type { DiagramNodeType } from "./node-config";

export type AttachElementDialogProps = {
	node: Node;
	nodeType: DiagramNodeType;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** Map display types to icons */
const TYPE_ICONS: Record<string, typeof Database> = {
	evidence: Database,
	strategy: Route,
	property_claim: FolderOpenDot,
};

export function AttachElementDialog({
	node,
	nodeType,
	open,
	onOpenChange,
}: AttachElementDialogProps) {
	const { orphanedElements } = useStore();
	const [loading, setLoading] = useState(false);

	const compatibleTypes = getCompatibleChildTypes(nodeType);
	const compatibleOrphans = orphanedElements.filter((orphan) => {
		const normalised = normaliseOrphanType(orphan.type);
		return compatibleTypes.includes(normalised);
	});

	const handleAttach = async (orphan: (typeof orphanedElements)[0]) => {
		setLoading(true);

		const orphanNode = {
			id: orphan.id.toString(),
			type: orphan.type || "",
			position: { x: 0, y: 0 },
			data: {
				id: orphan.id,
				name: orphan.name,
				type: orphan.type || "",
			},
		};

		const parentNode = {
			id: node.id,
			type: node.type || "",
			position: { x: 0, y: 0 },
			data: node.data,
		};

		const result = await attachCaseElement(
			orphanNode,
			orphan.id,
			"",
			parentNode
		);

		if ("error" in result) {
			toastError("Failed to attach element");
		} else {
			const orphanType = normaliseOrphanType(orphan.type);
			recordAttach(orphan.id, orphanType, node.data.id as string | number, {
				id: orphan.id,
				name: orphan.name,
				type: orphan.type || "",
				description:
					typeof orphan.description === "string" ? orphan.description : "",
			});
			toastSuccess(`Attached ${orphan.name || "element"} successfully`);
			onOpenChange(false);
		}

		setLoading(false);
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Attach element</DialogTitle>
					<DialogDescription>
						Select an orphaned element to attach as a child of{" "}
						{(node.data?.name as string) || "this element"}.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea
					className={compatibleOrphans.length > 4 ? "h-64" : "h-auto"}
				>
					<div className="space-y-1">
						{compatibleOrphans.map((orphan) => {
							const normalised = normaliseOrphanType(orphan.type);
							const Icon = TYPE_ICONS[normalised];
							return (
								<button
									className="flex w-full items-center gap-3 rounded-md p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
									disabled={loading}
									key={orphan.id}
									onClick={() => handleAttach(orphan)}
									type="button"
								>
									{Icon && (
										<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
									)}
									<div className="min-w-0 flex-1">
										<span className="font-medium">{orphan.name}</span>
										{typeof orphan.description === "string" &&
											orphan.description !== "" && (
												<p className="truncate text-muted-foreground text-xs">
													{String(orphan.description)}
												</p>
											)}
									</div>
									{loading && <Loader2 className="h-4 w-4 animate-spin" />}
								</button>
							);
						})}
						{compatibleOrphans.length === 0 && (
							<p className="p-2 text-muted-foreground text-sm">
								No compatible orphaned elements found.
							</p>
						)}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	);
}
