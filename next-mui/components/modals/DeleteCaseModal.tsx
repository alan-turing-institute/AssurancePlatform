'use client'

import React, { useCallback, useState } from "react";
import { Button, Typography } from "@mui/material";
import { ColumnFlow, RowFlow } from "@/components/common/Layouts";
import { useLoginToken } from "@/hooks/useAuth";
import ModalDialog from "@/components/common/ModalDialog";
import useId from "@mui/utils/useId";
// import LoadingSpinner from "./common/LoadingSpinner.jsx";
// import { Bin } from "./common/Icons.jsx";
import ErrorMessage from "@/components/common/ErrorMessage";
import { Trash2Icon } from "lucide-react";

/**
 * DeleteCaseModal presents a confirmation dialog for deleting an assurance case. It informs the user of the permanent consequences of this action and provides options to either cancel or proceed with the deletion. This component is critical for ensuring that users consciously acknowledge the deletion of an assurance case, preventing accidental data loss.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal dialog.
 * @param {Function} props.onClose - Callback function to be called when the modal is closed without deletion.
 * @param {string} props.caseId - The unique identifier of the assurance case to be deleted.
 * @param {Function} props.onDelete - Callback function to be called after the case has been successfully deleted.
 * @returns {JSX.Element} A modal dialog that prompts users to confirm or cancel the deletion of an assurance case.
 *
 * The component handles the deletion process internally, including API communication and error handling. It displays a loading indicator while the deletion is in progress and provides feedback in case of errors. The use of `ModalDialog`, `Typography`, and `Button` components from Material UI ensures a consistent and accessible user interface.
 */
function DeleteCaseModal({ isOpen, onClose, caseId, onDelete } : any) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  const [token] = useLoginToken();

  const titleId = useId();
  const descriptionId = useId();

  /**
   * Handle the deletion of the assurance case.
   *
   * @returns {void}
   * @throws {Error} If the deletion process fails.
   */
  const onDeleteClick = useCallback(() => {
    setLoading(true);
    setErrors([]);

    const requestOptions: RequestInit = {
      headers: {
        Authorization: `Token ${token}`,
      },
      method: "DELETE",
    };

    fetch(`http://localhost:8000/api/cases/${caseId}/`, requestOptions).then(() => {
        setLoading(false);
        onDelete();
      })
      .catch((err: any) => {
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
          This will permanently delete the file and its content. You cannot
          undo this action.
        </Typography>
        <ErrorMessage errors={errors}/>
        <RowFlow>
          {loading ? (
            // <LoadingSpinner />
            <p>Loading...</p>
          ) : (
            <>
              <Button
                variant="text"
                sx={{ marginLeft: "auto" }}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button variant="outlined" color="error" onClick={onDeleteClick} endIcon={<Trash2Icon />}>
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
