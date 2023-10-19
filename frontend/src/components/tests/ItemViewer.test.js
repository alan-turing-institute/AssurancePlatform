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

test("renders item viewer layer", async () => {
  await act(async () => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  });
  expect(screen.getByText("Name")).toBeInTheDocument();
});

test("renders item properties correctly", async () => {
  await act(async () => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  });

  const goalText = await screen.findByText("Test goal 1");
  expect(goalText).toBeInTheDocument();

  const shortDescText = await screen.findByText("Test short");
  expect(shortDescText).toBeInTheDocument();

  const longDescText = await screen.findByText("Test long");
  expect(longDescText).toBeInTheDocument();

  const keywordText = await screen.findByText("Test keywords");
  expect(keywordText).toBeInTheDocument();
});

test("renders PropertyClaim specific property", async () => {
  await act(async () => {
    render(<ItemViewer type="PropertyClaim" id="1" />);
  });

  const claimTypeText = await screen.findByText("PropertyClaim test type");
  expect(claimTypeText).toBeInTheDocument();
});

test("renders Evidence specific property", async () => {
  await act(async () => {
    render(<ItemViewer type="Evidence" id="1" />);
  });

  const urlText = await screen.findByText("https://test.url");
  expect(urlText).toBeInTheDocument();
});

test("renders edit button in edit mode", async () => {
  await act(async () => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" editMode={true} />);
  });

  const editButton = screen.getByText("Edit");
  expect(editButton).toBeInTheDocument();
});
