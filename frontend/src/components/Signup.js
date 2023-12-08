import React, { useState, useEffect, useCallback } from "react";
import { getBaseURL } from "./utils.js";
import { Alert, Typography } from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner";
import { ColumnFlow, ModalLikeLayout, RowFlow } from "./common/Layout";
import AtiButton from "./common/AtiButton";
import AtiTextField from "./common/AtiTextField";

const Signup = () => {
  const [username, setUsername] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [password1Error, setPassword1Error] = useState("");
  const [password2Error, setPassword2Error] = useState("");
  const [errors, setErrors] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("token") !== null) {
      window.location.replace("/home");
    } else {
      setLoading(false);
    }
  }, []);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!username || !password1 || !password2 || password1 !== password2) {
        setDirty(true);
        return;
      }

      setErrors([]);
      setLoading(true);
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
            window.location.replace("/");
          } else {
            setLoading(false);

            localStorage.clear();
            const currentErrors = [];
            if (data.username) {
              setUsername("");
              setUsernameError(data.username[0]);
              currentErrors.push(...data.username.slice(1));
            }
            if (data.password1) {
              setPassword1("");
              setPassword2("");
              setPassword1Error(data.password1[0]);
              currentErrors.push(...data.password1.slice(1));
            }
            if (data.password2) {
              setPassword2("");
              setPassword2Error(data.password2[0]);
              currentErrors.push(...data.password2.slice(1));
            }
            if (data.non_field_errors) {
              currentErrors.push(...data.non_field_errors);
            }
            setErrors(currentErrors);
          }
        })
        .catch(() => {
          setLoading(false); // Also set loading to false when there is an error
          setErrors(["An error occurred, please try again later"]);
        });
    },
    [username, password1, password2]
  );

  const validatePassword1 = React.useCallback((val) => {
    if (val.length < 8) {
      return "Password must be at least 8 characters.";
    }
  }, []);

  const validatePassword2 = React.useCallback(
    (val) => {
      if (val !== password1) {
        return "Passwords do not match.";
      }
    },
    [password1]
  );

  return (
    <ModalLikeLayout>
      <form noValidate onSubmit={onSubmit}>
        <ColumnFlow>
          <Typography variant="h2" component="h1" sx={{ marginBottom: "1rem" }}>
            Sign up for an account
          </Typography>
          <AtiTextField
            label="Username"
            value={username}
            setValue={setUsername}
            error={usernameError}
            setError={setUsernameError}
            dirty={dirty}
            required
            noRequiredSymbol
            autoComplete="username"
          />
          <AtiTextField
            label="Password"
            type="password"
            value={password1}
            setValue={setPassword1}
            error={password1Error}
            setError={setPassword1Error}
            dirty={dirty}
            required
            noRequiredSymbol
            autoComplete="new-password"
            validate={validatePassword1}
          />
          <AtiTextField
            label="Confirm Password"
            type="password"
            value={password2}
            setValue={setPassword2}
            error={password2Error}
            setError={setPassword2Error}
            dirty={dirty}
            required
            noRequiredSymbol
            autoComplete="new-password"
            validate={validatePassword2}
          />
          {errors.map((err) => (
            <Alert key={err} severity="error">
              {err}
            </Alert>
          ))}
          <RowFlow>
            {loading ? (
              <LoadingSpinner sx={{ margin: "auto" }} />
            ) : (
              <AtiButton type="submit" sx={{ marginLeft: "auto" }}>
                Sign-up
              </AtiButton>
            )}
          </RowFlow>
        </ColumnFlow>
      </form>
    </ModalLikeLayout>
  );
};

export default Signup;
