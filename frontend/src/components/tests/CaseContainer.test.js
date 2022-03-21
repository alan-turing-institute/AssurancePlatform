import { render, screen, waitFor } from "@testing-library/react";
import "regenerator-runtime/runtime";
import React from "react";
import { Link } from "react-router-dom";
import CaseContainer from "../CaseContainer.js";
import "@testing-library/jest-dom";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({ id: 1, name: "Test case", description: "", goals: [] }),
  })
);

test("renders loading screen", () => {
  render(<CaseContainer id="1" />);
  const textElement = screen.getByText("loading");
  expect(textElement).toBeInTheDocument();
});

test("renders case view", async () => {
  render(<CaseContainer id="1" />);
  await waitFor(() =>
    expect(screen.getByText("Test case")).toBeInTheDocument()
  );
});
