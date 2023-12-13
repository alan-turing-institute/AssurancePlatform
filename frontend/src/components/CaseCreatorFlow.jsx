import React, { useState, useCallback } from "react";
import TemplateSelector from "./TemplateSelector.js";
import { useNavigate } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import { useLoginToken } from "../hooks/useAuth.js";
import { Alert, Typography } from "@mui/material";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import AtiButton from "./common/AtiButton.jsx";
import AtiTextField from "./common/AtiTextField.jsx";
import LoadingSpinner from "./common/LoadingSpinner.jsx";

// see models.py
const titleMaxLength = 200;
const descriptionMaxLength = 1000;

function CaseCreatorFlow({ titleId, onClose }) {
  const [stage, setStage] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [titleError, setTitleError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [errors, setErrors] = useState([]);
  const [dirty0, setDirty0] = useState(false);
  const [dirty1, setDirty1] = useState(false);
  const [loading, setLoading] = useState(false);

  const [token] = useLoginToken();
  const baseURL = `${getBaseURL()}`;
  const navigate = useNavigate();

  const postCaseJSON = useCallback(
    (json_str) => {
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: json_str,
      };

      setLoading(true);

      fetch(baseURL + "/cases/", requestOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.id) {
            navigate("/case/" + json.id);
          } else {
            console.error(json);
            setLoading(false);
            setErrors(["An error occurred, please try again later"]);
          }
        })
        .catch((ex) => {
          console.error(ex);
          setLoading(false);
          setErrors(["An error occurred, please try again later"]);
        });
    },
    [token, baseURL, navigate]
  );

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (stage === 0) {
        if (
          !title ||
          !description ||
          title.length >= titleMaxLength ||
          description.length >= descriptionMaxLength
        ) {
          setDirty0(true);
          return;
        }
        setStage(1);
      } else {
        if (!template) {
          setDirty1(true);
          return;
        }

        const case_json = JSON.parse(JSON.stringify(template));
        case_json["name"] = title;
        case_json["description"] = description;
        case_json["color_profile"] = "default";
        postCaseJSON(JSON.stringify(case_json));
      }
    },
    [stage, title, description, template, postCaseJSON]
  );

  const goBack = useCallback(() => {
    setStage(0);
  }, []);

  return (
    <ColumnFlow component="form" onSubmit={onSubmit} noValidate>
      <Typography id={titleId} variant="h2" component="h3">
        {stage === 0 ? "Create a new assurance case" : "Pick a template"}
      </Typography>
      {errors.map((err) => (
        <Alert key={err} severity="error">
          {err}
        </Alert>
      ))}
      {stage === 0 ? (
        <>
          <AtiTextField
            label="Title"
            value={title}
            setValue={setTitle}
            error={titleError}
            setError={setTitleError}
            dirty={dirty0}
            required
            maxLength={titleMaxLength}
            placeholder="Assurance Case 1"
          />
          <AtiTextField
            multiline
            label="Description"
            value={description}
            setValue={setDescription}
            error={descriptionError}
            setError={setDescriptionError}
            dirty={dirty0}
            required
            maxLength={descriptionMaxLength}
            placeholder="Write down a small description of what the case is intended for"
          />
        </>
      ) : (
        <>
          <TemplateSelector
            value={template}
            setValue={setTemplate}
            error={templateError}
            setError={setTemplateError}
            dirty={dirty1}
          />
        </>
      )}
      <RowFlow sx={{ marginTop: "auto" }}>
        {loading ? (
          <LoadingSpinner />
        ) : stage === 0 ? (
          <>
            <AtiButton
              onClick={onClose}
              variant="outlined"
              sx={{ marginLeft: "auto" }}
            >
              Cancel
            </AtiButton>
            <AtiButton type="submit">Continue</AtiButton>
          </>
        ) : (
          <>
            <AtiButton onClick={goBack} variant="text">
              Back
            </AtiButton>
            <AtiButton
              onClick={onClose}
              variant="outlined"
              sx={{ marginLeft: "auto" }}
            >
              Cancel
            </AtiButton>
            <AtiButton type="submit">Create</AtiButton>
          </>
        )}
      </RowFlow>
    </ColumnFlow>
  );
}

export default CaseCreatorFlow;
