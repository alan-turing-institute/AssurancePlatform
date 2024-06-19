'use client'

import { useEffect, useState } from "react";
import EditSheet from "../ui/edit-sheet";
import MemberEditForm from "./MemberEditForm";

interface MemberEditProps {
  member: any
  isOpen: boolean
  onClose: () => void
}

const MemberEdit = ({ member, isOpen, onClose } : MemberEditProps ) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const onChange = (open: boolean) => {
    if(!open) {
      onClose()
    }
  };

  return (
    <EditSheet
      title={`Editing Member`}
      description="Use this form to update members."
      isOpen={isOpen} 
      onClose={onClose}
      onChange={onChange}
    >
      {member && <MemberEditForm member={member} />}
    </EditSheet>
  )
}

export default MemberEdit
