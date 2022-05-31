import {
  Box,
  Button,
  Form,
  FormField,
  Heading,
  Text,
  TextInput,
} from "grommet";
import React, { useState, useEffect } from "react";
import { getBaseURL } from "./utils.js";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessages, setErrorMessages] = useState([]);

  useEffect(() => {
    if (localStorage.getItem("token") !== null) {
      window.location.replace("/home");
    } else {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();

    const user = {
      username: username,
      password1: password1,
      password2: password2,
    };

    fetch(`${getBaseURL()}/auth/register/`, {
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
          console.log("Setting localstorage token to be ", data.key);
          window.location.replace("/");
        } else {
          setUsername("");
          setPassword1("");
          setPassword2("");
          localStorage.clear();
          setErrors(true);
          let currentErrors = [];
          if (data.username)
            currentErrors = [...currentErrors, ...data.username];
          if (data.password1)
            currentErrors = [...currentErrors, ...data.password1];
          if (data.password2)
            currentErrors = [...currentErrors, ...data.password2];
          if (data.non_field_errors)
            currentErrors = [...currentErrors, ...data.non_field_errors];
          setErrorMessages(currentErrors);
          console.log("Errors are", currentErrors);
        }
      });
  };

  function displayErrors() {
    if (errorMessages.length === 0) return null;
    else
      return (
        <Box pad="small" width="medium">
          <Text color="red">{errorMessages}</Text>
        </Box>
      );
  }

  return (
    <Box width={{ max: "large" }} gap="medium" pad="medium" overflow="auto">
      {loading === false && <Heading level={2}>Sign up</Heading>}
      {errors === true && (
        <Heading level={2}>Cannot sign up with provided credentials</Heading>
      )}
      <Form onSubmit={onSubmit}>
        <FormField htmlFor="username" label="User name">
          <TextInput
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </FormField>
        <FormField
          htmlFor="password1"
          label="Password"
          info="At least 8 characters"
        >
          <TextInput
            name="password1"
            type="password"
            value={password1}
            onChange={(e) => setPassword1(e.target.value)}
            required
          />
        </FormField>
        <FormField htmlFor="password2" label="Confirm password">
          <TextInput
            name="password2"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
          />
        </FormField>
        {displayErrors()}
        <Button type="submit" label="Sign up" primary={true} />
      </Form>
    </Box>
  );
};

export default Signup;
