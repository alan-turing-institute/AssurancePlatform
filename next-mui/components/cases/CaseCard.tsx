'use client'

import { CardActionArea, CardContent, CardMedia, Typography, useTheme } from '@mui/material';
import React, { useCallback, useState } from 'react'
import { ThemedCard } from '../common/ThemeCard';
import NextLink from 'next/link'
// import { formatter } from '@/utils';
import moment from 'moment';
import CaseMenu from './CaseMenu';

interface CaseCardProps {
  assuranceCase: any
}

const CaseCard = ({ assuranceCase } : CaseCardProps) => {
  const theme = useTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [permissionsOpen, setPermissionsOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    // const onExportClick = useCallback(() => {
    //   setExportOpen(true);
    //   setMenuOpen(false);
    // }, []);

    // const onNotesClick = useCallback(() => {
    //   setNotesOpen(true);
    //   setMenuOpen(false);
    // }, []);

    // const onPermissionsClick = useCallback(() => {
    //   setPermissionsOpen(true);
    //   setMenuOpen(false);
    // }, []);

    // const onDeleteClick = useCallback(() => {
    //   setDeleteOpen(true);
    //   setMenuOpen(false);
    // }, []);

    // const onExportClose = useCallback(() => {
    //   setExportOpen(false);
    // }, []);

    // const onNotesClose = useCallback(() => {
    //   setNotesOpen(false);
    // }, []);

    // const onPermissionsClose = useCallback(() => {
    //   setPermissionsOpen(false);
    // }, []);

    // const onDeleteClose = useCallback(() => {
    //   setDeleteOpen(false);
    // }, []);

    // const onPermissionsSuccess = useCallback(() => {
    //   setPermissionsOpen(false);
    // }, []);

    // const onDeleteSuccess = useCallback(() => {
    //   setDeleteOpen(false);
    //   reload();
    // }, []);
    
    return (
      <ThemedCard sx={{ position: "relative" }}>
        <CardActionArea
          component={NextLink}
          href={"case/" + assuranceCase.id}
          sx={{ height: "100%" }}
        >
          {/* <CaseMediaPreview caseObj={caseObj} /> */}
          <CardMedia
            height={227}
            component="img"
            image={'https://images.unsplash.com/photo-1620207418302-439b387441b0?q=80&w=3067&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D'}
            alt=""
            sx={{ background: theme.palette.grey[200] }}
          />

          <CardContent
            sx={{
              padding: "1.5rem",
              display: "inline-flex",
              flexDirection: "column",
              gap: "0.5rem",
              width: "100%",
              height: "50%",
              textDecoration: "none",
              color: "unset",
              overflow: "hidden",
              zIndex: 99,
            }}
          >
            <Typography variant="h3" component="h2">
              {assuranceCase.name}
            </Typography>
            <div style={{ position: "absolute", top: "1rem", right: "1rem", zIndex: '99' }}>
              <CaseMenu caseId={assuranceCase.id} />
            </div>
            <Typography
              variant="body2"
              sx={{
                // TODO this will show elipses when the text is too wide vertically
                // but not horizontally. CSS has no easy solution here.
                flexGrow: 1,
                flexShrink: 1,
                textWrap: "wrap",
                textOverflow: "ellipsis",
                overflow: "clip",
                minHeight: 0,
              }}
            >
              {assuranceCase.description?.split("\n").map((str: string) => (
                <>
                  {str}
                  <br />
                </>
              ))}
            </Typography>
            {/* TODO, designs would prefer the updated date */}
            <Typography variant="body2">
              Created: {moment(assuranceCase.created_date).format('DD/MM/YYYY')}
            </Typography>
          </CardContent>
        </CardActionArea>
        {/* <BurgerMenu
          isOpen={menuOpen}
          setIsOpen={setMenuOpen}
          sx={{ position: "absolute", top: "1rem", right: "1rem" }}
        >
          
          <MenuItem onClick={onPermissionsClick}>
            <ListItemIcon>
              <Share fontSize="small" />
            </ListItemIcon>
            Permissions
          </MenuItem>
          <MenuItem onClick={onExportClick}>
            <ListItemIcon>
              <ArrowTopRight fontSize="small" />
            </ListItemIcon>
            Export
          </MenuItem>
          <MenuItem onClick={onNotesClick}>
            <ListItemIcon>
              <Draft fontSize="small" />
            </ListItemIcon>
            Notes
          </MenuItem>
          <MenuItem onClick={onDeleteClick}>
            <ListItemIcon>
              <Bin fontSize="small" />
            </ListItemIcon>
            Delete case
          </MenuItem>
        </BurgerMenu>
        <ExportCaseModal
          isOpen={exportOpen}
          onClose={onExportClose}
          caseId={caseObj.id}
        />
        <CommentSection
          isOpen={notesOpen}
          onClose={onNotesClose}
          caseId={caseObj.id}
        />
        <CasePermissionsManager
          isOpen={permissionsOpen}
          onClose={onPermissionsClose}
          caseId={caseObj.id}
          onSuccess={onPermissionsSuccess}
        />
        <DeleteCaseModal
          isOpen={deleteOpen}
          onClose={onDeleteClose}
          caseId={caseObj.id}
          onDelete={onDeleteSuccess}
        /> */}
      </ThemedCard>
    );
}

export default CaseCard
