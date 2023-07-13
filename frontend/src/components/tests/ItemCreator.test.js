/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ItemCreator from "../ItemCreator.js";

test("renders item creator layer", () => {
  render(<ItemCreator type="TopLevelNormativeGoal" />);
  const textElement = screen.getByText("Create a new TopLevelNormativeGoal");
  expect(textElement).toBeInTheDocument();
});
