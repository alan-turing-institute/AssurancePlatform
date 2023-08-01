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
        {loading === false && <Heading level={2}>Login</Heading>}
        {errors === true && (
          <Heading level={2}>Cannot log in with provided credentials</Heading>
        )}
        {loading === false && (
          <Form onSubmit={onSubmit}>
            <FormField htmlFor="username" label="User name">
              <TextInput
                name="username"
                type="text"
                value={username}
                required
                onChange={(e) => setUsername(e.target.value)}
              />
            </FormField>
            <FormField htmlFor="password" label="Password">
              <TextInput
                name="password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
            <Button type="submit" label="Login" primary={true} />
          </Form>
        )}
      </Box>
      <Box flex={false} gap="small" pad="medium" width="medium">
        <Text>Forgot password?</Text>
        <Button href="/reset/" label="Reset password" />
      </Box>
      <Box flex={false} gap="small" pad="medium" width="medium">
        <Text>Not already registered?</Text>
        <Button href="/signup/" label="Sign-up" />
      </Box>
    </Box>
  );
};

export default Login;
