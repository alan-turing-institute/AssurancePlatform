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
  const mockResponse = JSON.stringify({
    id: 1,
    name: "Test case",
    description: "",
    goals: [],
    color_profile: "default",
  });
  fetch.mockResponseOnce(mockResponse, { status: 200 });

  localStorage.setItem("token", "dummy");
  const { unmount } = render(<CaseContainer />);

  await screen.findByText(/loading/i);

  console.log("LocalStorage token:", localStorage.getItem("token"));
  console.log(
    "Mocked fetch calls:",
    fetch.mock.calls.map((call) => ({ url: call[0], options: call[1] })),
  );
  console.log("JSON data returned:", mockResponse); // Log the mock response directly

  unmount();
});

test("renders case view", async () => {
  // Setup the mock responses for all expected fetch calls
  const mockCaseData = JSON.stringify({
    id: 1,
    name: "Test case",
    description: "",
    goals: [],
    color_profile: "default",
  });
  const mockUserData = JSON.stringify({
    /* user data */
  });
  const mockCommentsData = JSON.stringify([
    /* comments data */
  ]);

  fetch.mockResponses(
    [mockCaseData, { status: 200 }],
    [mockUserData, { status: 200 }],
    [mockCommentsData, { status: 200 }],
  );

  localStorage.setItem("token", "dummy");
  const { unmount } = render(<CaseContainer />);

  await screen.findByDisplayValue("Test case");

  console.log(
    "Mocked fetch calls:",
    fetch.mock.calls.map((call) => ({ url: call[0], options: call[1] })),
  );
  console.log("JSON mockCaseData:", mockCaseData); // Log the mock response directly
  console.log("JSON mockUserData:", mockUserData); // Log the mock response directly
  console.log("JSON mockCommentsData:", mockCommentsData); // Log the mock response directly

  unmount();
});
