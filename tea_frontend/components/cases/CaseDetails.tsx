'use client';

import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from 'react';
import useStore from '@/data/store';
import { AlertModal } from '../modals/alertModal';
import CaseSheet from '../ui/case-sheet';
import CaseEditForm from './CaseEditForm';

interface CaseDetailsProps {
  isOpen: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const CaseDetails = ({ isOpen, setOpen }: CaseDetailsProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unresolvedChanges, setUnresolvedChanges] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  const { assuranceCase } = useStore();

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
    <CaseSheet
      description={
        'Use this form to update your assurance case name and description.'
      }
      isOpen={isOpen}
      onChange={onChange}
      onClose={handleClose}
      title={`${assuranceCase.permissions === 'manage' ? 'Update' : ''} Assurance Case`}
    >
      <div className="my-6">
        <CaseEditForm
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
      </div>
    </CaseSheet>
  );
};

export default CaseDetails;
