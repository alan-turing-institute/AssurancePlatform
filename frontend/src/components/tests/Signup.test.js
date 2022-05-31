import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Signup from "../Signup.js";

test("renders signup component", () => {
  render(<Signup />);
  const text = screen.getByText("At least 8 characters");
  expect(text).toBeInTheDocument();
});
