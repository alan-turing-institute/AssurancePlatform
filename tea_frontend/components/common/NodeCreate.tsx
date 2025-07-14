'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import CreateSheet from '../ui/create-sheet';
import CreateForm from './CreateForm';
import { AlertModal } from '../modals/alertModal';

interface NodeCreateProps {
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // onClose: () => void
}

const NodeCreate = ({ isOpen, setOpen }: NodeCreateProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [unresolvedChanges, setUnresolvedChanges] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const handleClose = () => {
    setOpen(false);
    setAlertOpen(false);
    setUnresolvedChanges(false);
  };

  const onChange = (open: boolean) => {
    if (unresolvedChanges) {
      setAlertOpen(true);
    } else {
      handleClose();
    }
  };

  return (
    <CreateSheet isOpen={isOpen} onClose={handleClose} onChange={onChange}>
      <CreateForm
        onClose={handleClose}
        setUnresolvedChanges={setUnresolvedChanges}
      />

      <AlertModal
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        onConfirm={handleClose}
        loading={loading}
        message={
          'You have changes that have not been updated. Would you like to discard these changes?'
        }
        confirmButtonText={'Yes, discard changes!'}
        cancelButtonText={'No, keep editing'}
      />
    </CreateSheet>
  );
};

export default NodeCreate;
