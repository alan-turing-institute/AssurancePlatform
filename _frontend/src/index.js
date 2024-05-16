import React from "react";
import ReactDOM from "react-dom";
//import { BrowserRouter as Router, Route } from "react-router-dom";
import "./index.css";
import AllRoutes from "./components/Routes";
import Theming from "./Theming";
//import Home from './components/Home'
import reportWebVitals from "./reportWebVitals";
//import Navigation from "./components/Navigation";

ReactDOM.render(
  <Theming>
    <AllRoutes />
  </Theming>,
  document.getElementById("main"),
);

//const dropdown_menus = document.getElementById("main");
//ReactDOM.render( <CaseContainer />, dropdown_menus);

//const test_chart = document.getElementById("mermaid");
//ReactDOM.render(<Mermaid_Chart />, test_chart);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
