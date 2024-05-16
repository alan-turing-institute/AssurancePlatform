/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";
import Login from "../Login.js";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import "regenerator-runtime/runtime";

function WrappedLogin() {
  return (
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

// Mock fetch and localStorage methods
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        key: 1, // any truthy value
      }),
  }),
);

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders login component and checks elements", () => {
  render(<WrappedLogin />);

  // Check for registration text
  const registrationText = screen.getByText("Not already registered?");
  expect(registrationText).toBeInTheDocument();

  // Check for login heading
  const loginHeading = screen.getByText("Login");
  expect(loginHeading).toBeInTheDocument();

  // Check for input fields
  const usernameInput = screen.getByLabelText("Username");
  expect(usernameInput).toBeInTheDocument();

  const passwordInput = screen.getByLabelText("Password");
  expect(passwordInput).toBeInTheDocument();

  // Check for login button
  const loginButton = screen.getByRole("button", { name: /log in/i });
  expect(loginButton).toBeInTheDocument();

  // Check for signup button
  const signupButton = screen.getByText("Sign-up");
  expect(signupButton).toBeInTheDocument();
});

test("inputs are changeable", () => {
  render(<WrappedLogin />);

  const usernameInput = screen.getByLabelText("Username");
  const passwordInput = screen.getByLabelText("Password");

  fireEvent.change(usernameInput, { target: { value: "testuser" } });
  fireEvent.change(passwordInput, { target: { value: "testpassword" } });

  expect(usernameInput.value).toBe("testuser");
  expect(passwordInput.value).toBe("testpassword");
});

test("on form submit, fetch is called", () => {
  global.localStorage.getItem = jest.fn(() => undefined);
  render(<WrappedLogin />);

  const usernameInput = screen.getByLabelText("Username");
  const passwordInput = screen.getByLabelText("Password");
  const loginButton = screen.getByRole("button", { name: /log in/i });

  userEvent.type(usernameInput, "testuser");
  userEvent.type(passwordInput, "testpassword");

  userEvent.click(loginButton);

  expect(fetch).toHaveBeenCalled();
});

test("renders error message on failed login", async () => {
  global.localStorage.getItem = jest.fn(() => undefined);
  render(<WrappedLogin />);

  // Mock the fetch call to return an error
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () =>
        Promise.resolve({
          key: 0, // any falsey value
        }),
      status: 400, // typically, errors like these would return a 400 status
    }),
  );

  const usernameInput = screen.getByLabelText("Username");
  const passwordInput = screen.getByLabelText("Password");
  const loginButton = screen.getByRole("button", { name: /log in/i });

  userEvent.type(usernameInput, "testuser");
  userEvent.type(passwordInput, "testpassword");

  userEvent.click(loginButton);

  // Since network requests are asynchronous, we need to wait for the error message to appear
  const errorMessage = await screen.findByText(
    "Cannot log in with provided credentials",
  );
  expect(errorMessage).toBeInTheDocument();
});

test("when user is already logged in, page redirects", () => {
  global.localStorage.getItem = jest.fn(() => "test_token");
  render(<WrappedLogin />);
});
