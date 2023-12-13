import React, { useEffect } from "react";
import { getBaseURL } from "./utils.js";
import github from "./github.png";
import { getClientID, getRedirectURI } from "./utils.js";
import { Button } from "@mui/material";

const GithubLogin = ({ setLoading, ...props }) => {
  const GITHUB_CLIENT_ID = getClientID();
  const GITHUB_REDIRECT_URI = getRedirectURI();
  const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=user:email,repo,public_repo`;

  useEffect(() => {
    // This useEffect will only run once when the component mounts because of the empty dependency array.
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code) {
      setLoading(true); // Start loading
      fetch(`${getBaseURL()}/auth/github/`, {
        method: "POST",
        body: JSON.stringify({ auth_token: code }),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      })
        .then((res) => res.json())
        .then((response) => {
          setLoading(false); // Stop loading once the process is complete
          const token = response["token"];
          const access_token = response["access_token"];
          if (token) {
            localStorage.setItem("token", token);
            localStorage.setItem("access_token", access_token);
            window.location.replace("/");
          } else {
            console.error("Token not found in response");
          }
        })
        .catch((error) => {
          setLoading(false); // Stop loading on error
          console.error("Error during GitHub authentication:", error);
        });
    }
  }, [setLoading]); // Include setLoading in the dependency array

  function handleGitHubLogin() {
    setLoading(true); // Start loading when the login process starts
    window.location.href = GITHUB_AUTH_URL;
  }

  return (
    <Button
      {...props}
      startIcon={
        <img
          src={github}
          alt="GitHub Logo"
          style={{ width: "24px", height: "24px" }}
        />
      }
      onClick={handleGitHubLogin}
    >
      Sign in with GitHub
    </Button>
  );
};

export default GithubLogin;
