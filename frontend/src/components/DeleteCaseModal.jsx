import React, { useCallback, useState } from "react";
import { Button, Typography } from "@mui/material";
import { deleteCase } from "./caseApi.js";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import ModalDialog from "./common/ModalDialog.jsx";
import useId from "@mui/utils/useId";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { Bin } from "./common/Icons.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

function DeleteCaseModal({ isOpen, onClose, caseId, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const titleId = useId();
  const descriptionId = useId();

  const onDeleteClick = useCallback(() => {
    setLoading(true);
    setErrors([]);
    deleteCase(token, caseId)
      .then(() => {
        setLoading(false);
        onDelete();
      })
      .catch((err) => {
        console.error(err);
        setErrors(["Something went wrong, please try again later."]);
        setLoading(false);
      });
  }, [token, caseId, onDelete]);

  return (
    <ModalDialog
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      open={isOpen}
      onClose={onClose}
    >
      <ColumnFlow>
        <Typography variant="h3" id={titleId}>
          Are you sure you want to delete this assurance case?
        </Typography>
        <Typography id={descriptionId}>
          This will permanently delete the file and it's content. You cannot
          undo this action.
        </Typography>
        <ErrorMessage errors={errors}/>
        <RowFlow>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              <Button
                variant="text"
                sx={{ marginLeft: "auto" }}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button variant="delete" onClick={onDeleteClick} endIcon={<Bin/>}>
                Delete
              </Button>
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </ModalDialog>
  );
}

export default DeleteCaseModal;
