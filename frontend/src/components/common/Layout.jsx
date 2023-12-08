import * as React from "react";
import Box from "@mui/material/Box";
import { Container } from "@mui/material";
import AtiPaper from "./AtiPaper";

export function ColumnFlow({ sx, ...props }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        ...sx,
      }}
      {...props}
    />
  );
}

export function RowFlow({ sx, ...props }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        gap: "1rem",
        ...sx,
      }}
      {...props}
    />
  );
}

/** A screen containing only a small card with a modal-like design */
export function ModalLikeLayout({ children }) {
  return (
    <Container maxWidth={false} sx={{ display: "flex", flexGrow: 1 }}>
      <AtiPaper sx={{ margin: "auto", padding: "3rem", width: "35.375rem" }}>
        {children}
      </AtiPaper>
    </Container>
  );
}
