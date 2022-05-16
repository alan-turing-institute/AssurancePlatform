import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import CaseCreator from "../CaseCreator.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders case creator layer", () => {
  localStorage.setItem("token", "dummy");
  render(<CaseCreator />);
  const textElement = screen.getByText("Create a new assurance case");
  expect(textElement).toBeInTheDocument();
});
