'use client'

import { Box, Button, TextField, Typography } from '@mui/material'
import React, { useCallback, useState } from 'react'
import NextLink from 'next/link'
import { ColumnFlow, RowFlow } from '@/components/common/Layouts'
import TextInput from '@/components/common/TextInput'
import ErrorMessage from '../common/ErrorMessage'

const LoginForm = () => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [usernameError, setUsernameError] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  // const [_, setToken] = useLoginToken();

  const onSubmit = useCallback(
    (e : any) => {
      e.preventDefault();

      if (!username || !password) {
        setErrors(['You must provide these details.'])
        return;
      }

      setErrors([]);
      setLoading(true);
      
      const user = {
        username: username,
        password: password,
      };

      console.log(user)

      // fetch(`${getBaseURL()}/auth/login/`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(user),
      // })
      //   .then((res) => res.json())
      //   .then((data) => {
      //     console.log('API Data', data)
      //     // if (data.key) {
      //     //   setToken(data.key);
      //     //   window.location.replace("/");
      //     // } else {
      //     //   setLoading(false);
      //     //   setPassword("");
      //     //   setToken(null);
      //     //   setErrors(["Cannot log in with provided credentials"]);
      //     // }
      //   })
      //   .catch(() => {
      //     setLoading(false); // Also set loading to false when there is an error
      //     setErrors(["An error occurred, please try again later"]);
      //   });
    },
    [username, password],
  );

  return (
    <form noValidate onSubmit={onSubmit}>
      <ColumnFlow>
        <Typography variant="h2" component="h1" sx={{ marginBottom: "1rem" }}>
          Login
        </Typography>
        <Box sx={{ marginBottom: "1rem" }}>
          <Typography>Not already registered?</Typography>
          <Button component={NextLink} href="/signup" variant="outlined">
            Sign-up
          </Button>
        </Box>
        {/* <TextInput
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
        /> */}
        <TextField
          margin="normal"
          required
          fullWidth
          id="username"
          label="Username"
          name="username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Password"
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {/* <TextInput
          label="Password"
          type="password"
          value={password}
          setValue={setPassword}
          error={passwordError}
          setError={setPasswordError}
          dirty={dirty}
          required
          noRequiredSymbol
          inputProps={{
            autoComplete: "current-password",
          }}
        /> */}
        <ErrorMessage errors={errors} />
        <RowFlow>
          {/* <Github variant="outlined" setLoading={setLoading} /> */}
          <Button type="submit" sx={{ marginLeft: "auto" }}>
                Log in
              </Button>
        </RowFlow>
      </ColumnFlow>
    </form>
  )
}

export default LoginForm