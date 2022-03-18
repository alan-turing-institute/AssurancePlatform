import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { Link } from "react-router-dom";
import CaseCreator from "../CaseCreator.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders case creator layer", () => {
  render(<CaseCreator />);
  const textElement = screen.getByText(/Create a new assurance case/i);
  expect(textElement).toBeInTheDocument();
  expect(true);
});
