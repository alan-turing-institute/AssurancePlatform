import React from "react";
import { Box, Nav, Anchor } from "grommet";
import { NavLink } from "react-router-dom";
import CaseSelector from "./CaseSelector.js";
import UserProfileDropdown from "./UserProfileDropdown"; // Import the UserProfileDropdown
import { Book } from "grommet-icons"; // Import an icon for documentation

function Navigation() {
  const isLoggedIn = localStorage.getItem("token") != null;

  const anchorStyle = { color: "white", margin: "0 10px" }; // Added for styling the Anchor tags

  return (
    <Box className="navigation" as="header">
      <Nav
        className="navbar navbar-expand navbar-dark bg-dark"
        direction="row"
        pad="medium"
        align="center"
        justify="between"
      >
        <NavLink className="navbar-brand" to="/" style={{ color: "white" }}>
          Ethical Assurance Platform
        </NavLink>
        <Box direction="row" align="center" gap="medium">
          {isLoggedIn ? (
            <>
              <CaseSelector />
              <Anchor
                href="https://alan-turing-institute.github.io/AssurancePlatform/"
                label={
                  <Box direction="row" align="center" gap="small">
                    <Book />
                    Documentation
                  </Box>
                }
                target="_blank"
                rel="noopener noreferrer"
                style={anchorStyle}
              />
              <UserProfileDropdown />
            </>
          ) : (
            <>
              <Anchor
                as={NavLink}
                to="/login"
                label="Login"
                style={anchorStyle}
              />
              <Anchor
                as={NavLink}
                to="/signup"
                label="Signup"
                style={anchorStyle}
              />
            </>
          )}
        </Box>
      </Nav>
    </Box>
  );
}

export default Navigation;
