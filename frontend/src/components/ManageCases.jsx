import React from "react";
import CaseSelector from "./CaseSelector";
import { LayoutWithNav } from "./common/Layout";

const ManageCases = () => {
    return <LayoutWithNav>
        <CaseSelector/>
    </LayoutWithNav>;
}

export default ManageCases;