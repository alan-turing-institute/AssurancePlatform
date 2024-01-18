import React, { useCallback } from "react";
import { useParams } from "react-router-dom";
import { getBaseURL } from "./utils.js";
import { useNavigate } from "react-router-dom";
import { ColumnFlow, ModalLikeLayout, RowFlow } from "./common/Layout";
import { Button, Typography } from "@mui/material";
import { useEnforceLogin, useLoginToken } from "../hooks/useAuth.js";

const Logout = () => {
  const { sessionExpired } = useParams();
  useEnforceLogin();
  const [token, setToken] = useLoginToken();

  const handleLogout = useCallback(
    (e) => {
      e.preventDefault();
      if (sessionExpired) {
        setToken(null);
        window.location.replace("/");
        return;
      }
      fetch(`${getBaseURL()}/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
      })
        .then((res) => res.json())
        .then(() => {
          setToken(null);
          window.location.replace("/");
        });
    },
    [token, setToken, sessionExpired],
  );

  const navigate = useNavigate();

  const goBack = React.useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <ModalLikeLayout>
      {sessionExpired ? (
        <ColumnFlow>
        <Typography variant="h2" component="h1">
          Your login session has expired.
        </Typography>
        <RowFlow>
          <Button onClick={handleLogout}>Ok</Button>
        </RowFlow>
      </ColumnFlow>
      ) : (
      <ColumnFlow>
        <Typography variant="h2" component="h1">
          Are you sure you want to log out?
        </Typography>
        <RowFlow>
          <Button
            onClick={goBack}
            variant="outlined"
            sx={{ marginLeft: "auto" }}
          >
            Back
          </Button>
          <Button onClick={handleLogout}>Confirm logout</Button>
        </RowFlow>
      </ColumnFlow>
      )}
    </ModalLikeLayout>
  );
};

export default Logout;
