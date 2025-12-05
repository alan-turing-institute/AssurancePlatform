"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { Node } from "reactflow";
import useStore from "@/data/store";
import { useCaseEvents } from "@/hooks/use-case-events";
import { Skeleton } from "../ui/skeleton";
import CommentsForm from "./comment-form";
import CommentsFeed from "./comments-feed";

/** Event types that trigger a comments refetch */
const COMMENT_EVENTS = [
	"comment:created",
	"comment:updated",
	"comment:deleted",
];

type NodeWithData = Node & {
	data: {
		id: number;
	};
};

type NodeCommentProps = {
	node: NodeWithData;
	handleClose: () => void;
	loadingState: {
		loading: boolean;
		setLoading: Dispatch<SetStateAction<boolean>>;
	};
	setAction: Dispatch<SetStateAction<string | null>>;
	readOnly: boolean;
};

const NodeComment = ({
	node,
	handleClose: _handleClose,
	loadingState,
	setAction: _setAction,
	readOnly,
}: NodeCommentProps) => {
	const { loading, setLoading } = loadingState;
	const { assuranceCase, setNodeComments } = useStore();
	const [_filteredOrphanElements, _setFilteredOrphanElements] = useState<
		unknown[]
	>([]);
	const [_deleteOpen, _setDeleteOpen] = useState(false);

	// Get the case ID for SSE subscription
	const caseId = assuranceCase?.id?.toString() || "";
	const elementId = node.data.id;

	useEffect(() => {
		// Initialize component state on mount
	}, []);

	// Fetch Element Comments
	const fetchComments = useCallback(async () => {
		setLoading(true);

		try {
			const url = `/api/elements/${elementId}/comments`;

			const response = await fetch(url, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				console.error("Failed to fetch comments:", response.status);
				return [];
			}

			const result = await response.json();
			return Array.isArray(result) ? result : [];
		} catch (error) {
			console.error("Error fetching comments:", error);
			return [];
		} finally {
			setLoading(false);
		}
	}, [elementId, setLoading]);

	// Refetch comments and update store
	const refetchComments = useCallback(() => {
		fetchComments().then((result) => setNodeComments(result));
	}, [fetchComments, setNodeComments]);

	// Subscribe to real-time comment events via SSE (toast is shown globally)
	useCaseEvents({
		caseId,
		enabled: Boolean(caseId),
		onEvent: (event) => {
			// Check if this is a comment event for our element
			if (COMMENT_EVENTS.includes(event.type)) {
				const eventElementId = event.payload?.elementId;
				// Refetch if event is for this element or if elementId not specified
				if (!eventElementId || String(eventElementId) === String(elementId)) {
					refetchComments();
				}
			}
		},
	});

	// Initial comments load
	useEffect(() => {
		refetchComments();
	}, [refetchComments]);

	return (
		<div className="mt-8 flex flex-col items-start justify-start">
			<h3 className="mb-2 font-semibold text-lg">
				{readOnly ? "Comments" : "New Comment"}
			</h3>
			{!readOnly && (
				<CommentsForm node={node as { type: string; data: { id: number } }} />
			)}
			{loading ? (
				<div className="flex w-full flex-col justify-start gap-2 py-8">
					<Skeleton className="h-[10px] w-full rounded-full" />
					<Skeleton className="h-[10px] w-2/3 rounded-full" />
					<div className="flex items-center justify-start gap-2">
						<Skeleton className="h-[10px] w-[20px] rounded-full" />
						<Skeleton className="h-[10px] w-[100px] rounded-full" />
					</div>
				</div>
			) : (
				<CommentsFeed node={node as { type: string; data: { id: number } }} />
			)}
		</div>
	);
};

export default NodeComment;
