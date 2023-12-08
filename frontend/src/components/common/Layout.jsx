import * as React from "react";
import Box from "@mui/material/Box";
import { Container } from "@mui/material";
import AtiPaper from "./AtiPaper";
import AtiButton, { NavButton } from "./AtiButton";
import { useLocation } from "react-router-dom";

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

function SideNav({ to, ...props }) {
  const location = useLocation();

  const isActive = location.pathname === to;

  return (
    <NavButton
      sx={{ marginRight: "auto", fontWeight: isActive ? "bold" : undefined }}
      {...props}
      to={to}
      variant="text"
    />
  );
}

export function LayoutWithNav({ children }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "row" }}>
      <Box
        sx={{ width: "15.5625rem", display: "flex", flexDirection: "column" }}
      >
        <SideNav to="/">Assurance cases</SideNav>
        <SideNav to="/groups">Groups</SideNav>
        <SideNav to="/github">Github files</SideNav>
        <AtiButton sx={{ marginRight: "auto" }} variant="text">
          Methodology support
        </AtiButton>
      </Box>
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    </Box>
  );
}
