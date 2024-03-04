'use client'

import React, { useCallback, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { AccessibilityIcon, ArrowRightFromLine, MoreVerticalIcon, NotebookIcon, Share2Icon, Trash2Icon, Type } from 'lucide-react';
import { Divider, IconButton, ListItemIcon, Typography } from '@mui/material';
import DeleteCaseModal from '../modals/DeleteCaseModal';
import { useRouter } from 'next/navigation';
import ExportCaseModal from '../modals/ExportCaseModal';

interface CaseMenuProps {
  caseId: any
}

export default function CaseMenu({ caseId } : CaseMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const router = useRouter()

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Menu Actions
  const onExportClick = useCallback(() => {
    setExportOpen(true);
    setAnchorEl(null);
  }, []);

  const onExportClose = useCallback(() => {
    setExportOpen(false);
  }, []);

  const onNotesClick = useCallback(() => {
    setNotesOpen(true);
    setAnchorEl(null);
  }, []);

  const onNotesClose = useCallback(() => {
    setNotesOpen(false);
  }, []);

  const onPermissionsClick = useCallback(() => {
    setPermissionsOpen(true);
    setAnchorEl(null);
  }, []);

  const onPermissionsClose = useCallback(() => {
    setPermissionsOpen(false);
  }, []);

  const onPermissionsSuccess = useCallback(() => {
    setPermissionsOpen(false);
  }, []);

  const onDeleteClick = useCallback(() => {
    setDeleteOpen(true);
    setAnchorEl(null);
  }, []);

  const onDeleteClose = useCallback(() => {
    setDeleteOpen(false);
  }, []);

  const onDeleteSuccess = useCallback(() => {
    router.push('/')
  }, []);

  return (
    <div>
      <IconButton
        aria-label="more"
        id="long-button"
        aria-controls={open ? 'long-menu' : undefined}
        aria-expanded={open ? 'true' : undefined}
        aria-haspopup="true"
        onClick={handleClick}
      >
        <MoreVerticalIcon />
      </IconButton>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
      >
        <MenuItem onClick={handleClose}>
          <ListItemIcon><AccessibilityIcon size={22} /></ListItemIcon>
          <Typography>Accessibility</Typography>
        </MenuItem>
        <MenuItem onClick={onExportClick}>
          <ListItemIcon><ArrowRightFromLine size={22} /></ListItemIcon>
          <Typography>Export</Typography>
        </MenuItem>
        <MenuItem onClick={onNotesClick}>
          <ListItemIcon><NotebookIcon size={22} /></ListItemIcon>
          <Typography>Notes</Typography>
        </MenuItem>
        <MenuItem onClick={onPermissionsClick}>
          <ListItemIcon><Share2Icon size={22} /></ListItemIcon>
          <Typography>Permissions</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={onDeleteClick} sx={{ color: 'Red' }}>
          <ListItemIcon><Trash2Icon size={22} color='red' /></ListItemIcon>
          <Typography>Delete</Typography>
        </MenuItem>
      </Menu>
      <ExportCaseModal
        isOpen={exportOpen}
        onClose={onExportClose}
        caseId={caseId}
      />
      {/* <CommentSection
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
      /> */}
      <DeleteCaseModal
        isOpen={deleteOpen}
        onClose={onDeleteClose}
        caseId={caseId}
        onDelete={onDeleteSuccess}
      />
    </div>
  );
}