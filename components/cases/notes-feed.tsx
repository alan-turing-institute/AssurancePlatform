"use client";

import { PencilLine, Trash2, User2Icon } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { fetchCaseComments } from "@/actions/cases";
import useStore from "@/data/store";
import { formatShortDate } from "@/lib/date";
import { useToast } from "@/lib/toast";
import type { Comment } from "@/types";
import { Button } from "../ui/button";
import NotesEditForm from "./notes-edit-form";

export default function NotesFeed() {
	const { assuranceCase, caseNotes, setCaseNotes } = useStore();
	const [edit, setEdit] = useState<boolean>();
	const [editId, setEditId] = useState<number | string>();
	const { data: session } = useSession();
	const { toast } = useToast();

	// Sort notes by created_at (newest first) - useMemo to avoid mutation
	const sortedNotes = useMemo(
		() =>
			[...caseNotes].sort(
				(a: Comment, b: Comment) =>
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
			),
		[caseNotes]
	);

	// Fetch case notes/comments
	useEffect(() => {
		if (!assuranceCase) {
			return;
		}

		fetchCaseComments(assuranceCase.id)
			.then((comments) => setCaseNotes(comments || []))
			.catch(() => {
				setCaseNotes([]);
			});
	}, [assuranceCase, setCaseNotes]);

	const handleNoteDelete = async (id: number | string) => {
		try {
			// Use Next.js API route which handles both Prisma and Django auth
			const response = await fetch(`/api/comments/${id}`, {
				method: "DELETE",
			});

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
				{sortedNotes.length === 0 && (
					<p className="text-foreground/70">No notes have been added.</p>
				)}
				{sortedNotes.map((note: Comment, index: number) => (
					<li key={note.id}>
						<div className="group relative pb-8">
							{index !== sortedNotes.length - 1 ? (
								<span
									aria-hidden="true"
									className="-ml-px absolute top-5 left-9 h-full w-0.5 bg-border"
								/>
							) : null}
							<div className="relative flex items-start justify-start space-x-3 rounded-md p-4 group-hover:bg-accent">
								<div className="relative mr-4">
									{/* <img
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white"
                    src={activityItem.imageUrl}
                    alt=""
                  /> */}
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary ring-8 ring-background">
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
											Created On: {formatShortDate(new Date(note.created_at))}
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
									session?.user?.name === note.author && (
										<div className="hidden items-center justify-center gap-2 group-hover:flex">
											<Button
												aria-label="Edit note"
												className="bg-background text-foreground hover:bg-background/50"
												onClick={() => {
													setEdit(!edit);
													setEditId(note.id);
												}}
												size={"icon"}
												title="Edit note"
											>
												<PencilLine className="h-4 w-4" />
											</Button>
											<Button
												aria-label="Delete note"
												onClick={() => handleNoteDelete(note.id)}
												size={"icon"}
												title="Delete note"
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
