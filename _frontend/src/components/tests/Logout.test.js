/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Logout from "../Logout.js";
import { MemoryRouter } from "react-router-dom";

delete window.location;
window.location = { assign: jest.fn(), replace: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
});

function WrappedLogout() {
  return (
    <MemoryRouter>
      <Logout />
    </MemoryRouter>
  );
}

test("renders logout component", () => {
  render(<WrappedLogout />);
  const text = screen.getByText("Are you sure you want to log out?");
  const button = screen.getByRole("button", { name: /confirm logout/i });
  expect(text).toBeInTheDocument();
  expect(button).toBeInTheDocument();
});
