import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import "regenerator-runtime/runtime";
import React from "react";
import ItemEditor from "../ItemEditor.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        id: 1,
        name: "Test goal",
        short_description: "short",
        long_description: "long",
        keywords: "key",
      }),
  })
);

test("renders item editor layer", async () => {
  render(<ItemEditor type="TopLevelNormativeGoal" id="1" />);
  await waitFor(() =>
    expect(screen.getByDisplayValue("Test goal")).toBeInTheDocument()
  );
});
