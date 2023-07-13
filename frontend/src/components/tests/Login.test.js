/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Login from "../Login.js";

test("renders login component", () => {
  render(<Login />);
  const text = screen.getByText("Not already registered?");
  expect(text).toBeInTheDocument();
});
