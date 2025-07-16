'use client';

import { useEffect, useState } from 'react';
import EditSheet from '../ui/edit-sheet';
import MemberEditForm from './member-edit-form';

type TeamMember = {
  id: number;
  name: string;
  title: string;
  department: string;
  email: string;
  role: string;
  isAdmin: boolean;
  image: string;
};

interface MemberEditProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
}

const MemberEdit = ({ member, isOpen, onClose }: MemberEditProps) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <EditSheet
      description="Use this form to update members."
      isOpen={isOpen}
      onChange={onChange}
      onClose={onClose}
      title={'Editing Member'}
    >
      {member && <MemberEditForm member={member} />}
    </EditSheet>
  );
};

export default MemberEdit;
