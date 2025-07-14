'use client';

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { AlertModal } from '../modals/alertModal';
import CreateSheet from '../ui/create-sheet';
import CreateForm from './create-form';

interface NodeCreateProps {
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  // onClose: () => void
}

const NodeCreate = ({ isOpen, setOpen }: NodeCreateProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [unresolvedChanges, setUnresolvedChanges] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, _setLoading] = useState(false);

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

  const onChange = (_open: boolean) => {
    if (unresolvedChanges) {
      setAlertOpen(true);
    } else {
      handleClose();
    }
  };

  return (
    <CreateSheet isOpen={isOpen} onChange={onChange} onClose={handleClose}>
      <CreateForm
        onClose={handleClose}
        setUnresolvedChanges={setUnresolvedChanges}
      />

      <AlertModal
        cancelButtonText={'No, keep editing'}
        confirmButtonText={'Yes, discard changes!'}
        isOpen={alertOpen}
        loading={loading}
        message={
          'You have changes that have not been updated. Would you like to discard these changes?'
        }
        onClose={() => setAlertOpen(false)}
        onConfirm={handleClose}
      />
    </CreateSheet>
  );
};

export default NodeCreate;
