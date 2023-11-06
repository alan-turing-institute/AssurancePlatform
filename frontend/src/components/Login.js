import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  Text,
  TextInput,
  Spinner,
} from "grommet";
import { getBaseURL } from "./utils.js";
import Github from "./GithubLogin.js";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("token") !== null) {
      window.location.replace("/");
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
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
        setLoading(false); // Set loading to false when the login process is completed
        if (data.key) {
          localStorage.clear();
          localStorage.setItem("token", data.key);
          localStorage.setItem("username", username);
          window.location.replace("/");
        } else {
          setUsername("");
          setPassword("");
          localStorage.clear();
          setErrors(true);
        }
      })
      .catch(() => {
        setLoading(false); // Also set loading to false when there is an error
      });
  };

  return (
    <Box fill align="center" justify="center">
      {loading ? (
        // Centered box with Spinner
        <Box align="center" justify="center">
          <Spinner size="medium" />
          <Text size="xlarge" margin="small">
            Loading...
          </Text>
        </Box>
      ) : (
        // Login form and buttons
        <Box width="medium" pad="medium" gap="medium">
          <Heading level={2}>Login to platform</Heading>
          {errors && (
            <Text color="status-critical" textAlign="center">
              Cannot log in with provided credentials
            </Text>
          )}
          <Form onSubmit={onSubmit}>{/* Form fields */}</Form>
          <Box direction="row" gap="medium" justify="between">
            <Button type="submit" label="Login" primary onClick={onSubmit} />
            <Github setLoading={setLoading} />
          </Box>
          <Box align="center" margin={{ top: "medium" }}>
            <Text>Not already registered?</Text>
            <Button href="/signup/" label="Sign-up" />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Login;
