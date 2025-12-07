"use client";

import {
	CheckCircle,
	ChevronDown,
	ChevronRight,
	MessageSquare,
	PencilLine,
	Trash2,
	User2Icon,
	XCircle,
} from "lucide-react";
import moment from "moment";
import { useSession } from "next-auth/react";
import { useState } from "react";
import useStore from "@/data/store";
import type { Comment } from "@/types/domain";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import CommentsForm from "./comment-form";
import CommentsEditForm from "./comments-edit-form";

type CommentsFeedProps = {
	node: {
		type: string;
		data: {
			id: number;
		};
	};
};

type CommentItemProps = {
	comment: Comment;
	node: CommentsFeedProps["node"];
	currentUsername: string | null | undefined;
	canEdit: boolean;
	depth?: number;
	onDelete: (id: number | string) => Promise<void>;
	onResolve: (id: string, resolved: boolean) => Promise<void>;
	onReply: (parentId: string) => void;
	replyingTo: string | null;
	setReplyingTo: (id: string | null) => void;
};

/**
 * Renders the resolved status banner for a comment.
 */
function ResolvedBanner({ comment }: { comment: Comment }) {
	if (!comment.resolved) {
		return null;
	}

	return (
		<div className="mb-2 flex items-center gap-1 text-green-600 text-xs dark:text-green-400">
			<CheckCircle className="h-3 w-3" />
			<span>
				Resolved by {comment.resolvedBy}
				{comment.resolvedAt &&
					` on ${moment(new Date(comment.resolvedAt)).format("DD/MM/YYYY")}`}
			</span>
		</div>
	);
}

/**
 * Renders the comment metadata (author, date, reply count).
 */
