import { Button } from "@mui/material";
import React, { useCallback, useRef } from "react";

function FileInput({ file, setFile, accept }) {
  const fileInputRef = useRef(null);

  const onChange = useCallback(
    (e) => {
      setFile(e.target.files[0]);
    },
    [setFile]
  );

  // TODO progress / clear
  return (
    <Button component="label" variant="outlined">
      {file ? (
        <>{file.name}</>
      ) : (
        <>
          Choose file
          <b /> or drag and drop your file here
        </>
      )}

      <input
        ref={fileInputRef}
        className="assistive-text"
        type="file"
        accept={accept}
        onChange={onChange}
      />
    </Button>
  );
}

export default FileInput;
