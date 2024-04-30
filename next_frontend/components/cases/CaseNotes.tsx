'use client'

import { useEffect, useState } from "react";
import NotesSheet from "../ui/notes-sheet";
import NotesFeed from "./NotesFeed";
import NotesForm from "./NotesForm";

interface CaseNotesProps {
  isOpen: boolean
  onClose: () => void
}

const CaseNotes = ({ isOpen, onClose } : CaseNotesProps ) => {
  const [isMounted, setIsMounted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([
    // {
    //   id: 1,
    //   type: 'comment',
    //   person: { name: 'System User', href: '#' },
    //   imageUrl:
    //     'https://images.unsplash.com/photo-1520785643438-5bf77931f493?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80',
    //   comment:
    //     'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tincidunt nunc ipsum tempor purus vitae id. Morbi in vestibulum nec varius. Et diam cursus quis sed purus nam. ',
    //   date: '01/01/2001',
    // },
    // {
    //   id: 4,
    //   type: 'comment',
    //   person: { name: 'System User', href: '#' },
    //   imageUrl:
    //     'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80',
    //   comment:
    //     'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tincidunt nunc ipsum tempor purus vitae id. Morbi in vestibulum nec varius. Et diam cursus quis sed purus nam. Scelerisque amet elit non sit ut tincidunt condimentum. Nisl ultrices eu venenatis diam.',
    //   date: '01/01/2001',
    // },
  ])

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
      <NotesForm notes={notes} setNotes={setNotes} />
      <NotesFeed notes={notes} />
    </NotesSheet>
  )
}

export default CaseNotes
