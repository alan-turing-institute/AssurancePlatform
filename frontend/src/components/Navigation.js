import React from "react";
import { Box, Nav, Anchor } from "grommet";
import { NavLink } from "react-router-dom";
import CaseSelector from "./CaseSelector.js";
import UserProfileDropdown from "./UserProfileDropdown"; // Import the UserProfileDropdown

function Navigation() {
  const isLoggedIn = localStorage.getItem("token") != null;

  return (
    <Box className="navigation" as="header">
      <Nav
        className="navbar navbar-expand navbar-dark bg-dark"
        direction="row"
        pad="medium"
        align="center"
        justify="between"
      >
        <NavLink className="navbar-brand" to="/">
          Ethical Assurance Platform
        </NavLink>
        <Box direction="row" align="center" gap="medium">
          {isLoggedIn && <CaseSelector />}
          <UserProfileDropdown />
        </Box>
      </Nav>
    </Box>
  );
}

export default Navigation;
