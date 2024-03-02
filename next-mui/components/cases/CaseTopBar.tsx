'use client'

import React from 'react'
import { RowFlow } from '../common/Layouts'
import { Button, Paper, Typography } from '@mui/material'
import { DisguisedTextInput } from '../common/TextInput'
import { PlusIcon } from 'lucide-react'
import CaseMenu from './CaseMenu'

interface CaseTopBarProps {
  assuranceCase: any
  sx: any
  caseId: any
  onRefresh?: any
  setErrors?: any
  getIdForNewElement?: any
  updateAllIdentifiers?: any
  setSelected?: any
}

const CaseTopBar = (
  { 
    assuranceCase,
    sx,
    caseId,
    onRefresh,
    setErrors,
    getIdForNewElement,
    updateAllIdentifiers,
    setSelected 
  } : CaseTopBarProps) => {
  return (
    <RowFlow sx={sx}>
      <Paper sx={{ padding: "0.75rem 1rem", flexShrink: 1, zIndex: 99 }}>
        <RowFlow sx={{ alignItems: "center" }}>
          {/* <DisguisedTextInput
            value={assuranceCase.title}
            // setValue={setCaseName}
            // error={nameError}
            // setError={setNameError}
            placeholder="Case title"
            required
            maxLength={200}
          /> */}
          <Typography  tabIndex={0}>
            {assuranceCase.title}
          </Typography>
          <CaseMenu />
        </RowFlow>
      </Paper>
      <Button
        sx={{ marginLeft: "auto", zIndex: 99 }}
        variant="outlined"
        onClick={updateAllIdentifiers}
      >
        Reset names
      </Button>
      <Button startIcon={<PlusIcon />} sx={{ zIndex: 99 }}>
        Add Goal
      </Button>
      {/* <CaseAccessibilityModal
        isOpen={a11yOpen}
        onClose={onA11yClose}
        caseId={caseId}
        onSuccess={onA11ySuccess}
        currentColour={assuranceCase.color_profile}
      />
      <ExportCaseModal
        isOpen={exportOpen}
        onClose={onExportClose}
        caseId={caseId}
        assuranceCase={assuranceCase}
      />
      <CommentSection
        isOpen={notesOpen}
        onClose={onNotesClose}
        caseId={caseId}
      />
      <CasePermissionsManager
        isOpen={permissionsOpen}
        onClose={onPermissionsClose}
        caseId={caseId}
        assuranceCase={assuranceCase}
        onSuccess={onPermissionsSuccess}
      />
      <DeleteCaseModal
        isOpen={deleteOpen}
        onClose={onDeleteClose}
        caseId={caseId}
        onDelete={onDeleteSuccess}
      /> */}
    </RowFlow>
  )
}

export default CaseTopBar
