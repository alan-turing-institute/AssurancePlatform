import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  Text,
  TextInput,
} from "grommet";
import { getBaseURL } from "./utils.js";
import Github from "./GithubLogin.js";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("token") !== null) {
      window.location.replace("/");
    } else {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();

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
      });
  };
  return (
    <Box overflow="auto">
      <Box flex={false} gap="medium" pad="medium" width="medium">
        {loading === false && <Heading level={2}>Login to platform</Heading>}
        {errors === true && (
          <Heading level={2}>Cannot log in with provided credentials</Heading>
        )}
        {loading === false && (
          <Form onSubmit={onSubmit}>
            <FormField label="User name" htmlFor="usernameInput">
              <TextInput
                id="usernameInput"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Password" htmlFor="passwordInput">
              {" "}
              {/* Added htmlFor value */}
              <TextInput
                id="passwordInput"
                name="password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Box direction="row" gap="medium">
              <Button type="submit" label="Login" primary={true} />
              <Github />
            </Box>
          </Form>
        )}
      </Box>
      <Box flex={false} gap="small" pad="medium" width="medium">
        <Text>Not already registered?</Text>
        <Button href="/signup/" label="Sign-up" />
      </Box>
    </Box>
  );
};

export default Login;
