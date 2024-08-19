'use client'

import React, { Dispatch, SetStateAction, useEffect, useState } from 'react'
import CaseSheet from '../ui/case-sheet'
import useStore from '@/data/store'
import CaseEditForm from './CaseEditForm'
import { AlertModal } from '../modals/alertModal'

interface CaseDetailsProps {
  isOpen: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}

const CaseDetails = ({ isOpen, setOpen }: CaseDetailsProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false)
  const [unresolvedChanges, setUnresolvedChanges] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)

  const { assuranceCase } = useStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const handleClose = () => {
    setOpen(false)
    setAlertOpen(false)
    setUnresolvedChanges(false)
  }

  const onChange = (open: boolean) => {
    if (unresolvedChanges) {
      setAlertOpen(true)
    } else {
      handleClose()
    }
  };

  return (
    <CaseSheet
      title={`${assuranceCase.permissions !== 'view' ? 'Update' : ''} Assurance Case`}
      description={`Use this form to update your assurance case name and description.`}
      isOpen={isOpen}
      onClose={handleClose}
      onChange={onChange}
    >
      <div className='my-6'>
        <CaseEditForm onClose={handleClose} setUnresolvedChanges={setUnresolvedChanges}/>
        <AlertModal
          isOpen={alertOpen}
          onClose={() => setAlertOpen(false)}
          onConfirm={handleClose}
          loading={loading}
          message={'You have changes that have not been updated. Would you like to discard these changes?'}
          confirmButtonText={'Yes, discard changes!'}
          cancelButtonText={'No, keep editing'}
        />
      </div>
    </CaseSheet>
  )
}

export default CaseDetails
