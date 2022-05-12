import React, { useState, useEffect } from "react";
import { getBaseURL } from "./utils.js";

const Login = () => {
  const [email, setEmail] = useState("");
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
      email: email,
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
          setEmail("");
          setPassword("");
          localStorage.clear();
          setErrors(true);
        }
      });
  };
  return (
    <div>
      {loading === false && <h1>Login</h1>}
      {errors === true && <h2>Cannot log in with provided credentials</h2>}
      {loading === false && (
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email address:</label> <br />
          <input
            name="email"
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
          />{" "}
          <br />
          <label htmlFor="password">Password:</label> <br />
          <input
            name="password"
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />{" "}
          <br />
          <input type="submit" value="Login" />
        </form>
      )}
    </div>
  );
};

export default Login;
