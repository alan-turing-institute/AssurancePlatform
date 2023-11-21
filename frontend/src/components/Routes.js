import React from "react";
import "../index.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Box, Grid, Footer, Text, Anchor } from "grommet";
import Navigation from "./Navigation.js"; // Navigation now includes UserProfileDropdown
import Home from "./Home.js";
import Login from "./Login.js";
import Signup from "./Signup.js";
import CaseCreator from "./CaseCreator.js";
import CaseSelector from "./CaseSelector.js";
import CaseContainer from "./CaseContainer.js";
import WorkInProcessBanner from "./WorkInProcessBanner";
import Logout from "./Logout.js";
import Groups from "./Groups.js";
import Github from "./Github.js";

const AllRoutes = () => {
  return (
    <Router>
      <WorkInProcessBanner />
      <Grid
        rows={["auto", "flex", "auto"]}
        columns={["fill"]}
        height="100vh"
        gap="none"
        areas={[
          { name: "nav", start: [0, 0], end: [0, 0] },
          { name: "main", start: [0, 1], end: [0, 1] },
          { name: "footer", start: [0, 2], end: [0, 2] },
        ]}
      >
        <Box gridArea="nav">
          <Navigation />
        </Box>
        <Box gridArea="main" overflow="auto">
          <Routes>
            <Route exact path="/" element={<Home />} />
            <Route path="/case/new" element={<CaseCreator />} />
            <Route path="/case/select" element={<CaseSelector />} />
            <Route path="/case">
              <Route path=":caseSlug" element={<CaseContainer />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/github" element={<Github />} />
            {/* UserProfileDropdown is now part of Navigation, so no need to have separate routes for Logout, Groups, and Github */}
          </Routes>
        </Box>
        <Box gridArea="footer" width="100%">
          <Footer background="dark-2" pad="small" justify="between">
            <Text>&copy; The Alan Turing Institute</Text>
            <Anchor
              href="https://github.com/alan-turing-institute/AssurancePlatform"
              label="GitHub Repository"
            />
            <Text>Last updated: {process.env.REACT_APP_GIT_COMMIT_DATE}</Text>
          </Footer>
        </Box>
      </Grid>
    </Router>
  );
};

export default AllRoutes;
