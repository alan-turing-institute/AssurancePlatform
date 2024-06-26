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

/**
 * DeleteItemModal presents a confirmation dialog for deleting an item (e.g., goal, context, claim) within an assurance case. This component is crucial for ensuring that users are fully aware of the permanent deletion of the item and any associated links. It provides users with a clear choice to either proceed with the deletion or cancel the action to prevent accidental data loss.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal dialog.
 * @param {Function} props.onClose - Callback function to be called when the modal is closed without deletion.
 * @param {string} props.id - The unique identifier of the item to be deleted.
 * @param {string} props.type - The type of the item to be deleted (e.g., "TopLevelNormativeGoal", "Context").
 * @param {string} props.name - The name of the item to be deleted, displayed in the modal for clarity.
 * @param {Function} props.onDelete - Callback function to be called after the item has been successfully deleted.
 * @returns {JSX.Element} A modal dialog that prompts users to confirm or cancel the deletion of an item within an assurance case.
 *
 * The component manages the deletion process, including API communication and error handling, and displays a loading indicator while the deletion is in progress. Through the use of Material UI components like `ModalDialog`, `Typography`, and `Button`, it ensures a consistent and accessible user interface, while the `ErrorMessage` component provides feedback in case of errors.
 */
function DeleteItemModal({ isOpen, onClose, id, type, name, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const titleId = useId();
  const descriptionId = useId();

  /**
   * Handle the deletion of the item.
   *
   * @returns {void}
   * @throws {Error} If the deletion process fails.
   */
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
              <Button variant="outlined" color="error" onClick={onDeleteClick} endIcon={<Bin/>}>
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
