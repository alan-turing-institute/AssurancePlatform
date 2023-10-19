/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "regenerator-runtime/runtime";
import { act } from "react-dom/test-utils";
import React from "react";
import ItemViewer from "../ItemViewer.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        id: 1,
        name: "Test goal 1",
        short_description: "Test short",
        long_description: "Test long",
        keywords: "Test keywords",
        claim_type: "PropertyClaim test type",
        URL: "https://test.url",
      }),
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders item viewer layer", () => {
  act(() => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  });
  expect(screen.getByText("Name")).toBeInTheDocument();
});

test("renders item properties correctly", async () => {
  act(() => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  });

  await waitFor(() => {
    expect(screen.getByText("Test goal 1")).toBeInTheDocument();
    expect(screen.getByText("Test short")).toBeInTheDocument();
    expect(screen.getByText("Test long")).toBeInTheDocument();
    expect(screen.getByText("Test keywords")).toBeInTheDocument();
  });
});

test("renders PropertyClaim specific property", () => {
  act(() => {
    render(<ItemViewer type="PropertyClaim" id="1" />);
  });

  expect(screen.getByText("Claim type")).toBeInTheDocument();
  expect(screen.getByText("PropertyClaim test type")).toBeInTheDocument();
});

test("renders Evidence specific property", () => {
  act(() => {
    render(<ItemViewer type="Evidence" id="1" />);
  });

  expect(screen.getByText("URL")).toBeInTheDocument();
  expect(screen.getByText("https://test.url")).toBeInTheDocument();
});

test("renders edit button in edit mode", () => {
  act(() => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" editMode={true} />);
  });

  const editButton = screen.getByText("Edit");
  expect(editButton).toBeInTheDocument();
});
