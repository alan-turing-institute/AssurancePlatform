import React, { useCallback, useState } from "react";
import {
  Alert,
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
        {errors.map((err) => (
          <Alert key={err} severity="error">
            {err}
          </Alert>
        ))}
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
