import React, { useState, useEffect, useCallback } from "react";
import { getBaseURL } from "./utils.js";
import { Button, Typography } from "@mui/material";
import LoadingSpinner from "./common/LoadingSpinner";
import { ColumnFlow, ModalLikeLayout, RowFlow } from "./common/Layout";
import TextInput from "./common/TextInput.jsx";
import { useEnforceLogout, useLoginToken } from "../hooks/useAuth.js";
import ErrorMessage from "./common/ErrorMessage.jsx";

/**
 * Signup is a component for creating a new user account.
 *
 * @returns {JSX.Element} A form for creating a new user account.
 */
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

  const isLoggedOut = useEnforceLogout();
  const [_, setToken] = useLoginToken();

  /**
   * Set the loading state based on the user's authentication status.
   *
   * @returns {void}
   */
  useEffect(() => {
    setLoading(!isLoggedOut);
  }, [isLoggedOut]);

  /**
   * Submit the signup form.
   * 
   * @param {Event} e - The form submission event.
   * @returns {void}
   */
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
            setToken(data.key);
            window.location.replace("/");
          } else {
            setLoading(false);
            setToken(null);
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
    [username, password1, password2, setToken],
  );

  /**
   * Validate the password input.
   *
   * @param {string} val - The password input value.
   * @returns {string|undefined} An error message if the password input is invalid, otherwise undefined.
   */
  const validatePassword1 = React.useCallback((val) => {
    if (val.length < 8) {
      return "Password must be at least 8 characters.";
    }
  }, []);

  /**
   * Validate the confirm password input.
   *
   * @param {string} val - The confirm password input value.
   * @returns {string|undefined} An error message if the confirm password input is invalid, otherwise undefined.
   */
  const validatePassword2 = React.useCallback(
    (val) => {
      if (val !== password1) {
        return "Passwords do not match.";
      }
    },
    [password1],
  );

  return (
    <ModalLikeLayout>
      <form noValidate onSubmit={onSubmit}>
        <ColumnFlow>
          <Typography variant="h2" component="h1" sx={{ marginBottom: "1rem" }}>
            Sign up for an account
          </Typography>
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
            value={password1}
            setValue={setPassword1}
            error={password1Error}
            setError={setPassword1Error}
            dirty={dirty}
            required
            noRequiredSymbol
            inputProps={{
              autoComplete: "new-password",
            }}
            validate={validatePassword1}
            helperText="At least 8 characters"
            minLength={8}
          />
          <TextInput
            label="Confirm Password"
            type="password"
            value={password2}
            setValue={setPassword2}
            error={password2Error}
            setError={setPassword2Error}
            dirty={dirty}
            required
            noRequiredSymbol
            inputProps={{
              autoComplete: "new-password",
            }}
            validate={validatePassword2}
          />
          <ErrorMessage errors={errors} />
          <RowFlow>
            {loading ? (
              <LoadingSpinner sx={{ margin: "auto" }} />
            ) : (
              <Button type="submit" sx={{ marginLeft: "auto" }}>
                Sign up
              </Button>
            )}
          </RowFlow>
        </ColumnFlow>
      </form>
    </ModalLikeLayout>
  );
};

export default Signup;
