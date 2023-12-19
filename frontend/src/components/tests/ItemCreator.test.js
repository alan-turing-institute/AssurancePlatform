/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ItemCreator from "../ItemCreator.js";

test("renders item creator layer", () => {
  render(<ItemCreator type="TopLevelNormativeGoal" />);
  const textElement = screen.getByText("Create a new TopLevelNormativeGoal");
  expect(textElement).toBeInTheDocument();
});

test("renders input fields correctly", () => {
  render(<ItemCreator type="TopLevelNormativeGoal" />);
  const sdescInput = screen.getByPlaceholderText("Short description");
  const ldescInput = screen.getByPlaceholderText("Long description");
  const keywordsInput = screen.getByPlaceholderText(
    "Keywords (comma-separated)",
  );

  expect(sdescInput).toBeInTheDocument();
  expect(ldescInput).toBeInTheDocument();
  expect(keywordsInput).toBeInTheDocument();
});

test("updates input fields on change", () => {
  render(<ItemCreator type="TopLevelNormativeGoal" />);
  const sdescInput = screen.getByPlaceholderText("Short description");

  fireEvent.change(sdescInput, {
    target: { value: "Updated short description" },
  });

  expect(sdescInput.value).toBe("Updated short description");
});

test("renders Evidence specific property", () => {
  render(<ItemCreator type="Evidence" />);
  const urlInput = screen.getByPlaceholderText("www.some-evidence.com");
  fireEvent.change(urlInput, { target: { value: "https://updated.url" } });
  expect(urlInput.value).toBe("https://updated.url");
});

test("renders submit button", () => {
  render(<ItemCreator type="TopLevelNormativeGoal" />);
  const submitButton = screen.getByText("Submit");
  expect(submitButton).toBeInTheDocument();
});
