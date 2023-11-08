/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import "@testing-library/jest-dom";
import fetchMock from "jest-fetch-mock";

import CaseContainer from "../CaseContainer.js";

const mockedUsedNavigate = jest.fn();
const mockedUseParams = jest.fn().mockReturnValue({ caseSlug: "1" });

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
  useParams: () => mockedUseParams,
}));

fetchMock.enableMocks();
jest.mock("mermaid");

beforeEach(() => {
  fetch.resetMocks();
  localStorage.clear();
});

test("renders loading screen", () => {
  fetch.mockResponseOnce(
    JSON.stringify({
      id: 1,
      name: "Test case",
      description: "",
      goals: [],
      color_profile: "default",
    }),
  );
  localStorage.setItem("token", "dummy");
  render(<CaseContainer />);
  const textElement = screen.getByText("loading");
  expect(textElement).toBeInTheDocument();
});

// test("loads and displays assurance case data", async () => {
//   fetch.mockResponseOnce(JSON.stringify({
//     id: 1,
//     name: "Loaded Case",
//     description: "A test case",
//     goals: [],
//     color_profile: "default",
//   }));
//   localStorage.setItem("token", "dummy");
//   render(<CaseContainer />);
//   const nameElement = await screen.findByText("Loaded Case");
//   expect(nameElement).toBeInTheDocument();
// });

// test("changes profile and updates view", async () => {
//   fetch.mockResponses(
//     [JSON.stringify({ id: 1, name: "Loaded Case", description: "A test case", goals: [], color_profile: "default" }), { status: 200 }],
//     [JSON.stringify({}), { status: 200 }] // Mocking the response for profile change
//   );
//   localStorage.setItem("token", "dummy");
//   const { getByLabelText } = render(<CaseContainer />);
//   fireEvent.change(getByLabelText(/Select Case color profile/i), { target: { value: 'dark' } });
//   await waitFor(() => {
//     expect(fetch).toHaveBeenCalledTimes(2);
//   });
// });

// test("exports current case as JSON", async () => {
//   fetch.mockResponseOnce(JSON.stringify({
//     id: 1,
//     name: "Case to Export",
//     description: "",
//     goals: [],
//     color_profile: "default",
//   }));
//   localStorage.setItem("token", "dummy");
//   global.URL.createObjectURL = jest.fn();
//   const { getByLabelText } = render(<CaseContainer />);
//   fireEvent.click(getByLabelText(/Export JSON/i));
//   await waitFor(() => {
//     expect(global.URL.createObjectURL).toHaveBeenCalled();
//   });
// });

// test("shows edit layer when in edit mode", async () => {
//   fetch.mockResponseOnce(JSON.stringify({
//     id: 1,
//     name: "Case to Edit",
//     description: "",
//     goals: [],
//     color_profile: "default",
//     lock_uuid: "uuid-of-the-user",
//   }));
//   localStorage.setItem("token", "dummy");
//   localStorage.setItem("session_id", "uuid-of-the-user");
//   const { getByText } = render(<CaseContainer />);
//   fireEvent.click(getByText(/Edit/i));
//   await waitFor(() => {
//     const editLayer = screen.getByText(/Save/i);
//     expect(editLayer).toBeInTheDocument();
//   });
// });

// test("deletes a case and navigates to home", async () => {
//   fetch.mockResponses(
//     [JSON.stringify({}), { status: 200 }], // Mocking the delete response
//     [JSON.stringify({}), { status: 204 }]  // Mocking the navigate response
//   );
//   localStorage.setItem("token", "dummy");
//   const { getByText } = render(<CaseContainer />);
//   fireEvent.click(getByText(/Delete case/i));
//   fireEvent.click(getByText(/Yes/i));
//   await waitFor(() => {
//     expect(mockedUsedNavigate).toHaveBeenCalledWith("/");
//   });
// });
