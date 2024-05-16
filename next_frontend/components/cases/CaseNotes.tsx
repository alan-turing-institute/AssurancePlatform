'use client'

import { useEffect, useState } from "react";
import NotesSheet from "../ui/notes-sheet";
import NotesFeed from "./NotesFeed";
import NotesForm from "./NotesForm";
import useStore from "@/data/store";

interface CaseNotesProps {
  isOpen: boolean
  onClose: () => void
}

const CaseNotes = ({ isOpen, onClose } : CaseNotesProps ) => {
  const { assuranceCase } = useStore()
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <NotesSheet
      isOpen={isOpen}
      onClose={onClose}
      title='Manage Case Notes'
      description='Use this section to view and manage your notes.'
    >
      {/* <CreateForm onClose={onClose} /> */}
      <NotesForm />
      <NotesFeed />
    </NotesSheet>
  )
}

export default CaseNotes
