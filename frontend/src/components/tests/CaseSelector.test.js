/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import "regenerator-runtime/runtime";
import { fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CaseSelector from "../CaseSelector.js";

const mockedUsedNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockedUsedNavigate,
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve([
        { id: 1, name: "Test case 1" },
        { id: 2, name: "Test case 2" },
      ]),
  }),
);

test("renders selector screen", async () => {
  render(<CaseSelector />);
  await waitFor(() =>
    expect(
      screen.getByPlaceholderText("Select or create a case"),
    ).toBeInTheDocument(),
  );
});

test("loads and displays fetched cases", async () => {
  render(<CaseSelector />);

  await waitFor(() =>
    expect(screen.getByText("Test case 1")).toBeInTheDocument(),
  );
  expect(screen.getByText("Test case 2")).toBeInTheDocument();
});

test("navigates to the correct path when a case is selected", async () => {
  render(<CaseSelector />);

  await waitFor(() =>
    expect(screen.getByText("Test case 1")).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByPlaceholderText("Select or create a case"));
  fireEvent.click(screen.getByText("Test case 1"));

  expect(mockedUsedNavigate).toHaveBeenCalledWith("/case/1");
});

test("contains 'Create new case' option", async () => {
  render(<CaseSelector />);

  await waitFor(() =>
    expect(screen.getByText("Test case 1")).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByPlaceholderText("Select or create a case"));

  expect(screen.getByText("Create new case")).toBeInTheDocument();
});
