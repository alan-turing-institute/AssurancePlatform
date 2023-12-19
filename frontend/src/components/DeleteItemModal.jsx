import React, { useCallback, useState } from "react";
import { Button, Typography } from "@mui/material";
import { deleteItem } from "./caseApi.js";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import ModalDialog from "./common/ModalDialog.jsx";
import useId from "@mui/utils/useId";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { Bin } from "./common/Icons.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

function DeleteItemModal({ isOpen, onClose, id, type, name, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const titleId = useId();
  const descriptionId = useId();

  const onDeleteClick = useCallback(() => {
    setLoading(true);
    setErrors([]);
    deleteItem(token, id, type)
      .then(() => {
        setLoading(false);
        onDelete();
      })
      .catch((err) => {
        console.error(err);
        setErrors(["Something went wrong, please try again later."]);
        setLoading(false);
      });
  }, [token, id, type, onDelete]);

  return (
    <ModalDialog
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      open={isOpen}
      onClose={onClose}
    >
      <ColumnFlow>
        {/* TODO 297 change text once links aren't deleted */}
        <Typography variant="h3" id={titleId}>
          Are you sure you want to delete {name} and associated links?
        </Typography>
        <Typography id={descriptionId}>
          This claim and all items linked to it will be permanently deleted. You
          cannot undo this action.
        </Typography>
        <ErrorMessage errors={errors} />
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
              <Button variant="text" color="error" onClick={onDeleteClick} endIcon={<Bin/>}>
                Delete
              </Button>
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </ModalDialog>
  );
}

export default DeleteItemModal;
