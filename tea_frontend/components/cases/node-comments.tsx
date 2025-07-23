"use client";

import { useSession } from "next-auth/react";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { Node } from "reactflow";
import useStore from "@/data/store";
import { Skeleton } from "../ui/skeleton";
import CommentsForm from "./comment-form";
import CommentsFeed from "./comments-feed";

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
	const { setNodeComments } = useStore();
	const [_filteredOrphanElements, _setFilteredOrphanElements] = useState<
		unknown[]
	>([]);
	const [_deleteOpen, _setDeleteOpen] = useState(false);

	// const [token] = useLoginToken();
	const { data: session } = useSession();

	useEffect(() => {
		// Initialize component state on mount
	}, []);

	// Fetch Element Comments
	const fetchComments = useCallback(async () => {
		setLoading(true);
		let entity: string;
		switch (node.type) {
			case "context":
				entity = "contexts";
				break;
			case "strategy":
				entity = "strategies";
				break;
			case "property":
				entity = "propertyclaims";
				break;
			case "evidence":
				entity = "evidence";
				break;
			default:
				entity = "goals";
				break;
		}

		try {
			const url = `${process.env.NEXT_PUBLIC_API_URL}/api/${entity}/${node.data.id}/comments/`;

			const requestOptions: RequestInit = {
				method: "GET",
				headers: {
					Authorization: `Token ${session?.key}`,
					"Content-Type": "application/json",
				},
			};
			const response = await fetch(url, requestOptions);
			const result = await response.json();
			return result;
		} catch (_error) {
			// Error is handled by setting loading state to false in finally block
			// Comments will remain as previous state if fetch fails
		} finally {
			setLoading(false);
		}
	}, [node.type, node.data.id, session?.key, setLoading]);

	useEffect(() => {
		fetchComments().then((result) => setNodeComments(result));
	}, [fetchComments, setNodeComments]);

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
