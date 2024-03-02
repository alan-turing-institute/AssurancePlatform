'use client'

import React, { useCallback, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { AccessibilityIcon, ArrowRightFromLine, MoreVerticalIcon, NotebookIcon, Share2Icon, Trash2Icon, Type } from 'lucide-react';
import { Divider, IconButton, ListItemIcon, Typography } from '@mui/material';

export default function CaseMenu() {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showNotesMenu, setShowNotesMenu] = useState(false)
  const [showPermissionsMenu, setShowPermissionsMenu] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)

  // Menu Actions
  const onExportClick = useCallback(() => {
    // setExportOpen(true);
    // setMenuOpen(false);
    setShowExportMenu(true)
  }, []);

  const onNotesClick = useCallback(() => {
    // setNotesOpen(true);
    // setMenuOpen(false);
    alert('Notes Selected')
    setShowNotesMenu(true)
  }, []);

  const onPermissionsClick = useCallback(() => {
    // setPermissionsOpen(true);
    // setMenuOpen(false);
    alert('Peermissions Selected')
    setShowPermissionsMenu(true)
  }, []);

  const onDeleteClick = useCallback(() => {
    // setDeleteOpen(true);
    // setMenuOpen(false);
    alert('Delete Selected')
    setShowDeleteMenu(true)
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
    </div>
  );
}