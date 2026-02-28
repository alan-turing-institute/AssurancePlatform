import { zodResolver } from "@hookform/resolvers/zod";
import type React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	type CommentFormInput,
	commentFormSchema,
} from "@/lib/schemas/comment";
import useStore from "@/store/store";
import type { Comment } from "@/types/domain";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

type CommentsFormProps = {
	node: {
		type: string;
		data: {
			id: number;
		};
	};
	parentId?: string | null;
	onCancel?: () => void;
};

const CommentsForm: React.FC<CommentsFormProps> = ({
	node,
	parentId,
	onCancel,
}: CommentsFormProps) => {
	const { nodeComments, setNodeComments } = useStore();
	const [loading, setLoading] = useState(false);

	const submitButtonText = parentId ? "Reply" : "Add Comment";

	const form = useForm<CommentFormInput>({
		resolver: zodResolver(commentFormSchema),
		defaultValues: {
			comment: "",
		},
	});

	async function onSubmit(values: CommentFormInput) {
		setLoading(true);

		try {
			// Use the new unified comments API endpoint
			const url = `/api/elements/${node.data.id}/comments`;

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					content: values.comment,
					parentId: parentId ?? undefined,
				}),
			});

			if (!response.ok) {
				console.error("Failed to create comment:", response.status);
				return;
			}

			const result = await response.json();

			// Update comments based on whether this is a reply or top-level comment
			if (parentId) {
				// Find parent comment and add reply to its replies array
				const addReplyToParent = (comments: Comment[]): Comment[] =>
					comments.map((comment) => {
						if (comment.id === parentId) {
							return {
								...comment,
								replies: [...(comment.replies || []), result],
							};
						}
						if (comment.replies && comment.replies.length > 0) {
							return {
								...comment,
								replies: addReplyToParent(comment.replies),
							};
						}
						return comment;
					});
				setNodeComments(addReplyToParent(nodeComments));
				onCancel?.();
			} else {
				// Top-level comment: prepend to the list (newest first)
				setNodeComments([result, ...nodeComments]);
			}

			// Clear form input
			form.setValue("comment", "");
		} catch (error) {
			console.error("Error creating comment:", error);
		} finally {
			setLoading(false);
		}
	}

	return (
		<Form {...form}>
			<form
				className="mt-2 w-full space-y-8"
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<FormField
					control={form.control}
					name="comment"
					render={({ field }) => (
						<FormItem>
							<FormLabel className="hidden">New Comment</FormLabel>
							<FormControl>
								<Textarea
									placeholder="Type your comment here."
									rows={5}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<div className="flex items-center justify-start gap-3">
					<Button
						className="bg-primary text-primary-foreground hover:bg-primary/90"
						disabled={loading}
						type="submit"
					>
						{loading ? "Adding..." : submitButtonText}
					</Button>
					{onCancel && (
						<Button
							disabled={loading}
							onClick={onCancel}
							type="button"
							variant="ghost"
						>
							Cancel
						</Button>
					)}
				</div>
			</form>
		</Form>
	);
};

export default CommentsForm;
