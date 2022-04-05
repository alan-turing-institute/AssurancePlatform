import { render, screen, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import "@testing-library/jest-dom";
import fetchMock from "jest-fetch-mock";

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
    JSON.stringify({ id: 1, name: "Test case", description: "", goals: [] })
  );
  render(<CaseContainer id="1" />);
  const textElement = screen.getByText("loading");
  expect(textElement).toBeInTheDocument();
});

test("renders case view", async () => {
  fetch.mockResponseOnce(
    JSON.stringify({ id: 1, name: "Test case", description: "", goals: [] })
  );
  render(<CaseContainer id="1" />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("Test case")).toBeInTheDocument()
  );
});
