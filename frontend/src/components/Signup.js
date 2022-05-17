import React, { useState, useEffect } from "react";
import { Box, Button, Form, Text, TextInput } from "grommet";
import { getBaseURL } from "./utils.js";

const Signup = () => {
  const [email, setEmail] = useState("");
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
          if (data.email) setErrorMessages([...errorMessages, ...data.email]);
          if (data.password1)
            setErrorMessages([...errorMessages, ...data.password1]);
          if (data.password2)
            setErrorMessages([...errorMessages, ...data.password2]);
          if (data.non_field_errors)
            setErrorMessages([...errorMessages, ...data.non_field_errors]);
          console.log("Errors are", errorMessages);
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
    <Box width="medium" pad="small">
      {loading === false && <h1>Sign up</h1>}
      {errors === true && <h2>Cannot signup with provided credentials</h2>}
      <Form onSubmit={onSubmit}>
        <label htmlFor="email">Email address:</label> <br />
        <TextInput
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />{" "}
        <br />
        <label htmlFor="password1">
          Password (at least 8 characters, at least 2 types (uppercase,
          lowercase, numeric, symbol)):
        </label>{" "}
        <br />
        <TextInput
          name="password1"
          type="password"
          value={password1}
          onChange={(e) => setPassword1(e.target.value)}
          required
        />{" "}
        <br />
        <label htmlFor="password2">Confirm password:</label> <br />
        <TextInput
          name="password2"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
        />{" "}
        <br />
        {displayErrors()}
        <Button type="submit" label="Signup" primary={true} />
      </Form>
    </Box>
  );
};

export default Signup;
