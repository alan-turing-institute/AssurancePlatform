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
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [errors, setErrors] = useState(false);
  const [loading, setLoading] = useState(true);

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
      email: email,
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
          setEmail("");
          setPassword1("");
          setPassword2("");
          localStorage.clear();
          setErrors(true);
        }
      });
  };

  return (
    <Box gap="medium" pad="medium" width="medium">
      {loading === false && <Heading level={2}>Signup</Heading>}
      {errors === true && (
        <Heading level={2}>Cannot signup with provided credentials</Heading>
      )}
      <Form onSubmit={onSubmit}>
        <FormField htmlFor="email" label="Email address">
          <TextInput
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField htmlFor="password1" label="Password">
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
        <Button primary={true} type="submit" label="Signup" />
      </Form>
    </Box>
  );
};

export default Signup;
