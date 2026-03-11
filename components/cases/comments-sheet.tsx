"use client";

import { useState } from "react";
import type { Node } from "reactflow";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import useStore from "@/store/store";
import NodeComment from "./node-comment";

type NodeWithData = Node & {
	data: {
		id: number;
	};
};

/**
 * CommentsSheet - Sheet wrapper for comments panel
 *
 * Controlled by store state (commentsSheetOpen, commentsSheetNode).
 * Can be triggered from NodeActionGroup or other components.
 */
export default function CommentsSheet() {
	const {
		commentsSheetOpen,
		commentsSheetNode,
		setCommentsSheetOpen,
		assuranceCase,
	} = useStore();
	const [loading, setLoading] = useState(false);

	const readOnly = !!(
		assuranceCase?.permissions === "view" ||
		assuranceCase?.permissions === "comment"
	);

	const handleClose = () => {
		setCommentsSheetOpen(false);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			handleClose();
		}
	};

	// Don't render if no node is selected
	if (!commentsSheetNode) {
		return null;
	}

	const nodeName = (commentsSheetNode.data?.name as string) || "Element";

	return (
		<Sheet onOpenChange={handleOpenChange} open={commentsSheetOpen}>
			<SheetContent className="overflow-y-scroll" data-testid="comments-sheet">
				<SheetHeader>
					<SheetTitle>Comments for {nodeName}</SheetTitle>
					<SheetDescription>
						{readOnly
							? "View comments for this element."
							: "Add or view comments for this element."}
					</SheetDescription>
				</SheetHeader>
				<NodeComment
					handleClose={handleClose}
					loadingState={{ loading, setLoading }}
					node={commentsSheetNode as NodeWithData}
					readOnly={readOnly}
					setAction={() => {
						// No-op: Comments sheet doesn't use action navigation
					}}
				/>
			</SheetContent>
		</Sheet>
	);
}
