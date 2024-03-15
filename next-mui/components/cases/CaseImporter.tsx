import React, { useState, useCallback, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
import "regenerator-runtime/runtime";
import { decodeFromHtml, getBaseURL } from "@/utils";
import { useLoginToken } from "@/hooks/useAuth";
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { ColumnFlow, RowFlow } from "@/components/common/Layouts";
import TextInput from "@/components/common/TextInput";
// import LoadingSpinner from "./common/LoadingSpinner.jsx";
import FileInput from "@/components/common/FileInput";
// import { ArrowRight } from "./common/Icons.jsx";
import ErrorMessage from "@/components/common/ErrorMessage";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * CaseImporterFlow allows users to import an assurance case into the TEA Platform from either a file or a URL.
 * It supports importing from SVG files with embedded JSON metadata or directly from JSON files.
 *
 * @param {Object} props The component props.
 * @param {string} props.titleId A unique identifier for the title element, used for accessibility.
 * @param {Function} props.onClose A function to call when closing the import modal.
 */
function CaseImporterFlow({ titleId, onClose }: any) {
  const [uploadType, setUploadType] = useState("file");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<any>();
  const [fileJson, setFileJson] = useState<any>();
  const [urlError, setUrlError] = useState("");
  const [fileError, setFileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [dirtyF, setDirtyF] = useState<boolean>(false);
  const [dirtyU, setDirtyU] = useState<boolean>(false);

  const [token] = useLoginToken();
  const baseURL = `${getBaseURL()}`;
  // const navigate = useNavigate();
  const router = useRouter()

  /** Parses SVG text to extract embedded JSON metadata
   * @param {string} text The SVG text to parse
   * @returns {Promise<Object>} The parsed JSON metadata
   * @throws {Error} If the metadata cannot be parsed
   */
  const parseSvg = useCallback(async (text: string) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(text, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (svgElement && svgElement.hasAttribute("data-metadata")) {
      const metadataStr = svgElement.getAttribute("data-metadata");
      try {
        return JSON.parse(JSON.parse(decodeFromHtml(metadataStr)));
      } catch (err) {
        console.error("Error parsing metadata:", err);
      }
    }
  }, []);

  /** Fetches content from a URL and tries to parse it as JSON or SVG
   *
   * @param {string} url
   * @returns {Promise<Object>} The parsed JSON or SVG content
   * @throws {Error} If the content cannot be loaded or parsed
   */
  const getUrlContent = useCallback(
    async (url: any) => {
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

  /**
   * Posts the JSON representation of a case to the backend
   *
   * @param {Object} json The case JSON to post
   * @returns {Promise<void>}
   * @throws {Error} If the JSON cannot be posted
   */
  const postCaseJSON = useCallback(
    (json: any) => {
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(json),
      };

      setLoading(true);

      fetch(baseURL + "/cases/", requestOptions)
        .then((response) => response.json())
        .then((json) => {
          if (json.id) {
            // navigate("/case/" + json.id);
            router.push(`/case/${json.id}`)
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
    [token, baseURL]
  );

  /**
   * Handles form submission for importing a case
   *
   * @param {Event} e The form submission event
   * @returns {void}
   * @throws {Error} If the form submission fails
   */
  const onSubmit = useCallback(
    (e: any) => {
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
            postCaseJSON(json);
          }
        });
      } else {
        postCaseJSON(fileJson);
      }
    },
    [uploadType, url, fileJson, getUrlContent, postCaseJSON]
  );

  /**
   * Handles changes in the selected upload type (file or URL)
   * @param {Event} e The change event
   * @returns {void}
   * @throws {Error} If the change event fails
   */
  const onTypeChange = useCallback((e: any) => {
    setUploadType(e.target.value);
  }, []);

  /**
   * Processes the selected file to extract JSON data.
   *
   * @returns {void}
   */
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
        const readerStr = reader.result?.toString() ?? ''
        const svgDoc = parser.parseFromString(readerStr, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");

        if (svgElement && svgElement.hasAttribute("data-metadata")) {
          const metadataStr: string = svgElement.getAttribute("data-metadata") ?? ''
          try {
            const metadataJSON = JSON.parse(metadataStr);
            setFileJson(JSON.parse(metadataJSON));
          } catch (err) {
            // TODO error could be better
            setFileError("File is not a valid SVG");
            console.error("Error parsing metadata:", err);
          }
        }
      } else {
        // If not an SVG, proceed as before
        const case_json = reader.result?.toString();
        if(case_json != null) {
          try {
            setFileJson(JSON.parse(case_json));
          } catch (err) {
            setFileError("File is not a valid JSON");
            console.error("Error pasrsing file:", err);
          }
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
        <FormControlLabel value="url" control={<Radio />} label="URL upload" />
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
          // <LoadingSpinner />
          <p>Loading...</p>
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
