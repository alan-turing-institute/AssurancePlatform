import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import CreateGroup from "../CreateGroup.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders group creator layer", () => {
  localStorage.setItem("token", "dummy");
  render(<CreateGroup />);
  const button = screen.getByText("Create group");
  expect(button).toBeInTheDocument();
});
