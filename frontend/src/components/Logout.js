import React, { useCallback } from "react";
import { getBaseURL } from "./utils.js";
import { useNavigate } from "react-router-dom";
import { ColumnFlow, ModalLikeLayout, RowFlow } from "./common/Layout.jsx";
import { Typography } from "@mui/material";
import AtiButton from "./common/AtiButton.jsx";

const Logout = () => {
  const handleLogout = useCallback((e) => {
    e.preventDefault();

    fetch(`${getBaseURL()}/auth/logout/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then(() => {
        localStorage.clear();
        window.location.replace("/login/");
      });
  }, []);

  const navigate = useNavigate();

  const goBack = React.useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <ModalLikeLayout>
      <ColumnFlow>
        <Typography variant="h2" component="h1">
          Are you sure you want to logout?
        </Typography>
        <RowFlow>
          <AtiButton
            onClick={goBack}
            variant="outlined"
            sx={{ marginLeft: "auto" }}
          >
            Back
          </AtiButton>
          <AtiButton onClick={handleLogout}>Confirm logout</AtiButton>
        </RowFlow>
      </ColumnFlow>
    </ModalLikeLayout>
  );
};

export default Logout;
