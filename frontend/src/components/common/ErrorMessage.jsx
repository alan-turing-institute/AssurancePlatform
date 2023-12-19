import { Alert } from "@mui/material";
import * as React from "react";
import { ColumnFlow } from "./Layout";

function ErrorMessage({ errors }) {
  // accept string or array of strings
  const errorsInternal =
    typeof errors === "string" ? [errors] : Array.isArray(errors) ? errors : [];

  return (
    <ColumnFlow sx={{flexShrink: 1, height: "auto"}}>
      {errorsInternal.map((err) => (
        <Alert key={err} severity="error">
          {err}
        </Alert>
      ))}
    </ColumnFlow>
  );
}

export default ErrorMessage;
