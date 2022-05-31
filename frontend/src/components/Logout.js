import React from "react";
import { Box, Button, Text } from "grommet";
import { getBaseURL } from "./utils.js";
import { useNavigate } from "react-router-dom";

const Logout = (props) => {
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
        localStorage.clear();
        window.location.replace("/login/");
      });
  };

  let navigate = useNavigate();

  return (
    <Box pad="small" gap="xsmall" width="medium">
      <Text color="red">Are you sure you want to logout?</Text>
      <Box direction="row" width="medium" gap="xsmall">
        <Button onClick={() => navigate(-1)} label="Back" />
        <Button primary={true} onClick={handleLogout} label="Confirm logout" />
      </Box>
    </Box>
  );
};

export default Logout;
