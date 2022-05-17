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
            {localStorage.getItem("token") != null && <CaseSelector />}
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="https://github.com/alan-turing-institute/AssurancePlatform"
                >
                  Docs
                  <span className="sr-only">(current)</span>
                </a>
              </li>
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="https://github.com/alan-turing-institute/AssurancePlatform"
                >
                  Github
                </a>
              </li>
              {localStorage.getItem("token") != null && (
                <li className="nav-item">
                  <NavLink className="nav-link" to="/logout">
                    Logout
                  </NavLink>
                </li>
              )}
            </ul>
          </Box>
        </Box>
      </nav>
    </Box>
  );
}

export default Navigation;
