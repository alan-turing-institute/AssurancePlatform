'use client'

import "./FileInput.scss";
import { Button, IconButton, Typography, useTheme } from "@mui/material";
import { Trash2 } from "lucide-react";
import React, { useCallback, useRef } from "react";
// import { Remove } from "./Icons";

function FileInput({ file, setFile, accept }: any) {
  const fileInputRef = useRef(null);

  const onChange = useCallback(
    (e: any) => {
      setFile(e.target.files[0]);
    },
    [setFile]
  );

  const onClear = useCallback(
    (e: any) => {
      e.stopPropagation();
      setFile(null);
    },
    [setFile]
  );

  const theme = useTheme();

  // TODO progress / clear
  return (
    <Button
      component="label"
      variant="outlined"
      className="file-input-dropzone"
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: file ? "row" : "column",
        borderRadius: "0.5rem",
        height: "8rem",
      }}
    >
      {file ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.5rem' }}>
          <Typography>{file.name}</Typography>
          <IconButton aria-label="clear" onClick={onClear} sx={{ zIndex: 2 }}>
            <Trash2 color="red"/>
          </IconButton>
        </div>
      ) : (
        <>
          <Typography
            sx={{
              textDecoration: "underline",
              fontWeight: "bold",
              color: theme.palette.primary.main,
            }}
          >
            Choose file
          </Typography>
          <Typography>or drag and drop your file here</Typography>
        </>
      )}
      <input
        ref={fileInputRef}
        className="file-input-input"
        type="file"
        accept={accept}
        onChange={onChange}
      />
    </Button>
  );
}

export default FileInput;
