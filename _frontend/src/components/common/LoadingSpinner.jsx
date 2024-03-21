import * as React from "react";
import CircularProgress from "@mui/material/CircularProgress";

function LoadingSpinner({ ...props }) {
  return <CircularProgress {...props} />
}

export default LoadingSpinner;
