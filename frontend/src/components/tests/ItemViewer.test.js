/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "regenerator-runtime/runtime";
import { act } from "react-dom/test-utils";
import React from "react";
import "@testing-library/jest-dom";
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
      }),
  })
);

test("renders item viewer layer", () => {
  act(() => {
    render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  });
  expect(screen.getByText("Name")).toBeInTheDocument();
});
