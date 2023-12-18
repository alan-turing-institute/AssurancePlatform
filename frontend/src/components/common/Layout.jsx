import * as React from "react";
import Box from "@mui/material/Box";
import { Button, Container, Paper, useTheme } from "@mui/material";
import { Link, useLocation } from "react-router-dom";

export function ColumnFlow({ sx, ...props }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        height: "100%",
        width: "100%",
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
        alignItems: "center",
        ...sx,
      }}
      {...props}
    />
  );
}

/** A screen containing only a small card with a modal-like design */
export function ModalLikeLayout({ children }) {
  return (
    <Container
      maxWidth={false}
      sx={{
        padding: "1rem",
        display: "flex",
        flexGrow: 1,
        flexShrink: 1,
        overflowY: "auto",
      }}
    >
      <Paper sx={{ margin: "auto", padding: "3rem", width: "35.375rem" }}>
        {children}
      </Paper>
    </Container>
  );
}

function SideNav({ to, ...props }) {
  const location = useLocation();

  const isActive = location.pathname === to;

  return (
    <Button
      component={Link}
      sx={{ marginRight: "auto", fontWeight: isActive ? "bold" : undefined }}
      {...props}
      to={to}
      variant="text"
    />
  );
}

export function LayoutWithNav({ children }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flexGrow: 1,
        flexShrink: 1,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          width: "15.5625rem",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          borderRightStyle: "solid",
          borderRightWidth: "1px",
          borderRightColor: theme.palette.primary.main,
        }}
      >
        <SideNav to="/">Assurance cases</SideNav>
        {/* TODO figure out what to do with these pages */}
        {/* <SideNav to="/groups">Groups</SideNav>
        <SideNav to="/github">Github files</SideNav> */}
        <Button
          sx={{ marginRight: "auto" }}
          href="https://alan-turing-institute.github.io/AssurancePlatform/"
          target="_blank"
          variant="text"
        >
          Methodology support
        </Button>
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          flexShrink: 1,
          maxHeight: "100%",
          overflowY: "auto",
          padding: "2rem",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
