import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "regenerator-runtime/runtime";
import React from "react";
import { Link } from "react-router-dom";
import ItemViewer from "../ItemViewer.js";
import "@testing-library/jest-dom";

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

test("renders item viewer layer", async () => {
  render(<ItemViewer type="TopLevelNormativeGoal" id="1" />);
  //  await waitFor(() => expect(screen.findByText("Loading")).toBeInTheDocument());
});
