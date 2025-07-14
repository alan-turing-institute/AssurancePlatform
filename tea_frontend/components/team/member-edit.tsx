'use client';

import MemberEditForm from '.*/member-edit-form';
import { useEffect, useState } from 'react';
import EditSheet from '../ui/edit-sheet';

interface MemberEditProps {
  member: any;
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
