/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import "regenerator-runtime/runtime";
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
