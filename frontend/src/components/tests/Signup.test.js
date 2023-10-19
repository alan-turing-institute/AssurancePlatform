/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Signup from "../Signup.js";

test("renders signup component", () => {
  render(<Signup />);
  const userNameField = screen.getByLabelText("User name");
  const passwordField = screen.getByLabelText("Password");
  const confirmPasswordField = screen.getByLabelText("Confirm password");
  expect(userNameField).toBeInTheDocument();
  expect(passwordField).toBeInTheDocument();
  expect(confirmPasswordField).toBeInTheDocument();
});

test("renders signup button", () => {
  render(<Signup />);
  const signupButton = screen.getByRole("button", { name: /sign up/i });
  expect(signupButton).toBeInTheDocument();
});

test("renders password requirements", () => {
  render(<Signup />);
  const passwordInfo = screen.getByText("At least 8 characters");
  expect(passwordInfo).toBeInTheDocument();
});

test("renders error message on failed signup", () => {
  render(<Signup />);
  const errorMessage = screen.getByText(
    "Cannot sign up with provided credentials",
  );
  expect(errorMessage).toBeInTheDocument();
});

// Additional tests can be created based on functionalities like form submission, error handling, etc.
