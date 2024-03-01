'use client'

import React from "react";
import NextLink from 'next/link';
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
// import { useLoginToken } from "../hooks/useAuth";

/**
 * NavButton is a customized Button component designed to fit within the application's navigation bar. It applies specific styling to maintain visual consistency across all navigational buttons.
 *
 * @param {Object} props - Standard Button props with additional style overrides if needed.
 * @returns {JSX.Element} A Button component styled for the application's navigation bar.
 */
function NavButton({ sx, ...props }: any) {
  return (
    <Button
      {...props}
      sx={{
        ...sx,
        fontWeight: "bold",
      }}
    />
  );
}

/**
 * NavItem is a wrapper around NavButton for creating navigational items that do not require routing functionality provided by React Router's Link component. It's primarily used for external links.
 *
 * @param {Object} props - Props to be passed to the NavButton component.
 * @returns {JSX.Element} A navigational button for external links, styled consistently with the navigation bar.
 */
// I feel you should be able to do component={to ? Link : "a"}, but no...
// I suspect because of a bug in MUI
function NavItem({ ...props }) {
  return <NavButton {...props} />;
}

/**
 * NavLink extends NavButton to utilize React Router's Link component, enabling SPA-style routing without reloading the page. It's used for internal navigation within the application.
 *
 * @param {Object} props - Props including routing information to be passed to the NavButton component.
 * @returns {JSX.Element} A navigational button for internal links, styled consistently with the navigation bar and incorporating SPA routing.
 */
function NavLink({ ...props }) {
  return <NavButton {...props} component={NextLink} />;
}

/**
 * Navigation provides the top-level navigation bar for the application. It includes links to the main sections of the site and adjusts its items based on the user's authentication status.
 *
 * This component integrates with the application's authentication context to conditionally render navigation links for authenticated and unauthenticated users, promoting a seamless user experience across different states of user session.
 *
 * @returns {JSX.Element} The top navigation bar of the application, including links to home, GitHub, login, and signup pages, as well as a logout option for authenticated users.
 */
function Navigation() {
  // const [token] = useLoginToken();

  // const isLoggedIn = token != null;
  const isLoggedIn = false;

  return (
    <AppBar component="nav" elevation={0}>
      <Toolbar>
        <NavLink sx={{ marginRight: "auto" }} href="/">
          <Typography component="span" variant="h3">
            Ethical Assurance Platform
          </Typography>
        </NavLink>
        <NavItem href="https://github.com/alan-turing-institute/AssurancePlatform">
          Github
        </NavItem>
        {isLoggedIn ? (
          <NavLink href="/logout">Logout</NavLink>
        ) : (
          <>
            <NavLink href="/">Login</NavLink>
            <NavLink href="/signup">Signup</NavLink>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Navigation;
