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
  const [loading, setLoading] = useState(false); // Set default to false to not show loading initially

  useEffect(() => {
    if (localStorage.getItem("token") !== null) {
      window.location.replace("/");
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    setLoading(true); // Set loading to true when the login process starts
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
    <Box overflow="auto">
      <Box flex={false} gap="medium" pad="medium" width="medium">
        {loading ? (
          <Text>Loading...</Text> // Display loading text when loading is true
        ) : (
          <>
            <Heading level={2}>Login to platform</Heading>
            {errors && (
              <Heading level={2}>
                Cannot log in with provided credentials
              </Heading>
            )}
            <Form onSubmit={onSubmit}>{/* Form fields */}</Form>
          </>
        )}
        <Box direction="row" gap="medium">
          <Button
            type="submit"
            label="Login"
            primary={true}
            onClick={onSubmit}
          />
          <Github setLoading={setLoading} />
        </Box>
      </Box>
      <Box flex={false} gap="small" pad="medium" width="medium">
        {/* Registration info */}
      </Box>
    </Box>
  );
};

export default Login;
