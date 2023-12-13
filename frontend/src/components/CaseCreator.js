import React from "react";
import "regenerator-runtime/runtime";
import { useEnforceLogin } from "../hooks/useAuth.js";
import CaseCreatorFlow from "./CaseCreatorFlow.jsx";
import CaseImporterFlow from "./CaseImporterFlow.jsx";
import ModalDialog from "./common/ModalDialog.jsx";

function CaseCreator({ titleId, isOpen, onClose, isImport }) {
  if (!useEnforceLogin()) {
    return null;
  }

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      {isImport ? (
        <CaseImporterFlow titleId={titleId} onClose={onClose} />
      ) : (
        <CaseCreatorFlow titleId={titleId} onClose={onClose} />
      )}
    </ModalDialog>
  );
}

export default CaseCreator;
