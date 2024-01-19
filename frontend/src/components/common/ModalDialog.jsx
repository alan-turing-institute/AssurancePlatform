import { Box, Dialog } from "@mui/material";
import * as React from "react";

function ModalDialog({ sx, children, ...props }) {
  return (
    <Dialog elevation={8} {...props}>
      <Box
        sx={{
          display: "flex",
          padding: "3rem",
          width: "35.375rem",
          maxWidth: "100%",
          ...sx,
        }}
      >
        {children}
      </Box>
    </Dialog>
  );
}

export default ModalDialog;
