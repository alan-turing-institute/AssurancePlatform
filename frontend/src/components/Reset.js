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

const Reset = () => {
  const [email, setEmail] = useState("");
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
      email: email
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
          localStorage.clear();
          setErrors(true);
          let currentErrors = [];
          if (data.email)
            currentErrors = [...currentErrors, ...data.email];
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
      {loading === false && <Heading level={2}>Reset password</Heading>}
      {errors === true && (
        <Heading level={2}>Something went wrong</Heading>
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
        {displayErrors()}
        <Button type="submit" label="Submit" primary={true} />
      </Form>
    </Box>
  );
};

export default Reset;
