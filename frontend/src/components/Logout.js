import React, { useState, useEffect, Fragment } from "react";
import { Box, Button, Text } from "grommet";
import { getBaseURL } from "./utils.js";
import { useNavigate } from "react-router-dom";

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

  let navigate = useNavigate();

  return (
    <Box>
      <Text>Are you sure you want to logout?</Text>
      <Button onClick={handleLogout} label="Confirm logout" />
      <Button onClick={() => navigate(-1)} label="Back" />
    </Box>
  );
};

export default Logout;
