import React, { useCallback, useEffect, useState } from "react";
import { ColumnFlow, LayoutWithNav, RowFlow } from "./common/Layout";
import {
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  ListItemIcon,
  MenuItem,
  Typography,
  useTheme,
} from "@mui/material";
import { getBaseURL } from "./utils";
import LoadingSpinner from "./common/LoadingSpinner";
import { Link } from "react-router-dom";
import CaseCreator from "./CaseCreator";
import { unauthorized, useEnforceLogin, useLoginToken } from "../hooks/useAuth";
import mockup_diagram from "../images/mockup-diagram.png";
import { Add, ArrowTopRight, Bin, Draft, Share } from "./common/Icons";
import BurgerMenu from "./common/BurgerMenu";
import ExportCaseModal from "./ExportCaseModal";
import CommentSection from "./CommentSection";
import CasePermissionsManager from "./CasePermissionsManager";
import DeleteCaseModal from "./DeleteCaseModal";
import ErrorMessage from "./common/ErrorMessage";
import { CaseMediaPreview } from "./CaseMediaPreview";

const ThemedCard = ({ sx, ...props }) => {
  return (
    <Card
      elevation={0}
      sx={{
        ...sx,
        height: "29.0625rem",
        width: "22.0625rem",
        borderRadius: "0.5rem",
      }}
      {...props}
    />
  );
};

const CreateCard = ({ onCreateClick }) => {
  const theme = useTheme();

  return (
    <ThemedCard
      sx={{
        border: "none",
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
      }}
    >
      <CardActionArea
        onClick={onCreateClick}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "2rem",
        }}
      >
        <Add fontSize="large" />
        <Typography variant="h3" component="h2">
          Create a new case
        </Typography>
      </CardActionArea>
    </ThemedCard>
  );
};

const formatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const CaseCard = ({ caseObj, reload }) => {
  const theme = useTheme();

  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const onExportClick = useCallback(() => {
    setExportOpen(true);
    setMenuOpen(false);
  }, []);

  const onNotesClick = useCallback(() => {
    setNotesOpen(true);
    setMenuOpen(false);
  }, []);

  const onPermissionsClick = useCallback(() => {
    setPermissionsOpen(true);
    setMenuOpen(false);
  }, []);

  const onDeleteClick = useCallback(() => {
    setDeleteOpen(true);
    setMenuOpen(false);
  }, []);

  const onExportClose = useCallback(() => {
    setExportOpen(false);
  }, []);

  const onNotesClose = useCallback(() => {
    setNotesOpen(false);
  }, []);

  const onPermissionsClose = useCallback(() => {
    setPermissionsOpen(false);
  }, []);

  const onDeleteClose = useCallback(() => {
    setDeleteOpen(false);
  }, []);

  const onPermissionsSuccess = useCallback(() => {
    setPermissionsOpen(false);
  }, []);

  const onDeleteSuccess = useCallback(() => {
    setDeleteOpen(false);
    reload();
  }, [reload]);

  return (
    <ThemedCard sx={{ position: "relative" }}>
      <CardActionArea
        component={Link}
        to={"case/" + caseObj.id}
        sx={{ height: "100%" }}
      >
        <CaseMediaPreview caseObj={caseObj} />

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
            {caseObj.name}
          </Typography>
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
            {caseObj.description?.split("\n").map((str) => (
              <>
                {str}
                <br />
              </>
            ))}
          </Typography>
          {/* TODO, designs would prefer the updated date */}
          <Typography variant="body2">
            Created: {formatter.format(caseObj.createdDate)}
          </Typography>
        </CardContent>
      </CardActionArea>
      <BurgerMenu
        isOpen={menuOpen}
        setIsOpen={setMenuOpen}
        sx={{ position: "absolute", top: "1rem", right: "1rem" }}
      >
        {/* TODO add share functionality, possibly replacing groups and permissions */}
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
      />
    </ThemedCard>
  );
};

const LoadingCard = () => {
  return (
    <ThemedCard sx={{ display: "flex" }}>
      <LoadingSpinner sx={{ margin: "auto" }} />
    </ThemedCard>
  );
};

const ManageCases = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isImport, setIsImport] = useState(false);

  useEnforceLogin();
  const [token] = useLoginToken();

  const doLoad = useCallback(() => {
    let isMounted = true;

    let url = `${getBaseURL()}/cases/`;
    const requestOptions = {
      headers: {
        Authorization: `Token ${token}`,
      },
    };

    fetch(url, requestOptions)
      .then(
        (response) => {
          switch (response.status) {
            case 200:
              return response.json();
            case 401:
              unauthorized();
              break;
          }
        },
        (reason) => {
          console.log(reason);
          setError("Something went wrong. Please try again later.");
        }
      )
      .then((body) => {
        if (isMounted && body.map !== undefined) {
          setCases(
            body
              .map(({ id, name, description, created_date }) => ({
                id,
                name,
                description,
                createdDate: new Date(created_date),
              }))
              // descending
              .sort((a, b) => b.createdDate - a.createdDate)
          );
          setIsLoading(false);
        }
      })
      .catch((ex) => {
        console.error(ex);
        setIsLoading(false);
        setError("Something went wrong. Please try again later.");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // initial load
  useEffect(() => {
    doLoad();
  }, [doLoad]);

  const onCreateClick = useCallback(() => {
    setIsImport(false);
    setIsOpen(true);
  }, []);

  const onImportClick = useCallback(() => {
    setIsImport(true);
    setIsOpen(true);
  }, []);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <LayoutWithNav>
      <ColumnFlow sx={{ overflowY: "auto", gap: "2rem" }}>
        <RowFlow>
          <Typography variant="h1">Assurance Cases</Typography>
          <Button
            sx={{ marginLeft: "auto" }}
            onClick={onImportClick}
            variant="outlined"
            endIcon={<Add />}
          >
            Import File
          </Button>
        </RowFlow>
        <CaseCreator isOpen={isOpen} onClose={onClose} isImport={isImport} />
        {error ? <ErrorMessage errors={error} /> : <></>}
        {/* TODO split into mine and shared with me */}
        <RowFlow sx={{ flexWrap: "wrap" }}>
          <CreateCard onCreateClick={onCreateClick} />
          {isLoading ? (
            <LoadingCard />
          ) : (
            <>
              {cases.map((caseObj) => (
                <CaseCard caseObj={caseObj} reload={doLoad} />
              ))}
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </LayoutWithNav>
  );
};

export default ManageCases;
