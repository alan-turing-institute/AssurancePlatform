import React from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Box, Grid, Text } from "grommet";
import Navigation from "./Navigation.js";
import Home from "./Home.js";
import Login from "./Login.js";
import Signup from "./Signup.js";
import CaseCreator from "./CaseCreator.js";
import CaseSelector from "./CaseSelector.js";
import CaseContainer from "./CaseContainer.js";

const AllRoutes = () => (
  <Router>
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
        </Routes>
      </Box>
      <Box gridArea="footer" width="100%" background="dark-2" pad="small">
        <Text>&copy; The Alan Turing Institute</Text>
      </Box>
    </Grid>
  </Router>
);

export default AllRoutes;
