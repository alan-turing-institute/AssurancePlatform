/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import fetchMock from "jest-fetch-mock";
import React from "react";
import regeneratorRuntime from "regenerator-runtime";
import CaseContainer from "../CaseContainer";

// Mock useParams and useNavigate
const mockNavigate = jest.fn();
const mockParams = jest.fn().mockReturnValue({ caseSlug: "1" });

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"), // if you need other parts of the router besides navigate
  useParams: () => mockParams(),
  useNavigate: () => mockNavigate,
}));

fetchMock.enableMocks();

beforeEach(() => {
  fetch.resetMocks();
  localStorage.clear();
});
test("renders loading screen", async () => {
  // Setup the mock response for the fetch call
  fetch.mockResponseOnce(
    JSON.stringify({
      id: 1,
      name: "Test case",
      description: "",
      goals: [],
      color_profile: "default",
    }),
    { status: 200 },
  ); // Ensure the status is set to 200 to simulate a successful fetch

  localStorage.setItem("token", "dummy");

  const { unmount } = render(<CaseContainer />);

  // Use findByText instead of getByText to wait for the element to appear
  const textElement = await screen.findByText(/loading/i);
  expect(textElement).toBeInTheDocument();

  // Additional debugging logs
  console.log("Loading screen rendered");
  console.log("LocalStorage token:", localStorage.getItem("token"));
  console.log(
    "Mocked fetch calls:",
    fetch.mock.calls.map((call) => ({ url: call[0], options: call[1] })),
  );

  // Unmount the component to cleanup and avoid state update warnings
  unmount();
});

test("renders case view", async () => {
  // Setup the mock responses for all expected fetch calls
  fetch.mockResponses(
    [
      JSON.stringify({
        id: 1,
        name: "Test case",
        description: "",
        goals: [],
        color_profile: "default",
      }),
      { status: 200 },
    ], // Mock response for case data
    [
      JSON.stringify({
        /* user data */
      }),
      { status: 200 },
    ], // Mock response for user data
    [
      JSON.stringify([
        /* comments data */
      ]),
      { status: 200 },
    ], // Mock response for comments
  );

  localStorage.setItem("token", "dummy");

  const { unmount } = render(<CaseContainer />);

  // Use findBy* queries instead of getBy* to wait for element to appear
  const textElement = await screen.findByDisplayValue("Test case");
  expect(textElement).toBeInTheDocument();

  // Additional debugging logs
  console.log(
    "Mocked fetch calls:",
    fetch.mock.calls.map((call) => ({ url: call[0], options: call[1] })),
  );

  // Unmount the component to cleanup and avoid state update warnings
  unmount();
});
