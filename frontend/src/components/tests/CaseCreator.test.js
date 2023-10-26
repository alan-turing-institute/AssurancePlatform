/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import CaseCreator from "../CaseCreator.js";

const mockedUseNavigate = jest.fn();
const mockedUseLocation = jest.fn().mockReturnValue({ state: {} }); // return an object with the state property

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUseNavigate,
  useLocation: () => mockedUseLocation,
}));

test("renders case creator layer", () => {
  localStorage.setItem("token", "dummy");
  render(<CaseCreator />);
  const textElement = screen.getByText("Create a new assurance case");
  expect(textElement).toBeInTheDocument();
});
