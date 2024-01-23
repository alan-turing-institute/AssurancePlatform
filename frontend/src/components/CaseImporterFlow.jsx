import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "regenerator-runtime/runtime";
import { decodeFromHtml, getBaseURL } from "./utils.js";
import { useLoginToken } from "../hooks/useAuth.js";
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import TextInput from "./common/TextInput.jsx";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import FileInput from "./common/FileInput.jsx";
import { ArrowRight } from "./common/Icons.jsx";
import ErrorMessage from "./common/ErrorMessage.jsx";

function CaseImporterFlow({ titleId, onClose }) {
  const [uploadType, setUploadType] = useState("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState();
  const [fileJson, setFileJson] = useState();
  const [urlError, setUrlError] = useState("");
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dirtyF, setDirtyF] = useState("");
  const [dirtyU, setDirtyU] = useState("");

  const [token] = useLoginToken();
  const baseURL = `${getBaseURL()}`;
  const navigate = useNavigate();

  const parseSvg = useCallback(async (text) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (svgElement && svgElement.hasAttribute("data-metadata")) {
      const metadataStr = svgElement.getAttribute("data-metadata");
      try {
        return JSON.parse(decodeFromHtml(metadataStr));
      } catch (err) {
        console.error("Error parsing metadata:", err);
      }
    }
  }, []);

  const getUrlContent = useCallback(
    /** @param {string} url */
    async (url) => {
      try {
        const response = await fetch(url);
        const type = response.headers.get("content-type");
        if (type === "image/svg+xml" || url.toUpperCase().endsWith(".SVG")) {
          return parseSvg(await response.text());
        } else {
          try {
            const json = await response.json();
            return json;
          } catch (ex) {
            console.error(ex);
            setErrors(["Could not parse result as JSON"]);
            setLoading(false);
          }
        }
      } catch (ex) {
        console.error(ex);
        setErrors(["Could not load content from the given url."]);
        setLoading(false);
      }
    },
    [parseSvg]
  );

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
      if (uploadType === "url" && !url) {
        setDirtyU(true);
        return;
      } else if (uploadType === "file" && !fileJson) {
        setDirtyF(true);
        return;
      }

      setLoading(true);
      if (uploadType === "url") {
        getUrlContent(url).then((json) => {
          if (json) {
            postCaseJSON(JSON.stringify(json));
          }
        });
      } else {
        postCaseJSON(fileJson);
      }
    },
    [uploadType, url, fileJson, getUrlContent, postCaseJSON]
  );

  const onTypeChange = useCallback((e) => {
    setUploadType(e.target.value);
  }, []);

  useEffect(() => {
    if (!file) {
      setFileJson(null);
      return;
    }

    let isMounted = true;

    const reader = new FileReader();

    reader.onloadend = () => {
      if (!isMounted) {
        return;
      }
      if (file.type === "image/svg+xml") {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(reader.result, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (svgElement && svgElement.hasAttribute("data-metadata")) {
          const metadataStr = svgElement.getAttribute("data-metadata");
          try {
            const metadataJSON = JSON.parse(metadataStr);
            setFileJson(metadataJSON);
          } catch (err) {
            // TODO error could be better
            setFileError("File is not a valid SVG");
            console.error("Error parsing metadata:", err);
          }
        }
      } else {
        // If not an SVG, proceed as before
        const case_json = reader.result;
        try {
          setFileJson(JSON.parse(case_json));
        } catch (err) {
          setFileError("File is not a valid JSON");
          console.error("Error pasrsing file:", err);
        }
      }
    };

    reader.readAsText(file);

    return () => {
      isMounted = false;
      reader.abort();
    };
  }, [file]);

  return (
    <ColumnFlow component="form" onSubmit={onSubmit} noValidate>
      <Typography id={titleId} variant="h2" component="h3">
        Import file
      </Typography>
      <Typography>Import a file to create a case.</Typography>
      <ErrorMessage errors={errors} />
      <RadioGroup value={uploadType} onChange={onTypeChange} row>
        <FormControlLabel
          value="file"
          control={<Radio />}
          label="File upload"
        />
        <FormControlLabel value="url" control={<Radio />} label="Url upload" />
      </RadioGroup>
      {uploadType === "file" ? (
        <FileInput
          file={file}
          setFile={setFile}
          error={fileError}
          setError={setFileError}
          accept=".svg,.json,image/svg+xml,application/json"
          required
          dirty={dirtyF}
        />
      ) : (
        <TextInput
          label="Import file from URL:"
          value={url}
          setValue={setUrl}
          error={urlError}
          setError={setUrlError}
          dirty={dirtyU}
          required
          placeholder="https://www.testlink.com/123.json"
          noRequiredSymbol
          helperText="Supported: JSON, SVG"
          inputProps={{
            inputMode: "url",
          }}
        />
      )}
      <RowFlow sx={{ marginTop: "auto" }}>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{ marginLeft: "auto" }}
            >
              Cancel
            </Button>
            <Button type="submit" endIcon={<ArrowRight />}>
              Continue
            </Button>
          </>
        )}
      </RowFlow>
    </ColumnFlow>
  );
}

export default CaseImporterFlow;
