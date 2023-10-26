import React from "react";
import { Button } from "grommet";
import { getBaseURL } from "./utils.js";
import github from "./github.png";
import { getClientID, getRedirectURI } from "./utils.js";

const Github = () => {
  const GITHUB_CLIENT_ID = getClientID();
  const GITHUB_REDIRECT_URI = getRedirectURI();
  const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_REDIRECT_URI}&scope=user:email,repo,public_repo`;
  function handleGitHubLogin() {
    window.location.href = GITHUB_AUTH_URL;
  }

  // Assuming your server is redirecting back with the "code" parameter in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    fetch(`${getBaseURL()}/auth/github/`, {
      method: "POST",
      body: JSON.stringify({ auth_token: code }),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        const token = response["token"];
        if (token) {
          localStorage.setItem("token", token);
          window.location.replace("/");
        } else {
          console.error("Token not found in response");
        }
      })
      .catch((error) => {
        console.error("Error during GitHub authentication:", error);
      });
  }

  return (
    <Button
      label="Sign in with GitHub"
      icon={
        <img
          src={github}
          alt="GitHub Logo"
          style={{ width: "24px", height: "24px" }}
        />
      }
      primary={true}
      onClick={handleGitHubLogin}
    />
  );
};

export default Github;
