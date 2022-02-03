import React from 'react';
import { BrowserRouter as Router, Route, Routes  } from 'react-router-dom';
import Home from './Home.js';
import CaseCreator from './CaseCreator.js'
import CaseSelector from './CaseSelector.js'
import CaseContainer from './CaseContainer.js';
const AllRoutes = () => (
    <Router>
        <Routes>
            <Route exact path="/" element={<Home/>} />
            <Route path="/case/new" element={<CaseCreator/>} />
            <Route path="/case/select" element={<CaseSelector/>} />
            <Route path ="/cases">
                <Route path=":caseSlug" element={<CaseContainer/>} />
            </Route>
        </Routes>
    </Router>
);

export default AllRoutes;