/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ParentSelector from "../ParentSelector.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve([
        {
          id: 1,
          name: "Context 1",
        },
      ]),
  }),
);

test("renders parent selector layer", () => {
  localStorage.setItem("token", "dummy");
  render(<ParentSelector type="Evidence" />);
  const dropdown = screen.getByPlaceholderText("Choose a parent");
  expect(dropdown).toBeInTheDocument();
});
