import React, { useCallback, useState } from "react";
import { Button, Divider, ListItemIcon, MenuItem, Paper } from "@mui/material";
import { createItem, editCase } from "./caseApi.js";
import { RowFlow } from "./common/Layout.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import BurgerMenu from "./common/BurgerMenu.jsx";
import DeleteCaseModal from "./DeleteCaseModal.jsx";
import { useNavigate } from "react-router-dom";
import CaseAccessibilityModal from "./CaseAccessibilityModal.jsx";
import {
  Add,
  ArrowTopRight,
  Bin,
  Draft,
  Share,
  Wheelchair,
} from "./common/Icons.jsx";
import ExportCaseModal from "./ExportCaseModal.jsx";
import CommentSection from "./CommentSection.js";
import CasePermissionsManager from "./CasePermissionsManager.js";
import { DisguisedTextInput } from "./common/TextInput.jsx";

/**
 * CaseTopBar provides a top navigation bar for the assurance case page within the TEA Platform, offering various functionalities such as editing the case title, adding goals, managing accessibility settings, exporting, adding notes, managing permissions, and deleting the case. It enhances user interaction by providing quick access to these features directly from the case view.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.sx - The style properties applied to the component.
 * @param {Object} props.assuranceCase - The current assurance case object, containing case details.
 * @param {string} props.caseId - The unique identifier for the current assurance case.
 * @param {Function} props.onRefresh - Callback function to refresh the case view after certain actions.
 * @param {Function} props.setErrors - Callback function to handle errors and display them to the user.
 * @param {Function} props.getIdForNewElement - Function to generate IDs for new case elements.
 * @param {Function} props.updateAllIdentifiers - Function to update all identifiers/names within the case, ensuring uniqueness.
 * @param {Function} props.setSelected - Function to set the currently selected item in the case.
 * @returns {JSX.Element} The top navigation bar with case management features.
 */
function CaseTopBar({
  sx,
  assuranceCase,
  caseId,
  onRefresh,
  setErrors,
  getIdForNewElement,
  updateAllIdentifiers,
  setSelected,
}) {
  const [token] = useLoginToken();
  const navigate = useNavigate();

  const [nameError, setNameError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /**
   * Set the case name to the provided value.
   *
   * @param {string} name - The new name for the case.
   * @returns {void}
   */
  const setCaseName = useCallback(
    (name) => {
      editCase(token, caseId, { name })
        .then(() => onRefresh())
        .catch((err) => {
          console.error(err);
          setNameError("Could not change case name");
        });
    },
    [token, caseId, onRefresh]
  );

  /**
   * Add a new goal to the assurance case.
   *
   * @returns {void}
   * @throws {Error} If the goal cannot be added.
   */
  const addGoal = useCallback(() => {
    createItem(
      token,
      "TopLevelNormativeGoal",
      caseId,
      "AssuranceCase",
      getIdForNewElement("TopLevelNormativeGoal", caseId, "AssuranceCase")
    )
      .then((json) => {
        onRefresh();
        setSelected([json.id.toString(), "TopLevelNormativeGoal"]);
      })
      .catch((err) => {
        console.error(err);
        setErrors(["Could not add goal"]);
      });
  }, [token, caseId, onRefresh, setErrors, getIdForNewElement, setSelected]);

  const onA11yClick = useCallback(() => {
    setA11yOpen(true);
    setMenuOpen(false);
  }, []);

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

  const onA11yClose = useCallback(() => {
    setA11yOpen(false);
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

  const onA11ySuccess = useCallback(() => {
    onRefresh();
    setA11yOpen(false);
  }, [onRefresh]);

  const onPermissionsSuccess = useCallback(() => {
    setPermissionsOpen(false);
  }, []);

  const onDeleteSuccess = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <RowFlow sx={sx}>
      <Paper sx={{ padding: "0.75rem 1rem", flexShrink: 1, zIndex: 99 }}>
        <RowFlow sx={{ height: "2.75rem", alignItems: "center" }}>
          <DisguisedTextInput
            value={assuranceCase.name}
            setValue={setCaseName}
            error={nameError}
            setError={setNameError}
            placeholder="Case title"
            required
            maxLength={200}
          />
          <BurgerMenu isOpen={menuOpen} setIsOpen={setMenuOpen}>
            <MenuItem onClick={onA11yClick}>
              <ListItemIcon>
                <Wheelchair fontSize="small" />
              </ListItemIcon>
              Accessibility
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
            {/* TODO add share functionality, possibly replacing groups and permissions */}
            <MenuItem onClick={onPermissionsClick}>
              <ListItemIcon>
                <Share fontSize="small" />
              </ListItemIcon>
              Permissions
            </MenuItem>
            <Divider />
            <MenuItem onClick={onDeleteClick}>
              <ListItemIcon>
                <Bin fontSize="small" />
              </ListItemIcon>
              Delete case
            </MenuItem>
          </BurgerMenu>
        </RowFlow>
      </Paper>
      <Button
        sx={{ marginLeft: "auto", zIndex: 99 }}
        variant="outlined"
        onClick={updateAllIdentifiers}
      >
        Reset names
      </Button>
      <Button onClick={addGoal} startIcon={<Add />} sx={{ zIndex: 99 }}>
        Add Goal
      </Button>
      <CaseAccessibilityModal
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
      />
    </RowFlow>
  );
}

export default CaseTopBar;