function CommentMeta({
	comment,
	isResolved,
	hasReplies,
	showReplies,
	onToggleReplies,
}: {
	comment: Comment;
	isResolved: boolean;
	hasReplies: boolean;
	showReplies: boolean;
	onToggleReplies: () => void;
}) {
	const hoverClass = isResolved ? "" : "group-hover:text-white";

	return (
		<div
			className={`mt-3 flex items-center justify-start gap-2 text-muted-foreground text-xs transition-all duration-300 ${hoverClass}`}
		>
			<User2Icon className="h-3 w-3" />
			<div>
				{comment.author}
				<svg
					aria-hidden="true"
					className="mx-2 inline h-0.5 w-0.5 fill-current"
					viewBox="0 0 2 2"
				>
					<circle cx={1} cy={1} r={1} />
				</svg>
				{moment(new Date(comment.created_at)).format("DD/MM/YYYY")}
			</div>

			{hasReplies && (
				<button
					className="ml-2 flex items-center gap-1 hover:text-indigo-400"
					onClick={onToggleReplies}
					type="button"
				>
					{showReplies ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
					{comment.replies?.length}{" "}
					{comment.replies?.length === 1 ? "reply" : "replies"}
				</button>
			)}
		</div>
	);
}

/**
 * Renders the action buttons for a comment.
 */
function CommentActions({
	isTopLevel,
	isResolved,
	isOwnComment,
	onReply,
	onResolve,
	onEdit,
	onDelete,
}: {
	isTopLevel: boolean;
	isResolved: boolean;
	isOwnComment: boolean;
	onReply: () => void;
	onResolve: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="absolute right-2 bottom-2 hidden group-hover:block">
			<div className="flex items-center justify-start gap-1">
				{isTopLevel && (
					<Button
						className="hover:bg-indigo-800/50"
						onClick={onReply}
						size="sm"
						title="Reply"
						variant="ghost"
					>
						<MessageSquare className="h-4 w-4" />
					</Button>
				)}

				{isTopLevel && (
					<Button
						className="hover:bg-indigo-800/50"
						onClick={onResolve}
						size="sm"
						title={isResolved ? "Unresolve" : "Resolve"}
						variant="ghost"
					>
						{isResolved ? (
							<XCircle className="h-4 w-4" />
						) : (
							<CheckCircle className="h-4 w-4" />
						)}
					</Button>
				)}

				{isOwnComment && (
					<Button
						className="hover:bg-indigo-800/50"
						onClick={onEdit}
						size="sm"
						title="Edit"
						variant="ghost"
					>
						<PencilLine className="h-4 w-4" />
					</Button>
				)}

				{isOwnComment && (
					<Button
						onClick={onDelete}
						size="icon"
						title="Delete"
						variant="destructive"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}

function CommentItem({
	comment,
	node,
	currentUsername,
	canEdit,
	depth = 0,
	onDelete,
	onResolve,
	onReply,
	replyingTo,
	setReplyingTo,
}: CommentItemProps) {
	const [edit, setEdit] = useState(false);
	const [showReplies, setShowReplies] = useState(true);

	const hasReplies = Boolean(comment.replies && comment.replies.length > 0);
	const isReplyingToThis = replyingTo === String(comment.id);
	const isResolved = comment.resolved === true;
	const isTopLevel = depth === 0;
	const isOwnComment = currentUsername === comment.author;

	const nestedClass =
		depth > 0
			? "ml-6 border-slate-200 border-l-2 pl-4 dark:border-slate-700"
			: "";

	const cardClass = isResolved
		? "bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30"
		: "hover:bg-indigo-500 hover:pb-8 hover:text-white";

	return (
		<div className={`w-full ${nestedClass}`}>
			<div
				className={`group relative w-full rounded-md p-3 text-foreground transition-all duration-300 hover:cursor-pointer ${cardClass}`}
			>
				{edit ? (
					<CommentsEditForm comment={comment} node={node} setEdit={setEdit} />
				) : (
					<>
						<ResolvedBanner comment={comment} />
						<p
							className={`mb-1 whitespace-normal ${isResolved ? "text-foreground/70" : ""}`}
						>
							{comment.content}
						</p>
					</>
				)}

				{!edit && (
					<CommentMeta
						comment={comment}
						hasReplies={hasReplies}
						isResolved={isResolved}
						onToggleReplies={() => setShowReplies(!showReplies)}
						showReplies={showReplies}
					/>
				)}

				{!edit && canEdit && (
					<CommentActions
						isOwnComment={isOwnComment}
						isResolved={isResolved}
						isTopLevel={isTopLevel}
						onDelete={() => onDelete(comment.id)}
						onEdit={() => setEdit(true)}
						onReply={() => onReply(String(comment.id))}
						onResolve={() => onResolve(String(comment.id), !isResolved)}
					/>
				)}
			</div>

			{isReplyingToThis && (
				<div className="mt-2 ml-6 border-indigo-200 border-l-2 pl-4 dark:border-indigo-700">
					<CommentsForm
						node={node}
						onCancel={() => setReplyingTo(null)}
						parentId={String(comment.id)}
					/>
				</div>
			)}

			{hasReplies && showReplies && (
				<div className="mt-2">
					{comment.replies?.map((reply) => (
						<CommentItem
							canEdit={canEdit}
							comment={reply}
							currentUsername={currentUsername}
							depth={depth + 1}
							key={reply.id}
							node={node}
							onDelete={onDelete}
							onReply={onReply}
							onResolve={onResolve}
							replyingTo={replyingTo}
							setReplyingTo={setReplyingTo}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export default function CommentsFeed({ node }: CommentsFeedProps) {
	const { assuranceCase, nodeComments, setNodeComments } = useStore();
	const { data: session } = useSession();
	const [replyingTo, setReplyingTo] = useState<string | null>(null);
	const { toast } = useToast();

	const currentUsername = session?.user?.name || session?.user?.email;
	const canEdit = assuranceCase?.permissions !== "view";

	const handleDelete = async (id: number | string) => {
		try {
			const response = await fetch(`/api/comments/${id}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Unable to delete comment",
					description: "Something went wrong trying to delete the comment.",
				});
				return;
			}

			const removeFromTree = (comments: Comment[]): Comment[] =>
				comments
					.filter((c) => String(c.id) !== String(id))
					.map((c) => ({
						...c,
						replies: c.replies ? removeFromTree(c.replies) : undefined,
					}));

			setNodeComments(removeFromTree(nodeComments));
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Unable to delete comment",
				description: "Something went wrong trying to delete the comment.",
			});
		}
	};

	const handleResolve = async (id: string, resolved: boolean) => {
		try {
			const response = await fetch(`/api/comments/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ resolved }),
			});

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Unable to update comment",
					description: "Something went wrong trying to update the comment.",
				});
				return;
			}

			const updated = await response.json();

			const updateInTree = (comments: Comment[]): Comment[] =>
				comments.map((c) => {
					if (String(c.id) === id) {
						return {
							...c,
							resolved: updated.resolved,
							resolvedBy: updated.resolvedBy,
							resolvedAt: updated.resolvedAt,
						};
					}
					return {
						...c,
						replies: c.replies ? updateInTree(c.replies) : undefined,
					};
				});

			setNodeComments(updateInTree(nodeComments));

			toast({
				title: resolved ? "Comment resolved" : "Comment reopened",
				description: resolved
					? "The comment thread has been marked as resolved."
					: "The comment thread has been reopened.",
			});
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Unable to update comment",
				description: "Something went wrong trying to update the comment.",
			});
		}
	};

	const handleReply = (parentId: string) => {
		setReplyingTo(parentId);
	};

	return (
		<div className="mt-4 w-full py-2">
			{nodeComments.length === 0 && (
				<p className="text-foreground/70">No comments have been added.</p>
			)}

			<div className="mb-16 flex w-full flex-col items-start justify-start gap-3">
				{nodeComments.map((comment) => (
					<CommentItem
						canEdit={canEdit}
						comment={comment}
						currentUsername={currentUsername}
						key={comment.id}
						node={node}
						onDelete={handleDelete}
						onReply={handleReply}
						onResolve={handleResolve}
						replyingTo={replyingTo}
						setReplyingTo={setReplyingTo}
					/>
				))}
			</div>
		</div>
	);
}
