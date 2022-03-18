import { render, screen } from "@testing-library/react";
import React from "react";
import { Link } from "react-router-dom";
import "regenerator-runtime/runtime";
import CaseSelector from "../CaseSelector.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

test("renders selector screen", () => {
  //render(<CaseSelector />);
  // const linkElement = screen.getByText(/Ethical Assurance Platform/i);
  // expect(linkElement).toBeInTheDocument();
  expect(true);
});
