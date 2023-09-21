import React from "react";
import "../index.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Box, Grid, Text } from "grommet";
import Navigation from "./Navigation.js";
import Home from "./Home.js";
import Login from "./Login.js";
import Signup from "./Signup.js";
import Logout from "./Logout.js";
import Groups from "./Groups.js";
import CaseCreator from "./CaseCreator.js";
import CaseSelector from "./CaseSelector.js";
import CaseContainer from "./CaseContainer.js";
import WorkInProcessBanner from "./WorkInProcessBanner"; // Import the banner component
import Github from "./Github.js";
import WorkInProcessBanner from "./WorkInProcessBanner"; // Import the banner component

const AllRoutes = () => (
  <Router>
    <WorkInProcessBanner /> {/* Display the banner at the very top */}
    <Grid
      rows={["auto", "flex", "auto"]}
      columns={["fill"]}
      height="full"
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
      <Box gridArea="main">
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
        </Routes>
      </Box>
      <Box gridArea="footer" width="100%" background="dark-2" pad="small">
        <Text>&copy; The Alan Turing Institute</Text>
      </Box>
    </Grid>
  </Router>
);

export default AllRoutes;
