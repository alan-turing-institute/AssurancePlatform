import React from "react";
import "../index.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navigation from "./Navigation"; // Navigation now includes UserProfileDropdown
import { Home, Splash } from "./Home";
import Login from "./Login";
import Signup from "./Signup";
import CaseContainer from "./CaseContainer";
import Logout from "./Logout";
import Groups from "./Groups";
import Github from "./Github";
import { Box, Toolbar } from "@mui/material";

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
          {/* These two pages don't have direct links, but the routes should remain for now */}
          <Route path="/groups" element={<Groups />} />
          <Route path="/github" element={<Github />} />

          <Route path="*" element={<Splash notFound={true} />} />
        </Routes>
      </Box>
    </Router>
  );
};

export default AllRoutes;
