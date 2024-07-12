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
import { ColumnFlow, RowFlow } from "./common/Layout.jsx";
import ModalDialog from "./common/ModalDialog.jsx";
import useId from "@mui/utils/useId";
import { ArrowTopRight } from "./common/Icons.jsx";
import { neatJSON } from "neatjson";
import { saveAs } from "file-saver";
import SVGDownloader from "./SVGDownloader.js";
import LoadingSpinner from "./common/LoadingSpinner.jsx";
import { getCase } from "./caseApi.js";
import { useLoginToken } from "../hooks/useAuth.js";
import ErrorMessage from "./common/ErrorMessage.jsx";

/**
 * ExportCaseModal provides a user interface for exporting an assurance case in either JSON or SVG format. It allows users to select their preferred export format and initiates the download process. This component ensures that users can easily export and save their work for external use or archival purposes.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Controls the visibility of the export modal.
 * @param {Function} props.onClose - Callback function to close the export modal.
 * @param {string} props.caseId - The unique identifier of the assurance case to be exported.
 * @param {Object} props.assuranceCase - The loaded assurance case object. If not provided, the case will be fetched using the provided caseId.
 * @returns {JSX.Element} A modal dialog that provides options to export the assurance case in selected format.
 *
 * The component handles the export process based on the selected format: for JSON, it uses `neatJSON` to format the case data and `file-saver` library to initiate the download; for SVG, it utilizes a custom SVGDownloader class to generate and download the SVG representation of the case. It supports dynamic loading of the assurance case if not provided and handles errors during the export process.
 */
function ExportCaseModal({ isOpen, onClose, caseId, assuranceCase }) {
  const [format, setFormat] = useState("json");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const [token] = useLoginToken();

  const id = useId();
  const titleId = useId();

  const onChange = useCallback((e) => {
    setFormat(e.target.value);
  }, []);

  /**
   * Handle the export of the assurance case.
   *
   * @param {Event} e - The form submit event.
   * @returns {void}
   * @throws {Error} If the export process fails.
   */
  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      setErrors([]);
      setIsLoading(true);

      let loadedCase = assuranceCase;
      if (!loadedCase) {
        try {
          loadedCase = await getCase(token, caseId);
        } catch (err) {
          console.error(err);
          setIsLoading(false);
          setErrors(["Could not load case."]);
          return;
        }
      }

      let json = neatJSON(loadedCase);
      // Remove the `id` fields, since they are only meaningful to the backend, and might
      // confuse it when importing the JSON exported here.
      json = json.replaceAll(/"id":\d+(,)?/g, "");

      if (format === "json") {
        const name = loadedCase["name"];
        // Write to a file, which to the user shows as a download.
        const blob = new Blob([json], {
          type: "text/plain;charset=utf-8",
        });
        const now = new Date();
        // Using a custom date format because the ones that Date offers are either very long
        // or include characters not allowed in filenames on Windows.
        const datestr =
          now.getFullYear() +
          "-" +
          now.getMonth() +
          "-" +
          now.getDate() +
          "T" +
          now.getHours() +
          "-" +
          now.getMinutes() +
          "-" +
          now.getSeconds();
        const filename = name + "-" + datestr + ".json";
        saveAs(blob, filename);
      } else {
        const svgDownloader = new SVGDownloader();
        svgDownloader.handleDownloadSVG(json);
      }
      setIsLoading(false);
      onClose();
    },
    [token, assuranceCase, caseId, format, onClose]
  );

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow component="form" onSubmit={onSubmit}>
        <Typography variant="h3" id={titleId}>
          <ArrowTopRight sx={{ marginRight: "1rem" }} />
          Export options
        </Typography>
        <ErrorMessage errors={errors}/>
        {assuranceCase ? (
          <FormControl>
            <FormLabel id={id}>File format:</FormLabel>
            <RadioGroup
              value={format}
              onChange={onChange}
              aria-labelledby={id}
              defaultValue="json"
            >
              <FormControlLabel
                value="json"
                control={<Radio />}
                label=".JSON"
              />
              <FormControlLabel value="svg" control={<Radio />} label=".SVG" />
            </RadioGroup>
          </FormControl>
        ) : (
          <>
            {/* this is because we use mermaid to generate the svg */}
            <Typography variant="body2">
              Only .JSON export is supported from this menu.
            </Typography>
            <Typography variant="body2">
              To export as .SVG please open the case viewer.
            </Typography>
          </>
        )}
        <RowFlow>
          {isLoading ? (
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
              <Button type="submit">Export</Button>
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </ModalDialog>
  );
}

export default ExportCaseModal;
