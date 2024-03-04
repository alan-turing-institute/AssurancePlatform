'use client'

import React, { useCallback } from "react";
// import { useParams } from "react-router-dom";
// import { useNavigate } from "react-router-dom";
import { ColumnFlow, ModalLikeLayout, RowFlow } from "@/components/common/Layouts";
import { Button, Typography } from "@mui/material";
import { useEnforceLogin, useLoginToken } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

/**
 * Logout is a form component used for logging out of the TEA Platform. It provides a simple interface for logging out and redirects to the login page upon successful logout.
 *
 * @returns {JSX.Element} A form that allows users to log out of the platform.
 */
const LogoutPage = () => {
  // const { sessionExpired } = useParams();
  useEnforceLogin();
  const [token, setToken] = useLoginToken();
  const router = useRouter()

  /**
   * Handle logout request.
   *
   * @param {Event} e - The event object.
   * @returns {void}
   */
  const handleLogout = useCallback(
    (e: any) => {
      e.preventDefault();
      // if (sessionExpired) {
      //   setToken(null);
      //   // window.location.replace("/");
      //   router.push('/')
      //   return;
      // }
      fetch(`http://localhost:8000/api/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
      })
        .then((res) => res.json())
        .then(() => {
          setToken(null);
          // window.location.replace("/");
          router.push('/')
        });
    },
    [token, setToken],
  );

  // const navigate = useNavigate();

  const goBack = React.useCallback(() => {
    // navigate(-1);
    window.history.go(-1)
  }, []);

  return (
    <ModalLikeLayout>
      {/* {sessionExpired ? (
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
      )} */}
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
    </ModalLikeLayout>
  );
};

export default LogoutPage;
