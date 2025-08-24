"use client";

import { PencilLine, Trash2, User2Icon } from "lucide-react";
import moment from "moment";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import useStore from "@/data/store";
import { unauthorized } from "@/hooks/use-auth";
import type { User } from "@/types";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import CommentsEditForm from "./comments-edit-form";

type CommentsFeedProps = {
	node: {
		type: string;
		data: {
			id: number;
		};
	};
};

export default function CommentsFeed({ node }: CommentsFeedProps) {
	const { assuranceCase, nodeComments, setNodeComments } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const [edit, setEdit] = useState<boolean>(false);
	const [editId, setEditId] = useState<number>();
	const [user, setUser] = useState<User | undefined>();
	const { toast } = useToast();

	const handleNoteDelete = async (id: number) => {
		try {
			const url = `${process.env.NEXT_PUBLIC_API_URL}/api/comments/${id}/`;

			const requestOptions: RequestInit = {
				method: "DELETE",
				headers: {
					Authorization: `Token ${session?.key}`,
					"Content-Type": "application/json",
				},
			};
			const response = await fetch(url, requestOptions);

			if (!response.ok) {
				toast({
					variant: "destructive",
					title: "Unable to delete comment",
					description: "Something went wrong trying to delete the comment.",
				});
				return;
			}

			const updatedComments = nodeComments.filter(
				(comment) => comment.id !== id
			);
			setNodeComments(updatedComments);
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Unable to delete comment",
				description: "Something went wrong trying to delete the comment.",
			});
		}
	};

	useEffect(() => {
		// TODO: Add any initialization logic if needed
	}, []);

	const fetchCurrentUser = useCallback(async () => {
		const requestOptions: RequestInit = {
			headers: {
				Authorization: `Token ${session?.key}`,
			},
		};

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/api/user/`,
			requestOptions
		);

		if (response.status === 404 || response.status === 403) {
			return;
		}

		if (response.status === 401) {
			return unauthorized();
		}

		const result = await response.json();
		return result;
	}, [session?.key]);

	// Fetch current user
	useEffect(() => {
		fetchCurrentUser()
			.then((result) => setUser(result))
			.catch(() => {
				// Handle error silently
				setUser(undefined);
			});
	}, [fetchCurrentUser]);

	return (
		<div className="mt-4 w-full py-2">
			{/* <p className='mb-6'>Exisitng comments</p> */}

			{nodeComments.length === 0 && (
				<p className="text-foreground/70">No comments have been added.</p>
			)}

			<div className="mb-16 flex w-full flex-col items-start justify-start gap-3">
				{nodeComments.map((comment) => (
					<div
						className="group relative w-full rounded-md p-3 text-foreground transition-all duration-300 hover:cursor-pointer hover:bg-indigo-500 hover:pb-8 hover:text-white"
						key={comment.id}
					>
						{edit && editId === comment.id ? (
							<CommentsEditForm
								comment={comment}
								node={node}
								setEdit={setEdit}
							/>
						) : (
							<p className="mb-1 whitespace-normal">{comment.content}</p>
						)}
						{edit && editId === comment.id ? null : (
							<div className="mt-3 flex items-center justify-start gap-2 text-muted-foreground text-xs transition-all duration-300 group-hover:text-white">
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
							</div>
						)}
						{!edit &&
							assuranceCase?.permissions !== "view" &&
							user?.username === comment.author && (
								<div className="absolute right-2 bottom-2 hidden group-hover:block">
									<div className="flex items-center justify-start gap-2">
										<Button
											className="hover:bg-indigo-800/50"
											onClick={() => {
												setEdit(!edit);
												setEditId(comment.id);
											}}
											size={"sm"}
											variant={"ghost"}
										>
											<PencilLine className="h-4 w-4" />
										</Button>
										<Button
											onClick={() => handleNoteDelete(comment.id)}
											size={"icon"}
											variant={"destructive"}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							)}
					</div>
				))}
			</div>
		</div>
	);
}
