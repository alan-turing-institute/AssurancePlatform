import React, { useState, useEffect, Fragment } from "react";
import { Button } from "grommet";
import { getBaseURL } from "./utils.js";

const Logout = (props) => {
  const [loading, setLoading] = useState(true);

  const handleLogout = (e) => {
    e.preventDefault();

    fetch(`${getBaseURL()}/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        localStorage.clear();
        window.location.replace("/login/");
      });
  };

  return <Button onClick={handleLogout}>Logout</Button>;
};

export default Logout;
