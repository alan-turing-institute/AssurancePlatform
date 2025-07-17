'use client';

import { useEffect, useState } from 'react';
import useStore from '@/data/store';
import NotesSheet from '../ui/notes-sheet';
import NotesFeed from './notes-feed';
import NotesForm from './notes-form';

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
    return null;
  }

  return (
    <NotesSheet
      description={`Use this section to view ${assuranceCase.permissions !== 'view' ? 'and manage your' : ''} notes.`}
      isOpen={isOpen}
      onClose={onClose}
      title={`${assuranceCase.permissions !== 'view' ? 'Manage' : ''} Case Notes`}
    >
      {/* <CreateForm onClose={onClose} /> */}
      {assuranceCase.permissions !== 'view' && <NotesForm />}
      <NotesFeed />
    </NotesSheet>
  );
};

export default CaseNotes;
