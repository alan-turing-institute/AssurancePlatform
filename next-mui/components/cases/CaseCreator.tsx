'use client'

import React from "react";
import "regenerator-runtime/runtime";
// import CaseCreatorFlow from "./CaseCreatorFlow.jsx";
// import CaseImporterFlow from "./CaseImporterFlow.jsx";
// import ModalDialog from "./common/ModalDialog.jsx";
import useId from "@mui/utils/useId";
import { useEnforceLogin } from "@/hooks/useAuth";
import ModalDialog from "../common/ModalDialog";
import CaseCreatorOptions from "./CaseCreationOptions";
import CaseImporterFlow from "./CaseImporter";

/**
 * CaseCreator component that toggles between the CaseCreatorFlow and CaseImporterFlow based on user action.
 * It presents a modal dialog which either guides the user through creating a new assurance case
 * or importing an existing one. The component ensures that a user is logged in before allowing case creation
 * or importation.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Determines if the modal dialog is open.
 * @param {Function} props.onClose - Handler called when the modal dialog is requested to close.
 * @param {boolean} props.isImport - Flag determining which flow to show: true for import, false for creation.
 * @returns {JSX.Element|null} The rendered component if the user is logged in, otherwise null.
 */

interface CaseCreatorProps {
  isOpen: boolean
  onClose: () => void
  isImport: boolean
}

function CaseCreator({ isOpen, onClose, isImport } : CaseCreatorProps) {
  const titleId = useId();

  if (!useEnforceLogin()) {
    return null;
  }

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      {isImport ? (
        <CaseImporterFlow titleId={titleId} onClose={onClose} />
      ) : (
        <CaseCreatorOptions titleId={titleId} onClose={onClose} />
      )}
    </ModalDialog>
  );
}

export default CaseCreator;
