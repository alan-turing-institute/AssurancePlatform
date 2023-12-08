import React from "react";
import "../index.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navigation from "./Navigation"; // Navigation now includes UserProfileDropdown
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
      <Navigation />
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
    </Router>
  );
};

export default AllRoutes;
