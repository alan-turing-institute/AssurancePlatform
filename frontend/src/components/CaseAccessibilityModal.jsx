import React, { useCallback, useState } from "react";
import {
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { editCase } from "./caseApi.js";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import { useLoginToken } from "../hooks/useAuth.js";
import ModalDialog from "./common/ModalDialog.jsx";
import useId from "@mui/utils/useId";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import configData from "../config.json";
import { Wheelchair } from "./common/Icons.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

/**
 * CaseAccessibilityModal provides a modal dialog for editing the accessibility options,
 * specifically the colour profile, of an assurance case diagram. Users can select from
 * predefined colour schemes configured in `config.json` to enhance diagram accessibility.
 *
 * @param {Object} props The component props.
 * @param {boolean} props.isOpen Indicates if the modal is open.
 * @param {Function} props.onClose Function to call when closing the modal.
 * @param {Function} props.onSuccess Function to call upon successful update of the case.
 * @param {string} props.caseId The ID of the case being edited.
 * @param {string} props.currentColour The current colour profile of the case diagram.
 *
 * This component utilizes the `editCase` API to submit the selected colour profile update,
 * handling loading states, success, and error feedback within the modal dialog. The colour
 * selection is made through a radio button group, offering a user-friendly way to enhance
 * diagram accessibility for users with visual impairments.
 */
function CaseAccessibilityModal({
  isOpen,
  onClose,
  onSuccess,
  caseId,
  currentColour,
}) {
  const [loading, setLoading] = useState(false);
  const [colour, setColour] = useState(currentColour);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const id = useId();
  const titleId = useId();

  const onChange = useCallback((e) => {
    setColour(e.target.value);
  }, []);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      setLoading(true);
      setErrors([]);
      editCase(token, caseId, {
        color_profile: colour,
      })
        .then(() => {
          setLoading(false);
          onSuccess();
        })
        .catch((err) => {
          console.error(err);
          setErrors(["Something went wrong, please try again later."]);
          setLoading(false);
        });
    },
    [token, caseId, colour, onSuccess]
  );

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow component="form" onSubmit={onSubmit}>
        <Typography variant="h3" id={titleId}>
          <Wheelchair sx={{marginRight: "1rem"}}/>
          Accessibility
        </Typography>
        <ErrorMessage errors={errors}/>
        <FormControl>
          <FormLabel id={id}>Diagram colour</FormLabel>
          <RadioGroup
            value={colour}
            onChange={onChange}
            aria-labelledby={id}
            defaultValue={currentColour}
          >
            {Object.keys(configData.mermaid_styles).map((key) => (
              <FormControlLabel
                key={key}
                value={key}
                control={<Radio />}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
              />
            ))}
          </RadioGroup>
        </FormControl>
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
              <Button type="submit">Save</Button>
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </ModalDialog>
  );
}

export default CaseAccessibilityModal;
