/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import "@testing-library/jest-dom";
import fetchMock from "jest-fetch-mock";
import { fireEvent } from "@testing-library/react";

import CaseContainer from "../CaseContainer.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

fetchMock.enableMocks();

beforeEach(() => {
  fetch.resetMocks();
});

test("renders loading screen", () => {
  fetch.mockResponseOnce(
    JSON.stringify({ id: 1, name: "Test case", description: "", goals: [] }),
  );
  localStorage.setItem("token", "dummy");
  render(<CaseContainer id="1" />);
  const textElement = screen.getByText("loading");
  expect(textElement).toBeInTheDocument();
});

test("renders case view", async () => {
  fetch.mockResponseOnce(
    JSON.stringify({ id: 1, name: "Test case", description: "", goals: [] }),
  );
  localStorage.setItem("token", "dummy");
  render(<CaseContainer id="1" />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("Test case")).toBeInTheDocument(),
  );
});

test("displays 'Submit' button", () => {
  render(<CaseCreator />);
  const button = screen.getByText("Submit");
  expect(button).toBeInTheDocument();
});

test("displays 'Import' button", () => {
  render(<CaseCreator />);
  const button = screen.getByText("Import");
  expect(button).toBeInTheDocument();
});

test("displays 'Load JSON from URL' button", () => {
  render(<CaseCreator />);
  const button = screen.getByText("Load JSON from URL");
  expect(button).toBeInTheDocument();
});

test("shows dialog when 'Load JSON from URL' button is clicked", () => {
  render(<CaseCreator />);
  const button = screen.getByText("Load JSON from URL");
  fireEvent.click(button);
  const dialogInput = screen.getByPlaceholderText("Enter URL");
  expect(dialogInput).toBeInTheDocument();
});

// Additional test to ensure that the import from file input is present
test("has input for importing case from file", () => {
  render(<CaseCreator />);
  const fileInput = screen.getByLabelText(/Choose a file/i);
  expect(fileInput).toBeInTheDocument();
});
