import React from "react";
import { Link } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

function NavButton({ sx, ...props }) {
  return (
    <Button
      {...props}
      variant="contained"
      disableElevation
      sx={{
        ...sx,
        fontWeight: "bold",
        textTransform: "none",
      }}
    />
  );
}

// I feel you should be able to do component={to ? Link : "a"}, but no...
// I suspect because of a bug in MUI
function NavItem({ ...props }) {
  return <NavButton {...props} />;
}

function NavLink({ ...props }) {
  return <NavButton {...props} component={Link} />;
}

function Navigation() {
  const isLoggedIn = localStorage.getItem("token") != null;

  return (
    <AppBar component="nav" elevation={0}>
      <Toolbar>
        <NavLink sx={{ marginRight: "auto" }} to="/">
          <Typography component="span" variant="h3">
            Ethical Assurance Platform
          </Typography>
        </NavLink>
        <NavItem href="https://github.com/alan-turing-institute/AssurancePlatform">
            Github
          </NavItem>
          {isLoggedIn ? (
            <NavLink to="/logout">Logout</NavLink>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/signup">Signup</NavLink>
            </>
          )}
      </Toolbar>
    </AppBar>
  );
}

export default Navigation;
