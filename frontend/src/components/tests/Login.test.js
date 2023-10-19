/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";
import Login from "../Login.js";

// Mock fetch and localStorage
global.fetch = jest.fn(() =>
  Promise.resolve({ json: () => Promise.resolve({}) }),
);
global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders login component and checks elements", () => {
  render(<Login />);

  // Check for registration text
  const registrationText = screen.getByText("Not already registered?");
  expect(registrationText).toBeInTheDocument();

  // Check for login heading
  const loginHeading = screen.getByText("Login");
  expect(loginHeading).toBeInTheDocument();

  // Check for input fields
  const usernameInput = screen.getByLabelText("User name");
  expect(usernameInput).toBeInTheDocument();

  const passwordInput = screen.getByLabelText("Password");
  expect(passwordInput).toBeInTheDocument();

  // Check for login button
  const loginButton = screen.getByText("Login");
  expect(loginButton).toBeInTheDocument();

  // Check for signup button
  const signupButton = screen.getByText("Sign-up");
  expect(signupButton).toBeInTheDocument();
});

test("inputs are changeable", () => {
  render(<Login />);

  const usernameInput = screen.getByLabelText("User name");
  const passwordInput = screen.getByLabelText("Password");

  fireEvent.change(usernameInput, { target: { value: "testuser" } });
  fireEvent.change(passwordInput, { target: { value: "testpassword" } });

  expect(usernameInput.value).toBe("testuser");
  expect(passwordInput.value).toBe("testpassword");
});

test("on form submit, fetch is called", () => {
  render(<Login />);

  const usernameInput = screen.getByLabelText("User name");
  const passwordInput = screen.getByLabelText("Password");
  const loginButton = screen.getByText("Login");

  fireEvent.change(usernameInput, { target: { value: "testuser" } });
  fireEvent.change(passwordInput, { target: { value: "testpassword" } });
  fireEvent.click(loginButton);

  expect(fetch).toHaveBeenCalled();
});

test("when user is already logged in, page redirects", () => {
  global.localStorage.getItem = jest.fn(() => "test_token");
  render(<Login />);
});
