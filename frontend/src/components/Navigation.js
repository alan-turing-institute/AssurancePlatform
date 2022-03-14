import { Box } from "grommet";
import React from "react";
import { NavLink } from "react-router-dom";
import CaseSelector from "./CaseSelector.js";

function Navigation() {
  return (
    <Box className="navigation">
      <nav className="navbar navbar-expand navbar-dark bg-dark">
        <Box direction="row" className="container">
          <NavLink className="navbar-brand" to="/">
            Ethical Assurance Platform
          </NavLink>
          <Box gap="small" direction="row">
            <CaseSelector />
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <NavLink className="nav-link" to="/">
                  Home
                  <span className="sr-only">(current)</span>
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/about">
                  About
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/contact">
                  Contact
                </NavLink>
              </li>
            </ul>
          </Box>
        </Box>
      </nav>
    </Box>
  );
}

export default Navigation;
