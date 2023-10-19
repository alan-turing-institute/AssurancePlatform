/**
 * @jest-environment jsdom
 */
import "regenerator-runtime/runtime";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ParentSelector from "../ParentSelector.js";

global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve([
        {
          id: 1,
          name: "PropertyClaim 1",
        },
        {
          id: 2,
          name: "PropertyClaim 2",
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

test("renders dropdown with 'Choose a potential parent' placeholder for potential prop", () => {
  render(<ParentSelector type="Evidence" potential={true} />);
  const dropdown = screen.getByPlaceholderText("Choose a potential parent");
  expect(dropdown).toBeInTheDocument();
});

test("renders options based on API response", async () => {
  render(<ParentSelector type="Evidence" />);
  const dropdown = screen.getByPlaceholderText("Choose a parent");
  fireEvent.click(dropdown);

  const option1 = await screen.findByText("PropertyClaim 1");
  const option2 = await screen.findByText("PropertyClaim 2");
  expect(option1).toBeInTheDocument();
  expect(option2).toBeInTheDocument();
});

test("onChange updates selected value correctly", () => {
  const setValueMock = jest.fn();
  render(<ParentSelector type="Evidence" setValue={setValueMock} />);
  const dropdown = screen.getByPlaceholderText("Choose a parent");
  fireEvent.click(dropdown);

  const option = screen.getByText("PropertyClaim 1");
  fireEvent.click(option);

  expect(setValueMock).toHaveBeenCalledWith({ id: 1, name: "PropertyClaim 1" });
});
