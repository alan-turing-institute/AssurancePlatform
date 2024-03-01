'use client'

import * as React from "react";
import Box from "@mui/material/Box";
import { Button, Container, Paper, useTheme } from "@mui/material";
// import { Link, useLocation } from "react-router-dom";
import NextLink from 'next/link';
import { Module, NodesThree } from "./Icons";
import { Folder, Network } from "lucide-react";
// import { Module, NodesThree } from "./Icons";

export function ColumnFlow({ sx, ...props }: any) {
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

export function RowFlow({ sx, ...props }: any) {
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
export function ModalLikeLayout({ children } : { children : React.ReactNode }) {
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

function SideNav({ href, ...props } : any) {
  // const location = useLocation();

  // const isActive = location.pathname === href;
  const isActive = false

  return (
    <Button
      component={NextLink}
      sx={{
        marginRight: "auto",
        fontWeight: isActive ? "bold" : undefined,
        textDecoration: isActive ? "underline" : undefined,
      }}
      {...props}
      href={href}
      variant="text"
    />
  );
}

export function LayoutWithNav({ children } : { children : React.ReactNode }) {
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
          padding: "1rem",
          gap: "1.5rem",
        }}
      >
        <SideNav href="/" startIcon={<Network />}>
          Assurance cases
        </SideNav>
        {/* TODO figure out what to do with these pages */}
        {/* <SideNav to="/groups">Groups</SideNav>
        <SideNav to="/github">Github files</SideNav> */}
        <Button
          startIcon={<Folder />}
          sx={{ marginRight: "auto" }}
          href="https://alan-turing-institute.github.io/AssurancePlatform/"
          target="_blank"
          variant="text"
        >
          {/* TODO add external link icon */}
          Documentation
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
