import { Box, Dialog } from "@mui/material";
import * as React from "react";

function ModalDialog({ children, ...props }) {
  return (
    <Dialog elevation={8} {...props}>
      <Box
        sx={{
          display: "flex",
          padding: "3rem",
          height: "30.8125rem",
          width: "35.375rem",
          maxWidth: "100%"
        }}
      >
        {children}
      </Box>
    </Dialog>
  );
}

export default ModalDialog;
