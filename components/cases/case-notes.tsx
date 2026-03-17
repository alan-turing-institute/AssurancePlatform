"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import useStore from "@/store/store";
import NotesSheet from "../ui/notes-sheet";
import NotesFeed from "./notes-feed";
import NotesForm from "./notes-form";

interface CaseNotesProps {
	isOpen: boolean;
	onClose: () => void;
}

const CaseNotes = ({ isOpen, onClose }: CaseNotesProps) => {
	const { assuranceCase } = useStore();
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!(isMounted && assuranceCase)) {
		return (
			<NotesSheet
				description="Loading notes..."
				isOpen={isOpen}
				onClose={onClose}
				title="Case Notes"
			>
				<div className="space-y-4">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</NotesSheet>
		);
	}

	return (
		<NotesSheet
			description={`Use this section to view ${assuranceCase.permissions !== "view" ? "and manage your" : ""} notes.`}
			isOpen={isOpen}
			onClose={onClose}
			title={`${assuranceCase.permissions !== "view" ? "Manage" : ""} Case Notes`}
		>
			{/* <CreateForm onClose={onClose} /> */}
			{assuranceCase.permissions !== "view" && <NotesForm />}
			<NotesFeed />
		</NotesSheet>
	);
};

export default CaseNotes;
