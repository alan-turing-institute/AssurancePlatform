/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Signup from "../Signup.js";
import userEvent from "@testing-library/user-event";

test("renders signup component", () => {
  render(<Signup />);
  const userNameField = screen.getByLabelText("Username");
  const passwordField = screen.getByLabelText("Password");
  const confirmPasswordField = screen.getByLabelText("Confirm Password");
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

test("renders error message on failed signup", async () => {
  // Mock the fetch call to return an error
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          username: ["This username is already taken."],
          // ... add other errors as necessary
        }),
      status: 400, // typically, errors like these would return a 400 status
    }),
  );

  render(<Signup />);

  const userNameField = screen.getByLabelText("Username");
  const passwordField = screen.getByLabelText("Password");
  const confirmPasswordField = screen.getByLabelText("Confirm Password");
  const submitButton = screen.getByText("Sign up");
  
  userEvent.type(userNameField, "testuser");
  userEvent.type(passwordField, "testpassword");
  userEvent.type(confirmPasswordField, "testpassword");
  userEvent.click(submitButton);

  // Since network requests are asynchronous, we need to wait for the error message to appear
  const errorMessage = await screen.findByText(
    "This username is already taken.",
  );
  expect(errorMessage).toBeInTheDocument();
});
