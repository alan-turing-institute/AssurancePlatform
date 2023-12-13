import { Box, Dialog } from "@mui/material";
import * as React from "react";

function ModalDialog({ children, ...props }) {
  return (
    <Dialog elevation={8} {...props}>
      <Box
        sx={{
          display: "flex",
          padding: "3rem",
          minHeight: "30.8125rem",
          minWidth: "35.375rem",
        }}
      >
        {children}
      </Box>
    </Dialog>
  );
}

export default ModalDialog;
