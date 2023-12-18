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

function ExportCaseModal({ isOpen, onClose, assuranceCase }) {
  const [format, setFormat] = useState("json");

  const id = useId();
  const titleId = useId();

  const onChange = useCallback((e) => {
    setFormat(e.target.value);
  }, []);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      let json = neatJSON(assuranceCase);
      // Remove the `id` fields, since they are only meaningful to the backend, and might
      // confuse it when importing the JSON exported here.
      json = json.replaceAll(/"id":\d+(,)?/g, "");

      if (format === "json") {
        const name = json["name"];
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
      onClose();
    },
    [assuranceCase, format, onClose]
  );

  return (
    <ModalDialog aria-labelledby={titleId} open={isOpen} onClose={onClose}>
      <ColumnFlow component="form" onSubmit={onSubmit}>
        <Typography variant="h3" id={titleId}>
          <ArrowTopRight sx={{ marginRight: "1rem" }} />
          Export options
        </Typography>
        <FormControl>
          <FormLabel id={id}>File format:</FormLabel>
          <RadioGroup
            value={format}
            onChange={onChange}
            aria-labelledby={id}
            defaultValue="json"
          >
            <FormControlLabel value="json" control={<Radio />} label=".JSON" />
            <FormControlLabel value="svg" control={<Radio />} label=".SVG" />
          </RadioGroup>
        </FormControl>
        <RowFlow>
          <Button variant="text" sx={{ marginLeft: "auto" }} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Export</Button>
        </RowFlow>
      </ColumnFlow>
    </ModalDialog>
  );
}

export default ExportCaseModal;
