"use client";

import { PencilLine, Trash2, User2Icon } from "lucide-react";
import moment from "moment";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import useStore from "@/data/store";
import { unauthorized } from "@/hooks/use-auth";
import type { Comment, User } from "@/types";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import NotesEditForm from "./notes-edit-form";

export default function NotesFeed() {
	const { assuranceCase, caseNotes, setCaseNotes } = useStore();
	// const [token] = useLoginToken();
	const { data: session } = useSession();
	const [edit, setEdit] = useState<boolean>();
	const [editId, setEditId] = useState<number>();
	const [user, setUser] = useState<User | undefined>();
	const { toast } = useToast();

	if (assuranceCase?.comments) {
		assuranceCase.comments.sort(
			(a: Comment, b: Comment) =>
				new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
	}

	// Fetch case notes/comments
	useEffect(() => {
		const fetchSingleCase = async () => {
			const requestOptions: RequestInit = {
				headers: {
					Authorization: `Token ${session?.key}`,
				},
			};

			if (!assuranceCase) {
				return [];
			}

			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL}/api/cases/${assuranceCase.id}/`,
				requestOptions
			);

			if (response.status === 404 || response.status === 403) {
				// Return empty array if case not found or forbidden
				return [];
			}

			if (response.status === 401) {
				// Handle unauthorized access
				unauthorized();
				return [];
			}

			const { comments } = await response.json();
			return comments;
		};

		fetchSingleCase().then((comments) => setCaseNotes(comments || []));
	}, [assuranceCase, session?.key, setCaseNotes]);

	// Fetch current user
	useEffect(() => {
		const fetchCurrentUser = async () => {
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
				// Return undefined if user not found or forbidden
				return;
			}

			if (response.status === 401) {
				// Handle unauthorized access
				unauthorized();
				return;
			}

			const result = await response.json();
			return result;
		};

		fetchCurrentUser().then((result) => setUser(result));
	}, [session?.key]);

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

			const updatedComments = caseNotes.filter((comment) => comment.id !== id);
			setCaseNotes(updatedComments);
		} catch (_error) {
			toast({
				variant: "destructive",
				title: "Unable to delete comment",
				description: "Something went wrong trying to delete the comment.",
			});
		}
	};

	return (
		<div className="mt-4 px-4 py-8">
			<ul className="-mb-8">
				{caseNotes.length === 0 && (
					<p className="text-foreground/70">No notes have been added.</p>
				)}
				{caseNotes.map((note: Comment, index: number) => (
					<li key={note.id}>
						<div className="group relative pb-8">
							{index !== caseNotes.length - 1 ? (
								<span
									aria-hidden="true"
									className="-ml-px absolute top-5 left-9 h-full w-0.5 bg-gray-200 dark:bg-gray-800"
								/>
							) : null}
							<div className="relative flex items-start justify-start space-x-3 rounded-md p-4 group-hover:bg-gray-100/50 dark:group-hover:bg-foreground/10">
								<div className="relative mr-4">
									{/* <img
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white"
                    src={activityItem.imageUrl}
                    alt=""
                  /> */}
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 ring-8 ring-white dark:ring-slate-900">
										<User2Icon className="h-4 w-4 text-white" />
									</div>

									{/* <span className="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                    <ChatBubbleLeftEllipsisIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </span> */}
								</div>
								<div className="min-w-0 flex-1">
									<div>
										<div className="text-sm">
											<p className="font-medium text-foreground">
												{note.author}
											</p>
										</div>
										<p className="mt-0.5 text-foreground/70 text-sm">
											Created On:{" "}
											{moment(new Date(note.created_at)).format("DD/MM/YYYY")}
										</p>
									</div>
									<div className="mt-2 text-foreground text-sm">
										{edit && editId === note.id ? (
											<NotesEditForm note={note} setEdit={setEdit} />
										) : (
											<p className="whitespace-normal">{note.content}</p>
										)}
									</div>
								</div>
								{!edit &&
									assuranceCase?.permissions !== "view" &&
									user?.username === note.author && (
										<div className="hidden items-center justify-center gap-2 group-hover:flex">
											<Button
												className="bg-background text-foreground hover:bg-background/50"
												onClick={() => {
													setEdit(!edit);
													setEditId(note.id);
												}}
												size={"icon"}
											>
												<PencilLine className="h-4 w-4" />
											</Button>
											<Button
												onClick={() => handleNoteDelete(note.id)}
												size={"icon"}
												variant={"destructive"}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									)}
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
