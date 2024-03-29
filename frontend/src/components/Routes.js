import React from "react";
import "../index.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navigation from "./Navigation"; // Navigation now includes UserProfileDropdown
import { Home, Splash } from "./Home";
import Signup from "./Signup";
import CaseContainer from "./CaseContainer";
import Logout from "./Logout";
import { Box, Toolbar } from "@mui/material";

/**
 * AllRoutes is the top-level component for the application. It includes the main navigation bar and routes to the main sections of the site.
 *
 * @returns {JSX.Element} The top-level component for the application, including the main navigation bar and routes to the main sections of the site.
 */
const AllRoutes = () => {
  return (
    <Router>
      <Navigation />
      <Box
        component="main"
        sx={{
          minHeight: "100vh",
          height: "100vh",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Toolbar />
        <Routes>
          <Route exact path="/" element={<Home />} />
          <Route path="/case">
            <Route path=":caseSlug" element={<CaseContainer />} />
          </Route>
          <Route path="/signup" element={<Signup />} />
          <Route path="/logout" element={<Logout />}>
            <Route path=":sessionExpired" element={<Logout />} />
          </Route>
          {/* These two pages are not linked to from anywhere, and these routes have been commented
          out because the pages have not been updated to remove grommet dependencies. */}
          {/* <Route path="/groups" element={<Groups />} />
          <Route path="/github" element={<Github />} /> */}

          <Route path="*" element={<Splash notFound={true} />} />
        </Routes>
      </Box>
    </Router>
  );
};

export default AllRoutes;
