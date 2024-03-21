import React, { useState, useEffect, useCallback } from "react";

import { getBaseURL } from "./utils.js";
import Github from "./GithubLogin";
import { Box, Button, Typography } from "@mui/material";
import TextInput from "./common/TextInput.jsx";
import LoadingSpinner from "./common/LoadingSpinner";
import { ColumnFlow, RowFlow } from "./common/Layout";
import { useEnforceLogout, useLoginToken } from "../hooks/useAuth.js";
import { Link } from "react-router-dom";
import ErrorMessage from "./common/ErrorMessage.jsx";

/**
 * Login is a form component used for authenticating users within the TEA Platform. It provides a simple interface for entering a username and password and submitting them to the server. Upon successful submission, the form sets a token in local storage and redirects the user to the home page.
 *
 * @returns {JSX.Element} A form that allows users to input their username and password and log in.
 */
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [errors, setErrors] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  const [_, setToken] = useLoginToken();

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!username || !password) {
        setDirty(true);
        return;
      }

      setErrors([]);
      setLoading(true);
      const user = {
        username: username,
        password: password,
      };

      fetch(`${getBaseURL()}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.key) {
            setToken(data.key);
            window.location.replace("/");
          } else {
            setLoading(false);
            setPassword("");
            setToken(null);
            setErrors(["Cannot log in with provided credentials"]);
          }
        })
        .catch(() => {
          setLoading(false); // Also set loading to false when there is an error
          setErrors(["An error occurred, please try again later"]);
        });
    },
    [username, password, setToken],
  );

  return (
    <form noValidate onSubmit={onSubmit}>
      <ColumnFlow>
        <Typography variant="h2" component="h1" sx={{ marginBottom: "1rem" }}>
          Login
        </Typography>
        <Box sx={{ marginBottom: "1rem" }}>
          <Typography>Not already registered?</Typography>
          <Button component={Link} to="/signup" variant="outlined">
            Sign-up
          </Button>
        </Box>
        <TextInput
          label="Username"
          value={username}
          setValue={setUsername}
          error={usernameError}
          setError={setUsernameError}
          dirty={dirty}
          required
          noRequiredSymbol
          inputProps={{
            autoComplete: "username",
          }}
        />
        <TextInput
          label="Password"
          type="password"
          value={password}
          setValue={setPassword}
          error={passwordError}
          setError={setPasswordError}
          dirty={dirty}
          required
          noRequiredSymbol
          inputProps={{
            autoComplete: "current-password",
          }}
        />
        <ErrorMessage errors={errors} />
        <RowFlow>
          {loading ? (
            <LoadingSpinner sx={{ margin: "auto" }} />
          ) : (
            <>
              {/* <Github variant="outlined" setLoading={setLoading} /> */}
              <Button type="submit" sx={{ marginLeft: "auto" }}>
                Log in
              </Button>
            </>
          )}
        </RowFlow>
      </ColumnFlow>
    </form>
  );
};

export default Login;
