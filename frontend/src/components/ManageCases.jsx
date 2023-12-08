import React from "react";
import CaseSelector from "./CaseSelector";
import { Link } from "react-router-dom";

const ManageCases = () => {
    return <>
        <CaseSelector/>
        <Link to="/groups">Groups</Link>
        <Link to="/github">GitHub Files</Link>
    </>;
}

export default ManageCases;