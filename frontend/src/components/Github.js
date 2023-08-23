import React from "react";
import { Box } from "grommet";

import LoginGithub from "react-login-github";
import github from "./github.png";

const Github = () => {
  function onSuccess(e) {
    fetch("http://127.0.0.1:8000/api/github/", {
      method: "POST",
      body: JSON.stringify({ auth_token: e.code }),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    })
      .then((res) => res.json())
      .then((response) => {
        document.getElementById("email_id").innerText = response["email"];
        document.getElementById("auth_token").innerText = response["tokens"];
      });
  }

  function onFailure(e) {
    alert(e);
  }

  return (
    <Box overflow="auto">
      <div className="Github">
        <LoginGithub
          clientId="0cd5a829deef2e8d3a12"
          onSuccess={onSuccess}
          onFailure={onFailure}
          className="github"
        >
          <img
            src={github}
            alt="Sign in with github"
            className="github-image"
          ></img>
          <h2 className="github-name">Sign in with github</h2>
        </LoginGithub>
        <div className="show-user_info">
          <div>
            <label className="info">Email Id:</label>
            <label id="email_id"></label>
          </div>
          <div>
            <label className="info">Auth token:</label>
            <label id="auth_token"></label>
          </div>
        </div>
      </div>
    </Box>
  );
};

export default Github;
