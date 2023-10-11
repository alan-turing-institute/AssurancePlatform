import React from "react";
import { Box, Button } from "grommet";
import { getBaseURL } from "./utils.js";
import LoginGithub from "react-login-github";
import github from "./github.png";

const Github = () => {
  function onSuccess(e) {
    fetch(`${getBaseURL()}/auth/github/`, {
      method: "POST",
      body: JSON.stringify({ auth_token: e.code }),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        // Assuming your backend returns the token with a key "token"
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

  function onFailure(e) {
    alert(e);
  }

  return (
    <Box overflow="auto" gap="medium" pad="medium">
      <div className="Github">
        <LoginGithub
          clientId="0cd5a829deef2e8d3a12"
          onSuccess={onSuccess}
          onFailure={onFailure}
        >
          {/* Using Grommet's Button for styling */}
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
          />
        </LoginGithub>
      </div>
    </Box>
  );
};

export default Github;
